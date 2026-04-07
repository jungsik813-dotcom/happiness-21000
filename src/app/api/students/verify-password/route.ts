import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyStudentPassword } from "@/lib/student-auth";
import { readJsonObject } from "@/lib/safe-json";
import { isUuid } from "@/lib/validation";

type ProfileRow = {
  id: string;
  name: string | null;
  balance: number | null;
  password_hash: string | null;
  account_type: string | null;
};

export async function POST(request: Request) {
  const parsed = await readJsonObject(request);
  if (!parsed.ok) return parsed.response;

  const body = parsed.data as { studentId?: string; password?: string };
  const studentId = body.studentId?.trim() ?? "";
  const password = body.password?.trim() ?? "";

  if (!studentId || !isUuid(studentId)) {
    return NextResponse.json({ ok: false, message: "학생 정보가 필요합니다." }, { status: 400 });
  }

  if (password.length !== 4) {
    return NextResponse.json({ ok: false, message: "4자리 비밀번호를 입력해주세요." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, balance, password_hash, account_type")
    .eq("id", studentId)
    .single<ProfileRow>();

  if (error || !data) {
    return NextResponse.json({ ok: false, message: "계정을 찾을 수 없습니다." }, { status: 404 });
  }

  if (!verifyStudentPassword(password, data.password_hash)) {
    return NextResponse.json({ ok: false, message: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    profile: {
      id: data.id,
      name: data.name ?? "이름 없음",
      balance: data.balance ?? 0,
      accountType: data.account_type ?? "STUDENT"
    }
  });
}
