"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "@/components/admin/admin-provider";
import AdminGate from "@/components/admin/admin-gate";
import AdminCollapsible from "@/components/admin/admin-collapsible";

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
    const pin = newPassword.replace(/\D/g, "").slice(0, 4);
    if (pin.length !== 4) {
      setStatus("error");
      setMessage("4자리 숫자 비밀번호를 입력해주세요.");
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
    <AdminCollapsible
      title="학생 비밀번호 설정"
      description="학생 비밀번호를 새로 정하거나 0000으로 초기화합니다."
      className="ui-card p-6"
    >
      <AdminGate
        fallback={
          <p className="rounded-2xl border border-[#d7efe2] bg-[#f7fcf9] px-4 py-3 text-center text-sm text-[#5d7a6c]">
            🔒 관리자 전용입니다. 클릭하여 비밀번호를 입력하세요.
          </p>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="ui-label">학생 선택</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={status === "loading"}
              className="ui-input disabled:opacity-60"
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
            <label className="ui-label">새 비밀번호 (4자리 숫자)</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="0000"
              className="ui-input disabled:opacity-60"
              disabled={status === "loading"}
            />
          </div>
          {(status === "success" || status === "error") && (
            <p
              className={`rounded-2xl px-4 py-2 text-sm ${
                status === "success"
                  ? "border border-[#b9ebcf] bg-[#dff8ea] text-[#1f7a4a]"
                  : "border border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {message}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSetPassword}
              disabled={status === "loading" || !selectedId || newPassword.length !== 4}
              className="ui-btn-primary"
            >
              {status === "loading" ? "처리 중..." : "비밀번호 설정 (해시 저장)"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={status === "loading" || !selectedId}
              className="ui-btn-secondary"
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
                className="ui-btn-secondary"
              >
                닫기
              </button>
            )}
          </div>
          <p className="text-xs text-[#9bb5a8]">
            비밀번호는 SHA-256 해시로 저장되며, 원문은 저장되지 않습니다.
          </p>
        </div>
      </AdminGate>
    </AdminCollapsible>
  );
}
