import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminTokenFromRequest, verifyAdminToken } from "@/lib/admin-auth";
import { hashStudentPassword } from "@/lib/student-auth";

const DEFAULT_PIN = "0000";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = getAdminTokenFromRequest(_request);
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

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ password_hash: hashStudentPassword(DEFAULT_PIN) })
    .eq("id", studentId);

  if (error) {
    return NextResponse.json(
      { ok: false, message: `비밀번호 초기화 실패: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: `비밀번호가 ${DEFAULT_PIN}(으)로 초기화되었습니다.`
  });
}
