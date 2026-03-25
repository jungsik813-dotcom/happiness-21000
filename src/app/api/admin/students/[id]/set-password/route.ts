import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminTokenFromRequest, verifyAdminToken } from "@/lib/admin-auth";
import { hashStudentPassword } from "@/lib/student-auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = getAdminTokenFromRequest(request);
  if (!verifyAdminToken(token)) {
    return NextResponse.json(
      { ok: false, message: "관리자 비밀번호가 필요합니다." },
      { status: 401 }
    );
  }

  const { id: studentId } = await params;
  if (!studentId) {
    return NextResponse.json({ ok: false, message: "학생 ID가 필요합니다." }, { status: 400 });
  }

  const body = (await request.json()) as { password?: string };
  const password = typeof body.password === "string" ? body.password.trim() : "";

  if (password.length !== 4 || !/^\d+$/.test(password)) {
    return NextResponse.json(
      { ok: false, message: "4자리 숫자 비밀번호를 입력해주세요." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ password_hash: hashStudentPassword(password) })
    .eq("id", studentId);

  if (error) {
    return NextResponse.json(
      { ok: false, message: `비밀번호 설정 실패: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "비밀번호가 설정되었습니다. (해시로 저장됨)"
  });
}
