import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { insertTransaction } from "@/lib/transactions";

type TransferBody = {
  fromStudentId?: string;
  toStudentId?: string;
  toGoalId?: string;
  amount?: number;
};

type ProfileRow = { id: string; balance: number | null; name: string | null };
type GoalRow = { id: string; name: string; target_amount: number; current_amount: number };

export async function POST(request: Request) {
  const body = (await request.json()) as TransferBody;
  const fromStudentId = body.fromStudentId?.trim();
  const toStudentId = body.toStudentId?.trim() || null;
  const toGoalId = body.toGoalId?.trim() || null;
  const amount = Number(body.amount ?? 0);

  const isP2P = Boolean(toStudentId);
  const isContribution = Boolean(toGoalId);

  if (!fromStudentId || (!isP2P && !isContribution) || Number.isNaN(amount) || amount <= 0) {
    return NextResponse.json(
      { ok: false, message: "보내는 학생, 받는 대상, 송금 금액을 확인해주세요." },
      { status: 400 }
    );
  }

  if (isP2P && fromStudentId === toStudentId) {
    return NextResponse.json(
      { ok: false, message: "같은 학생에게는 송금할 수 없습니다." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();

  const fromQuery = await supabase
    .from("profiles")
    .select("id, name, balance")
    .eq("id", fromStudentId)
    .single<ProfileRow>();

  if (fromQuery.error || !fromQuery.data) {
    return NextResponse.json(
      { ok: false, message: "보내는 학생 정보를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const fromBalance = fromQuery.data.balance ?? 0;
  if (fromBalance < amount) {
    return NextResponse.json(
      { ok: false, message: "잔액이 부족합니다." },
      { status: 400 }
    );
  }

  let effectiveAmount = amount;
  let memo: string;
  let cappedMessage = "";

  if (isContribution) {
    const goalQuery = await supabase
      .from("goals")
      .select("id, name, target_amount, current_amount")
      .eq("id", toGoalId!)
      .eq("is_active", true)
      .single<GoalRow>();

    if (goalQuery.error || !goalQuery.data) {
      return NextResponse.json(
        { ok: false, message: "펀딩 목표를 찾을 수 없거나 비활성입니다." },
        { status: 404 }
      );
    }

    const currentAmount = goalQuery.data.current_amount ?? 0;
    const targetAmount = goalQuery.data.target_amount ?? 0;
    const needed = Math.max(0, targetAmount - currentAmount);

    if (needed <= 0) {
      return NextResponse.json(
        { ok: false, message: "이 펀딩은 이미 목표액에 도달했습니다." },
        { status: 400 }
      );
    }

    const actualAmount = Math.min(amount, needed);
    const excess = amount - actualAmount;
    cappedMessage =
      excess > 0
        ? ` 목표 달성에 필요한 ${actualAmount} P만 사용되었고, 나머지 ${excess} P는 차감되지 않았습니다.`
        : "";
    const newGoalAmount = currentAmount + actualAmount;

    const goalReached = newGoalAmount >= targetAmount;
    const goalUpdatePayload = goalReached
      ? { current_amount: 0, is_active: false }
      : { current_amount: newGoalAmount };

    const goalUpdate = await supabase
      .from("goals")
      .update(goalUpdatePayload)
      .eq("id", toGoalId!);

    if (goalUpdate.error) {
      return NextResponse.json(
        { ok: false, message: "펀딩 적립 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    if (goalReached && newGoalAmount > 0) {
      await insertTransaction(supabase, {
        txType: "burn",
        amount: newGoalAmount,
        fromProfileId: null,
        toProfileId: null,
        toGoalId: toGoalId!,
        memo: `소각: ${goalQuery.data.name} 펀딩 완료`
      });
    }

    effectiveAmount = actualAmount;
    memo = `${fromQuery.data.name ?? "이름 없음"} → 펀딩: ${goalQuery.data.name}`;
  } else {
    const toQuery = await supabase
      .from("profiles")
      .select("id, name, balance")
      .eq("id", toStudentId!)
      .single<ProfileRow>();

    if (toQuery.error || !toQuery.data) {
      return NextResponse.json(
        { ok: false, message: "받는 학생 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const toBalance = toQuery.data.balance ?? 0;
    const receivedBalance = toBalance + amount;

    const updateTo = await supabase
      .from("profiles")
      .update({ balance: receivedBalance })
      .eq("id", toStudentId!);

    if (updateTo.error) {
      return NextResponse.json(
        { ok: false, message: "송금 처리 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    memo = `${fromQuery.data.name ?? "이름 없음"} → ${toQuery.data.name ?? "이름 없음"}`;
  }

  const remainingBalance = fromBalance - effectiveAmount;

  const updateFrom = await supabase
    .from("profiles")
    .update({ balance: remainingBalance })
    .eq("id", fromStudentId);

  if (updateFrom.error) {
    return NextResponse.json(
      { ok: false, message: "송금 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }

  const txType = isContribution ? "contribution" : "transfer";
  const txResult = await insertTransaction(supabase, {
    txType,
    amount: effectiveAmount,
    fromProfileId: fromStudentId,
    toProfileId: isP2P ? toStudentId : null,
    toGoalId: isContribution ? toGoalId : null,
    memo
  });

  const baseMessage = isContribution ? "기부가 완료되었습니다." : "송금이 완료되었습니다.";
  const fullMessage = isContribution && cappedMessage
    ? baseMessage + cappedMessage
    : baseMessage;

  if (!txResult.ok) {
    return NextResponse.json(
      {
        ok: true,
        message: fullMessage,
        txRecorded: false,
        txError: txResult.error,
        remainingBalance
      },
      { status: 200 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: fullMessage,
    txRecorded: true,
    remainingBalance
  });
}
