import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { insertTransaction } from "@/lib/transactions";
import { getAdminTokenFromRequest, verifyAdminToken } from "@/lib/admin-auth";

const TOTAL_SUPPLY = 21_000;

type ProfileRow = { id: string; name: string | null; balance: number | null };
type VaultRow = {
  id: string;
  central_balance: number | null;
  issuance_total: number | null;
  issuance_count: number | null;
};
type GoalRow = { id: string; name: string; current_amount: number };

function calcMiningAmount(remaining: number, count: number): number {
  if (remaining <= 0) return 0;
  const rate = count < 4 ? 0.2 : 0.1;
  return Math.floor(remaining * rate);
}

export async function POST(request: Request) {
  const token = getAdminTokenFromRequest(request);
  if (!verifyAdminToken(token)) {
    return NextResponse.json(
      { ok: false, message: "관리자 비밀번호가 필요합니다." },
      { status: 401 }
    );
  }

  const supabase = await createSupabaseServerClient();

  const [profilesRes, vaultRes, activeGoalRes] = await Promise.all([
    supabase.from("profiles").select("id, name, balance").order("name"),
    supabase.from("vault").select("id, central_balance, issuance_total, issuance_count").limit(1).single<VaultRow>(),
    supabase.from("goals").select("id, name, current_amount").eq("is_active", true).limit(1).maybeSingle<GoalRow>()
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

  // 1단계: 3% 세금 징수 → 활성 펀딩 목표
  let totalTax = 0;
  const taxDestination = activeGoal ?? null;

  for (const profile of profiles) {
    const balance = profile.balance ?? 0;
    const tax = Math.floor(balance * 0.03);
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
      memo: `${profile.name ?? "이름 없음"} 세금 3%`
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
    const newGoalAmount = (taxDestination.current_amount ?? 0) + totalTax;
    const goalUpdate = await supabase
      .from("goals")
      .update({ current_amount: newGoalAmount })
      .eq("id", taxDestination.id);

    if (goalUpdate.error) {
      return NextResponse.json(
        { ok: false, message: `펀딩 목표 적립 실패: ${goalUpdate.error.message}. goals 테이블이 있나요?` },
        { status: 500 }
      );
    }

    const txDeposit = await insertTransaction(supabase, {
      txType: "tax_deposit",
      amount: totalTax,
      fromProfileId: null,
      toProfileId: null,
      toGoalId: taxDestination.id,
      memo: "세금 징수 → 펀딩 목표 적립"
    });
    if (!txDeposit.ok) {
      return NextResponse.json(
        { ok: false, message: "세금 적립 거래 기록 저장에 실패했습니다." },
        { status: 500 }
      );
    }
  } else if (totalTax > 0 && !taxDestination) {
    // 활성 펀딩 목표 없음 → 중앙 금고
    const vaultBalance = vault.central_balance ?? 0;
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
  }

  // 2단계: 클로버 씨앗 보상 균등 분배
  const miningAmount = Math.min(calcMiningAmount(remainingSupply, issuanceCount), remainingSupply);
  if (miningAmount <= 0) {
    return NextResponse.json({
      ok: true,
      message: `세금 징수 완료 (총 ${totalTax}클로버). 클로버 씨앗 한도 소진으로 보상 지급 없음.`
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

  // 나머지 → 활성 펀딩 또는 중앙 금고
  if (remainder > 0) {
    if (taxDestination) {
      const goalRes = await supabase
        .from("goals")
        .select("current_amount")
        .eq("id", taxDestination.id)
        .single<{ current_amount: number }>();
      const current = goalRes.data?.current_amount ?? taxDestination.current_amount ?? 0;
      await supabase
        .from("goals")
        .update({ current_amount: current + remainder })
        .eq("id", taxDestination.id);

      await insertTransaction(supabase, {
        txType: "mining_remainder",
        amount: remainder,
        fromProfileId: null,
        toProfileId: null,
        toGoalId: taxDestination.id,
        memo: "클로버 씨앗 나머지 → 펀딩"
      });
    } else {
      const vaultBalance = vault.central_balance ?? 0;
      await supabase
        .from("vault")
        .update({ central_balance: vaultBalance + remainder })
        .eq("id", vault.id);

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
    message: `주간 실행 완료. 세금 ${totalTax}클로버 징수, 클로버 씨앗 보상 ${miningAmount}클로버 지급 (${profiles.length}명 균등, 1인당 ${perStudent}클로버). 누적 발행: ${newIssuanceTotal}/21,000 클로버`
  });
}
