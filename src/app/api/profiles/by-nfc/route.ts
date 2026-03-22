import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tagId = searchParams.get("tagId")?.trim();

  if (!tagId) {
    return NextResponse.json(
      { ok: false, message: "tagId가 필요합니다." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, balance, nfc_tag_id")
    .eq("nfc_tag_id", tagId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, message: "조회에 실패했습니다.", error: error.message },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { ok: false, message: "등록된 학생을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    profile: {
      id: data.id,
      name: data.name,
      balance: data.balance ?? 0
    }
  });
}
