/** UUID(일반적인 8-4-4-4-12 형식) */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(id: string | null | undefined): boolean {
  return typeof id === "string" && UUID_RE.test(id.trim());
}

/** 송금·기부 금액: 양의 정수, 상한으로 이상값 방지 */
const MAX_CLOVER_AMOUNT = 10_000_000;

export function parseCloverAmount(raw: unknown): { ok: true; value: number } | { ok: false } {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return { ok: false };
  const intVal = Math.floor(n);
  if (intVal < 1 || intVal > MAX_CLOVER_AMOUNT) return { ok: false };
  return { ok: true, value: intVal };
}
