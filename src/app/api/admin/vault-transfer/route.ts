import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { insertTransaction } from "@/lib/transactions";
import { getAdminTokenFromRequest, verifyAdminToken } from "@/lib/admin-auth";
import { splitGoalFunding } from "@/lib/goal-funding";

type VaultRow = { id: string; central_balance: number | null };
type ProfileRow = { id: string; name: string | null; balance: number | null };
type GoalRow = { id: string; name: string; current_amount: number; target_amount: number };

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

  let deductFromVault = amount;
  let responseMessage = "";

  if (isToStudent) {
    if (currentBalance < amount) {
      return NextResponse.json(
        { ok: false, message: `중앙 금고 잔액이 부족합니다. (현재 ${currentBalance} 클로버)` },
        { status: 400 }
      );
    }
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
    responseMessage = "학생에게 송금이 완료되었습니다.";
  } else {
    const goalRes = await supabase
      .from("goals")
      .select("id, name, current_amount, target_amount")
      .eq("id", toGoalId!)
      .eq("is_active", true)
      .single<GoalRow>();

    if (goalRes.error || !goalRes.data) {
      return NextResponse.json(
        { ok: false, message: "활성 펀딩 목표를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const g = goalRes.data;
    const current = g.current_amount ?? 0;
    const target = g.target_amount ?? 0;
    const split = splitGoalFunding(current, target, amount);
    const outFromVault = split.toGoal;
    deductFromVault = outFromVault;

    if (outFromVault > currentBalance) {
      return NextResponse.json(
        {
          ok: false,
          message: `중앙 금고 잔액이 부족합니다. (펀딩에 필요한 ${outFromVault} 클로버, 금고 ${currentBalance} 클로버)`
        },
        { status: 400 }
      );
    }

    responseMessage = "펀딩 목표에 송금이 완료되었습니다.";

    if (split.needsStaleCompletion) {
      if (current > 0) {
        await insertTransaction(supabase, {
          txType: "burn",
          amount: current,
          fromProfileId: null,
          toProfileId: null,
          toGoalId: g.id,
          memo: `소각: ${g.name} 펀딩 완료(정리·금고)`
        });
      }
      const staleClose = await supabase
        .from("goals")
        .update({ is_active: false, current_amount: 0 })
        .eq("id", toGoalId!);
      if (staleClose.error) {
        return NextResponse.json(
          { ok: false, message: "펀딩 목표 정리에 실패했습니다." },
          { status: 500 }
        );
      }
      if (split.toVault > 0) {
        responseMessage =
          "이미 목표를 달성한 펀딩이었습니다. 초과분은 중앙 금고에 그대로 있습니다.";
      }
    } else if (outFromVault > 0) {
      if (split.goalReached) {
        const goalClose = await supabase
          .from("goals")
          .update({ is_active: false, current_amount: 0 })
          .eq("id", toGoalId!);
        if (goalClose.error) {
          return NextResponse.json(
            { ok: false, message: "펀딩 목표 업데이트에 실패했습니다." },
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
        responseMessage =
          split.toVault > 0
            ? `펀딩 목표를 달성했습니다! 초과 ${split.toVault} 클로버는 중앙 금고에 그대로 두었습니다.`
            : "펀딩 목표를 달성했습니다!";
      } else {
        const updateRes = await supabase
          .from("goals")
          .update({ current_amount: split.newGoalTotal })
          .eq("id", toGoalId!);

        if (updateRes.error) {
          return NextResponse.json(
            { ok: false, message: "펀딩 목표 업데이트에 실패했습니다." },
            { status: 500 }
          );
        }
        if (split.toVault > 0) {
          responseMessage = `목표에 ${outFromVault} 클로버를 보냈고, 나머지 ${split.toVault} 클로버는 금고에 남겼습니다.`;
        }
      }
    }

    if (outFromVault > 0) {
      await insertTransaction(supabase, {
        txType: "vault_transfer",
        amount: outFromVault,
        fromProfileId: null,
        toProfileId: null,
        toGoalId: toGoalId,
        memo: `중앙 금고 → 펀딩: ${g.name}`
      });
    }
  }

  const newVaultBalance = currentBalance - deductFromVault;
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
    message: responseMessage,
    newVaultBalance
  });
}
