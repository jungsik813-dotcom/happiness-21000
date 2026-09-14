import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminTokenFromRequest, verifyAdminToken } from "@/lib/admin-auth";
import { insertTransaction } from "@/lib/transactions";
import { readJsonObject } from "@/lib/safe-json";

type Params = { params: Promise<{ id: string }> };
type GoalRow = {
  id: string;
  name: string;
  current_amount: number;
  is_active: boolean;
};
type VaultRow = { id: string; central_balance: number | null };

async function reclaimGoalToVault(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  goal: GoalRow
): Promise<{ ok: true; amount: number } | { ok: false; message: string; status: number }> {
  const amount = Math.max(0, Number(goal.current_amount ?? 0));
  if (amount <= 0) {
    return { ok: true, amount: 0 };
  }

  const vaultRes = await supabase
    .from("vault")
    .select("id, central_balance")
    .limit(1)
    .single<VaultRow>();

  if (vaultRes.error || !vaultRes.data) {
    return { ok: false, message: "중앙 금고 정보를 찾을 수 없습니다.", status: 500 };
  }

  const vault = vaultRes.data;
  const newVaultBalance = Number(vault.central_balance ?? 0) + amount;

  const vaultUpdate = await supabase
    .from("vault")
    .update({ central_balance: newVaultBalance })
    .eq("id", vault.id);

  if (vaultUpdate.error) {
    return {
      ok: false,
      message: `중앙 금고 적립 실패: ${vaultUpdate.error.message}`,
      status: 500
    };
  }

  const goalUpdate = await supabase
    .from("goals")
    .update({ current_amount: 0, is_active: false })
    .eq("id", goal.id);

  if (goalUpdate.error) {
    return {
      ok: false,
      message: `펀딩 잔액 초기화 실패: ${goalUpdate.error.message}`,
      status: 500
    };
  }

  const tx = await insertTransaction(supabase, {
    txType: "funding_reclaim",
    amount,
    fromProfileId: null,
    toProfileId: null,
    toGoalId: goal.id,
    memo: `펀딩 환수 → 중앙 금고 (${goal.name})`
  });

  if (!tx.ok) {
    return {
      ok: false,
      message: `환수 거래 기록 저장 실패: ${tx.error}`,
      status: 500
    };
  }

  return { ok: true, amount };
}

export async function PATCH(request: Request, { params }: Params) {
  const token = getAdminTokenFromRequest(request);
  if (!verifyAdminToken(token)) {
    return NextResponse.json(
      { ok: false, message: "관리자 비밀번호가 필요합니다." },
      { status: 401 }
    );
  }

  const { id } = await params;
  const parsed = await readJsonObject(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data as { isActive?: boolean; reclaimToVault?: boolean };

  const supabase = await createSupabaseServerClient();

  if (body.reclaimToVault === true) {
    const goalRes = await supabase
      .from("goals")
      .select("id, name, current_amount, is_active")
      .eq("id", id)
      .single<GoalRow>();

    if (goalRes.error || !goalRes.data) {
      return NextResponse.json(
        { ok: false, message: "펀딩 목표를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const amount = Math.max(0, Number(goalRes.data.current_amount ?? 0));
    if (amount <= 0) {
      return NextResponse.json(
        { ok: false, message: "환수할 금액이 없습니다. (모인 클로버가 0입니다)" },
        { status: 400 }
      );
    }

    const result = await reclaimGoalToVault(supabase, goalRes.data);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `「${goalRes.data.name}」 펀딩 ${result.amount} 클로버를 중앙 금고로 환수했고, 목표를 비활성으로 바꿨습니다.`
    });
  }

  const isActive = body.isActive;
  if (typeof isActive !== "boolean") {
    return NextResponse.json(
      { ok: false, message: "isActive는 boolean이어야 합니다." },
      { status: 400 }
    );
  }

  if (isActive === false) {
    const goalRes = await supabase
      .from("goals")
      .select("id, name, current_amount, is_active")
      .eq("id", id)
      .single<GoalRow>();

    if (goalRes.error || !goalRes.data) {
      return NextResponse.json(
        { ok: false, message: "펀딩 목표를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const goal = goalRes.data;
    const burnAmount = Number(goal.current_amount ?? 0);

    if (burnAmount > 0) {
      await insertTransaction(supabase, {
        txType: "burn",
        amount: burnAmount,
        fromProfileId: null,
        toProfileId: null,
        toGoalId: goal.id,
        memo: `소각: ${goal.name} 펀딩 완료`
      });
    }

    const { error } = await supabase
      .from("goals")
      .update({ is_active: false, current_amount: 0 })
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { ok: false, message: "펀딩 목표 수정에 실패했습니다.", error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message:
        burnAmount > 0
          ? `「${goal.name}」을(를) 완료 처리하고 ${burnAmount} 클로버를 소각했습니다.`
          : `「${goal.name}」을(를) 비활성으로 바꿨습니다.`
    });
  }

  const { error } = await supabase
    .from("goals")
    .update({ is_active: true })
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { ok: false, message: "펀딩 목표 수정에 실패했습니다.", error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, message: "펀딩 목표를 다시 활성으로 바꿨습니다." });
}

export async function DELETE(request: Request, { params }: Params) {
  const token = getAdminTokenFromRequest(request);
  if (!verifyAdminToken(token)) {
    return NextResponse.json(
      { ok: false, message: "관리자 비밀번호가 필요합니다." },
      { status: 401 }
    );
  }

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const goalRes = await supabase
    .from("goals")
    .select("id, name, current_amount, is_active")
    .eq("id", id)
    .single<GoalRow>();

  if (goalRes.error || !goalRes.data) {
    return NextResponse.json(
      { ok: false, message: "펀딩 목표를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const goal = goalRes.data;
  const balance = Math.max(0, Number(goal.current_amount ?? 0));

  if (balance > 0) {
    const result = await reclaimGoalToVault(supabase, goal);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, message: result.message },
        { status: result.status }
      );
    }
  }

  // FK 때문에 거래의 to_goal_id를 먼저 비움 (메모에는 목표 이름이 남음)
  const clearFk = await supabase
    .from("transactions")
    .update({ to_goal_id: null })
    .eq("to_goal_id", id);

  if (clearFk.error) {
    return NextResponse.json(
      {
        ok: false,
        message: `관련 거래 연결 해제에 실패했습니다: ${clearFk.error.message}`
      },
      { status: 500 }
    );
  }

  const del = await supabase.from("goals").delete().eq("id", id);
  if (del.error) {
    return NextResponse.json(
      { ok: false, message: `펀딩 목표 삭제에 실패했습니다: ${del.error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message:
      balance > 0
        ? `「${goal.name}」을(를) 삭제했고, 모인 ${balance} 클로버는 중앙 금고로 환수했습니다.`
        : `「${goal.name}」을(를) 완전히 삭제했습니다.`
  });
}
