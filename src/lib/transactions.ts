import type { SupabaseClient } from "@supabase/supabase-js";

export type TxPayload = {
  txType: string;
  amount: number;
  fromProfileId: string | null;
  toProfileId: string | null;
  toGoalId?: string | null;
  memo: string;
};

export async function insertTransaction(
  supabase: SupabaseClient,
  payload: TxPayload
): Promise<{ ok: true } | { ok: false; error: string }> {
  const attempts: Record<string, unknown>[] = [
    {
      tx_type: payload.txType,
      amount: payload.amount,
      from_profile_id: payload.fromProfileId,
      to_profile_id: payload.toProfileId,
      to_goal_id: payload.toGoalId ?? null,
      memo: payload.memo
    },
    {
      type: payload.txType,
      amount: payload.amount,
      from_profile_id: payload.fromProfileId,
      to_profile_id: payload.toProfileId,
      to_goal_id: payload.toGoalId ?? null,
      memo: payload.memo
    },
    {
      tx_type: payload.txType,
      amount: payload.amount,
      from_id: payload.fromProfileId,
      to_id: payload.toProfileId,
      memo: payload.memo
    },
    { amount: payload.amount, memo: payload.memo },
    {
      tx_type: payload.txType,
      amount: payload.amount,
      from_profile_id: payload.fromProfileId,
      to_profile_id: payload.toProfileId,
      memo: payload.memo
    },
    {
      type: payload.txType,
      amount: payload.amount,
      from_profile_id: payload.fromProfileId,
      to_profile_id: payload.toProfileId,
      memo: payload.memo
    },
    { amount: payload.amount }
  ];

  let lastError = "";
  for (const row of attempts) {
    const result = await supabase.from("transactions").insert(row);
    if (!result.error) return { ok: true };
    lastError = result.error.message;
  }
  return { ok: false, error: lastError };
}
