/**
 * 스마트 타임락: 평일 08:30 ~ 15:30 (KST)에만 P2P 송금 가능
 */

const START_HOUR = 8;
const START_MINUTE = 30;
const END_HOUR = 15;
const END_MINUTE = 30;

export type TimeLockResult =
  | { allowed: true }
  | { allowed: false; reason: "weekend" | "outside_hours" };

/**
 * 관리자가 평일 송금 시간 제한을 끈 경우(`transferHoursEnforced === false`)에는 항상 허용.
 */
export function getEffectiveTransferTimeLock(transferHoursEnforced: boolean): TimeLockResult {
  if (!transferHoursEnforced) return { allowed: true };
  return checkTransferTimeLock();
}

/**
 * 현재 시각이 송금 가능 시간인지 검사 (KST 기준)
 * - 평일(월~금) 08:30 ~ 15:30
 */
export function checkTransferTimeLock(): TimeLockResult {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  const utcDay = now.getUTCDay();

  const kstHour = (utcHour + 9) % 24;
  const kstDay = utcHour + 9 >= 24 ? (utcDay + 1) % 7 : utcDay;

  const totalMinutes = kstHour * 60 + utcMinute;
  const startMinutes = START_HOUR * 60 + START_MINUTE;
  const endMinutes = END_HOUR * 60 + END_MINUTE;

  if (kstDay === 0 || kstDay === 6) {
    return { allowed: false, reason: "weekend" };
  }
  if (totalMinutes < startMinutes || totalMinutes > endMinutes) {
    return { allowed: false, reason: "outside_hours" };
  }
  return { allowed: true };
}

/** 영업 종료 시 사용자에게 보여줄 메시지 */
export function getTimeLockMessage(result: TimeLockResult): string {
  if (result.allowed) return "";
  if (result.reason === "weekend") {
    return "주말에는 송금이 불가합니다. 평일(월~금) 08:30~15:30에 이용해주세요.";
  }
  return "현재 영업 시간이 아닙니다. 평일(월~금) 08:30~15:30에 송금할 수 있어요.";
}
