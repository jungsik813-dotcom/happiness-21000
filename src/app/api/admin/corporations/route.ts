import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminTokenFromRequest, verifyAdminToken } from "@/lib/admin-auth";
import { readJsonObject } from "@/lib/safe-json";
import { hashStudentPassword } from "@/lib/student-auth";
import { insertAuditLog } from "@/lib/audit-log";

export async function GET(request: Request) {
  const token = getAdminTokenFromRequest(request);
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ ok: false, message: "관리자 비밀번호가 필요합니다." }, { status: 401 });
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, balance")
    .eq("account_type", "CORPORATION")
    .order("name");
  if (error) {
    return NextResponse.json({ ok: false, message: `법인 목록 조회 실패: ${error.message}` }, { status: 500 });
  }
  return NextResponse.json({ ok: true, corporations: data ?? [] });
}

export async function POST(request: Request) {
  const token = getAdminTokenFromRequest(request);
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ ok: false, message: "관리자 비밀번호가 필요합니다." }, { status: 401 });
  }
  const parsed = await readJsonObject(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data as { name?: string; password?: string };
  const name = body.name?.trim() ?? "";
  const password = body.password?.trim() ?? "";
  if (!name) return NextResponse.json({ ok: false, message: "법인 이름을 입력해주세요." }, { status: 400 });
  if (!/^\d{4}$/.test(password)) {
    return NextResponse.json({ ok: false, message: "법인 비밀번호는 4자리 숫자입니다." }, { status: 400 });
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      name,
      balance: 0,
      account_type: "CORPORATION",
      password_hash: hashStudentPassword(password)
    })
    .select("id, name, balance")
    .single();
  if (error) {
    return NextResponse.json({ ok: false, message: `법인 생성 실패: ${error.message}` }, { status: 500 });
  }
  await insertAuditLog(supabase, {
    action: "admin.corporation.created",
    targetType: "profile",
    targetId: data.id,
    detail: { name: data.name }
  });
  return NextResponse.json({ ok: true, corporation: data });
}
