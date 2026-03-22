"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "@/components/admin/admin-provider";
import AdminGate from "@/components/admin/admin-gate";

type Student = { id: string; name: string };

type StudentPasswordResetProps = {
  students: Student[];
};

export default function StudentPasswordReset({ students }: StudentPasswordResetProps) {
  const router = useRouter();
  const { token } = useAdmin();
  const [selectedId, setSelectedId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSetPassword() {
    if (!selectedId) {
      setStatus("error");
      setMessage("학생을 선택해주세요.");
      return;
    }
    const pin = newPassword.replace(/\D/g, "").slice(0, 6);
    if (pin.length < 4) {
      setStatus("error");
      setMessage("4~6자리 숫자 비밀번호를 입력해주세요.");
      return;
    }

    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/students/${selectedId}/set-password`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: JSON.stringify({ password: pin })
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (data.ok) {
        setStatus("success");
        setMessage("비밀번호가 설정되었습니다. (해시로 저장됨)");
        setNewPassword("");
        router.refresh();
      } else {
        setStatus("error");
        setMessage(data.message ?? "설정에 실패했습니다.");
      }
    } catch {
      setStatus("error");
      setMessage("요청 중 오류가 발생했습니다.");
    }
  }

  async function handleReset() {
    if (!selectedId) {
      setStatus("error");
      setMessage("학생을 선택해주세요.");
      return;
    }

    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/students/${selectedId}/reset-password`, {
        method: "PATCH",
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (data.ok) {
        setStatus("success");
        setMessage(data.message ?? "비밀번호가 0000으로 초기화되었습니다.");
        setNewPassword("");
        router.refresh();
      } else {
        setStatus("error");
        setMessage(data.message ?? "초기화에 실패했습니다.");
      }
    } catch {
      setStatus("error");
      setMessage("요청 중 오류가 발생했습니다.");
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-white/10 bg-slate-900/50 p-4">
      <h3 className="mb-3 text-sm font-bold text-orange-300">학생 비밀번호 설정</h3>
      <AdminGate
        fallback={
          <p className="rounded-lg border border-orange-400/30 bg-orange-500/10 px-4 py-3 text-center text-sm text-orange-300">
            🔒 관리자 전용입니다. 클릭하여 비밀번호를 입력하세요.
          </p>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="mb-2 block text-xs text-gray-400">학생 선택</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={status === "loading"}
              className="w-full rounded-md border border-white/20 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-orange-400 disabled:opacity-60"
            >
              <option value="">학생 선택</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-xs text-gray-400">새 비밀번호 (4~6자리 숫자)</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="0000"
              className="w-full rounded-md border border-white/20 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-orange-400 disabled:opacity-60"
              disabled={status === "loading"}
            />
          </div>
          {(status === "success" || status === "error") && (
            <p
              className={`rounded-lg px-4 py-2 text-sm ${
                status === "success"
                  ? "border border-green-500/40 bg-green-950/30 text-green-200"
                  : "border border-red-500/40 bg-red-950/30 text-red-200"
              }`}
            >
              {message}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSetPassword}
              disabled={status === "loading" || !selectedId || newPassword.length < 4}
              className="rounded-md bg-orange-500/80 px-4 py-2 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "loading" ? "처리 중..." : "비밀번호 설정 (해시 저장)"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={status === "loading" || !selectedId}
              className="rounded-md border border-white/30 px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              0000으로 초기화
            </button>
            {status !== "idle" && status !== "loading" && (
              <button
                type="button"
                onClick={() => {
                  setStatus("idle");
                  setMessage("");
                }}
                className="rounded-md border border-white/20 px-4 py-2 text-sm text-gray-300"
              >
                닫기
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500">
            비밀번호는 SHA-256 해시로 저장되며, 원문은 저장되지 않습니다.
          </p>
        </div>
      </AdminGate>
    </section>
  );
}
