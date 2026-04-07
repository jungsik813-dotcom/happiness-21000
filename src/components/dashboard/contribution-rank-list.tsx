"use client";

import { CURRENCY } from "@/lib/constants";
import { formatCloverAmount } from "@/lib/money";
import type { DecimalPlaces } from "@/lib/money";

/** 펀딩 목표별 기부자 명단에 표시할 최대 인원 (1위~10위) */
export const CONTRIBUTION_LEADERBOARD_SIZE = 10;

export type ContributionPerson = {
  id: string;
  name: string;
  amount: number;
  percent: number;
};

type ContributionRankListProps = {
  byPerson: ContributionPerson[];
  compact?: boolean;
  /** 기본 10. 관리자 등에서 전체를 보려면 `Infinity` 또는 충분히 큰 수 */
  maxRows?: number;
  decimalPlaces?: DecimalPlaces;
};

/** 학생 기부 총액이 많은 펀딩 목표가 먼저 오도록 정렬 */
export function sortGoalsByStudentContributionTotal<
  G extends { id: string; name: string }
>(goals: G[], contributions: Record<string, { total: number }>): G[] {
  return [...goals].sort((a, b) => {
    const diff = (contributions[b.id]?.total ?? 0) - (contributions[a.id]?.total ?? 0);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name, "ko");
  });
}

/**
 * 접기 버튼 라벨. `displayCap`이 유한하고 전체보다 작으면 "상위 N명 / 전체" 형식.
 */
export function contributorRankButtonSuffix(
  total: number,
  displayCap: number = CONTRIBUTION_LEADERBOARD_SIZE
): string {
  if (total <= 0) return "";
  if (!Number.isFinite(displayCap) || displayCap >= total) {
    return ` · ${total}명`;
  }
  return ` · 상위 ${displayCap}명 / 전체 ${total}명`;
}

export function ContributionRankList({
  byPerson,
  compact = false,
  maxRows = CONTRIBUTION_LEADERBOARD_SIZE,
  decimalPlaces = 0
}: ContributionRankListProps) {
  if (byPerson.length === 0) {
    return <p className="text-xs text-gray-500">아직 학생 기부가 없습니다.</p>;
  }

  const top = byPerson.slice(0, maxRows);

  return (
    <ul className={compact ? "space-y-0.5" : "mt-2 space-y-1"}>
      {top.map((p, i) => (
        <li
          key={p.id}
          className={`flex items-center justify-between gap-2 ${compact ? "text-xs" : "text-sm"}`}
        >
          <span className="min-w-0 flex-1 truncate text-gray-300">
            <span className="mr-1.5 inline-block w-8 font-semibold text-orange-400/90">
              {i + 1}위
            </span>
            {p.name}
          </span>
          <span className="shrink-0 font-medium text-orange-400">
            {formatCloverAmount(p.amount, decimalPlaces)} {CURRENCY} ({p.percent.toFixed(1)}%)
          </span>
        </li>
      ))}
    </ul>
  );
}
