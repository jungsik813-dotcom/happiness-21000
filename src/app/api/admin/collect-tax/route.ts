import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProfileRow = {
  id: string;
  name: string | null;
  balance: number | null;
};

type VaultRow = {
  id: string;
  central_balance: number | null;
};

async function insertTransactionWithFallback(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  payload: {
    txType: string;
    amount: number;
    fromProfileId: string | null;
    toProfileId: string | null;
    memo: string;
  }
) {
  const attempts: Record<string, unknown>[] = [
    {
      tx_type: payload.txType,
      amount: payload.amount,
      from_profile_id: payload.fromProfileId,
      to_profile_id: payload.toProfileId,
      memo: payload.memo
    },
    {
      type: payload.txType,
      amount: payload.amount,
      from_profile_id: payload.fromProfileId,
      to_profile_id: payload.toProfileId,
      memo: payload.memo
    },
    {
      tx_type: payload.txType,
      amount: payload.amount,
      from_id: payload.fromProfileId,
      to_id: payload.toProfileId,
      note: payload.memo
    },
    {
      amount: payload.amount,
      memo: payload.memo
    },
    {
      tx_type: payload.txType,
      amount: payload.amount,
      from_profile_id: payload.fromProfileId,
      to_profile_id: payload.toProfileId
    },
    {
      type: payload.txType,
      amount: payload.amount,
      from_profile_id: payload.fromProfileId,
      to_profile_id: payload.toProfileId
    },
    {
      amount: payload.amount
    }
  ];

  for (const row of attempts) {
    const result = await supabase.from("transactions").insert(row);
    if (!result.error) return { ok: true as const };
  }

  return { ok: false as const };
}

export async function POST() {
  const supabase = await createSupabaseServerClient();

  const profilesQuery = await supabase
    .from("profiles")
    .select("id, name, balance")
    .order("name");

  if (profilesQuery.error || !profilesQuery.data) {
    return NextResponse.json(
      { ok: false, message: "학생 데이터를 불러오지 못했습니다." },
      { status: 500 }
    );
  }

  const profiles = profilesQuery.data as ProfileRow[];
  let totalTax = 0;

  for (const profile of profiles) {
    const currentBalance = profile.balance ?? 0;
    const tax = Math.floor(currentBalance * 0.1);
    if (tax <= 0) continue;

    const updateResult = await supabase
      .from("profiles")
      .update({ balance: currentBalance - tax })
      .eq("id", profile.id);

    if (updateResult.error) {
      return NextResponse.json(
        { ok: false, message: "세금 징수 중 학생 잔액 갱신에 실패했습니다." },
        { status: 500 }
      );
    }

    totalTax += tax;

    const txResult = await insertTransactionWithFallback(supabase, {
      txType: "tax",
      amount: tax,
      fromProfileId: profile.id,
      toProfileId: null,
      memo: `${profile.name ?? "이름 없음"} 세금 10%`
    });

    if (!txResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "세금 거래 기록 저장에 실패했습니다. transactions 테이블 컬럼명 또는 RLS 정책을 확인해주세요."
        },
        { status: 500 }
      );
    }
  }

  const vaultQuery = await supabase
    .from("vault")
    .select("id, central_balance")
    .limit(1)
    .single<VaultRow>();

  if (vaultQuery.error || !vaultQuery.data) {
    return NextResponse.json(
      { ok: false, message: "중앙 금고 데이터를 찾을 수 없습니다." },
      { status: 500 }
    );
  }

  const vaultUpdate = await supabase
    .from("vault")
    .update({ central_balance: (vaultQuery.data.central_balance ?? 0) + totalTax })
    .eq("id", vaultQuery.data.id);

  if (vaultUpdate.error) {
    return NextResponse.json(
      { ok: false, message: "중앙 금고 업데이트에 실패했습니다." },
      { status: 500 }
    );
  }

  const vaultTx = await insertTransactionWithFallback(supabase, {
    txType: "tax_deposit",
    amount: totalTax,
    fromProfileId: null,
    toProfileId: null,
    memo: "세금 징수 금액 중앙 금고 적립"
  });

  if (!vaultTx.ok) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "중앙 금고 거래 기록 저장에 실패했습니다. transactions 테이블 컬럼명 또는 RLS 정책을 확인해주세요."
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: `세금 징수 완료: 총 ${totalTax}P 적립`
  });
}
