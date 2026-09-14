"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "@/components/admin/admin-provider";
import AdminGate from "@/components/admin/admin-gate";
import { CURRENCY, WEALTH_TAX_RATE } from "@/lib/constants";
import { formatCloverAmount } from "@/lib/money";
import type { DecimalPlaces } from "@/lib/money";
import { getWeeklyIssuanceCap, TOTAL_SUPPLY } from "@/lib/issuance-schedule";
import {
  ContributionRankList,
  contributorRankButtonSuffix,
  sortGoalsByStudentContributionTotal
} from "@/components/dashboard/contribution-rank-list";
import AdminCollapsible from "@/components/admin/admin-collapsible";

const WEALTH_TAX_PCT = Math.round(WEALTH_TAX_RATE * 100);
const ADMIN_RANK_ROWS = Number.POSITIVE_INFINITY;

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

type FundingSectionProps = {
  goals: Goal[];
  contributions?: Record<string, GoalContributions>;
  burnedByGoal?: Record<string, number>;
  decimalPlaces?: DecimalPlaces;
  issuanceTotal?: number;
  issuanceCount?: number;
  studentCount?: number;
};

function WeeklyButton({
  decimalPlaces = 0,
  issuanceTotal = 0,
  issuanceCount = 0,
  studentCount = 0
}: {
  decimalPlaces?: DecimalPlaces;
  issuanceTotal?: number;
  issuanceCount?: number;
  studentCount?: number;
}) {
  const router = useRouter();
  const { token, logout } = useAdmin();
  const [isWeeklyLoading, setIsWeeklyLoading] = useState(false);
  const remaining = Math.max(0, TOTAL_SUPPLY - issuanceTotal);
  const nextWeek = issuanceCount + 1;
  const scheduleCap = getWeeklyIssuanceCap(nextWeek);
  const suggested = Math.min(scheduleCap > 0 ? scheduleCap : remaining, remaining);
  const [miningAmount, setMiningAmount] = useState(String(suggested));

  const amountNum = Number(miningAmount);
  const perPreview =
    studentCount > 0 && Number.isFinite(amountNum) && amountNum > 0
      ? Math.floor(amountNum / studentCount)
      : 0;

  async function handleWeekly() {
    const amt = Number(miningAmount);
    if (!Number.isFinite(amt) || amt < 0) {
      alert("지급할 클로버 씨앗 금액을 확인해 주세요.");
      return;
    }
    if (amt > remaining) {
      alert(`남은 발행 한도(${remaining} 클로버)를 넘을 수 없습니다.`);
      return;
    }

    setIsWeeklyLoading(true);
    try {
      const res = await fetch("/api/admin/weekly", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: JSON.stringify({ miningAmount: amt })
      });
      const data = (await res.json()) as { ok: boolean; message: string };
      if (data.ok) {
        alert(data.message);
        logout();
        router.refresh();
      } else {
        alert(data.message || "주간 실행에 실패했습니다.");
      }
    } catch {
      alert("주간 실행 중 오류가 발생했습니다.");
    } finally {
      setIsWeeklyLoading(false);
    }
  }

  return (
    <div className="ui-card w-full max-w-md space-y-3 p-4 sm:w-auto">
      <p className="text-sm font-bold text-[#1f3d32]">주간 실행</p>
      <p className="text-xs text-[#5d7a6c]">
        보유세 {WEALTH_TAX_PCT}% 징수 후, 입력한 클로버 씨앗을 학생에게 균등 지급합니다.
        <br />
        남은 한도 {remaining.toLocaleString("ko-KR")} / {TOTAL_SUPPLY.toLocaleString("ko-KR")} ·
        권장(참고) {suggested.toLocaleString("ko-KR")}
      </p>
      <label className="block">
        <span className="ui-label">이번 주 씨앗 지급액 (전체)</span>
        <input
          type="number"
          min={0}
          max={remaining}
          step={decimalPlaces === 0 ? 1 : decimalPlaces === 1 ? 0.1 : 0.01}
          value={miningAmount}
          onChange={(e) => setMiningAmount(e.target.value)}
          disabled={isWeeklyLoading || remaining <= 0}
          className="ui-input"
        />
      </label>
      {studentCount > 0 && amountNum > 0 && (
        <p className="text-xs text-[#2fbf71]">
          학생 {studentCount}명 · 1인당 약 {perPreview.toLocaleString("ko-KR")} 클로버
          {amountNum - perPreview * studentCount > 0
            ? ` (나머지 ${amountNum - perPreview * studentCount} → 중앙 금고)`
            : ""}
        </p>
      )}
      <button
        type="button"
        onClick={handleWeekly}
        disabled={isWeeklyLoading || remaining <= 0}
        className="ui-btn-primary w-full disabled:cursor-not-allowed"
      >
        {isWeeklyLoading
          ? "주간 실행 중..."
          : remaining <= 0
            ? "발행 한도 소진"
            : `주간 실행 (보유세 ${WEALTH_TAX_PCT}% + 씨앗 지급)`}
      </button>
    </div>
  );
}

