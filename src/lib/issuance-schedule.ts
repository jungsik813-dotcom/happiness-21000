/**
 * 계단식 발행 스케줄 (34주 운영, 총 발행 21,000 클로버).
 * issuance_count가 N이면 다음 실행은 (N+1)주차입니다.
 *
 * 1단계 1~8주: 주당 1,400 (소계 11,200)
 * 2단계 9~16주: 주당 700 (소계 5,600)
 * 3단계 17~24주: 주당 350 (소계 2,800)
 * 4단계 25~33주: 주당 134 (소계 1,206), 34주: 194 (소계 1,400) — 합계 21,000
 */

export const TOTAL_SUPPLY = 21_000;
export const OPERATING_WEEKS = 34;

/** 1-based week index (1 … 34). 그 외는 0 */
export function getWeeklyIssuanceCap(weekNumber: number): number {
  if (weekNumber < 1 || weekNumber > OPERATING_WEEKS) return 0;
  if (weekNumber <= 8) return 1_400;
  if (weekNumber <= 16) return 700;
  if (weekNumber <= 24) return 350;
  if (weekNumber <= 33) return 134;
  return 194;
}
