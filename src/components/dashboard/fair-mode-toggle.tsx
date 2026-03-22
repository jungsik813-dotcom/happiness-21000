"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "@/components/admin/admin-provider";

type FairModeToggleProps = {
  fairMode: boolean;
};

export default function FairModeToggle({ fairMode }: FairModeToggleProps) {
  const router = useRouter();
  const { token } = useAdmin();
  const [isUpdating, setIsUpdating] = useState(false);

  async function handleToggle() {
    const nextMode = !fairMode;
    setIsUpdating(true);
    try {
      const res = await fetch("/api/admin/fair-mode", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: JSON.stringify({ fairMode: nextMode })
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (data.ok) {
        router.refresh();
      } else {
        alert(data.message || "설정 변경에 실패했습니다.");
      }
    } catch {
      alert("설정 변경 중 오류가 발생했습니다.");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-orange-400/30 bg-slate-900/70 p-4">
      <h3 className="mb-3 text-sm font-bold text-orange-300">마스터 토글</h3>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={handleToggle}
          disabled={isUpdating}
          role="switch"
          aria-checked={fairMode}
          className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            fairMode ? "bg-green-500" : "bg-slate-600"
          }`}
        >
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
              fairMode ? "translate-x-7" : "translate-x-1"
            }`}
          />
        </button>
        <div>
          <span className="text-sm font-medium text-white">
            장터 모드: {fairMode ? "ON" : "OFF"}
          </span>
          <span className="ml-2 text-sm text-gray-400">
            ({fairMode ? "P2P 한도 100%" : "P2P 한도 10%"})
          </span>
        </div>
        {isUpdating && (
          <span className="text-xs text-orange-300">변경 중...</span>
        )}
        <p className="w-full text-xs text-gray-500">
          ON이면 P2P 송금 한도가 잔액 100%로 해제됩니다. 스위치를 눌러 전환하세요.
        </p>
      </div>
    </section>
  );
}
