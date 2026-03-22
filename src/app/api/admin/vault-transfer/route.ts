import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { insertTransaction } from "@/lib/transactions";
import { getAdminTokenFromRequest, verifyAdminToken } from "@/lib/admin-auth";

type VaultRow = { id: string; central_balance: number | null };
type ProfileRow = { id: string; name: string | null; balance: number | null };
type GoalRow = { id: string; name: string; current_amount: number };

export async function POST(request: Request) {
  const token = getAdminTokenFromRequest(request);
  if (!verifyAdminToken(token)) {
    return NextResponse.json(
      { ok: false, message: "관리자 비밀번호가 필요합니다." },
      { status: 401 }
    );
  }

  const body = (await request.json()) as {
    amount?: number;
    toStudentId?: string;
    toGoalId?: string;
  };
  const amount = Number(body.amount ?? 0);
  const toStudentId = body.toStudentId?.trim() || null;
  const toGoalId = body.toGoalId?.trim() || null;

  const isToStudent = Boolean(toStudentId);
  const isToGoal = Boolean(toGoalId);

  if (Number.isNaN(amount) || amount <= 0 || (!isToStudent && !isToGoal)) {
    return NextResponse.json(
      { ok: false, message: "금액과 받는 대상을 확인해주세요." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();

  const vaultRes = await supabase
    .from("vault")
    .select("id, central_balance")
    .limit(1)
    .single<VaultRow>();

  if (vaultRes.error || !vaultRes.data) {
    return NextResponse.json(
      { ok: false, message: "중앙 금고 정보를 찾을 수 없습니다." },
      { status: 500 }
    );
  }

  const vault = vaultRes.data;
  const currentBalance = vault.central_balance ?? 0;
  if (currentBalance < amount) {
    return NextResponse.json(
      { ok: false, message: `중앙 금고 잔액이 부족합니다. (현재 ${currentBalance} 클로버)` },
      { status: 400 }
    );
  }

  if (isToStudent) {
    const toRes = await supabase
      .from("profiles")
      .select("id, name, balance")
      .eq("id", toStudentId!)
      .single<ProfileRow>();

    if (toRes.error || !toRes.data) {
      return NextResponse.json(
        { ok: false, message: "받는 학생을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const newBalance = (toRes.data.balance ?? 0) + amount;
    const updateRes = await supabase
      .from("profiles")
      .update({ balance: newBalance })
      .eq("id", toStudentId!);

    if (updateRes.error) {
      return NextResponse.json(
        { ok: false, message: "학생 잔액 업데이트에 실패했습니다." },
        { status: 500 }
      );
    }

    await insertTransaction(supabase, {
      txType: "vault_transfer",
      amount,
      fromProfileId: null,
      toProfileId: toStudentId,
      toGoalId: null,
      memo: `중앙 금고 → ${toRes.data.name ?? "학생"}`
    });
  } else {
    const goalRes = await supabase
      .from("goals")
      .select("id, name, current_amount")
      .eq("id", toGoalId!)
      .eq("is_active", true)
      .single<GoalRow>();

    if (goalRes.error || !goalRes.data) {
      return NextResponse.json(
        { ok: false, message: "활성 펀딩 목표를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const newGoalAmount = (goalRes.data.current_amount ?? 0) + amount;
    const updateRes = await supabase
      .from("goals")
      .update({ current_amount: newGoalAmount })
      .eq("id", toGoalId!);

    if (updateRes.error) {
      return NextResponse.json(
        { ok: false, message: "펀딩 목표 업데이트에 실패했습니다." },
        { status: 500 }
      );
    }

    await insertTransaction(supabase, {
      txType: "vault_transfer",
      amount,
      fromProfileId: null,
      toProfileId: null,
      toGoalId: toGoalId,
      memo: `중앙 금고 → 펀딩: ${goalRes.data.name}`
    });
  }

  const newVaultBalance = currentBalance - amount;
  const vaultUpdate = await supabase
    .from("vault")
    .update({ central_balance: newVaultBalance })
    .eq("id", vault.id);

  if (vaultUpdate.error) {
    return NextResponse.json(
      { ok: false, message: "중앙 금고 잔액 업데이트에 실패했습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: isToStudent
      ? "학생에게 송금이 완료되었습니다."
      : "펀딩 목표에 송금이 완료되었습니다.",
    newVaultBalance
  });
}
