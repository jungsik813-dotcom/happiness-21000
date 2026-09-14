"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getEffectiveTransferTimeLock, getTimeLockMessage } from "@/lib/time-lock";
import { CURRENCY, maxAmountPerTransfer } from "@/lib/constants";
import { amountInputStep, formatCloverAmount, roundToDecimalPlaces } from "@/lib/money";
import type { DecimalPlaces } from "@/lib/money";
import {
  FUNDING_OR_VAULT_NOTE_MIN_LENGTH,
  P2P_PRAISE_NOTE_MIN_LENGTH,
  P2P_PRAISE_REASONS
} from "@/lib/praise-reasons";
import SectionCollapsible from "@/components/ui/section-collapsible";

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
  /** 장터 모드 ON이면 송금/기부 모두 회당 잔액 전액까지 */
  fairMode?: boolean;
  /** false면 평일 시간 제한 없이 송금 (관리자 설정) */
  transferHoursEnforced?: boolean;
  /** 관리자 설정: 클로버 소수 자릿수 */
  decimalPlaces?: DecimalPlaces;
};

const GOAL_PREFIX = "goal-";
const VAULT_RECIPIENT = "__vault__";

export default function StudentGrid({
  students,
  goals = [],
  fairMode = false,
  transferHoursEnforced = true,
  decimalPlaces = 0
}: StudentGridProps) {
  const dp = decimalPlaces;
  const fc = useCallback((v: number) => formatCloverAmount(v, dp), [dp]);
  const router = useRouter();
  const [localStudents, setLocalStudents] = useState<Student[]>(students);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [toRecipient, setToRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [praiseMessage, setPraiseMessage] = useState("");
  const [praiseReason, setPraiseReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    text: string;
    tone: "success" | "error";
  } | null>(null);
  const [passwordModalStudent, setPasswordModalStudent] = useState<Student | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordVerifying, setPasswordVerifying] = useState(false);

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

  const timeLockResult = getEffectiveTransferTimeLock(transferHoursEnforced);
  const isGoalRecipient = toRecipient.startsWith(GOAL_PREFIX);
  const isVaultRecipient = toRecipient === VAULT_RECIPIENT;
  const isP2PToStudent = Boolean(toRecipient && !isGoalRecipient && !isVaultRecipient);
  const showMessageInput = Boolean(toRecipient);

  async function handlePasswordVerify() {
    if (!passwordModalStudent) return;
    const pin = passwordInput.trim();
    if (pin.length !== 4) {
      showToast("4자리 비밀번호를 입력해주세요.", "error");
      return;
    }
    setPasswordVerifying(true);
    try {
      const res = await fetch("/api/students/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: passwordModalStudent.id, password: pin })
      });
      const data = (await res.json()) as {
        ok: boolean;
        message?: string;
        profile?: { id: string; name: string; balance: number };
      };
      if (data.ok && data.profile) {
        setLocalStudents((prev) =>
          prev.map((s) =>
            s.id === data.profile!.id
              ? { ...s, balance: data.profile!.balance }
              : s
          )
        );
        setSelectedStudent({
          id: data.profile.id,
          name: data.profile.name,
          balance: data.profile.balance
        });
        setPasswordModalStudent(null);
        setPasswordInput("");
        showToast(`${data.profile.name}님, 환영합니다!`, "success");
      } else {
        showToast(data.message ?? "비밀번호가 올바르지 않습니다.", "error");
      }
    } catch {
      showToast("확인 중 오류가 발생했습니다.", "error");
    } finally {
      setPasswordVerifying(false);
    }
  }

  const recipientOptions = useMemo(() => {
    if (!selectedStudent) return [];
    const others = localStudents.filter((s) => s.id !== selectedStudent.id);
    return [
      ...others.map((s) => ({ type: "student" as const, id: s.id, label: s.name })),
      { type: "vault" as const, id: VAULT_RECIPIENT, label: "중앙 금고" },
      ...activeGoals.map((g) => {
        const needed = Math.max(0, (g.target_amount ?? 0) - (g.current_amount ?? 0));
        const neededStr = needed > 0 ? ` (남은 ${fc(needed)} ${CURRENCY})` : "";
        return {
          type: "goal" as const,
          id: g.id,
          label: `펀딩: ${g.name}${neededStr}`,
          needed
        };
      })
    ];
  }, [selectedStudent, localStudents, activeGoals, fc]);

  const maxOnceThisTransfer = useMemo(() => {
    if (!selectedStudent) return 0;
    if (fairMode) return selectedStudent.balance;
    return maxAmountPerTransfer(selectedStudent.balance, dp);
  }, [selectedStudent, fairMode, dp]);

  const selectedGoalNeeded = useMemo(() => {
    if (!isGoalRecipient) return null;
    const goalId = toRecipient.slice(GOAL_PREFIX.length);
    const g = activeGoals.find((x) => x.id === goalId);
    if (!g) return null;
    const needed = Math.max(0, (g.target_amount ?? 0) - (g.current_amount ?? 0));
    return needed > 0 ? needed : null;
  }, [toRecipient, activeGoals, isGoalRecipient]);

  function showToast(text: string, tone: "success" | "error" = "success") {
    setToast({ text, tone });
    setTimeout(() => {
      setToast(null);
    }, 5000);
  }

  async function handleTransfer() {
    if (!selectedStudent) return;

    if (!timeLockResult.allowed) {
      showToast(getTimeLockMessage(timeLockResult), "error");
      return;
    }

    const sender = selectedStudent;
    const transferAmount = roundToDecimalPlaces(Number(amount), dp);
    if (!toRecipient || Number.isNaN(transferAmount) || transferAmount <= 0) {
      showToast("받는 대상과 송금 금액을 정확히 입력해주세요.", "error");
      return;
    }

    const isGoal = toRecipient.startsWith(GOAL_PREFIX);
    const isVault = toRecipient === VAULT_RECIPIENT;
    const maxOnce = fairMode
      ? sender.balance
      : maxAmountPerTransfer(sender.balance, dp);
    if (transferAmount > maxOnce + 1e-9) {
      showToast(
        fairMode
          ? `한 번에 최대 ${fc(maxOnce)} ${CURRENCY}(전액)까지 보낼 수 있어요.`
          : `한 번에 최대 ${fc(maxOnce)} ${CURRENCY}(현재 잔액의 10%)까지 보낼 수 있어요.`,
        "error"
      );
      return;
    }
    const toGoalId = isGoal ? toRecipient.slice(GOAL_PREFIX.length) : null;
    const toStudentId = isGoal || isVault ? null : toRecipient;

    const praiseForSend = praiseMessage.trim();
    if (isGoal || isVault) {
      if (praiseForSend.length < FUNDING_OR_VAULT_NOTE_MIN_LENGTH) {
        showToast(
          `송금 사유를 ${FUNDING_OR_VAULT_NOTE_MIN_LENGTH}자 이상 입력해주세요.`,
          "error"
        );
        return;
      }
    } else {
      if (!praiseReason) {
        showToast("칭찬 사유를 선택해주세요.", "error");
        return;
      }
      if (praiseForSend.length < P2P_PRAISE_NOTE_MIN_LENGTH) {
        showToast(
          `짧은 한마디를 ${P2P_PRAISE_NOTE_MIN_LENGTH}자 이상 입력해주세요.`,
          "error"
        );
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const body: Record<string, unknown> = {
        fromStudentId: sender.id,
        amount: transferAmount
      };
      if (toGoalId) {
        body.toGoalId = toGoalId;
        body.praiseMessage = praiseForSend;
      } else if (isVault) {
        body.toVault = true;
        body.praiseMessage = praiseForSend;
      } else {
        body.toStudentId = toStudentId;
        body.praiseReason = praiseReason;
        body.praiseMessage = praiseForSend;
      }

      const response = await fetch("/api/transactions/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      let result: {
        ok: boolean;
        message?: string;
        remainingBalance?: number;
        txRecorded?: boolean;
        txError?: string;
      };
      try {
        result = (await response.json()) as typeof result;
      } catch {
        showToast("서버 응답을 읽을 수 없습니다. 네트워크를 확인해주세요.", "error");
        return;
      }

      if (!response.ok || !result.ok) {
        showToast(result.message ?? "송금에 실패했습니다.", "error");
        return;
      }

      const remaining = result.remainingBalance ?? 0;
      setLocalStudents((prev) =>
        prev.map((student) => {
          if (student.id === sender.id) {
            return { ...student, balance: remaining };
          }
          if (!isGoal && !isVault && student.id === toStudentId) {
            return { ...student, balance: student.balance + transferAmount };
          }
          return student;
        })
      );
      setSelectedStudent((prev) =>
        prev && prev.id === sender.id ? { ...prev, balance: remaining } : prev
      );
      setToRecipient("");
      setAmount("");
      setPraiseMessage("");
      setPraiseReason("");
      showToast(
        `${result.message ?? ""}${
          result.txRecorded === false && result.txError
            ? ` (원인: ${result.txError})`
            : ""
        } ${sender.name} 남은 잔액: ${fc(remaining)} ${CURRENCY}`,
        result.txRecorded === false ? "error" : "success"
      );
      if (isGoal || isVault) router.refresh();
    } catch {
      showToast("송금/기부 요청 중 오류가 발생했습니다.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <SectionCollapsible
        title="학생 지갑 보드"
        description={`${subtitle} · 본인 이름을 누르고 비밀번호를 입력하세요`}
        className="mb-8 rounded-[2rem] border border-[#d7efe2] bg-white/90 p-5 shadow-[0_8px_24px_rgba(47,191,113,0.06)] md:p-6"
      >
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {localStudents.map((student) => (
            <button
              key={student.id}
              type="button"
              onClick={() => setPasswordModalStudent(student)}
              className="flex items-center justify-between gap-3 rounded-2xl border border-[#d7efe2] bg-white px-4 py-3 text-left shadow-[0_6px_18px_rgba(47,191,113,0.08)] transition hover:-translate-y-0.5 hover:border-[#2fbf71] hover:shadow-[0_10px_24px_rgba(47,191,113,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2fbf71]"
            >
              <span className="truncate font-semibold text-[#1f3d32]">{student.name}</span>
              <span className="shrink-0 text-right">
                <span className="block text-[10px] text-[#9bb5a8]">현재 잔액</span>
                <span className="font-bold text-[#2fbf71]">
                  {fc(student.balance)} {CURRENCY}
                </span>
              </span>
            </button>
          ))}
        </section>
      </SectionCollapsible>

      {toast ? (
        <div className="fixed right-5 top-5 z-[60]">
          <section
            className={`rounded-2xl px-4 py-3 text-sm shadow-lg ${
              toast.tone === "success"
                ? "border border-[#b9ebcf] bg-white text-[#1f7a4a]"
                : "border border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {toast.text}
          </section>
        </div>
      ) : null}

      {passwordModalStudent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1f3d32]/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-[#d7efe2] bg-white p-6 shadow-xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2fbf71]">로그인</p>
            <h3 className="mt-2 text-xl font-bold text-[#1f3d32]">{passwordModalStudent.name}</h3>
            <p className="mt-2 text-sm text-[#5d7a6c]">4자리 비밀번호를 입력하세요.</p>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
              onKeyDown={(e) => e.key === "Enter" && handlePasswordVerify()}
              placeholder="0000"
              className="mt-4 w-full rounded-xl border border-[#d7efe2] bg-[#f7fcf9] px-4 py-3 text-center text-lg tracking-[0.5em] text-[#1f3d32] outline-none focus:border-[#2fbf71]"
            />
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setPasswordModalStudent(null);
                  setPasswordInput("");
                }}
                className="flex-1 rounded-full border border-[#d7efe2] px-4 py-2 text-sm text-[#5d7a6c]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handlePasswordVerify}
                disabled={passwordVerifying || passwordInput.length !== 4}
                className="flex-1 rounded-full bg-[#2fbf71] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {passwordVerifying ? "확인 중..." : "입장"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedStudent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1f3d32]/35 p-4 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-3xl border border-[#d7efe2] bg-white p-6 shadow-xl">
            <div className="overflow-y-auto pr-1">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2fbf71]">Wallet Menu</p>
            <h3 className="mt-2 text-2xl font-extrabold text-[#1f3d32]">
              {selectedStudent.name}
            </h3>
            <p className="mt-2 text-sm text-[#5d7a6c]">
              현재 잔액:{" "}
              <span className="font-bold text-[#2fbf71]">
                {fc(selectedStudent.balance)} {CURRENCY}
              </span>
            </p>

            <div className="mt-6 grid gap-3">
              {!transferHoursEnforced && (
                <div className="rounded-2xl border border-[#b9ebcf] bg-[#dff8ea] px-4 py-3 text-sm text-[#1f7a4a]">
                  송금 시간 제한이 꺼져 있어 평일 시간과 관계없이 송금·기부할 수 있어요.
                </div>
              )}
              {transferHoursEnforced && !timeLockResult.allowed && (
                <div className="rounded-2xl border border-[#ffe0d4] bg-[#fff4f0] px-4 py-3 text-sm text-[#7a5345]">
                  ⏰ {getTimeLockMessage(timeLockResult)}
                </div>
              )}
              <div className="rounded-2xl border border-[#e8f4ee] bg-[#f7fcf9] p-3">
                <p className="mb-2 text-sm font-semibold text-[#2fbf71]">송금/기부하기</p>
                <label className="mb-2 block text-xs text-[#5d7a6c]">받는 대상</label>
                <select
                  value={toRecipient}
                  onChange={(event) => setToRecipient(event.target.value)}
                  className="mb-3 w-full rounded-xl border border-[#d7efe2] bg-white px-3 py-2 text-sm text-[#1f3d32] outline-none focus:border-[#2fbf71]"
                >
                  <option value="">학생/중앙 금고/펀딩 목표 선택</option>
                  {recipientOptions.map((opt) => (
                    <option
                      key={opt.type + opt.id}
                      value={
                        opt.type === "goal"
                          ? GOAL_PREFIX + opt.id
                          : opt.type === "vault"
                            ? VAULT_RECIPIENT
                            : opt.id
                      }
                    >
                      {opt.label}
                    </option>
                  ))}
                </select>

                {showMessageInput && isP2PToStudent && (
                  <>
                    <p className="mb-2 text-xs text-[#5d7a6c]">
                      칭찬 사유 <span className="text-[#ff7a59]">(필수 · 하나 선택)</span>
                    </p>
                    <div className="mb-3 space-y-2">
                      {P2P_PRAISE_REASONS.map((reason) => (
                        <label
                          key={reason}
                          className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                            praiseReason === reason
                              ? "border-[#2fbf71] bg-[#dff8ea] text-[#1f3d32]"
                              : "border-[#d7efe2] bg-white text-[#1f3d32] hover:border-[#2fbf71]"
                          }`}
                        >
                          <input
                            type="radio"
                            name="praiseReason"
                            value={reason}
                            checked={praiseReason === reason}
                            onChange={() => setPraiseReason(reason)}
                            className="mt-0.5"
                          />
                          <span>{reason}</span>
                        </label>
                      ))}
                    </div>
                    <label className="mb-2 block text-xs text-[#5d7a6c]">
                      짧은 한마디{" "}
                      <span className="text-[#ff7a59]">
                        ({P2P_PRAISE_NOTE_MIN_LENGTH}자 이상 필수)
                      </span>
                    </label>
                    <textarea
                      value={praiseMessage}
                      onChange={(e) => setPraiseMessage(e.target.value)}
                      placeholder="예: 청소 도와줘서 고마워!"
                      rows={2}
                      maxLength={200}
                      className="mb-3 w-full rounded-xl border border-[#d7efe2] bg-white px-3 py-2 text-sm text-[#1f3d32] outline-none placeholder:text-[#9bb5a8] focus:border-[#2fbf71]"
                    />
                    {praiseMessage.length > 0 &&
                      praiseMessage.length < P2P_PRAISE_NOTE_MIN_LENGTH && (
                        <p className="mb-2 text-xs text-[#ff7a59]">
                          아직 {P2P_PRAISE_NOTE_MIN_LENGTH - praiseMessage.length}자 더
                          입력해주세요.
                        </p>
                      )}
                  </>
                )}
                {showMessageInput && !isP2PToStudent && (
                  <>
                    <label className="mb-2 block text-xs text-[#5d7a6c]">
                      송금 사유{" "}
                      <span className="text-[#ff7a59]">
                        ({FUNDING_OR_VAULT_NOTE_MIN_LENGTH}자 이상 필수)
                      </span>
                    </label>
                    <textarea
                      value={praiseMessage}
                      onChange={(e) => setPraiseMessage(e.target.value)}
                      placeholder="예: 학급 운영비 납부"
                      rows={2}
                      maxLength={200}
                      className="mb-3 w-full rounded-xl border border-[#d7efe2] bg-white px-3 py-2 text-sm text-[#1f3d32] outline-none placeholder:text-[#9bb5a8] focus:border-[#2fbf71]"
                    />
                  </>
                )}
                <label className="mb-2 block text-xs text-[#5d7a6c]">송금 금액 ({CURRENCY})</label>
                {selectedGoalNeeded != null ? (
                  <p className="mb-1.5 text-xs text-[#2fbf71]">
                    남은 필요액: {fc(selectedGoalNeeded)} {CURRENCY} (목표 초과분은 중앙 금고로)
                  </p>
                ) : null}
                <input
                  type="number"
                  min={dp === 0 ? 1 : 0.01}
                  step={amountInputStep(dp)}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="w-full rounded-xl border border-[#d7efe2] bg-white px-3 py-2 text-sm text-[#1f3d32] outline-none focus:border-[#2fbf71]"
                  placeholder={dp === 0 ? "예: 100" : dp === 1 ? "예: 10.5" : "예: 1.25"}
                />
                {toRecipient ? (
                  <p className="mt-2 text-xs text-[#5d7a6c]">
                    한 번에 보낼 수 있는 최대:{" "}
                    <span className="font-medium text-[#2fbf71]">
                      {fc(maxOnceThisTransfer)} {CURRENCY}
                    </span>
                    {fairMode ? (
                      <span> — 장터 모드: 학생/중앙 금고/펀딩 모두 잔액 전액까지 한 번에 보낼 수 있어요.</span>
                    ) : (
                      <span>
                        {" "}
                        (펀딩·일반 P2P: 송금 직전 잔액의 10%, 여러 번 나누어 보내도 매번 10%)
                      </span>
                    )}
                    {maxOnceThisTransfer < (dp === 0 ? 1 : 0.01) && (
                      <span className="ml-1 text-[#ff7a59]">
                        · 잔액이 적어 지금은 송금할 수 없어요
                      </span>
                    )}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={handleTransfer}
                  disabled={isSubmitting || !timeLockResult.allowed}
                  className="mt-3 w-full rounded-full bg-[#ff7a59] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#ff6a45] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "송금 중..." : timeLockResult.allowed ? "송금 실행" : "영업 시간 아님"}
                </button>
              </div>
              <button
                type="button"
                onClick={() =>
                  showToast(
                    `${selectedStudent.name} 잔액: ${fc(selectedStudent.balance)} ${CURRENCY}`,
                    "success"
                  )
                }
                className="rounded-2xl border border-[#d7efe2] bg-white px-4 py-3 text-sm font-semibold text-[#1f3d32] transition hover:border-[#2fbf71]"
              >
                잔액 확인
              </button>
            </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedStudent(null);
                setToRecipient("");
                setAmount("");
                setPraiseMessage("");
              }}
              className="mt-5 w-full rounded-full border border-[#d7efe2] px-4 py-2 text-sm text-[#5d7a6c] transition hover:border-[#2fbf71] hover:text-[#1f3d32]"
            >
              닫기
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
