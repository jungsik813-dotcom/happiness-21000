import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminTokenFromRequest, verifyAdminToken } from "@/lib/admin-auth";
import { insertTransaction } from "@/lib/transactions";

type Params = { params: Promise<{ id: string }> };
type GoalRow = { id: string; name: string; current_amount: number };

export async function PATCH(request: Request, { params }: Params) {
  const token = getAdminTokenFromRequest(request);
  if (!verifyAdminToken(token)) {
    return NextResponse.json(
      { ok: false, message: "관리자 비밀번호가 필요합니다." },
      { status: 401 }
    );
  }

  const { id } = await params;
  const body = (await request.json()) as { isActive?: boolean };
  const isActive = body.isActive;

  if (typeof isActive !== "boolean") {
    return NextResponse.json(
      { ok: false, message: "isActive는 boolean이어야 합니다." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();

  if (isActive === false) {
    const goalRes = await supabase
      .from("goals")
      .select("id, name, current_amount")
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

    return NextResponse.json({ ok: true });
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

  return NextResponse.json({ ok: true });
}
