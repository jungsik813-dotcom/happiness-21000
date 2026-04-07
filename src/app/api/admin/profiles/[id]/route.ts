import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminTokenFromRequest, verifyAdminToken } from "@/lib/admin-auth";
import { insertAuditLog } from "@/lib/audit-log";
import { isUuid } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const token = getAdminTokenFromRequest(_request);
  if (!verifyAdminToken(token)) {
    return NextResponse.json(
      { ok: false, message: "관리자 비밀번호가 필요합니다." },
      { status: 401 }
    );
  }

  const { id } = await params;
  if (!id || id.trim().length < 1) {
    return NextResponse.json({ ok: false, message: "올바른 학생 ID가 아닙니다." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  if (isUuid(id)) {
    const shareCheck = await supabase
      .from("corporation_shares")
      .select("corporation_id, share_count")
      .eq("student_id", id)
      .gt("share_count", 0);
    if (shareCheck.error) {
      return NextResponse.json(
        { ok: false, message: `삭제 전 지분 확인 실패: ${shareCheck.error.message}` },
        { status: 500 }
      );
    }
    if ((shareCheck.data?.length ?? 0) > 0) {
      const totalShares = (shareCheck.data ?? []).reduce(
        (sum, row) => sum + Number((row as { share_count: number | null }).share_count ?? 0),
        0
      );
      return NextResponse.json(
        {
          ok: false,
          message: `삭제할 수 없습니다. 이 학생은 현재 법인 지분 ${totalShares}주를 보유 중입니다. 먼저 법인 지분에서 0주로 조정한 뒤 삭제해주세요.`
        },
        { status: 400 }
      );
    }
  }

  const { error } = await supabase.from("profiles").delete().eq("id", id).eq("account_type", "STUDENT");
  if (error) {
    return NextResponse.json(
      {
        ok: false,
        message: `삭제 실패: ${error.message}. 학생 ID 타입/DB 스키마를 확인하세요.`
      },
      { status: 500 }
    );
  }

  await insertAuditLog(supabase, {
    action: "admin.student.deleted",
    targetType: "profile",
    targetId: id,
    detail: { burnedOnDelete: true }
  });

  return NextResponse.json({ ok: true, message: "학생 명단에서 제거되었습니다. (잔액은 소각 처리)" });
}
