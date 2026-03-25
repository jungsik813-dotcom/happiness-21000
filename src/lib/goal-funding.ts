/**
 * 펀딩 목표에 들어오는 금액을 목표 잔여 한도와 중앙 금고(초과분)로 나눕니다.
 */
export type GoalFundingSplit = {
  /** 목표에 적립되는 양 */
  toGoal: number;
  /** 중앙 금고로 보내는 초과분 (학생 기부·세금 등: 보낸 총액에서 toGoal을 뺀 나머지) */
  toVault: number;
  /** toGoal 적용 직후 목표 누적액 (종료 시 소각 기준) */
  newGoalTotal: number;
  /** 이번 적립으로 목표액에 도달·초과하는지 */
  goalReached: boolean;
  /**
   * 활성 목표인데 이미 current >= target 인 비정상 상태.
   * 먼저 목표를 정리(소각·비활성)한 뒤, 이번 입금은 전액 금고로 보냄.
   */
  needsStaleCompletion: boolean;
};

export function splitGoalFunding(
  currentAmount: number,
  targetAmount: number,
  incoming: number
): GoalFundingSplit {
  const target = Math.max(0, Math.floor(Number(targetAmount) || 0));
  const current = Math.max(0, Math.floor(Number(currentAmount) || 0));
  const incomingSafe = Math.max(0, Math.floor(incoming));

  if (incomingSafe <= 0) {
    return {
      toGoal: 0,
      toVault: 0,
      newGoalTotal: current,
      goalReached: false,
      needsStaleCompletion: false
    };
  }

  if (target <= 0) {
    return {
      toGoal: 0,
      toVault: incomingSafe,
      newGoalTotal: current,
      goalReached: false,
      needsStaleCompletion: false
    };
  }

  const needed = Math.max(0, target - current);
  if (needed <= 0) {
    return {
      toGoal: 0,
      toVault: incomingSafe,
      newGoalTotal: current,
      goalReached: false,
      needsStaleCompletion: current > 0
    };
  }

  const toGoal = Math.min(incomingSafe, needed);
  const toVault = incomingSafe - toGoal;
  const newGoalTotal = current + toGoal;
  const goalReached = newGoalTotal >= target;

  return {
    toGoal,
    toVault,
    newGoalTotal,
    goalReached,
    needsStaleCompletion: false
  };
}
