"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/admin-provider";

type FairModeToggleProps = {
  fairMode: boolean;
};

export default function FairModeToggle({ fairMode }: FairModeToggleProps) {
  const router = useRouter();
  const { token } = useAdmin();
  const [isUpdating, setIsUpdating] = useState(false);
  const [on, setOn] = useState(fairMode);

  useEffect(() => {
    setOn(fairMode);
  }, [fairMode]);

  async function handleToggle() {
    const nextMode = !on;
    setOn(nextMode);
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
        setOn(fairMode);
        alert(data.message || "설정 변경에 실패했습니다.");
      }
    } catch {
      setOn(fairMode);
      alert("설정 변경 중 오류가 발생했습니다.");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#e8f4ee] bg-[#f7fcf9] p-4">
      <h3 className="mb-3 text-sm font-bold text-[#2fbf71]">장터 모드</h3>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={handleToggle}
          disabled={isUpdating}
          role="switch"
          aria-checked={on}
          className={`relative inline-flex h-8 w-[3.5rem] shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            on ? "bg-[#2fbf71]" : "bg-[#c9d9d0]"
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
          <span className="text-sm font-medium text-[#1f3d32]">
            장터 모드: {on ? "ON" : "OFF"}
          </span>
          <span className="ml-2 text-sm text-[#5d7a6c]">
            ({on ? "학생 간 송금 한도 100%" : "학생 간 송금 한도 10%"})
          </span>
        </div>
        {isUpdating && <span className="text-xs text-[#2fbf71]">변경 중...</span>}
        <p className="w-full text-xs text-[#5d7a6c]">
          ON이면 친구에게 보낼 때 잔액 전액까지 한 번에 보낼 수 있어요. 펀딩 기부는 항상 회당 잔액의
          10%까지입니다.
        </p>
      </div>
    </div>
  );
}
