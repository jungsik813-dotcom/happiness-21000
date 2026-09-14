/** 학생 간(P2P) 송금 시 선택하는 칭찬 사유 */
export const P2P_PRAISE_REASONS = [
  "선행을 칭찬합니다",
  "성과를 칭찬합니다",
  "도움을 주어 칭찬합니다.",
  "응원합니다",
  "학급장터에서 좋은 물건을 팔아주어 감사합니다"
] as const;

export type P2PPraiseReason = (typeof P2P_PRAISE_REASONS)[number];

export const P2P_PRAISE_NOTE_MIN_LENGTH = 5;
export const FUNDING_OR_VAULT_NOTE_MIN_LENGTH = 10;

export function isP2PPraiseReason(value: string): value is P2PPraiseReason {
  return (P2P_PRAISE_REASONS as readonly string[]).includes(value);
}

/** 타임라인·거래 메모에 넣을 칭찬 문구 */
export function formatP2PPraiseText(reason: string, note: string): string {
  return `${reason} · ${note.trim()}`;
}