export default function FundingSection({
  goals,
  contributions = {},
  burnedByGoal = {},
  decimalPlaces = 0,
  issuanceTotal = 0,
  issuanceCount = 0,
  studentCount = 0
}: FundingSectionProps) {
  const [showCompleted, setShowCompleted] = useState(false);
  const activeGoals = sortGoalsByStudentContributionTotal(
    goals.filter((g) => g.is_active),
    contributions
  );
  const completedGoals = sortGoalsByStudentContributionTotal(
    goals.filter((g) => !g.is_active),
    contributions
  );

  return (
    <section className="mb-8 space-y-6">
      <AdminGate
        fallback={
          <button type="button" className="ui-btn-secondary">
            🔒 주간 실행 (관리자 전용)
          </button>
        }
      >
        <WeeklyButton
          decimalPlaces={decimalPlaces}
          issuanceTotal={issuanceTotal}
          issuanceCount={issuanceCount}
          studentCount={studentCount}
        />
      </AdminGate>

      <AdminCollapsible
        title="펀딩 목표 현황"
        description={`활성 ${activeGoals.length}개${completedGoals.length > 0 ? ` · 완료 ${completedGoals.length}개` : ""}`}
        defaultOpen
      >
        {activeGoals.length === 0 ? (
          <p className="rounded-2xl border border-[#e8f4ee] bg-[#f7fcf9] px-4 py-3 text-sm text-[#5d7a6c]">
            활성 펀딩 목표가 없습니다. 위에서 새 목표를 만들 수 있어요. 주간 실행의 보유세와 씨앗
            나머지는 중앙 금고로 들어갑니다.
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

        {completedGoals.length > 0 && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setShowCompleted((v) => !v)}
              className="flex w-full items-center justify-between rounded-2xl border border-[#d7efe2] bg-white px-4 py-3 text-left text-sm font-bold text-[#1f3d32] shadow-sm transition hover:border-[#2fbf71]"
            >
              <span>완료된 펀딩 ({completedGoals.length})</span>
              <span className="text-[#9bb5a8]">{showCompleted ? "접기 ▲" : "펼치기 ▼"}</span>
            </button>
            {showCompleted && (
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
            )}
          </div>
        )}
      </AdminCollapsible>
    </section>
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
    <article className="ui-card p-5">
      <p className="text-sm font-semibold text-[#2fbf71]">{goal.name}</p>
      <p className="mt-2 text-2xl font-extrabold text-[#1f3d32]">
        {formatCloverAmount(goal.current_amount, decimalPlaces)}{" "}
        <span className="text-lg font-normal text-[#5d7a6c]">
          / {formatCloverAmount(goal.target_amount, decimalPlaces)} {CURRENCY}
        </span>
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e8f7ef]">
        <div
          className="h-full rounded-full bg-[#2fbf71] transition-all duration-500"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-[#5d7a6c]">{progress.toFixed(1)}% 달성</p>

      <div className="mt-3 border-t border-[#e8f4ee] pt-3">
        <button
          type="button"
          onClick={() => setShowContributors(!showContributors)}
          className="flex w-full items-center justify-between text-left text-xs font-bold text-[#2fbf71]"
        >
          기부 랭킹
          {contributions?.byPerson?.length
            ? contributorRankButtonSuffix(contributions.byPerson.length, ADMIN_RANK_ROWS)
            : ""}
          <span className="text-[#9bb5a8]">{showContributors ? "▲" : "▼"}</span>
        </button>
        {showContributors && contributions ? (
          <ContributionRankList
            byPerson={contributions.byPerson}
            compact
            maxRows={ADMIN_RANK_ROWS}
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
      <p className="text-sm font-semibold text-[#5d7a6c]">✓ {goal.name}</p>
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
          <p className="text-sm font-semibold text-[#ff7a59]">
            소각: {formatCloverAmount(burnedAmount!, decimalPlaces)} {CURRENCY}
          </p>
          <p className="text-xs text-[#7a5345]">펀딩 완료로 유통에서 제거되었습니다.</p>
        </div>
      )}
      <div className="mt-3 border-t border-[#e5ebe8] pt-3">
        <button
          type="button"
          onClick={() => setShowContributors(!showContributors)}
          className="flex w-full items-center justify-between text-left text-xs font-bold text-[#5d7a6c]"
        >
          기부 랭킹 (전체)
          {contributions?.byPerson?.length
            ? contributorRankButtonSuffix(contributions.byPerson.length, ADMIN_RANK_ROWS)
            : ""}
          <span className="text-[#9bb5a8]">{showContributors ? "▲" : "▼"}</span>
        </button>
        {showContributors ? (
          contributions ? (
            <div className="mt-2">
              <ContributionRankList
                byPerson={contributions.byPerson}
                maxRows={ADMIN_RANK_ROWS}
                decimalPlaces={decimalPlaces}
              />
            </div>
          ) : (
            <p className="mt-2 text-xs text-[#9bb5a8]">기여 데이터가 없습니다.</p>
          )
        ) : null}
      </div>
    </article>
  );
}
