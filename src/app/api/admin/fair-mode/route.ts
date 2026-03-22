import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminTokenFromRequest, verifyAdminToken } from "@/lib/admin-auth";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const res = await supabase
    .from("vault")
    .select("fair_mode")
    .limit(1)
    .maybeSingle<{ fair_mode: boolean | null }>();

  const fairMode = res.data?.fair_mode ?? false;
  return NextResponse.json({ ok: true, fairMode });
}

export async function PATCH(request: Request) {
  const token = getAdminTokenFromRequest(request);
  if (!verifyAdminToken(token)) {
    return NextResponse.json(
      { ok: false, message: "관리자 비밀번호가 필요합니다." },
      { status: 401 }
    );
  }

  const body = (await request.json()) as { fairMode?: boolean };
  const fairMode = Boolean(body.fairMode);

  const supabase = await createSupabaseServerClient();
  const { data: vault, error: fetchError } = await supabase
    .from("vault")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (fetchError || !vault) {
    return NextResponse.json(
      { ok: false, message: "중앙 금고 정보를 찾을 수 없습니다." },
      { status: 500 }
    );
  }

  const { error } = await supabase
    .from("vault")
    .update({ fair_mode: fairMode })
    .eq("id", vault.id);

  if (error) {
    return NextResponse.json(
      { ok: false, message: `설정 저장 실패: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    fairMode,
    message: fairMode ? "장터 모드 ON - P2P 송금 한도 100%" : "장터 모드 OFF - P2P 송금 한도 10%"
  });
}
