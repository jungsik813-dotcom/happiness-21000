"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminGate from "@/components/admin/admin-gate";
import { useAdmin } from "@/components/admin/admin-provider";

type Student = { id: string; name: string };
type Corporation = { id: string; name: string };

type Props = {
  students: Student[];
  corporations: Corporation[];
};

export default function CorporationAdmin({ students, corporations }: Props) {
  const router = useRouter();
  const { token } = useAdmin();
  const [newCorpName, setNewCorpName] = useState("");
  const [newCorpPassword, setNewCorpPassword] = useState("");
  const [selectedCorpId, setSelectedCorpId] = useState(corporations[0]?.id ?? "");
  const [resetPassword, setResetPassword] = useState("");
  const [shares, setShares] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState("");

  const selectedCorp = useMemo(
    () => corporations.find((c) => c.id === selectedCorpId) ?? null,
    [corporations, selectedCorpId]
  );

  async function loadShares(corpId: string) {
    if (!corpId) return;
    const res = await fetch(`/api/corporations/${corpId}/shares`);
    const data = (await res.json()) as {
      ok: boolean;
      holdings?: Array<{ studentId: string; shareCount: number }>;
    };
    if (!data.ok) return;
    const next: Record<string, number> = {};
    (data.holdings ?? []).forEach((h) => (next[h.studentId] = h.shareCount));
    setShares(next);
  }

  async function createCorporation() {
    const name = newCorpName.trim();
    const pw = newCorpPassword.trim();
    if (!name || !/^\d{4}$/.test(pw)) {
      setMsg("법인 이름과 4자리 비밀번호를 확인해주세요.");
      return;
    }
    const res = await fetch("/api/admin/corporations", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
      body: JSON.stringify({ name, password: pw })
    });
    const data = (await res.json()) as { ok: boolean; message?: string };
    setMsg(data.message ?? (data.ok ? "법인이 생성되었습니다." : "생성 실패"));
    if (data.ok) {
      setNewCorpName("");
      setNewCorpPassword("");
      router.refresh();
    }
  }

  async function removeCorporation() {
    if (!selectedCorp) return;
    if (
      !window.confirm(
        `법인 '${selectedCorp.name}'을(를) 제거할까요?\n삭제 시 해당 법인의 지분/잔액은 복구 없이 소각됩니다.`
      )
    )
      return;
    const res = await fetch(`/api/admin/corporations/${selectedCorp.id}`, {
      method: "DELETE",
      headers: { ...(token && { Authorization: `Bearer ${token}` }) }
    });
    const data = (await res.json()) as { ok: boolean; message?: string };
    setMsg(data.message ?? (data.ok ? "법인이 제거되었습니다." : "제거 실패"));
    if (data.ok) router.refresh();
  }

  async function resetCorpPassword() {
    if (!selectedCorp) return;
    if (!/^\d{4}$/.test(resetPassword.trim())) {
      setMsg("초기화 비밀번호는 4자리 숫자입니다.");
      return;
    }
    const res = await fetch(`/api/admin/corporations/${selectedCorp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
      body: JSON.stringify({ password: resetPassword.trim() })
    });
    const data = (await res.json()) as { ok: boolean; message?: string };
    setMsg(data.message ?? (data.ok ? "비밀번호 재설정 완료" : "재설정 실패"));
    if (data.ok) setResetPassword("");
  }

  async function saveShares() {
    if (!selectedCorp) return;
    const holdings = students.map((s) => ({
      studentId: s.id,
      shareCount: Number(shares[s.id] ?? 0)
    }));
    const total = holdings.reduce((sum, h) => sum + h.shareCount, 0);
    if (total !== 10) {
      setMsg("주식 총합은 10이어야 합니다.");
      return;
    }
    const res = await fetch(`/api/admin/corporations/${selectedCorp.id}/shares`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
      body: JSON.stringify({ holdings })
    });
    const data = (await res.json()) as { ok: boolean; message?: string };
    setMsg(data.message ?? (data.ok ? "저장되었습니다." : "저장 실패"));
  }

  return (
    <AdminGate
      fallback={
        <section className="mb-6 rounded-xl border border-slate-600/50 bg-slate-900/50 p-4">
          <p className="text-sm text-gray-400">🔒 법인/주식 관리 (관리자 전용)</p>
        </section>
      }
    >
      <section className="mb-6 rounded-xl border border-emerald-400/30 bg-slate-900/60 p-4">
        <h3 className="text-lg font-bold text-emerald-300">법인 관리</h3>
        <p className="mt-1 text-xs text-amber-300">주의: 법인 삭제 시 지분/잔액은 소각됩니다.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={newCorpName}
            onChange={(e) => setNewCorpName(e.target.value)}
            placeholder="법인 이름"
            className="rounded-md border border-white/20 bg-slate-900 px-3 py-2 text-sm text-white"
          />
          <input
            value={newCorpPassword}
            onChange={(e) => setNewCorpPassword(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="4자리 비밀번호"
            className="w-36 rounded-md border border-white/20 bg-slate-900 px-3 py-2 text-sm text-white"
          />
          <button onClick={createCorporation} className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-black">
            법인 생성
          </button>
        </div>

        <div className="mt-5 rounded-lg border border-white/10 p-3">
          <label className="text-xs text-gray-400">법인 선택</label>
          <select
            value={selectedCorpId}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedCorpId(id);
              void loadShares(id);
            }}
            className="mt-1 w-full rounded-md border border-white/20 bg-slate-900 px-3 py-2 text-sm text-white"
          >
            <option value="">법인 선택</option>
            {corporations.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {selectedCorp && (
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="새 4자리 비밀번호"
                className="w-40 rounded-md border border-white/20 bg-slate-900 px-3 py-2 text-sm text-white"
              />
              <button onClick={resetCorpPassword} className="rounded-md border border-emerald-400/60 px-3 py-2 text-sm text-emerald-300">
                비밀번호 초기화
              </button>
              <button onClick={removeCorporation} className="rounded-md border border-red-500/60 px-3 py-2 text-sm text-red-300">
                법인 제거
              </button>
            </div>
          )}
        </div>

        {selectedCorp && (
          <div className="mt-5 rounded-lg border border-white/10 p-3">
            <h4 className="text-sm font-semibold text-white">주식 소유 관리 (총합 10)</h4>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {students.map((s) => (
                <label key={s.id} className="flex items-center justify-between rounded bg-slate-800/60 px-3 py-2 text-sm">
                  <span className="text-gray-200">{s.name}</span>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={shares[s.id] ?? 0}
                    onChange={(e) =>
                      setShares((prev) => ({ ...prev, [s.id]: Math.max(0, Math.min(10, Number(e.target.value || 0))) }))
                    }
                    className="w-16 rounded border border-white/20 bg-slate-900 px-2 py-1 text-right text-white"
                  />
                </label>
              ))}
            </div>
            <button onClick={saveShares} className="mt-3 rounded-md bg-emerald-500/80 px-4 py-2 text-sm font-semibold text-black">
              지분 저장
            </button>
          </div>
        )}
        {msg && <p className="mt-3 text-sm text-emerald-200">{msg}</p>}
      </section>
    </AdminGate>
  );
}
