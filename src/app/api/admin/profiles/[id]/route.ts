import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminTokenFromRequest, verifyAdminToken } from "@/lib/admin-auth";
import { insertAuditLog } from "@/lib/audit-log";
import { insertTransaction } from "@/lib/transactions";

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

  const profileRes = await supabase
    .from("profiles")
    .select("id, name, balance")
    .eq("id", id)
    .eq("account_type", "STUDENT")
    .maybeSingle<{ id: string; name: string | null; balance: number | null }>();

  if (profileRes.error || !profileRes.data) {
    return NextResponse.json(
      { ok: false, message: "학생을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const balance = Number(profileRes.data.balance ?? 0);
  const studentName = profileRes.data.name?.trim() || "이름 없음";

  if (balance > 0) {
    const burnTx = await insertTransaction(supabase, {
      txType: "burn",
      amount: balance,
      fromProfileId: id,
      toProfileId: null,
      toGoalId: null,
      memo: `학생 삭제 소각: ${studentName}`
    });
    if (!burnTx.ok) {
      return NextResponse.json(
        { ok: false, message: `소각 기록 저장 실패: ${burnTx.error}` },
        { status: 500 }
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
    detail: { burnedOnDelete: true, burnedAmount: balance }
  });

  return NextResponse.json({
    ok: true,
    message:
      balance > 0
        ? `학생 명단에서 제거되었습니다. (잔액 ${balance} 클로버 소각)`
        : "학생 명단에서 제거되었습니다."
  });
}
