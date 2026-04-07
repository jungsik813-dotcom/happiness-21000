import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminTokenFromRequest, verifyAdminToken } from "@/lib/admin-auth";
import { hashStudentPassword } from "@/lib/student-auth";
import { readJsonObject } from "@/lib/safe-json";
import { isUuid } from "@/lib/validation";
import { insertAuditLog } from "@/lib/audit-log";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const token = getAdminTokenFromRequest(request);
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ ok: false, message: "관리자 비밀번호가 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ ok: false, message: "법인 ID 오류" }, { status: 400 });

  const parsed = await readJsonObject(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data as { password?: string };
  const password = body.password?.trim() ?? "";
  if (!/^\d{4}$/.test(password)) {
    return NextResponse.json({ ok: false, message: "비밀번호는 4자리 숫자입니다." }, { status: 400 });
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ password_hash: hashStudentPassword(password) })
    .eq("id", id)
    .eq("account_type", "CORPORATION");
  if (error) {
    return NextResponse.json({ ok: false, message: `비밀번호 초기화 실패: ${error.message}` }, { status: 500 });
  }
  await insertAuditLog(supabase, {
    action: "admin.corporation.password_reset",
    targetType: "profile",
    targetId: id
  });
  return NextResponse.json({ ok: true, message: "법인 비밀번호가 재설정되었습니다." });
}

export async function DELETE(request: Request, { params }: Params) {
  const token = getAdminTokenFromRequest(request);
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ ok: false, message: "관리자 비밀번호가 필요합니다." }, { status: 401 });
  }
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ ok: false, message: "법인 ID 오류" }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const rpc = await supabase.rpc("admin_delete_corporation_burn", {
    p_corporation_id: id
  });
  if (rpc.error) {
    return NextResponse.json(
      { ok: false, message: `법인 삭제 실패: ${rpc.error.message}. 013 마이그레이션 적용 여부를 확인하세요.` },
      { status: 500 }
    );
  }
  const row = (rpc.data as Array<{ ok: boolean; message: string; burned_amount: number }> | null)?.[0];
  if (!row?.ok) {
    return NextResponse.json({ ok: false, message: row?.message ?? "법인 삭제 실패" }, { status: 400 });
  }
  await insertAuditLog(supabase, {
    action: "admin.corporation.deleted",
    targetType: "profile",
    targetId: id,
    detail: { burnedOnDelete: true, burnedAmount: row.burned_amount ?? 0 }
  });
  return NextResponse.json({
    ok: true,
    message:
      (row.burned_amount ?? 0) > 0
        ? `법인이 제거되었습니다. 잔액 ${row.burned_amount}는 소각 처리되었습니다.`
        : "법인이 제거되었습니다."
  });
}
