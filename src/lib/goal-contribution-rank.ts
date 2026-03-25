/**
 * 펀딩 기부 랭킹 집계에 넣을 거래인지.
 * - contribution: 학생이 직접 펀딩에 보낸 금액
 * - tax + to_goal_id + from_profile_id: 주간 실행 시 보유세가 활성 펀딩으로 간 학생별 금액
 */
export function shouldIncludeInGoalContributorRank(row: Record<string, unknown>): boolean {
  const txType = (row.tx_type ?? row.type ?? "") as string;
  if (txType === "contribution") return true;
  if (txType !== "tax") return false;
  const toGoalId = typeof row.to_goal_id === "string" ? row.to_goal_id : null;
  const fromId = typeof row.from_profile_id === "string" ? row.from_profile_id : null;
  return Boolean(toGoalId && fromId);
}
