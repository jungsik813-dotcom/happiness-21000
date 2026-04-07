/** vault.decimal_places 와 동일: 0=정수, 1·2=소수 표시 */
export type DecimalPlaces = 0 | 1 | 2;

const DP_FACTORS: Record<DecimalPlaces, number> = {
  0: 1,
  1: 10,
  2: 100
};

export function roundToDecimalPlaces(value: number, dp: DecimalPlaces): number {
  if (!Number.isFinite(value)) return 0;
  const f = DP_FACTORS[dp];
  return Math.round(value * f) / f;
}

/** 클로버 금액 표시 (천 단위 구분 + 소수 자릿수) */
export function formatCloverAmount(value: number, dp: DecimalPlaces): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = roundToDecimalPlaces(value, dp);
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: dp === 0 ? 0 : dp,
    maximumFractionDigits: dp
  }).format(rounded);
}

/** number input step 속성 */
export function amountInputStep(dp: DecimalPlaces): string {
  if (dp === 0) return "1";
  if (dp === 1) return "0.1";
  return "0.01";
}

/** 금액을 센트 단위 정수로 변환 (부동소수 오차 회피) */
export function toCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

/** 센트 단위 정수를 금액으로 복원 */
export function fromCents(cents: number): number {
  return cents / 100;
}
