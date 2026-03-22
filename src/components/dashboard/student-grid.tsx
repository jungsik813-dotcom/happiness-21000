"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

declare global {
  interface NDEFReadingEvent extends Event {
    serialNumber: string;
  }
  interface NDEFReader {
    scan(options?: { signal?: AbortSignal }): Promise<void>;
    onreading: ((event: NDEFReadingEvent) => void) | null;
  }
  interface Window {
    NDEFReader?: new () => NDEFReader;
  }
}

type Student = {
  id: string;
  name: string;
  balance: number;
};

type Goal = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  is_active: boolean;
};

type StudentGridProps = {
  students: Student[];
  goals?: Goal[];
};

function toWon(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

const GOAL_PREFIX = "goal-";

export default function StudentGrid({ students, goals = [] }: StudentGridProps) {
  const router = useRouter();
  const [localStudents, setLocalStudents] = useState<Student[]>(students);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [toRecipient, setToRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    text: string;
    tone: "success" | "error";
  } | null>(null);
  const [nfcScanning, setNfcScanning] = useState(false);

  const supportsNfc =
    typeof window !== "undefined" &&
    "NDEFReader" in window &&
    window.isSecureContext;

  const handleNfcFindMe = useCallback(async () => {
    if (!supportsNfc || !window.NDEFReader) {
      showToast("NFC는 Android Chrome(HTTPS)에서만 사용 가능합니다.", "error");
      return;
    }
    const controller = new AbortController();
    setNfcScanning(true);
    showToast("NFC 태그를 기기에 갖다 대주세요...", "success");
    try {
      const reader = new window.NDEFReader();
      reader.onreading = async (event: NDEFReadingEvent) => {
        let tagId = event.serialNumber ?? "";
        const ev = event as unknown as { message?: { records?: Array<{ data?: DataView; id?: string }> } };
        if (!tagId && ev?.message?.records?.length) {
          const first = ev.message.records[0];
          if (first?.id) tagId = `ndef:${first.id}`;
          else if (first?.data) {
            const arr = new Uint8Array(first.data.buffer, first.data.byteOffset, first.data.byteLength);
            tagId = `ndef:${Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32)}`;
          }
        }
        if (!tagId) {
          showToast("이 태그는 식별할 수 없습니다.", "error");
          controller.abort();
          return;
        }
        try {
          const res = await fetch(`/api/profiles/by-nfc?tagId=${encodeURIComponent(tagId)}`);
          const data = (await res.json()) as { ok: boolean; profile?: { id: string; name: string; balance: number } };
          if (data.ok && data.profile) {
            setLocalStudents((prev) => {
              const exists = prev.find((s) => s.id === data.profile!.id);
              if (exists)
                return prev.map((s) =>
                  s.id === data.profile!.id ? { ...s, balance: data.profile!.balance } : s
                );
              return [...prev, data.profile!];
            });
            setSelectedStudent(data.profile);
            showToast(`${data.profile.name}님, 환영합니다!`, "success");
            controller.abort();
          } else {
            showToast("등록된 학생을 찾을 수 없습니다. 먼저 NFC를 등록해주세요.", "error");
          }
        } catch {
          showToast("조회 중 오류가 발생했습니다.", "error");
        }
      };
      await reader.scan({ signal: controller.signal });
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        showToast(
          (err as Error)?.message?.includes("permission")
            ? "NFC 권한이 필요합니다."
            : "NFC 스캔을 시작할 수 없습니다.",
          "error"
        );
      }
    } finally {
      setNfcScanning(false);
    }
  }, [supportsNfc]);

  useEffect(() => {
    setLocalStudents(students);
  }, [students]);

  const subtitle = useMemo(() => {
    if (localStudents.length === 0) {
      return "등록된 학생이 아직 없습니다.";
    }

    return `총 ${localStudents.length}명의 학생이 참여 중입니다.`;
  }, [localStudents.length]);

  const activeGoals = useMemo(
    () => goals.filter((g) => g.is_active),
    [goals]
  );

  const recipientOptions = useMemo(() => {
    if (!selectedStudent) return [];
    const others = localStudents.filter((s) => s.id !== selectedStudent.id);
    return [
      ...others.map((s) => ({ type: "student" as const, id: s.id, label: s.name })),
      ...activeGoals.map((g) => {
        const needed = Math.max(0, (g.target_amount ?? 0) - (g.current_amount ?? 0));
        const neededStr = needed > 0 ? ` (남은 ${toWon(needed)} P)` : "";
        return {
          type: "goal" as const,
          id: g.id,
          label: `펀딩: ${g.name}${neededStr}`,
          needed
        };
      })
    ];
  }, [selectedStudent, localStudents, activeGoals]);

  const selectedGoalNeeded = useMemo(() => {
    if (!toRecipient.startsWith(GOAL_PREFIX)) return null;
    const goalId = toRecipient.slice(GOAL_PREFIX.length);
    const g = activeGoals.find((x) => x.id === goalId);
    if (!g) return null;
    const needed = Math.max(0, (g.target_amount ?? 0) - (g.current_amount ?? 0));
    return needed > 0 ? needed : null;
  }, [toRecipient, activeGoals]);

  function showToast(text: string, tone: "success" | "error" = "success") {
    setToast({ text, tone });
    setTimeout(() => {
      setToast(null);
    }, 5000);
  }

  async function handleTransfer() {
    if (!selectedStudent) return;

    const sender = selectedStudent;
    const transferAmount = Number(amount);
    if (!toRecipient || Number.isNaN(transferAmount) || transferAmount <= 0) {
      showToast("받는 대상과 송금 금액을 정확히 입력해주세요.", "error");
      return;
    }

    const isGoal = toRecipient.startsWith(GOAL_PREFIX);
    const toGoalId = isGoal ? toRecipient.slice(GOAL_PREFIX.length) : null;
    const toStudentId = isGoal ? null : toRecipient;

    setIsSubmitting(true);
    setSelectedStudent(null);
    setToRecipient("");
    setAmount("");

    try {
      const body: Record<string, unknown> = {
        fromStudentId: sender.id,
        amount: transferAmount
      };
      if (toGoalId) body.toGoalId = toGoalId;
      else body.toStudentId = toStudentId;

      const response = await fetch("/api/transactions/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const result = (await response.json()) as {
        ok: boolean;
        message: string;
        remainingBalance?: number;
        txRecorded?: boolean;
        txError?: string;
      };
      if (!response.ok || !result.ok) {
        showToast(result.message, "error");
        return;
      }

      const remaining = result.remainingBalance ?? 0;
      setLocalStudents((prev) =>
        prev.map((student) => {
          if (student.id === sender.id) {
            return { ...student, balance: remaining };
          }
          if (!isGoal && student.id === toStudentId) {
            return { ...student, balance: student.balance + transferAmount };
          }
          return student;
        })
      );
      showToast(
        `${result.message}${
          result.txRecorded === false && result.txError
            ? ` (원인: ${result.txError})`
            : ""
        } ${sender.name} 남은 잔액: ${toWon(remaining)} P`,
        result.txRecorded === false ? "error" : "success"
      );
      if (isGoal) router.refresh();
    } catch {
      showToast("송금/기부 요청 중 오류가 발생했습니다.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <section className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-white md:text-2xl">학생 지갑 보드</h2>
            <p className="mt-1 text-sm text-gray-400">{subtitle}</p>
          </div>
          {supportsNfc && (
            <button
              type="button"
              onClick={handleNfcFindMe}
              disabled={nfcScanning}
              className="rounded-lg border border-orange-400/50 bg-orange-500/20 px-4 py-2 text-sm font-semibold text-orange-300 transition hover:bg-orange-500/30 disabled:opacity-60"
            >
              {nfcScanning ? "NFC 스캔 중..." : "📱 NFC로 나 찾기"}
            </button>
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {localStudents.map((student) => (
          <button
            key={student.id}
            type="button"
            onClick={() => setSelectedStudent(student)}
            className="rounded-xl border border-white/10 bg-slate-900/70 p-5 text-left shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-orange-400/60 hover:shadow-[0_0_16px_rgba(247,147,26,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
          >
            <p className="text-sm uppercase tracking-widest text-orange-300">Student</p>
            <h3 className="mt-2 text-xl font-bold text-white">{student.name}</h3>
            <p className="mt-3 text-sm text-gray-400">현재 잔액</p>
            <p className="mt-1 text-2xl font-extrabold text-orange-400">
              {toWon(student.balance)} P
            </p>
          </button>
        ))}
      </section>

      {toast ? (
        <div className="fixed right-5 top-5 z-[60]">
          <section
            className={`rounded-lg px-4 py-3 text-sm shadow-lg ${
              toast.tone === "success"
                ? "border border-orange-400/40 bg-slate-900 text-orange-200"
                : "border border-red-500/50 bg-red-950/90 text-red-200"
            }`}
          >
            {toast.text}
          </section>
        </div>
      ) : null}

      {selectedStudent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-orange-400/40 bg-slate-900 p-6 shadow-[0_0_32px_rgba(247,147,26,0.2)]">
            <p className="text-xs uppercase tracking-[0.2em] text-orange-300">Wallet Menu</p>
            <h3 className="mt-2 text-2xl font-extrabold text-white">
              {selectedStudent.name}
            </h3>
            <p className="mt-2 text-sm text-gray-300">
              현재 잔액:{" "}
              <span className="font-bold text-orange-400">
                {toWon(selectedStudent.balance)} P
              </span>
            </p>

            <div className="mt-6 grid gap-3">
              <div className="rounded-lg border border-white/10 bg-slate-800/80 p-3">
                <p className="mb-2 text-sm font-semibold text-orange-300">송금/기부하기</p>
                <label className="mb-2 block text-xs text-gray-400">받는 대상</label>
                <select
                  value={toRecipient}
                  onChange={(event) => setToRecipient(event.target.value)}
                  className="mb-3 w-full rounded-md border border-white/20 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-orange-400"
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

                <label className="mb-2 block text-xs text-gray-400">송금 금액 (P)</label>
                {selectedGoalNeeded != null ? (
                  <p className="mb-1.5 text-xs text-orange-300/90">
                    남은 필요액: {toWon(selectedGoalNeeded)} P (초과분은 차감되지 않음)
                  </p>
                ) : null}
                <input
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="w-full rounded-md border border-white/20 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-orange-400"
                  placeholder="예: 100"
                />
                <button
                  type="button"
                  onClick={handleTransfer}
                  disabled={isSubmitting}
                  className="mt-3 w-full rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "송금 중..." : "송금 실행"}
                </button>
              </div>
              <button
                type="button"
                onClick={() =>
                  showToast(
                    `${selectedStudent.name} 잔액: ${toWon(selectedStudent.balance)} P`,
                    "success"
                  )
                }
                className="rounded-lg border border-white/20 bg-slate-800 px-4 py-3 text-sm font-semibold text-white transition hover:border-orange-400/60"
              >
                잔액 확인
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedStudent(null);
                setToRecipient("");
                setAmount("");
              }}
              className="mt-5 w-full rounded-lg border border-white/20 px-4 py-2 text-sm text-gray-300 transition hover:border-white/40 hover:text-white"
            >
              닫기
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
