import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminTokenFromRequest, verifyAdminToken } from "@/lib/admin-auth";

type GoalRow = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  is_active: boolean;
  created_at: string | null;
};

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("goals")
    .select("id, name, target_amount, current_amount, is_active, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { ok: false, message: "펀딩 목표를 불러오지 못했습니다.", error: error.message },
      { status: 500 }
    );
  }

  const goals = (data as GoalRow[] | null) ?? [];
  return NextResponse.json({ ok: true, goals });
}

type CreateBody = { name?: string; targetAmount?: number };

export async function POST(request: Request) {
  const token = getAdminTokenFromRequest(request);
  if (!verifyAdminToken(token)) {
    return NextResponse.json(
      { ok: false, message: "관리자 비밀번호가 필요합니다." },
      { status: 401 }
    );
  }

  const body = (await request.json()) as CreateBody;
  const name = body.name?.trim();
  const targetAmount = Number(body.targetAmount ?? 0);

  if (!name || targetAmount <= 0) {
    return NextResponse.json(
      { ok: false, message: "목표 이름과 목표 금액을 입력해주세요." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("goals")
    .insert({
      name,
      target_amount: targetAmount,
      current_amount: 0,
      is_active: true
    })
    .select("id, name, target_amount, current_amount, is_active")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, message: "펀딩 목표 생성에 실패했습니다.", error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, goal: data });
}
