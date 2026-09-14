import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { insertTransaction } from "@/lib/transactions";
import { getAdminTokenFromRequest, verifyAdminToken } from "@/lib/admin-auth";
import { getWeeklyIssuanceCap, TOTAL_SUPPLY } from "@/lib/issuance-schedule";
import { WEALTH_TAX_RATE } from "@/lib/constants";
import { roundToDecimalPlaces } from "@/lib/money";
import type { DecimalPlaces } from "@/lib/money";
import { normalizeDecimalPlaces } from "@/lib/vault-settings";
import { readJsonObject } from "@/lib/safe-json";

const WEALTH_TAX_PERCENT_LABEL = `${Math.round(WEALTH_TAX_RATE * 100)}%`;

type ProfileRow = {
  id: string;
  name: string | null;
  balance: number | null;
  account_type?: string | null;
};

function isStudentProfile(profile: ProfileRow) {
  return (profile.account_type ?? "STUDENT") === "STUDENT";
}

type VaultRow = {
  id: string;
  central_balance: number | null;
  issuance_total: number | null;
  issuance_count: number | null;
  decimal_places?: number | null;
};

export async function POST(request: Request) {
  const token = getAdminTokenFromRequest(request);
  if (!verifyAdminToken(token)) {
    return NextResponse.json(
      { ok: false, message: "관리자 비밀번호가 필요합니다." },
      { status: 401 }
    );
  }

  try {
    const parsed = await readJsonObject(request);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data as { miningAmount?: number };

    const supabase = await createSupabaseServerClient();

    const [profilesRes, vaultRes] = await Promise.all([
      supabase.from("profiles").select("id, name, balance, account_type").order("name"),
      supabase
        .from("vault")
        .select("id, central_balance, issuance_total, issuance_count, decimal_places")
        .limit(1)
        .single<VaultRow>()
    ]);

    if (profilesRes.error || !profilesRes.data) {
      return NextResponse.json(
        { ok: false, message: `학생 데이터 오류: ${profilesRes.error?.message ?? "알 수 없음"}` },
        { status: 500 }
      );
    }

    const profiles = (profilesRes.data as ProfileRow[]).filter(isStudentProfile);
    let vault: VaultRow;
    let issuanceTotal = 0;
    let issuanceCount = 0;

    if (vaultRes.error || !vaultRes.data) {
      const fallback = await supabase
        .from("vault")
        .select("id, central_balance, decimal_places")
        .limit(1)
        .single<{ id: string; central_balance: number | null; decimal_places: number | null }>();
      if (fallback.error || !fallback.data) {
        return NextResponse.json(
          {
            ok: false,
            message: `중앙 금고 오류: ${vaultRes.error?.message ?? "vault 테이블 또는 issuance_total, issuance_count 컬럼을 확인하세요. Supabase에서 마이그레이션 SQL을 실행했나요?"}`
          },
          { status: 500 }
        );
      }
      vault = { ...fallback.data, issuance_total: 0, issuance_count: 0 };
    } else {
      vault = vaultRes.data;
      issuanceTotal = Number(vault.issuance_total ?? 0);
      issuanceCount = Number(vault.issuance_count ?? 0);
    }
    const dp = normalizeDecimalPlaces(vault.decimal_places) as DecimalPlaces;
    let vaultBalance = Number(vault.central_balance ?? 0);

    if (profiles.length === 0) {
      return NextResponse.json(
        { ok: false, message: "등록된 학생이 없어 주간 실행을 할 수 없습니다." },
        { status: 400 }
      );
    }

    const remainingSupply = Math.max(0, TOTAL_SUPPLY - issuanceTotal);
    if (remainingSupply <= 0) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "총 발행 한도(21,000 클로버)를 모두 사용했습니다. 더 이상 클로버 씨앗 보상을 지급할 수 없습니다."
        },
        { status: 400 }
      );
    }

    const nextWeek = issuanceCount + 1;
    const scheduleCap = getWeeklyIssuanceCap(nextWeek);
    const suggestedAmount = Math.min(
      scheduleCap > 0 ? scheduleCap : remainingSupply,
      remainingSupply
    );

    let requestedRaw = body.miningAmount;
    if (requestedRaw === undefined || requestedRaw === null) {
      requestedRaw = suggestedAmount;
    }
    if (typeof requestedRaw !== "number" || !Number.isFinite(requestedRaw) || requestedRaw < 0) {
      return NextResponse.json(
        { ok: false, message: "이번 주 지급할 클로버 씨앗 금액을 확인해 주세요. (0 이상)" },
        { status: 400 }
      );
    }
    const requestedMining = roundToDecimalPlaces(requestedRaw, dp);
    if (requestedMining > remainingSupply + 1e-9) {
      return NextResponse.json(
        {
          ok: false,
          message: `남은 발행 한도(${remainingSupply} 클로버)를 초과할 수 없습니다. 총 한도 21,000.`
        },
        { status: 400 }
      );
    }

    // 1단계: 보유세 징수 → 항상 중앙 금고
    let totalTax = 0;

    for (const profile of profiles) {
      const balance = Number(profile.balance ?? 0);
      const tax = roundToDecimalPlaces(balance * WEALTH_TAX_RATE, dp);
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
        toGoalId: null,
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

    if (totalTax > 0) {
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
        memo: "세금 징수 → 중앙 금고"
      });
      if (!txDeposit.ok) {
        return NextResponse.json(
          { ok: false, message: "세금 적립 거래 기록 저장에 실패했습니다." },
          { status: 500 }
        );
      }
      vaultBalance += totalTax;
    }

    // 2단계: 관리자가 입력한 금액으로 균등 분배 (총 발행 21,000 한도 내)
    const miningAmount = requestedMining;
    if (miningAmount <= 0) {
      return NextResponse.json({
        ok: true,
        message: `보유세(${WEALTH_TAX_PERCENT_LABEL}) 징수 완료 (총 ${totalTax}클로버 → 중앙 금고). 클로버 씨앗 지급 없음.`
      });
    }

    const scale = 10 ** dp;
    const miningUnits = Math.round(miningAmount * scale);
    const perStudentUnits = Math.floor(miningUnits / profiles.length);
    const remainderUnits = miningUnits - perStudentUnits * profiles.length;
    const perStudent = perStudentUnits / scale;
    const remainder = remainderUnits / scale;

    if (perStudent <= 0) {
      return NextResponse.json(
        {
          ok: false,
          message: `지급액이 너무 작아 학생 ${profiles.length}명에게 나눌 수 없습니다. 금액을 늘려 주세요.`
        },
        { status: 400 }
      );
    }

    const afterTaxRes = await supabase
      .from("profiles")
      .select("id, balance")
      .in(
        "id",
        profiles.map((p) => p.id)
      );
    const afterTaxMap = new Map(
      ((afterTaxRes.data as { id: string; balance: number | null }[]) ?? []).map((r) => [
        r.id,
        r.balance ?? 0
      ])
    );

    for (const profile of profiles) {
      const current = afterTaxMap.get(profile.id) ?? 0;
      const updateRes = await supabase
        .from("profiles")
        .update({ balance: current + perStudent })
        .eq("id", profile.id);

      if (updateRes.error) {
        return NextResponse.json(
          {
            ok: false,
            message: `클로버 씨앗 보상 지급 실패 (${profile.name}): ${updateRes.error.message}`
          },
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

    if (remainder > 0) {
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
      message: `주간 실행 완료. 보유세(${WEALTH_TAX_PERCENT_LABEL}) ${totalTax}클로버 → 중앙 금고, 클로버 씨앗 보상 ${miningAmount}클로버 지급 (학생 ${profiles.length}명 균등, 1인당 ${perStudent}클로버${remainder > 0 ? `, 나머지 ${remainder}→금고` : ""}). 누적 발행: ${newIssuanceTotal}/21,000 클로버`
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
