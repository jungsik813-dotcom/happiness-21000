import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { insertTransaction } from "@/lib/transactions";
import { getAdminTokenFromRequest, verifyAdminToken } from "@/lib/admin-auth";
import {
  getWeeklyIssuanceCap,
  OPERATING_WEEKS,
  TOTAL_SUPPLY
} from "@/lib/issuance-schedule";
import { WEALTH_TAX_RATE } from "@/lib/constants";
import { splitGoalFunding } from "@/lib/goal-funding";

const WEALTH_TAX_PERCENT_LABEL = `${Math.round(WEALTH_TAX_RATE * 100)}%`;

type ProfileRow = { id: string; name: string | null; balance: number | null };
type VaultRow = {
  id: string;
  central_balance: number | null;
  issuance_total: number | null;
  issuance_count: number | null;
};
type GoalRow = { id: string; name: string; current_amount: number; target_amount: number };

export async function POST(request: Request) {
  const token = getAdminTokenFromRequest(request);
  if (!verifyAdminToken(token)) {
    return NextResponse.json(
      { ok: false, message: "관리자 비밀번호가 필요합니다." },
      { status: 401 }
    );
  }

  try {
  const supabase = await createSupabaseServerClient();

  const [profilesRes, vaultRes, activeGoalRes] = await Promise.all([
    supabase.from("profiles").select("id, name, balance").order("name"),
    supabase.from("vault").select("id, central_balance, issuance_total, issuance_count").limit(1).single<VaultRow>(),
    supabase.from("goals").select("id, name, current_amount, target_amount").eq("is_active", true).limit(1).maybeSingle<GoalRow>()
  ]);

  if (profilesRes.error || !profilesRes.data) {
    return NextResponse.json(
      { ok: false, message: `학생 데이터 오류: ${profilesRes.error?.message ?? "알 수 없음"}` },
      { status: 500 }
    );
  }

  const profiles = profilesRes.data as ProfileRow[];
  let vault: VaultRow;
  let issuanceTotal = 0;
  let issuanceCount = 0;

  if (vaultRes.error || !vaultRes.data) {
    const fallback = await supabase.from("vault").select("id, central_balance").limit(1).single<{ id: string; central_balance: number | null }>();
    if (fallback.error || !fallback.data) {
      return NextResponse.json(
        { ok: false, message: `중앙 금고 오류: ${vaultRes.error?.message ?? "vault 테이블 또는 issuance_total, issuance_count 컬럼을 확인하세요. Supabase에서 마이그레이션 SQL을 실행했나요?"}` },
        { status: 500 }
      );
    }
    vault = { ...fallback.data, issuance_total: 0, issuance_count: 0 };
  } else {
    vault = vaultRes.data;
    issuanceTotal = Number(vault.issuance_total ?? 0);
    issuanceCount = Number(vault.issuance_count ?? 0);
  }
  let vaultBalance = vault.central_balance ?? 0;
  const activeGoal = activeGoalRes.data;

  if (profiles.length === 0) {
    return NextResponse.json(
      { ok: false, message: "등록된 학생이 없어 주간 실행을 할 수 없습니다." },
      { status: 400 }
    );
  }

  const remainingSupply = TOTAL_SUPPLY - issuanceTotal;
  if (remainingSupply <= 0) {
    return NextResponse.json(
      { ok: false, message: "총 발행 한도(21,000 클로버)를 모두 사용했습니다. 더 이상 클로버 씨앗 보상을 지급할 수 없습니다." },
      { status: 400 }
    );
  }

  if (issuanceCount >= OPERATING_WEEKS) {
    return NextResponse.json(
      {
        ok: false,
        message: `운영 기간(${OPERATING_WEEKS}주)이 종료되어 더 이상 주간 발행을 할 수 없습니다.`
      },
      { status: 400 }
    );
  }

  const nextWeek = issuanceCount + 1;
  const weeklyIssuanceCap = getWeeklyIssuanceCap(nextWeek);

  // 1단계: 보유세 징수 → 활성 펀딩 목표 또는 중앙 금고
  let totalTax = 0;
  const taxDestination = activeGoal ?? null;

  for (const profile of profiles) {
    const balance = profile.balance ?? 0;
    const tax = Math.floor(balance * WEALTH_TAX_RATE);
    if (tax <= 0) continue;

    const newBalance = balance - tax;
    const updateRes = await supabase
      .from("profiles")
      .update({ balance: newBalance })
      .eq("id", profile.id);

    if (updateRes.error) {
      return NextResponse.json(
        { ok: false, message: `세금 징수 실패 (${profile.name}): ${updateRes.error.message}` },
        { status: 500 }
      );
    }

    totalTax += tax;

    const txResult = await insertTransaction(supabase, {
      txType: "tax",
      amount: tax,
      fromProfileId: profile.id,
      toProfileId: null,
      toGoalId: taxDestination?.id ?? null,
      memo: `${profile.name ?? "이름 없음"} 보유세 ${WEALTH_TAX_PERCENT_LABEL}`
    });

    if (!txResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "세금 거래 기록 저장에 실패했습니다. transactions 테이블/RLS를 확인해주세요."
        },
        { status: 500 }
      );
    }
  }

  if (totalTax > 0 && taxDestination) {
    const goalFresh = await supabase
      .from("goals")
      .select("id, name, current_amount, target_amount")
      .eq("id", taxDestination.id)
      .single<GoalRow>();

    if (goalFresh.error || !goalFresh.data) {
      return NextResponse.json(
        {
          ok: false,
          message: `활성 펀딩 목표를 다시 읽지 못했습니다: ${goalFresh.error?.message ?? ""}`
        },
        { status: 500 }
      );
    }

    const g = goalFresh.data;
    const current = g.current_amount ?? 0;
    const target = g.target_amount ?? 0;
    const split = splitGoalFunding(current, target, totalTax);

    if (split.needsStaleCompletion) {
      if (current > 0) {
        await insertTransaction(supabase, {
          txType: "burn",
          amount: current,
          fromProfileId: null,
          toProfileId: null,
          toGoalId: g.id,
          memo: `소각: ${g.name} 펀딩 완료(정리·세금)`
        });
      }
      const staleClose = await supabase
        .from("goals")
        .update({ is_active: false, current_amount: 0 })
        .eq("id", g.id);
      if (staleClose.error) {
        return NextResponse.json(
          { ok: false, message: `펀딩 목표 정리 실패: ${staleClose.error.message}` },
          { status: 500 }
        );
      }
    } else if (split.toGoal > 0) {
      if (split.goalReached) {
        const goalClose = await supabase
          .from("goals")
          .update({ is_active: false, current_amount: 0 })
          .eq("id", g.id);
        if (goalClose.error) {
          return NextResponse.json(
            { ok: false, message: `펀딩 목표 적립 실패: ${goalClose.error.message}` },
            { status: 500 }
          );
        }
        await insertTransaction(supabase, {
          txType: "burn",
          amount: split.newGoalTotal,
          fromProfileId: null,
          toProfileId: null,
          toGoalId: g.id,
          memo: `소각: ${g.name} 펀딩 완료`
        });
      } else {
        const goalUpdate = await supabase
          .from("goals")
          .update({ current_amount: split.newGoalTotal })
          .eq("id", g.id);
        if (goalUpdate.error) {
          return NextResponse.json(
            { ok: false, message: `펀딩 목표 적립 실패: ${goalUpdate.error.message}. goals 테이블이 있나요?` },
            { status: 500 }
          );
        }
      }
    }

    if (split.toVault > 0) {
      vaultBalance += split.toVault;
      const vaultOv = await supabase
        .from("vault")
        .update({ central_balance: vaultBalance })
        .eq("id", vault.id);
      if (vaultOv.error) {
        return NextResponse.json(
          { ok: false, message: "세금 초과분을 중앙 금고에 넣는 데 실패했습니다." },
          { status: 500 }
        );
      }
      await insertTransaction(supabase, {
        txType: "funding_overflow",
        amount: split.toVault,
        fromProfileId: null,
        toProfileId: null,
        toGoalId: null,
        memo: `세금 → 펀딩 초과분 중앙 금고 (${g.name})`
      });
    }

    if (split.toGoal > 0) {
      const txDeposit = await insertTransaction(supabase, {
        txType: "tax_deposit",
        amount: split.toGoal,
        fromProfileId: null,
        toProfileId: null,
        toGoalId: g.id,
        memo: "세금 징수 → 펀딩 목표 적립"
      });
      if (!txDeposit.ok) {
        return NextResponse.json(
          { ok: false, message: "세금 적립 거래 기록 저장에 실패했습니다." },
          { status: 500 }
        );
      }
    }
  } else if (totalTax > 0 && !taxDestination) {
    // 활성 펀딩 목표 없음 → 중앙 금고
    const vaultUpdate = await supabase
      .from("vault")
      .update({ central_balance: vaultBalance + totalTax })
      .eq("id", vault.id);

    if (vaultUpdate.error) {
      return NextResponse.json(
        { ok: false, message: "세금을 중앙 금고에 적립하는 데 실패했습니다." },
        { status: 500 }
      );
    }

    const txDeposit = await insertTransaction(supabase, {
      txType: "tax_deposit",
      amount: totalTax,
      fromProfileId: null,
      toProfileId: null,
      memo: "세금 징수 → 중앙 금고 (활성 펀딩 목표 없음)"
    });
    if (!txDeposit.ok) {
      return NextResponse.json(
        { ok: false, message: "세금 적립 거래 기록 저장에 실패했습니다." },
        { status: 500 }
      );
    }
    vaultBalance += totalTax;
  }

  // 2단계: 클로버 씨앗 보상 균등 분배 (계단식 주간 한도)
  const miningAmount = Math.min(weeklyIssuanceCap, remainingSupply);
  if (miningAmount <= 0) {
    return NextResponse.json({
      ok: true,
      message: `보유세(${WEALTH_TAX_PERCENT_LABEL}) 징수 완료 (총 ${totalTax}클로버). 클로버 씨앗 한도 소진으로 보상 지급 없음.`
    });
  }

  const perStudent = Math.floor(miningAmount / profiles.length);
  const remainder = miningAmount - perStudent * profiles.length;

  const afterTaxRes = await supabase
    .from("profiles")
    .select("id, balance")
    .in("id", profiles.map((p) => p.id));
  const afterTaxMap = new Map(
    ((afterTaxRes.data as { id: string; balance: number | null }[]) ?? []).map((r) => [r.id, r.balance ?? 0])
  );

  for (const profile of profiles) {
    const current = afterTaxMap.get(profile.id) ?? 0;
    const updateRes = await supabase
      .from("profiles")
      .update({ balance: current + perStudent })
      .eq("id", profile.id);

    if (updateRes.error) {
      return NextResponse.json(
        { ok: false, message: `클로버 씨앗 보상 지급 실패 (${profile.name}): ${updateRes.error.message}` },
        { status: 500 }
      );
    }

    const txResult = await insertTransaction(supabase, {
      txType: "mining",
      amount: perStudent,
      fromProfileId: null,
      toProfileId: profile.id,
      memo: `클로버 씨앗 보상 ${issuanceCount + 1}회차`
    });
    if (!txResult.ok) {
      return NextResponse.json(
        { ok: false, message: "클로버 씨앗 거래 기록 저장에 실패했습니다." },
        { status: 500 }
      );
    }
  }

  // 나머지 → 활성 펀딩(목표 초과분은 금고) 또는 중앙 금고
  if (remainder > 0) {
    const activeNow = await supabase
      .from("goals")
      .select("id, name, current_amount, target_amount")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle<GoalRow>();

    if (activeNow.data) {
      const g = activeNow.data;
      const current = g.current_amount ?? 0;
      const target = g.target_amount ?? 0;
      const split = splitGoalFunding(current, target, remainder);

      if (split.needsStaleCompletion) {
        if (current > 0) {
          await insertTransaction(supabase, {
            txType: "burn",
            amount: current,
            fromProfileId: null,
            toProfileId: null,
            toGoalId: g.id,
            memo: `소각: ${g.name} 펀딩 완료(정리·씨앗 나머지)`
          });
        }
        const staleClose = await supabase
          .from("goals")
          .update({ is_active: false, current_amount: 0 })
          .eq("id", g.id);
        if (staleClose.error) {
          return NextResponse.json(
            { ok: false, message: `펀딩 목표 정리 실패: ${staleClose.error.message}` },
            { status: 500 }
          );
        }
      } else if (split.toGoal > 0) {
        if (split.goalReached) {
          const goalClose = await supabase
            .from("goals")
            .update({ is_active: false, current_amount: 0 })
            .eq("id", g.id);
          if (goalClose.error) {
            return NextResponse.json(
              { ok: false, message: `펀딩 목표 적립 실패: ${goalClose.error.message}` },
              { status: 500 }
            );
          }
          await insertTransaction(supabase, {
            txType: "burn",
            amount: split.newGoalTotal,
            fromProfileId: null,
            toProfileId: null,
            toGoalId: g.id,
            memo: `소각: ${g.name} 펀딩 완료`
          });
        } else {
          const goalUpdate = await supabase
            .from("goals")
            .update({ current_amount: split.newGoalTotal })
            .eq("id", g.id);
          if (goalUpdate.error) {
            return NextResponse.json(
              { ok: false, message: `펀딩 목표 적립 실패: ${goalUpdate.error.message}` },
              { status: 500 }
            );
          }
        }
      }

      if (split.toVault > 0) {
        vaultBalance += split.toVault;
        const vaultOv = await supabase
          .from("vault")
          .update({ central_balance: vaultBalance })
          .eq("id", vault.id);
        if (vaultOv.error) {
          return NextResponse.json(
            { ok: false, message: "씨앗 나머지 초과분을 중앙 금고에 넣는 데 실패했습니다." },
            { status: 500 }
          );
        }
        await insertTransaction(supabase, {
          txType: "funding_overflow",
          amount: split.toVault,
          fromProfileId: null,
          toProfileId: null,
          toGoalId: null,
          memo: `씨앗 나머지 초과분 → 중앙 금고 (${g.name})`
        });
      }

      if (split.toGoal > 0) {
        await insertTransaction(supabase, {
          txType: "mining_remainder",
          amount: split.toGoal,
          fromProfileId: null,
          toProfileId: null,
          toGoalId: g.id,
          memo: "클로버 씨앗 나머지 → 펀딩"
        });
      }
    } else {
      vaultBalance += remainder;
      const vaultUpdate = await supabase
        .from("vault")
        .update({ central_balance: vaultBalance })
        .eq("id", vault.id);

      if (vaultUpdate.error) {
        return NextResponse.json(
          { ok: false, message: "클로버 씨앗 나머지를 중앙 금고에 넣는 데 실패했습니다." },
          { status: 500 }
        );
      }

      await insertTransaction(supabase, {
        txType: "mining_remainder",
        amount: remainder,
        fromProfileId: null,
        toProfileId: null,
        memo: "클로버 씨앗 나머지 → 중앙 금고"
      });
    }
  }

  const newIssuanceTotal = issuanceTotal + miningAmount;
  const newIssuanceCount = issuanceCount + 1;

  const vaultFinal = await supabase
    .from("vault")
    .update({
      issuance_total: newIssuanceTotal,
      issuance_count: newIssuanceCount
    })
    .eq("id", vault.id);

  if (vaultFinal.error) {
    const errMsg = vaultFinal.error.message ?? "";
    return NextResponse.json(
      {
        ok: false,
        message: `발행 이력 갱신 실패: ${errMsg}. vault 테이블에 issuance_total, issuance_count 컬럼이 있나요? Supabase SQL Editor에서 다음을 실행하세요:\nALTER TABLE vault ADD COLUMN IF NOT EXISTS issuance_total bigint DEFAULT 0;\nALTER TABLE vault ADD COLUMN IF NOT EXISTS issuance_count integer DEFAULT 0;`
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: `주간 실행 완료. 보유세(${WEALTH_TAX_PERCENT_LABEL}) ${totalTax}클로버 징수, 클로버 씨앗 보상 ${miningAmount}클로버 지급 (${profiles.length}명 균등, 1인당 ${perStudent}클로버). 누적 발행: ${newIssuanceTotal}/21,000 클로버`
  });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json(
      {
        ok: false,
        message: `주간 실행 중 오류가 발생했습니다: ${msg}`
      },
      { status: 500 }
    );
  }
}
