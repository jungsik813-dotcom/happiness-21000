"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/admin-provider";

type BusinessHoursToggleProps = {
  /** true면 평일 08:30~15:30(KST)만 송금 가능 */
  transferHoursEnforced: boolean;
};

export default function BusinessHoursToggle({ transferHoursEnforced }: BusinessHoursToggleProps) {
  const router = useRouter();
  const { token } = useAdmin();
  const [isUpdating, setIsUpdating] = useState(false);
  /** 서버 반영 전에도 스위치가 바로 움직이도록 로컬 상태 사용 */
  const [on, setOn] = useState(transferHoursEnforced);

  useEffect(() => {
    setOn(transferHoursEnforced);
  }, [transferHoursEnforced]);

  async function handleToggle() {
    const next = !on;
    setOn(next);
    setIsUpdating(true);
    try {
      const res = await fetch("/api/admin/transfer-hours", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: JSON.stringify({ transferHoursEnforced: next })
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (data.ok) {
        router.refresh();
      } else {
        setOn(transferHoursEnforced);
        alert(data.message || "설정 변경에 실패했습니다.");
      }
    } catch {
      setOn(transferHoursEnforced);
      alert("설정 변경 중 오류가 발생했습니다.");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-orange-400/30 bg-slate-900/70 p-4">
      <h3 className="mb-3 text-sm font-bold text-orange-300">영업시간 (송금)</h3>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={handleToggle}
          disabled={isUpdating}
          role="switch"
          aria-checked={on}
          className={`relative inline-flex h-8 w-[3.5rem] shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            on ? "bg-green-500" : "bg-slate-600"
          }`}
        >
          <span
            className="inline-block h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ease-out"
            style={{
              transform: on ? "translateX(1.75rem)" : "translateX(0)"
            }}
          />
        </button>
        <div>
          <span className="text-sm font-medium text-white">
            평일 송금 시간 제한: {on ? "ON" : "OFF"}
          </span>
          <span className="ml-2 text-sm text-gray-400">
            ({on ? "08:30~15:30만 송금" : "시간 제한 없음"})
          </span>
        </div>
        {isUpdating && (
          <span className="text-xs text-orange-300">변경 중...</span>
        )}
        <p className="w-full text-xs text-gray-500">
          ON이면 평일(월~금) 08:30~15:30(KST)에만 송금·기부가 가능합니다. OFF면 수업·행사 중에도 제한 없이 송금할 수 있습니다.
        </p>
      </div>
    </section>
  );
}
