"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "@/components/admin/admin-provider";
import AdminGate from "@/components/admin/admin-gate";
import AdminCollapsible from "@/components/admin/admin-collapsible";

type Student = { id: string; name: string };

type Props = {
  students: Student[];
};

export default function StudentRosterManager({ students }: Props) {
  const router = useRouter();
  const { token } = useAdmin();
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function addStudent() {
    if (!token) return;
    const name = newName.trim();
    const pin = newPassword.replace(/\D/g, "").slice(0, 4);
    if (name.length < 1) {
      setMsg({ tone: "err", text: "이름을 입력해주세요." });
      return;
    }
    if (pin.length !== 4) {
      setMsg({ tone: "err", text: "4자리 숫자 비밀번호를 입력해주세요." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/profiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name, password: pin })
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      if (data.ok) {
        setNewName("");
        setNewPassword("");
        setMsg({ tone: "ok", text: data.message ?? "추가되었습니다." });
        router.refresh();
      } else {
        setMsg({ tone: "err", text: data.message ?? "추가 실패" });
      }
    } catch {
      setMsg({ tone: "err", text: "요청 중 오류가 발생했습니다." });
    } finally {
      setBusy(false);
    }
  }

  async function removeStudent(id: string, name: string) {
    if (!token) return;
    if (
      !window.confirm(
        `「${name}」 학생을 명단에서 제거할까요?\n삭제 시 해당 학생의 잔액은 중앙 금고로 이관되지 않고 소각됩니다.`
      )
    )
      return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/profiles/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      if (data.ok) {
        setMsg({ tone: "ok", text: data.message ?? "제거되었습니다." });
        router.refresh();
      } else {
        setMsg({ tone: "err", text: data.message ?? "제거 실패" });
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
        <section className="ui-card p-4">
          <p className="text-sm text-[#5d7a6c]">🔒 학생 명단 관리 (관리자 전용)</p>
        </section>
      }
    >
      <AdminCollapsible
        title="학생 명단 관리"
        description="전입/전출에 맞춰 학생을 추가하거나 제거합니다. 삭제 시 잔액은 소각됩니다."
        className="ui-card p-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="ui-label">이름</span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="새 학생 이름"
              className="ui-input"
            />
          </label>
          <label className="w-full sm:w-36">
            <span className="ui-label">4자리 비밀번호</span>
            <input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value.replace(/\D/g, "").slice(0, 4))}
              inputMode="numeric"
              maxLength={4}
              placeholder="0000"
              className="ui-input text-center tracking-widest"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void addStudent()}
            className="ui-btn-primary"
          >
            학생 추가
          </button>
        </div>

        <ul className="max-h-80 space-y-2 overflow-y-auto rounded-2xl border border-[#e8f4ee] bg-[#f7fcf9] p-3">
          {students.length === 0 ? (
            <li className="text-sm text-[#9bb5a8]">등록된 학생이 없습니다.</li>
          ) : (
            students.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-[#d7efe2] bg-white px-3 py-2 text-sm"
              >
                <span className="text-[#1f3d32]">{s.name}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void removeStudent(s.id, s.name)}
                  className="shrink-0 rounded-full border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  제거
                </button>
              </li>
            ))
          )}
        </ul>
        {msg ? (
          <p className={msg.tone === "ok" ? "text-sm text-[#1f7a4a]" : "text-sm text-red-600"}>
            {msg.text}
          </p>
        ) : null}
      </AdminCollapsible>
    </AdminGate>
  );
}
