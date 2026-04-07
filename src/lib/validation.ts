import type { DecimalPlaces } from "./money";
import { roundToDecimalPlaces } from "./money";

/** UUID(일반적인 8-4-4-4-12 형식) */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(id: string | null | undefined): boolean {
  return typeof id === "string" && UUID_RE.test(id.trim());
}

/** 송금·기부 금액: 양수, 소수 자릿수·상한 적용 */
const MAX_CLOVER_AMOUNT = 10_000_000;

export function parseCloverAmount(
  raw: unknown,
  dp: DecimalPlaces = 0
): { ok: true; value: number } | { ok: false } {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return { ok: false };
  const rounded = roundToDecimalPlaces(n, dp);
  const min = dp === 0 ? 1 : dp === 1 ? 0.1 : 0.01;
  if (rounded < min || rounded > MAX_CLOVER_AMOUNT) return { ok: false };
  return { ok: true, value: rounded };
}
