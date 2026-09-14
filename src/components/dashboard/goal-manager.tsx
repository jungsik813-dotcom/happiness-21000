"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "@/components/admin/admin-provider";
import AdminGate from "@/components/admin/admin-gate";
import AdminCollapsible from "@/components/admin/admin-collapsible";

export type Goal = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  is_active: boolean;
};

type GoalManagerProps = {
  goals: Goal[];
};

export default function GoalManager({ goals }: GoalManagerProps) {
  const router = useRouter();
  const { token, logout } = useAdmin();
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const authHeaders = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` })
  };

  async function handleCreate() {
    const amount = Number(targetAmount);
    if (!name.trim() || Number.isNaN(amount) || amount <= 0) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ name: name.trim(), targetAmount: amount })
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (data.ok) {
        setName("");
        setTargetAmount("");
        logout();
        router.refresh();
      } else if (res.status === 401) {
        alert("관리자 비밀번호가 필요합니다.");
      } else {
        alert(data.message ?? "목표 생성에 실패했습니다.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleActive(goal: Goal) {
    if (goal.is_active && goal.current_amount > 0) {
      const ok = window.confirm(
        `「${goal.name}」을(를) 완료·비활성으로 바꿀까요?\n모인 ${goal.current_amount} 클로버는 소각됩니다.\n\n달성 불가로 돈을 남기려면「환수」를 사용하세요.`
      );
      if (!ok) return;
    }

    setBusyId(goal.id);
    try {
      const res = await fetch(`/api/goals/${goal.id}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ isActive: !goal.is_active })
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      if (res.ok && data.ok !== false) {
        if (data.message) alert(data.message);
        router.refresh();
      } else {
        alert(data.message ?? "상태 변경에 실패했습니다.");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function reclaimToVault(goal: Goal) {
    if (goal.current_amount <= 0) {
      alert("환수할 금액이 없습니다.");
      return;
    }
    const ok = window.confirm(
      `「${goal.name}」에 모인 ${goal.current_amount} 클로버를 중앙 금고로 환수할까요?\n목표는 비활성으로 바뀌고, 모금액은 0이 됩니다.`
    );
    if (!ok) return;

    setBusyId(goal.id);
    try {
      const res = await fetch(`/api/goals/${goal.id}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ reclaimToVault: true })
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      if (res.ok && data.ok) {
        alert(data.message ?? "환수했습니다.");
        router.refresh();
      } else {
        alert(data.message ?? "환수에 실패했습니다.");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function deleteGoal(goal: Goal) {
    const ok = window.confirm(
      goal.current_amount > 0
        ? `「${goal.name}」을(를) 완전히 삭제할까요?\n모인 ${goal.current_amount} 클로버는 중앙 금고로 환수한 뒤 삭제됩니다.\n거래 기록(메모)은 남습니다.`
        : `「${goal.name}」을(를) 완전히 삭제할까요?\n거래 기록(메모)은 남습니다.`
    );
    if (!ok) return;

    setBusyId(goal.id);
    try {
      const res = await fetch(`/api/goals/${goal.id}`, {
        method: "DELETE",
        headers: authHeaders
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      if (res.ok && data.ok) {
        alert(data.message ?? "삭제했습니다.");
        router.refresh();
      } else {
        alert(data.message ?? "삭제에 실패했습니다.");
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminCollapsible
      title="펀딩 목표 관리"
      description="생성·활성/완료(소각)·환수(중앙 금고)·완전 삭제"
      className="ui-card mb-6 p-5"
    >
      <AdminGate
        fallback={
          <p className="rounded-2xl border border-[#d7efe2] bg-[#f7fcf9] px-4 py-3 text-center text-sm text-[#5d7a6c]">
            🔒 관리자 전용 영역입니다. 클릭하여 비밀번호를 입력하세요.
          </p>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="목표 이름 (예: 과자파티)"
              className="ui-input max-w-xs"
            />
            <input
              type="number"
              min={1}
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="목표 금액"
              className="ui-input w-28"
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={isSubmitting}
              className="ui-btn-primary"
            >
              {isSubmitting ? "생성 중..." : "새 목표 추가"}
            </button>
          </div>

          <p className="text-xs text-[#5d7a6c]">
            · <span className="font-semibold text-[#1f7a4a]">활성/비활성</span>: 완료 처리 시 모금액
            소각 · <span className="font-semibold text-[#2fbf71]">환수</span>: 달성 불가 시 중앙
            금고로 이동 · <span className="font-semibold text-red-600">삭제</span>: 목표 완전 제거
            (잔액 있으면 먼저 환수)
          </p>

          {goals.length > 0 && (
            <ul className="space-y-2">
              {goals.map((goal) => {
                const busy = busyId === goal.id;
                return (
                  <li
                    key={goal.id}
                    className="flex flex-col gap-2 rounded-2xl border border-[#d7efe2] bg-[#f7fcf9] px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#1f3d32]">{goal.name}</p>
                      <p className="text-xs text-[#5d7a6c]">
                        {goal.current_amount}/{goal.target_amount} 클로버 ·{" "}
                        {goal.is_active ? "진행 중" : "완료/비활성"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void toggleActive(goal)}
                        className={`rounded-full px-3 py-1 text-xs font-bold disabled:opacity-50 ${
                          goal.is_active
                            ? "bg-[#dff8ea] text-[#1f7a4a]"
                            : "bg-[#e8eee9] text-[#5d7a6c]"
                        }`}
                      >
                        {goal.is_active ? "활성→완료(소각)" : "다시 활성"}
                      </button>
                      <button
                        type="button"
                        disabled={busy || goal.current_amount <= 0}
                        onClick={() => void reclaimToVault(goal)}
                        className="rounded-full border border-[#2fbf71] bg-white px-3 py-1 text-xs font-bold text-[#1f7a4a] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        환수
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void deleteGoal(goal)}
                        className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        삭제
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </AdminGate>
    </AdminCollapsible>
  );
}
