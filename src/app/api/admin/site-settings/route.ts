import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminTokenFromRequest, verifyAdminToken } from "@/lib/admin-auth";
import { readJsonObject } from "@/lib/safe-json";
import { normalizeDecimalPlaces } from "@/lib/vault-settings";
import { insertAuditLog } from "@/lib/audit-log";

export async function PATCH(request: Request) {
  const token = getAdminTokenFromRequest(request);
  if (!verifyAdminToken(token)) {
    return NextResponse.json(
      { ok: false, message: "관리자 비밀번호가 필요합니다." },
      { status: 401 }
    );
  }

  const parsed = await readJsonObject(request);
  if (!parsed.ok) return parsed.response;

  const body = parsed.data as {
    siteTitle?: string;
    siteSubtitle?: string;
    siteMetaDescription?: string;
    decimalPlaces?: number;
  };

  const siteTitle = typeof body.siteTitle === "string" ? body.siteTitle.trim() : undefined;
  const siteSubtitle = typeof body.siteSubtitle === "string" ? body.siteSubtitle.trim() : undefined;
  const siteMetaDescription =
    typeof body.siteMetaDescription === "string" ? body.siteMetaDescription.trim() : undefined;
  const decimalPlaces =
    typeof body.decimalPlaces === "number" ? normalizeDecimalPlaces(body.decimalPlaces) : undefined;

  if (
    siteTitle === undefined &&
    siteSubtitle === undefined &&
    siteMetaDescription === undefined &&
    decimalPlaces === undefined
  ) {
    return NextResponse.json({ ok: false, message: "변경할 항목이 없습니다." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const row = await supabase.from("vault").select("id").limit(1).maybeSingle<{ id: string }>();
  if (row.error || !row.data?.id) {
    return NextResponse.json(
      { ok: false, message: "vault 행을 찾을 수 없습니다." },
      { status: 500 }
    );
  }

  const patch: Record<string, string | number> = {};
  if (siteTitle !== undefined) patch.site_title = siteTitle;
  if (siteSubtitle !== undefined) patch.site_subtitle = siteSubtitle;
  if (siteMetaDescription !== undefined) patch.site_meta_description = siteMetaDescription;
  if (decimalPlaces !== undefined) patch.decimal_places = decimalPlaces;

  const { error } = await supabase.from("vault").update(patch).eq("id", row.data.id);

  if (error) {
    return NextResponse.json(
      { ok: false, message: `저장 실패: ${error.message}. vault에 site_title 등 컬럼이 있는지 마이그레이션을 확인하세요.` },
      { status: 500 }
    );
  }

  await insertAuditLog(supabase, {
    action: "admin.site_settings.updated",
    targetType: "vault",
    targetId: row.data.id,
    detail: patch
  });

  return NextResponse.json({ ok: true, message: "설정이 저장되었습니다." });
}
