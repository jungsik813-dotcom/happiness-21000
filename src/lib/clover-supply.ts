/**
 * 클로버 총량 항등식:
 * 누적 발행 = 현재 유통 + 누적 소각
 *
 * 유통 = 지금 실제로 남아 있는 돈 (학생 + 금고 + 진행 중 펀딩)
 * 소각 = 발행 − 유통  (항상 맞도록 파생)
 */
export function computeCloverSupply(params: {
  issuanceTotal: number;
  profileBalances: number;
  vaultBalance: number;
  goalBalances: number;
}): { circulating: number; burned: number; issuance: number } {
  const issuance = Math.max(0, Number(params.issuanceTotal) || 0);
  const circulating = Math.max(
    0,
    (Number(params.profileBalances) || 0) +
      (Number(params.vaultBalance) || 0) +
      (Number(params.goalBalances) || 0)
  );
  const burned = Math.max(0, issuance - circulating);
  return { issuance, circulating, burned };
}
