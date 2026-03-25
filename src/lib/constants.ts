/** 통화 단위 (화면 표시용) */
export const CURRENCY = "클로버";

/** 보유세(주간 실행 시 잔액에서 징수 후 펀딩 또는 중앙 금고) */
export const WEALTH_TAX_RATE = 0.05;

/** 학생 송금·펀딩 기부 1회당 상한: 요청 시점 잔액의 비율 (여러 번 보내도 매번 현재 잔액 기준) */
export const PER_TRANSFER_MAX_RATE = 0.1;

export function maxAmountPerTransfer(balance: number): number {
  return Math.floor(balance * PER_TRANSFER_MAX_RATE);
}
