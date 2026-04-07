"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "@/components/admin/admin-provider";
import AdminGate from "@/components/admin/admin-gate";
import type { DecimalPlaces } from "@/lib/money";

type Props = {
  initialSiteTitle: string;
  initialSiteSubtitle: string;
  initialDecimalPlaces: DecimalPlaces;
};

export default function AdminSiteRoster({
  initialSiteTitle,
  initialSiteSubtitle,
  initialDecimalPlaces
}: Props) {
  const router = useRouter();
  const { token } = useAdmin();

  const [siteTitle, setSiteTitle] = useState(initialSiteTitle);
  const [siteSubtitle, setSiteSubtitle] = useState(initialSiteSubtitle);
  const [decimalPlaces, setDecimalPlaces] = useState<DecimalPlaces>(initialDecimalPlaces);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function saveSiteSettings() {
    if (!token) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          siteTitle,
          siteSubtitle,
          decimalPlaces
        })
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      if (data.ok) {
        setMsg({ tone: "ok", text: data.message ?? "저장되었습니다." });
        router.refresh();
      } else {
        setMsg({ tone: "err", text: data.message ?? "저장 실패" });
      }
    } catch {
      setMsg({ tone: "err", text: "요청 중 오류가 발생했습니다." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminGate
      fallback={
        <section className="mb-6 rounded-xl border border-slate-600/50 bg-slate-900/50 p-4">
          <p className="text-sm text-gray-400">🔒 사이트·명단 설정 (관리자 전용)</p>
        </section>
      }
    >
      <section className="mb-8 space-y-6 rounded-2xl border border-orange-400/30 bg-slate-900/80 p-6">
        <div>
          <h2 className="text-lg font-bold text-white">사이트 제목·부제목</h2>
          <p className="mt-1 text-sm text-gray-400">
            브라우저 탭 제목과 메인 화면 제목·부제목을 바꿀 수 있습니다.
          </p>
        </div>
        <label className="block">
          <span className="text-xs text-gray-400">페이지 제목 (탭·메인 큰 글씨)</span>
          <input
            value={siteTitle}
            onChange={(e) => setSiteTitle(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/15 bg-slate-800 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-400">부제목 (메인 회색 한 줄)</span>
          <input
            value={siteSubtitle}
            onChange={(e) => setSiteSubtitle(e.target.value)}
            className="mt-1 w-full rounded-md border border-white/15 bg-slate-800 px-3 py-2 text-sm text-white"
          />
        </label>
        <div className="rounded-lg border border-white/10 bg-slate-800/50 p-4">
          <p className="text-sm font-semibold text-orange-300">클로버 소수 표시</p>
          <p className="mt-1 text-xs text-gray-500">
            유통량이 줄었을 때 더 잘게 쓰려면 첫째·둘째 자리까지 허용할 수 있습니다.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {([0, 1, 2] as const).map((d) => (
              <label key={d} className="flex cursor-pointer items-center gap-2 text-sm text-gray-200">
                <input
                  type="radio"
                  name="decimalPlaces"
                  checked={decimalPlaces === d}
                  onChange={() => setDecimalPlaces(d)}
                />
                {d === 0 ? "정수만" : d === 1 ? "소수 첫째까지" : "소수 둘째까지"}
              </label>
            ))}
          </div>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void saveSiteSettings()}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
        >
          설정 저장
        </button>

        {msg ? (
          <p className={msg.tone === "ok" ? "text-sm text-emerald-400" : "text-sm text-red-400"}>{msg.text}</p>
        ) : null}
      </section>
    </AdminGate>
  );
}
