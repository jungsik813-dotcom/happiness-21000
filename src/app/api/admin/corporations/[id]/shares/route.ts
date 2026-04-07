import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminTokenFromRequest, verifyAdminToken } from "@/lib/admin-auth";
import { readJsonObject } from "@/lib/safe-json";
import { isUuid } from "@/lib/validation";
import { insertAuditLog } from "@/lib/audit-log";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const token = getAdminTokenFromRequest(request);
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ ok: false, message: "관리자 비밀번호가 필요합니다." }, { status: 401 });
  }
  const { id: corporationId } = await params;
  if (!isUuid(corporationId)) {
    return NextResponse.json({ ok: false, message: "법인 ID 오류" }, { status: 400 });
  }

  const parsed = await readJsonObject(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data as { holdings?: Array<{ studentId: string; shareCount: number }> };
  const holdings = Array.isArray(body.holdings) ? body.holdings : [];
  const total = holdings.reduce((sum, h) => sum + Number(h.shareCount || 0), 0);
  if (total !== 10) {
    return NextResponse.json({ ok: false, message: "주식 총합은 10이어야 합니다." }, { status: 400 });
  }
  for (const h of holdings) {
    if (!isUuid(h.studentId)) {
      return NextResponse.json({ ok: false, message: "학생 ID 오류가 있습니다." }, { status: 400 });
    }
    const c = Number(h.shareCount);
    if (!Number.isInteger(c) || c < 0 || c > 10) {
      return NextResponse.json({ ok: false, message: "주식 수는 0~10 정수여야 합니다." }, { status: 400 });
    }
  }

  const supabase = await createSupabaseServerClient();
  const rpc = await supabase.rpc("admin_replace_corporation_shares", {
    p_corporation_id: corporationId,
    p_holdings: holdings
  });
  if (rpc.error) {
    return NextResponse.json({ ok: false, message: `지분 저장 실패: ${rpc.error.message}` }, { status: 500 });
  }
  const row = (rpc.data as Array<{ ok: boolean; message: string }> | null)?.[0];
  if (!row?.ok) {
    return NextResponse.json({ ok: false, message: row?.message ?? "지분 저장 실패" }, { status: 400 });
  }

  await insertAuditLog(supabase, {
    action: "admin.corporation.shares_updated",
    targetType: "corporation_shares",
    targetId: corporationId,
    detail: { holdings }
  });

  return NextResponse.json({ ok: true, message: "주식 보유 현황이 저장되었습니다." });
}
