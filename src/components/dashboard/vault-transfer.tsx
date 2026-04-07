"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "@/components/admin/admin-provider";
import AdminGate from "@/components/admin/admin-gate";
import { amountInputStep, formatCloverAmount, roundToDecimalPlaces } from "@/lib/money";
import type { DecimalPlaces } from "@/lib/money";

const GOAL_PREFIX = "goal-";

type Profile = { id: string; name: string };
type Goal = { id: string; name: string; is_active: boolean };

type VaultTransferProps = {
  vaultBalance: number;
  profiles: Profile[];
  goals: Goal[];
  decimalPlaces?: DecimalPlaces;
};

export default function VaultTransfer({
  vaultBalance,
  profiles,
  goals,
  decimalPlaces = 0
}: VaultTransferProps) {
  const dp = decimalPlaces;
  const fc = (v: number) => formatCloverAmount(v, dp);
  const router = useRouter();
  const { token, logout } = useAdmin();
  const [expanded, setExpanded] = useState(false);
  const [toRecipient, setToRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const activeGoals = goals.filter((g) => g.is_active);
  const recipientOptions = [
    ...profiles.map((p) => ({ type: "student" as const, id: p.id, label: p.name })),
    ...activeGoals.map((g) => ({ type: "goal" as const, id: g.id, label: `펀딩: ${g.name}` }))
  ];

  async function handleTransfer() {
    const amt = roundToDecimalPlaces(Number(amount), dp);
    if (!toRecipient || Number.isNaN(amt) || amt <= 0) {
      setMessage({ text: "받는 대상과 금액을 입력해주세요.", isError: true });
      return;
    }
    if (amt > vaultBalance + 1e-9) {
      setMessage({ text: `잔액이 부족합니다. (현재 ${fc(vaultBalance)} 클로버)`, isError: true });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const isGoal = toRecipient.startsWith(GOAL_PREFIX);
      const body: Record<string, unknown> = { amount: amt };
      if (isGoal) {
        body.toGoalId = toRecipient.slice(GOAL_PREFIX.length);
      } else {
        body.toStudentId = toRecipient;
      }

      const res = await fetch("/api/admin/vault-transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: JSON.stringify(body)
      });

      const data = (await res.json()) as { ok: boolean; message?: string };
      if (data.ok) {
        setAmount("");
        setToRecipient("");
        setMessage({ text: data.message ?? "송금이 완료되었습니다.", isError: false });
        logout();
        router.refresh();
      } else {
        setMessage({ text: data.message ?? "송금에 실패했습니다.", isError: true });
      }
    } catch {
      setMessage({ text: "요청 중 오류가 발생했습니다.", isError: true });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-4 border-t border-orange-400/20 pt-4">
      <AdminGate
        fallback={
          <p className="text-xs text-gray-500">
            🔒 중앙 금고 송금은 관리자 전용입니다.
          </p>
        }
      >
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between text-left text-sm font-medium text-orange-300/90 hover:text-orange-300"
        >
          중앙 금고 송금하기 {expanded ? "▲" : "▼"}
        </button>
        {expanded && (
          <div className="mt-3 space-y-3 rounded-lg border border-orange-400/20 bg-slate-900/50 p-4">
            <p className="text-xs text-gray-400">
              잔액: <span className="font-semibold text-orange-400">{fc(vaultBalance)} 클로버</span>
            </p>
            <div>
              <label className="mb-1 block text-xs text-gray-400">받는 대상</label>
              <select
                value={toRecipient}
                onChange={(e) => setToRecipient(e.target.value)}
                className="w-full rounded-md border border-white/20 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-orange-400"
              >
                <option value="">학생 또는 펀딩 목표 선택</option>
                {recipientOptions.map((opt) => (
                  <option
                    key={opt.type + opt.id}
                    value={opt.type === "goal" ? GOAL_PREFIX + opt.id : opt.id}
                  >
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">송금 금액 (클로버)</label>
              <input
                type="number"
                min={dp === 0 ? 1 : 0.01}
                max={vaultBalance}
                step={amountInputStep(dp)}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-md border border-white/20 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-orange-400"
                placeholder={dp === 0 ? "예: 100" : dp === 1 ? "예: 10.5" : "예: 1.25"}
              />
            </div>
            {message && (
              <p
                className={`text-sm ${
                  message.isError ? "text-red-400" : "text-orange-300"
                }`}
              >
                {message.text}
              </p>
            )}
            <button
              type="button"
              onClick={handleTransfer}
              disabled={isSubmitting || !toRecipient || !amount}
              className="w-full rounded-lg bg-orange-500/80 px-4 py-2 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "송금 중..." : "송금 실행"}
            </button>
          </div>
        )}
      </AdminGate>
    </div>
  );
}
