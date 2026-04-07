"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getEffectiveTransferTimeLock, getTimeLockMessage } from "@/lib/time-lock";
import { CURRENCY, maxAmountPerTransfer } from "@/lib/constants";
import { amountInputStep, formatCloverAmount, roundToDecimalPlaces } from "@/lib/money";
import type { DecimalPlaces } from "@/lib/money";

type Student = {
  id: string;
  name: string;
  balance: number;
  account_type?: string;
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
  /** 장터 모드 ON이면 학생 간 송금만 회당 잔액 전액까지 */
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDividendSubmitting, setIsDividendSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    text: string;
    tone: "success" | "error";
  } | null>(null);
  const [passwordModalStudent, setPasswordModalStudent] = useState<Student | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordVerifying, setPasswordVerifying] = useState(false);
  const [dividendAmount, setDividendAmount] = useState("");
  const [dividendReason, setDividendReason] = useState("");
  const [holdings, setHoldings] = useState<Array<{ studentId: string; studentName: string; shareCount: number }>>([]);

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
  const selectedIsCorporation = (selectedStudent?.account_type ?? "STUDENT") === "CORPORATION";
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
      const data = (await res.json()) as { ok: boolean; message?: string; profile?: { id: string; name: string; balance: number; accountType?: string } };
      if (data.ok && data.profile) {
        setLocalStudents((prev) =>
          prev.map((s) =>
            s.id === data.profile!.id
              ? {
                  ...s,
                  balance: data.profile!.balance,
                  account_type: data.profile!.accountType ?? s.account_type ?? "STUDENT"
                }
              : s
          )
        );
        setSelectedStudent({
          id: data.profile.id,
          name: data.profile.name,
          balance: data.profile.balance,
          account_type: data.profile.accountType ?? "STUDENT"
        });
        if ((data.profile.accountType ?? "STUDENT") === "CORPORATION") {
          void loadCorporationShares(data.profile.id);
        } else {
          setHoldings([]);
        }
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
    const p2p = Boolean(toRecipient && !toRecipient.startsWith(GOAL_PREFIX));
    if ((selectedStudent.account_type ?? "STUDENT") === "CORPORATION") return selectedStudent.balance;
    if (p2p) {
      const to = localStudents.find((s) => s.id === toRecipient);
      if ((to?.account_type ?? "STUDENT") === "CORPORATION") return selectedStudent.balance;
    }
    if (p2p && fairMode) return selectedStudent.balance;
    return maxAmountPerTransfer(selectedStudent.balance, dp);
  }, [selectedStudent, toRecipient, fairMode, dp, localStudents]);

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

  async function loadCorporationShares(corporationId: string) {
    try {
      const res = await fetch(`/api/corporations/${corporationId}/shares`);
      const data = (await res.json()) as {
        ok: boolean;
        holdings?: Array<{ studentId: string; studentName: string; shareCount: number }>;
      };
      if (data.ok) setHoldings(data.holdings ?? []);
      else setHoldings([]);
    } catch {
      setHoldings([]);
    }
  }

  async function handleDividend() {
    if (!selectedStudent || !selectedIsCorporation) return;
    const amountNum = roundToDecimalPlaces(Number(dividendAmount), dp);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      showToast("총 배당 금액을 정확히 입력해주세요.", "error");
      return;
    }
    if (dividendReason.trim().length < 10) {
      showToast("배당 사유를 10자 이상 입력해주세요.", "error");
      return;
    }
    setIsDividendSubmitting(true);
    try {
      const res = await fetch("/api/corporations/dividend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          corporationId: selectedStudent.id,
          totalAmount: amountNum,
          message: dividendReason.trim()
        })
      });
      const data = (await res.json()) as { ok: boolean; message?: string; remainingBalance?: number };
      if (!res.ok || !data.ok) {
        showToast(data.message ?? "배당 실행에 실패했습니다.", "error");
        return;
      }
      setLocalStudents((prev) =>
        prev.map((s) =>
          s.id === selectedStudent.id
            ? { ...s, balance: data.remainingBalance ?? s.balance }
            : s
        )
      );
      setSelectedStudent((prev) =>
        prev ? { ...prev, balance: data.remainingBalance ?? prev.balance } : prev
      );
      setDividendAmount("");
      setDividendReason("");
      showToast(data.message ?? "배당이 완료되었습니다.", "success");
      router.refresh();
    } catch {
      showToast("배당 요청 중 오류가 발생했습니다.", "error");
    } finally {
      setIsDividendSubmitting(false);
    }
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
    const isCorpSender = (sender.account_type ?? "STUDENT") === "CORPORATION";
    const toProfile = !isGoal && !isVault ? localStudents.find((s) => s.id === toRecipient) : null;
    const isCorpReceiver = (toProfile?.account_type ?? "STUDENT") === "CORPORATION";
    const maxOnce = isCorpSender || isCorpReceiver
      ? sender.balance
      : isGoal || isVault
        ? maxAmountPerTransfer(sender.balance, dp)
        : fairMode
          ? sender.balance
          : maxAmountPerTransfer(sender.balance, dp);
    if (transferAmount > maxOnce + 1e-9) {
      showToast(
        isGoal || !fairMode
          ? `한 번에 최대 ${fc(maxOnce)} ${CURRENCY}(현재 잔액의 10%)까지 보낼 수 있어요.`
          : `한 번에 최대 ${fc(maxOnce)} ${CURRENCY}(전액)까지 보낼 수 있어요.`,
        "error"
      );
      return;
    }
    const toGoalId = isGoal ? toRecipient.slice(GOAL_PREFIX.length) : null;
    const toStudentId = isGoal || isVault ? null : toRecipient;

    if (praiseMessage.trim().length < 10) {
      showToast("송금/기부 메시지를 10자 이상 입력해주세요.", "error");
      return;
    }

    const praiseForSend = praiseMessage.trim();
    setIsSubmitting(true);

    try {
      const body: Record<string, unknown> = {
        fromStudentId: sender.id,
        amount: transferAmount
      };
      if (toGoalId) {
        body.toGoalId = toGoalId;
        body.praiseMessage = praiseForSend;
      }
      else if (isVault) {
        body.toVault = true;
        body.praiseMessage = praiseForSend;
      }
      else {
        body.toStudentId = toStudentId;
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
      <section className="mb-4">
        <div>
          <h2 className="text-xl font-bold text-white md:text-2xl">학생 지갑 보드</h2>
          <p className="mt-1 text-sm text-gray-400">{subtitle}</p>
          <p className="mt-1 text-xs text-gray-500">본인 이름을 누르고 4자리 비밀번호를 입력하세요.</p>
        </div>
      </section>

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {localStudents.map((student) => (
          <button
            key={student.id}
            type="button"
            onClick={() => setPasswordModalStudent(student)}
            className={`flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-left shadow transition focus-visible:outline-none focus-visible:ring-2 ${
              (student.account_type ?? "STUDENT") === "CORPORATION"
                ? "border border-emerald-400/60 bg-emerald-950/35 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-[0_0_14px_rgba(16,185,129,0.28)] focus-visible:ring-emerald-400"
                : "border border-white/10 bg-slate-900/70 hover:-translate-y-0.5 hover:border-orange-400/60 hover:shadow-[0_0_12px_rgba(247,147,26,0.2)] focus-visible:ring-orange-400"
            }`}
          >
            <span className="truncate font-semibold text-white">
              {student.name}
              {(student.account_type ?? "STUDENT") === "CORPORATION" && (
                <span className="ml-2 rounded border border-emerald-400/50 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                  CORP
                </span>
              )}
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-[10px] text-gray-500">현재 잔액</span>
              <span
                className={`font-bold ${
                  (student.account_type ?? "STUDENT") === "CORPORATION"
                    ? "text-emerald-300"
                    : "text-orange-400"
                }`}
              >
                {fc(student.balance)} {CURRENCY}
              </span>
            </span>
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

      {passwordModalStudent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-orange-400/40 bg-slate-900 p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-orange-300">로그인</p>
            <h3 className="mt-2 text-xl font-bold text-white">{passwordModalStudent.name}</h3>
            <p className="mt-2 text-sm text-gray-400">4자리 비밀번호를 입력하세요.</p>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
              onKeyDown={(e) => e.key === "Enter" && handlePasswordVerify()}
              placeholder="0000"
              className="mt-4 w-full rounded-md border border-white/20 bg-slate-800 px-4 py-3 text-center text-lg tracking-[0.5em] text-white outline-none focus:border-orange-400"
            />
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setPasswordModalStudent(null);
                  setPasswordInput("");
                }}
                className="flex-1 rounded-lg border border-white/20 px-4 py-2 text-sm text-gray-300"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handlePasswordVerify}
                disabled={passwordVerifying || passwordInput.length !== 4}
                className="flex-1 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
              >
                {passwordVerifying ? "확인 중..." : "입장"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedStudent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl border border-orange-400/40 bg-slate-900 p-6 shadow-[0_0_32px_rgba(247,147,26,0.2)]">
            <div className="overflow-y-auto pr-1">
            <p className="text-xs uppercase tracking-[0.2em] text-orange-300">Wallet Menu</p>
            <h3 className="mt-2 text-2xl font-extrabold text-white">
              {selectedStudent.name}
            </h3>
            <p className="mt-2 text-sm text-gray-300">
              현재 잔액:{" "}
              <span className="font-bold text-orange-400">
                {fc(selectedStudent.balance)} {CURRENCY}
              </span>
            </p>
            {selectedIsCorporation && (
              <p className="mt-1 text-xs text-emerald-300">
                법인 계정: 송금 10% 제한 없이 거래할 수 있습니다.
              </p>
            )}

            <div className="mt-6 grid gap-3">
              {selectedIsCorporation && (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-3">
                  <p className="text-sm font-semibold text-emerald-300">지분 배당 실행</p>
                  <p className="mt-1 text-xs text-gray-300">
                    총 배당금의 10%는 자동 징수되고, 90%는 10주 지분대로 분배됩니다.
                  </p>
                  {holdings.some((h) => h.shareCount > 0) && (
                    <p className="mt-1 text-xs text-gray-400">
                      {holdings
                        .filter((h) => h.shareCount > 0)
                        .map((h) => `${h.studentName} ${h.shareCount}주`)
                        .join(" · ")}
                    </p>
                  )}
                  <input
                    type="number"
                    min={dp === 0 ? 1 : 0.01}
                    step={amountInputStep(dp)}
                    value={dividendAmount}
                    onChange={(e) => setDividendAmount(e.target.value)}
                    className="mt-2 w-full rounded-md border border-white/20 bg-slate-900 px-3 py-2 text-sm text-white"
                    placeholder="총 배당 금액"
                  />
                  <textarea
                    value={dividendReason}
                    onChange={(e) => setDividendReason(e.target.value)}
                    rows={2}
                    maxLength={200}
                    className="mt-2 w-full rounded-md border border-white/20 bg-slate-900 px-3 py-2 text-sm text-white"
                    placeholder="배당 사유(10자 이상)"
                  />
                  <button
                    type="button"
                    onClick={handleDividend}
                    disabled={isDividendSubmitting || !timeLockResult.allowed}
                    className="mt-2 w-full rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
                  >
                    {isDividendSubmitting ? "배당 처리 중..." : "배당 실행"}
                  </button>
                </div>
              )}
              {!transferHoursEnforced && (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
                  송금 시간 제한이 꺼져 있어 평일 시간과 관계없이 송금·기부할 수 있어요.
                </div>
              )}
              {transferHoursEnforced && !timeLockResult.allowed && (
                <div className="rounded-lg border border-amber-500/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
                  ⏰ {getTimeLockMessage(timeLockResult)}
                </div>
              )}
              {!selectedIsCorporation && (
              <div className="rounded-lg border border-white/10 bg-slate-800/80 p-3">
                <p className="mb-2 text-sm font-semibold text-orange-300">송금/기부하기</p>
                <label className="mb-2 block text-xs text-gray-400">받는 대상</label>
                <select
                  value={toRecipient}
                  onChange={(event) => setToRecipient(event.target.value)}
                  className="mb-3 w-full rounded-md border border-white/20 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-orange-400"
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

                {showMessageInput && (
                  <>
                    <label className="mb-2 block text-xs text-gray-400">
                      {isP2PToStudent ? (
                        <>
                          칭찬 메시지 <span className="text-orange-400">(10자 이상 필수)</span>
                        </>
                      ) : (
                        <>송금 사유 <span className="text-orange-400">(10자 이상 필수)</span></>
                      )}
                    </label>
                    <textarea
                      value={praiseMessage}
                      onChange={(e) => setPraiseMessage(e.target.value)}
                      placeholder={
                        isP2PToStudent
                          ? "예: 친구가 발표할 때 열심히 듣는 모습이 멋져요!"
                          : "예: 학급 운영비 납부"
                      }
                      rows={2}
                      maxLength={200}
                      className="mb-3 w-full rounded-md border border-white/20 bg-slate-900 px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500 focus:border-orange-400"
                    />
                    {isP2PToStudent && praiseMessage.length > 0 && praiseMessage.length < 10 && (
                      <p className="mb-2 text-xs text-amber-400">아직 {10 - praiseMessage.length}자 더 입력해주세요.</p>
                    )}
                  </>
                )}
                <label className="mb-2 block text-xs text-gray-400">송금 금액 ({CURRENCY})</label>
                {selectedGoalNeeded != null ? (
                  <p className="mb-1.5 text-xs text-orange-300/90">
                    남은 필요액: {fc(selectedGoalNeeded)} {CURRENCY} (목표 초과분은 중앙 금고로)
                  </p>
                ) : null}
                <input
                  type="number"
                  min={dp === 0 ? 1 : 0.01}
                  step={amountInputStep(dp)}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="w-full rounded-md border border-white/20 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-orange-400"
                  placeholder={dp === 0 ? "예: 100" : dp === 1 ? "예: 10.5" : "예: 1.25"}
                />
                {toRecipient ? (
                  <p className="mt-2 text-xs text-gray-400">
                    한 번에 보낼 수 있는 최대:{" "}
                    <span className="font-medium text-orange-300/90">
                      {fc(maxOnceThisTransfer)} {CURRENCY}
                    </span>
                    {isP2PToStudent && fairMode ? (
                      <span> — 장터 모드: 친구에게는 잔액 전액까지 한 번에 보낼 수 있어요.</span>
                    ) : (
                      <span>
                        {" "}
                        (펀딩·일반 P2P: 송금 직전 잔액의 10%, 여러 번 나누어 보내도 매번 10%)
                      </span>
                    )}
                    {maxOnceThisTransfer < (dp === 0 ? 1 : 0.01) && (
                      <span className="ml-1 text-amber-400">
                        · 잔액이 적어 지금은 송금할 수 없어요
                      </span>
                    )}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={handleTransfer}
                  disabled={isSubmitting || !timeLockResult.allowed}
                  className="mt-3 w-full rounded-lg bg-orange-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "송금 중..." : timeLockResult.allowed ? "송금 실행" : "영업 시간 아님"}
                </button>
              </div>
              )}
              <button
                type="button"
                onClick={() =>
                  showToast(
                    `${selectedStudent.name} 잔액: ${fc(selectedStudent.balance)} ${CURRENCY}`,
                    "success"
                  )
                }
                className="rounded-lg border border-white/20 bg-slate-800 px-4 py-3 text-sm font-semibold text-white transition hover:border-orange-400/60"
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
                setDividendAmount("");
                setDividendReason("");
                setHoldings([]);
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
