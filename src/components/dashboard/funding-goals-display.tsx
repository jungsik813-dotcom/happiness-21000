"use client";

import { useState } from "react";
import { CURRENCY } from "@/lib/constants";
import { formatCloverAmount } from "@/lib/money";
import type { DecimalPlaces } from "@/lib/money";
import {
  ContributionRankList,
  contributorRankButtonSuffix,
  sortGoalsByStudentContributionTotal
} from "@/components/dashboard/contribution-rank-list";
import SectionCollapsible from "@/components/ui/section-collapsible";

export type Goal = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  is_active: boolean;
};

type GoalContributions = {
  total: number;
  byPerson: Array<{ id: string; name: string; amount: number; percent: number }>;
};

type FundingGoalsDisplayProps = {
  goals: Goal[];
  contributions?: Record<string, GoalContributions>;
  burnedByGoal?: Record<string, number>;
  decimalPlaces?: DecimalPlaces;
};

export default function FundingGoalsDisplay({
  goals,
  contributions = {},
  burnedByGoal = {},
  decimalPlaces = 0
}: FundingGoalsDisplayProps) {
  const activeGoals = sortGoalsByStudentContributionTotal(
    goals.filter((g) => g.is_active),
    contributions
  );
  const completedGoals = sortGoalsByStudentContributionTotal(
    goals.filter((g) => !g.is_active),
    contributions
  );

  return (
    <div className="mb-8 space-y-4">
      <SectionCollapsible
        title="진행 중인 펀딩"
        description={
          activeGoals.length > 0
            ? `${activeGoals.length}개 · 눌러서 진행 상황을 봐요`
            : "지금 열린 목표가 없어요"
        }
        className="rounded-[2rem] border border-[#d7efe2] bg-white/90 p-5 shadow-[0_8px_24px_rgba(47,191,113,0.06)] md:p-6"
      >
        {activeGoals.length === 0 ? (
          <p className="rounded-2xl border border-[#e8f4ee] bg-[#f7fcf9] px-4 py-3 text-sm text-[#5d7a6c]">
            진행 중인 펀딩 목표가 없습니다.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {activeGoals.map((goal) => (
              <ActiveGoalCard
                key={goal.id}
                goal={goal}
                contributions={contributions[goal.id]}
                decimalPlaces={decimalPlaces}
              />
            ))}
          </div>
        )}
      </SectionCollapsible>

      {completedGoals.length > 0 && (
        <SectionCollapsible
          title="완료된 펀딩"
          description={`${completedGoals.length}개 · 필요할 때만 펼쳐 보세요`}
          className="rounded-[2rem] border border-[#d7efe2] bg-white/90 p-5 shadow-[0_8px_24px_rgba(47,191,113,0.06)] md:p-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {completedGoals.map((goal) => (
              <CompletedGoalCard
                key={goal.id}
                goal={goal}
                contributions={contributions[goal.id]}
                burnedAmount={burnedByGoal[goal.id]}
                decimalPlaces={decimalPlaces}
              />
            ))}
          </div>
        </SectionCollapsible>
      )}
    </div>
  );
}

function ActiveGoalCard({
  goal,
  contributions,
  decimalPlaces
}: {
  goal: Goal;
  contributions?: GoalContributions;
  decimalPlaces: DecimalPlaces;
}) {
  const [showContributors, setShowContributors] = useState(false);
  const progress = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;

  return (
    <article className="rounded-3xl border border-[#d7efe2] bg-white p-5 shadow-[0_8px_24px_rgba(47,191,113,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(47,191,113,0.12)]">
      <p className="text-sm font-bold text-[#2fbf71]">{goal.name}</p>
      <p className="mt-2 text-2xl font-extrabold text-[#1f3d32]">
        {formatCloverAmount(goal.current_amount, decimalPlaces)}{" "}
        <span className="text-lg font-normal text-[#5d7a6c]">
          / {formatCloverAmount(goal.target_amount, decimalPlaces)} {CURRENCY}
        </span>
      </p>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#e8f7ef]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#2fbf71] to-[#7ad9a3] transition-all duration-500"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-[#5d7a6c]">{progress.toFixed(1)}% 달성</p>

      <div className="mt-3 border-t border-[#e8f4ee] pt-3">
        <button
          type="button"
          onClick={() => setShowContributors(!showContributors)}
          className="ui-expand-trigger -mx-1 flex w-full items-center justify-between px-2 py-1 text-left text-xs font-bold text-[#2fbf71] hover:text-[#1f7a4a]"
        >
          기부 랭킹
          {contributions?.byPerson?.length
            ? contributorRankButtonSuffix(contributions.byPerson.length)
            : ""}
          <span className="ui-expand-hint text-[#9bb5a8]">{showContributors ? "▲" : "▼"}</span>
        </button>
        {showContributors && contributions ? (
          <ContributionRankList
            byPerson={contributions.byPerson}
            compact
            decimalPlaces={decimalPlaces}
          />
        ) : showContributors ? (
          <p className="mt-1 text-xs text-[#9bb5a8]">아직 학생 기부가 없습니다.</p>
        ) : null}
      </div>
    </article>
  );
}

function CompletedGoalCard({
  goal,
  contributions,
  burnedAmount,
  decimalPlaces
}: {
  goal: Goal;
  contributions?: GoalContributions;
  burnedAmount?: number;
  decimalPlaces: DecimalPlaces;
}) {
  const [showContributors, setShowContributors] = useState(false);
  const totalContributed = contributions?.total ?? 0;

  return (
    <article className="rounded-3xl border border-[#e5ebe8] bg-[#f8fbf9] p-5">
      <p className="text-sm font-bold text-[#5d7a6c]">✓ {goal.name}</p>
      <p className="mt-2 text-lg font-bold text-[#1f3d32]">
        목표 {formatCloverAmount(goal.target_amount, decimalPlaces)} {CURRENCY} 달성
        {totalContributed > 0 && (
          <span className="ml-2 text-sm font-normal text-[#5d7a6c]">
            (학생 기부 {formatCloverAmount(totalContributed, decimalPlaces)} {CURRENCY})
          </span>
        )}
      </p>
      {(burnedAmount ?? 0) > 0 && (
        <div className="mt-2 rounded-2xl border border-[#ffe0d4] bg-[#fff4f0] px-3 py-2">
          <p className="text-sm font-bold text-[#ff7a59]">
            소각 {formatCloverAmount(burnedAmount!, decimalPlaces)} {CURRENCY}
          </p>
          <p className="text-xs text-[#7a5345]">펀딩 완료로 유통에서 제거되었습니다.</p>
        </div>
      )}
      <div className="mt-3 border-t border-[#e5ebe8] pt-3">
        <button
          type="button"
          onClick={() => setShowContributors(!showContributors)}
          className="ui-expand-trigger -mx-1 flex w-full items-center justify-between px-2 py-1 text-left text-xs font-bold text-[#5d7a6c] hover:text-[#1f3d32]"
        >
          기부 랭킹 (상위 10명)
          {contributions?.byPerson?.length
            ? contributorRankButtonSuffix(contributions.byPerson.length)
            : ""}
          <span className="ui-expand-hint text-[#9bb5a8]">{showContributors ? "▲" : "▼"}</span>
        </button>
        {showContributors ? (
          contributions ? (
            <div className="mt-2">
              <ContributionRankList byPerson={contributions.byPerson} decimalPlaces={decimalPlaces} />
            </div>
          ) : (
            <p className="mt-2 text-xs text-[#9bb5a8]">기여 데이터가 없습니다.</p>
          )
        ) : null}
      </div>
    </article>
  );
}
