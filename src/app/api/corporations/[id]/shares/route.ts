import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id: corporationId } = await params;
  if (!isUuid(corporationId)) {
    return NextResponse.json({ ok: false, message: "법인 ID 오류" }, { status: 400 });
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("corporation_shares")
    .select("student_id, share_count, profiles!corporation_shares_student_id_fkey(name)")
    .eq("corporation_id", corporationId);
  if (error) {
    return NextResponse.json({ ok: false, message: `지분 조회 실패: ${error.message}` }, { status: 500 });
  }

  const holdings = ((data as Array<Record<string, unknown>> | null) ?? []).map((r) => ({
    studentId: String(r.student_id ?? ""),
    shareCount: Number(r.share_count ?? 0),
    studentName:
      typeof (r.profiles as { name?: unknown } | null)?.name === "string"
        ? ((r.profiles as { name: string }).name || "이름 없음")
        : "이름 없음"
  }));
  return NextResponse.json({ ok: true, holdings });
}
