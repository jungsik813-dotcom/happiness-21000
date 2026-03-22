import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.json(
      {
        ok: false,
        message: "Supabase 환경 변수가 설정되지 않았습니다."
      },
      { status: 500 }
    );
  }

  const supabase = createClient(url, anonKey);
  const { error } = await supabase.auth.getSession();

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Supabase 연결 실패",
        error: error.message
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Supabase 연결 성공"
  });
}
