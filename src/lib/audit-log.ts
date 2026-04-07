import type { SupabaseClient } from "@supabase/supabase-js";

type AuditPayload = {
  actorType?: "ADMIN" | "CORPORATION" | "SYSTEM";
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  detail?: Record<string, unknown>;
};

export async function insertAuditLog(
  supabase: SupabaseClient,
  payload: AuditPayload
): Promise<void> {
  await supabase.from("audit_logs").insert({
    actor_type: payload.actorType ?? "ADMIN",
    actor_id: payload.actorId ?? null,
    action: payload.action,
    target_type: payload.targetType,
    target_id: payload.targetId ?? null,
    detail: payload.detail ?? {}
  });
}
