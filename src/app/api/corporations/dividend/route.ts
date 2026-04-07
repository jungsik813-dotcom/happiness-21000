import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getEffectiveTransferTimeLock, getTimeLockMessage } from "@/lib/time-lock";
import { normalizeDecimalPlaces } from "@/lib/vault-settings";
import { parseCloverAmount, isUuid } from "@/lib/validation";
import { readJsonObject } from "@/lib/safe-json";

type Body = {
  corporationId?: string;
  totalAmount?: number;
  message?: string;
};

export async function POST(request: Request) {
  const parsed = await readJsonObject(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data as Body;
  const corporationId = body.corporationId?.trim() ?? "";
  const message = body.message?.trim() ?? "";
  if (!isUuid(corporationId)) {
    return NextResponse.json({ ok: false, message: "법인 계정이 올바르지 않습니다." }, { status: 400 });
  }
  if (message.length < 10) {
    return NextResponse.json({ ok: false, message: "배당 사유는 10자 이상 입력해주세요." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const settings = await supabase
    .from("vault")
    .select("transfer_hours_enforced, decimal_places")
    .limit(1)
    .maybeSingle<{ transfer_hours_enforced: boolean | null; decimal_places: number | null }>();
  const transferHoursEnforced = settings.data?.transfer_hours_enforced ?? true;
  const dp = normalizeDecimalPlaces(settings.data?.decimal_places);

  const amountParsed = parseCloverAmount(body.totalAmount, dp);
  if (!amountParsed.ok) {
    return NextResponse.json({ ok: false, message: "총 배당 금액이 올바르지 않습니다." }, { status: 400 });
  }
  const totalAmount = amountParsed.value;
  const lock = getEffectiveTransferTimeLock(transferHoursEnforced);
  if (!lock.allowed) {
    return NextResponse.json({ ok: false, message: getTimeLockMessage(lock) }, { status: 400 });
  }

  const rpc = await supabase.rpc("apply_corporation_dividend", {
    p_corporation_id: corporationId,
    p_total_amount: totalAmount,
    p_message: message
  });
  if (rpc.error) {
    return NextResponse.json({ ok: false, message: `배당 처리 실패: ${rpc.error.message}` }, { status: 500 });
  }
  const row = (rpc.data as Array<{ ok: boolean; message: string; remaining_balance: number }> | null)?.[0];
  if (!row) {
    return NextResponse.json({ ok: false, message: "배당 처리 결과를 받지 못했습니다." }, { status: 500 });
  }
  return NextResponse.json({
    ok: row.ok,
    message: row.message,
    remainingBalance: row.remaining_balance
  }, { status: row.ok ? 200 : 400 });
}
