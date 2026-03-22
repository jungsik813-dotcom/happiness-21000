"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "@/components/admin/admin-provider";
import AdminGate from "@/components/admin/admin-gate";

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
  const [expanded, setExpanded] = useState(false);

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
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleActive(goal: Goal) {
    const res = await fetch(`/api/goals/${goal.id}`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ isActive: !goal.is_active })
    });
    if (res.ok) router.refresh();
  }

  return (
    <section className="mb-6 rounded-xl border border-white/10 bg-slate-900/50 p-4">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-left text-sm font-semibold text-gray-300"
      >
        펀딩 목표 관리
        <span className="text-gray-500">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <AdminGate
          fallback={
            <p className="mt-4 rounded-lg border border-orange-400/30 bg-orange-500/10 px-4 py-3 text-center text-sm text-orange-300">
              🔒 관리자 전용 영역입니다. 클릭하여 비밀번호를 입력하세요.
            </p>
          }
        >
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="목표 이름 (예: 과자파티)"
              className="rounded-md border border-white/20 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-orange-400"
            />
            <input
              type="number"
              min={1}
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="목표 금액"
              className="w-28 rounded-md border border-white/20 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-orange-400"
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={isSubmitting}
              className="rounded-md bg-orange-500/80 px-4 py-2 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
            >
              {isSubmitting ? "생성 중..." : "새 목표 추가"}
            </button>
          </div>

          {goals.length > 0 && (
            <ul className="space-y-2">
              {goals.map((goal) => (
                <li
                  key={goal.id}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-800/50 px-3 py-2 text-sm"
                >
                  <span className="text-white">
                    {goal.name} ({goal.current_amount}/{goal.target_amount} P)
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleActive(goal)}
                    className={`rounded px-2 py-1 text-xs font-medium ${
                      goal.is_active
                        ? "bg-orange-500/30 text-orange-300"
                        : "bg-slate-600 text-gray-400"
                    }`}
                  >
                    {goal.is_active ? "활성" : "비활성"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        </AdminGate>
      )}
    </section>
  );
}
