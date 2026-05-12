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

/**
 * transactions 스키마가 `tx_type` 또는 `type` 중 하나만 있는 환경을 모두 지원한다.
 */
export async function fetchTransactionsWithTypeFallback(
  supabase: SupabaseClient,
  selectColumns: string,
  limit: number = 2000
): Promise<{ data: Array<Record<string, unknown>>; errorMessage?: string }> {
  const txTypeQuery = await supabase
    .from("transactions")
    .select(`${selectColumns}, tx_type`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!txTypeQuery.error) {
    return { data: (txTypeQuery.data as Array<Record<string, unknown>> | null) ?? [] };
  }

  const legacyTypeQuery = await supabase
    .from("transactions")
    .select(`${selectColumns}, type`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (legacyTypeQuery.error) {
    return { data: [], errorMessage: legacyTypeQuery.error.message };
  }

  const rows = ((legacyTypeQuery.data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
    ...row,
    tx_type: typeof row.type === "string" ? row.type : null
  }));

  return { data: rows };
}
