import { NextResponse } from "next/server";
import { verifyAdminPassword, createAdminToken } from "@/lib/admin-auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { password?: string };
    const password = body.password?.trim();

    if (!password) {
      return NextResponse.json(
        { ok: false, message: "비밀번호를 입력해주세요." },
        { status: 400 }
      );
    }

    if (!verifyAdminPassword(password)) {
      return NextResponse.json(
        { ok: false, message: "비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    const token = createAdminToken();
    return NextResponse.json({ ok: true, token });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "서버 오류";
    return NextResponse.json(
      { ok: false, message: msg },
      { status: 500 }
    );
  }
}
