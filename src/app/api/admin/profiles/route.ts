import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminTokenFromRequest, verifyAdminToken } from "@/lib/admin-auth";
import { readJsonObject } from "@/lib/safe-json";
import { hashStudentPassword } from "@/lib/student-auth";
import { insertAuditLog } from "@/lib/audit-log";

export async function POST(request: Request) {
  const token = getAdminTokenFromRequest(request);
  if (!verifyAdminToken(token)) {
    return NextResponse.json(
      { ok: false, message: "관리자 비밀번호가 필요합니다." },
      { status: 401 }
    );
  }

  const parsed = await readJsonObject(request);
  if (!parsed.ok) return parsed.response;

  const body = parsed.data as { name?: string; password?: string };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password.trim() : "";

  if (name.length < 1) {
    return NextResponse.json({ ok: false, message: "이름을 입력해주세요." }, { status: 400 });
  }
  if (password.length !== 4 || !/^\d{4}$/.test(password)) {
    return NextResponse.json(
      { ok: false, message: "4자리 숫자 비밀번호를 설정해주세요." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      name,
      balance: 0,
      account_type: "STUDENT",
      password_hash: hashStudentPassword(password)
    })
    .select("id, name, balance")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, message: `학생 추가 실패: ${error.message}` },
      { status: 500 }
    );
  }

  await insertAuditLog(supabase, {
    action: "admin.student.created",
    targetType: "profile",
    targetId: data.id,
    detail: { name: data.name }
  });

  return NextResponse.json({
    ok: true,
    message: "학생이 추가되었습니다.",
    profile: data
  });
}
