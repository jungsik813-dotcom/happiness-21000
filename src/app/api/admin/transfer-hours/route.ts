import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminTokenFromRequest, verifyAdminToken } from "@/lib/admin-auth";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const res = await supabase
    .from("vault")
    .select("transfer_hours_enforced")
    .limit(1)
    .maybeSingle<{ transfer_hours_enforced: boolean | null }>();

  const enforced = res.data?.transfer_hours_enforced ?? true;
  return NextResponse.json({ ok: true, transferHoursEnforced: enforced });
}

export async function PATCH(request: Request) {
  const token = getAdminTokenFromRequest(request);
  if (!verifyAdminToken(token)) {
    return NextResponse.json(
      { ok: false, message: "관리자 비밀번호가 필요합니다." },
      { status: 401 }
    );
  }

  const body = (await request.json()) as { transferHoursEnforced?: boolean };
  const transferHoursEnforced = Boolean(body.transferHoursEnforced);

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
    .update({ transfer_hours_enforced: transferHoursEnforced })
    .eq("id", vault.id);

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        message: `설정 저장 실패: ${error.message}. Supabase에서 vault.transfer_hours_enforced 컬럼을 추가했는지 확인하세요.`
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    transferHoursEnforced,
    message: transferHoursEnforced
      ? "영업시간 제한 ON — 평일 08:30~15:30(KST)에만 송금 가능합니다."
      : "영업시간 제한 OFF — 시간과 관계없이 송금할 수 있습니다."
  });
}
