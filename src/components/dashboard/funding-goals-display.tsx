"use client";

import { useState } from "react";
import { CURRENCY } from "@/lib/constants";

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

function toWon(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

type FundingGoalsDisplayProps = {
  goals: Goal[];
  contributions?: Record<string, GoalContributions>;
  burnedByGoal?: Record<string, number>;
};

function ContributionList({
  contributions,
  compact = false
}: {
  contributions: GoalContributions;
  compact?: boolean;
}) {
  const list = contributions?.byPerson ?? [];
  if (list.length === 0) {
    return <p className="text-xs text-gray-500">아직 학생 기부가 없습니다.</p>;
  }
  return (
    <ul className={compact ? "space-y-0.5" : "mt-2 space-y-1"}>
      {list.map((p) => (
        <li
          key={p.id}
          className={`flex items-center justify-between ${compact ? "text-xs" : "text-sm"}`}
        >
          <span className="text-gray-300">{p.name}</span>
          <span className="font-medium text-orange-400">
            {toWon(p.amount)} {CURRENCY} ({p.percent.toFixed(1)}%)
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function FundingGoalsDisplay({
  goals,
  contributions = {},
  burnedByGoal = {}
}: FundingGoalsDisplayProps) {
  const activeGoals = goals.filter((g) => g.is_active);
  const completedGoals = goals.filter((g) => !g.is_active);

  return (
    <section className="mb-8 space-y-6">
      <h2 className="text-xl font-bold text-white">펀딩 목표</h2>

      {activeGoals.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-slate-900/50 px-4 py-3 text-sm text-gray-400">
          진행 중인 펀딩 목표가 없습니다.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {activeGoals.map((goal) => (
            <ActiveGoalCard
              key={goal.id}
              goal={goal}
              contributions={contributions[goal.id]}
            />
          ))}
        </div>
      )}

      {completedGoals.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white">완료된 펀딩</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {completedGoals.map((goal) => (
              <CompletedGoalCard
                key={goal.id}
                goal={goal}
                contributions={contributions[goal.id]}
                burnedAmount={burnedByGoal[goal.id]}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ActiveGoalCard({
  goal,
  contributions
}: {
  goal: Goal;
  contributions?: GoalContributions;
}) {
  const [showContributors, setShowContributors] = useState(false);
  const progress = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;

  return (
    <article className="rounded-xl border border-orange-400/30 bg-slate-900/70 p-5 shadow-lg">
      <p className="text-sm font-semibold text-orange-300">{goal.name}</p>
      <p className="mt-2 text-2xl font-extrabold text-orange-400">
        {toWon(goal.current_amount)}{" "}
        <span className="text-lg font-normal text-gray-400">
          / {toWon(goal.target_amount)} {CURRENCY}
        </span>
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-orange-500 transition-all duration-500"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-gray-400">{progress.toFixed(1)}% 달성</p>

      <div className="mt-3 border-t border-white/10 pt-3">
        <button
          type="button"
          onClick={() => setShowContributors(!showContributors)}
          className="flex w-full items-center justify-between text-left text-xs font-medium text-orange-300/90 hover:text-orange-300"
        >
          기여자 보기 {contributions?.byPerson?.length ? `(${contributions.byPerson.length}명)` : ""}
          <span className="text-gray-500">{showContributors ? "▲" : "▼"}</span>
        </button>
        {showContributors && contributions ? (
          <ContributionList contributions={contributions} compact />
        ) : showContributors ? (
          <p className="mt-1 text-xs text-gray-500">아직 학생 기부가 없습니다.</p>
        ) : null}
      </div>
    </article>
  );
}

function CompletedGoalCard({
  goal,
  contributions,
  burnedAmount
}: {
  goal: Goal;
  contributions?: GoalContributions;
  burnedAmount?: number;
}) {
  const totalContributed = contributions?.total ?? 0;

  return (
    <article className="rounded-xl border border-slate-600/50 bg-slate-900/50 p-5 shadow-lg">
      <p className="text-sm font-semibold text-gray-400">✓ {goal.name}</p>
      <p className="mt-2 text-lg font-bold text-white">
        목표 {toWon(goal.target_amount)} {CURRENCY} 달성
        {totalContributed > 0 && (
          <span className="ml-2 text-sm font-normal text-gray-400">
            (학생 기부 {toWon(totalContributed)} {CURRENCY})
          </span>
        )}
      </p>
      {(burnedAmount ?? 0) > 0 && (
        <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-2">
          <p className="text-sm font-semibold text-amber-400">
            🔥 소각: {toWon(burnedAmount!)} {CURRENCY}
          </p>
          <p className="text-xs text-gray-400">펀딩 완료로 유통에서 제거되었습니다.</p>
        </div>
      )}
      <div className="mt-3 border-t border-white/10 pt-3">
        <p className="mb-2 text-xs font-medium text-gray-400">기여 현황</p>
        {contributions ? (
          <ContributionList contributions={contributions} />
        ) : (
          <p className="text-xs text-gray-500">기여 데이터가 없습니다.</p>
        )}
      </div>
    </article>
  );
}
