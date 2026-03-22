import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminTokenFromRequest, verifyAdminToken } from "@/lib/admin-auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const token = getAdminTokenFromRequest(request);
  if (!verifyAdminToken(token)) {
    return NextResponse.json(
      { ok: false, message: "관리자 비밀번호가 필요합니다." },
      { status: 401 }
    );
  }

  const { id } = await params;
  const body = (await request.json()) as { nfcTagId?: string | null };

  const nfcTagId =
    body.nfcTagId === null || body.nfcTagId === undefined
      ? null
      : typeof body.nfcTagId === "string"
        ? body.nfcTagId.trim() || null
        : null;

  const supabase = await createSupabaseServerClient();

  if (nfcTagId !== null) {
    const existing = await supabase
      .from("profiles")
      .select("id")
      .eq("nfc_tag_id", nfcTagId)
      .neq("id", id)
      .maybeSingle();

    if (existing.data) {
      return NextResponse.json(
        { ok: false, message: "이 NFC 태그는 이미 다른 학생에게 등록되어 있습니다." },
        { status: 400 }
      );
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ nfc_tag_id: nfcTagId })
    .eq("id", id);

  if (error) {
    const hint =
      error.message?.includes("nfc_tag_id") || error.message?.includes("column")
        ? " Supabase SQL Editor에서 'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nfc_tag_id text UNIQUE;' 실행이 필요할 수 있습니다."
        : "";
    return NextResponse.json(
      {
        ok: false,
        message: `NFC 등록에 실패했습니다.${hint}`,
        error: error.message
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: nfcTagId ? "NFC가 등록되었습니다." : "NFC 등록이 해제되었습니다."
  });
}
