import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { insertTransaction } from "@/lib/transactions";
import { getEffectiveTransferTimeLock, getTimeLockMessage } from "@/lib/time-lock";
import { maxAmountPerTransfer } from "@/lib/constants";
import { readJsonObject } from "@/lib/safe-json";
import { splitGoalFunding } from "@/lib/goal-funding";
import { normalizeDecimalPlaces } from "@/lib/vault-settings";
import { isUuid, parseCloverAmount } from "@/lib/validation";
import type { DecimalPlaces } from "@/lib/money";

type TransferBody = {
  fromStudentId?: string;
  toStudentId?: string;
  toGoalId?: string;
  toVault?: boolean;
  amount?: number;
  praiseMessage?: string;
};

type ProfileRow = { id: string; balance: number | null; name: string | null };
type GoalRow = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
};
type VaultRow = { id: string; central_balance: number | null };

export async function POST(request: Request) {
  const parsed = await readJsonObject(request);
  if (!parsed.ok) return parsed.response;

  const body = parsed.data as TransferBody;
  const fromStudentId = body.fromStudentId?.trim() ?? "";
  const toStudentId = body.toStudentId?.trim() || null;
  const toGoalId = body.toGoalId?.trim() || null;
  const toVault = body.toVault === true;
  const praiseMessage = typeof body.praiseMessage === "string" ? body.praiseMessage.trim() : "";

  const isP2P = Boolean(toStudentId);
  const isContribution = Boolean(toGoalId);
  const isVaultDeposit = toVault;
  const destinationCount = Number(isP2P) + Number(isContribution) + Number(isVaultDeposit);

  if (!fromStudentId || !isUuid(fromStudentId)) {
    return NextResponse.json({ ok: false, message: "보내는 학생 정보가 올바르지 않습니다." }, { status: 400 });
  }
  if (isP2P && (!toStudentId || !isUuid(toStudentId))) {
    return NextResponse.json({ ok: false, message: "받는 학생 정보가 올바르지 않습니다." }, { status: 400 });
  }
  if (isContribution && (!toGoalId || !isUuid(toGoalId))) {
    return NextResponse.json({ ok: false, message: "펀딩 목표 정보가 올바르지 않습니다." }, { status: 400 });
  }

  if (destinationCount !== 1) {
    return NextResponse.json(
      { ok: false, message: "받는 대상을 한 곳만 선택해주세요." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const vaultSettings = await supabase
    .from("vault")
    .select("transfer_hours_enforced, fair_mode, decimal_places")
    .limit(1)
    .maybeSingle<{
      transfer_hours_enforced: boolean | null;
      fair_mode: boolean | null;
      decimal_places: number | null;
    }>();
  const transferHoursEnforced = vaultSettings.data?.transfer_hours_enforced ?? true;
  const fairMode = vaultSettings.data?.fair_mode ?? false;
  const dp = normalizeDecimalPlaces(vaultSettings.data?.decimal_places) as DecimalPlaces;

  const amountParsed = parseCloverAmount(body.amount, dp);
  if (!amountParsed.ok) {
    const hint =
      dp === 0
        ? "1 이상의 정수(클로버)"
        : dp === 1
          ? "0.1 이상, 소수 첫째 자리까지"
          : "0.01 이상, 소수 둘째 자리까지";
    return NextResponse.json(
      { ok: false, message: `송금 금액을 확인해주세요. (${hint})` },
      { status: 400 }
    );
  }
  const amount = amountParsed.value;

  const timeLock = getEffectiveTransferTimeLock(transferHoursEnforced);
  if (!timeLock.allowed) {
    return NextResponse.json(
      { ok: false, message: getTimeLockMessage(timeLock) },
      { status: 400 }
    );
  }

  if (praiseMessage.length < 10) {
    return NextResponse.json(
      { ok: false, message: "송금 사유/칭찬 메시지를 10자 이상 입력해주세요." },
      { status: 400 }
    );
  }

  if (isP2P && fromStudentId === toStudentId) {
    return NextResponse.json(
      { ok: false, message: "같은 학생에게는 송금할 수 없습니다." },
      { status: 400 }
    );
  }

  const fromQuery = await supabase
    .from("profiles")
    .select("id, name, balance, account_type")
    .eq("id", fromStudentId)
    .single<ProfileRow & { account_type: string | null }>();

  if (fromQuery.error || !fromQuery.data) {
    return NextResponse.json(
      { ok: false, message: "보내는 학생 정보를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const fromBalance = fromQuery.data.balance ?? 0;
  if (fromBalance < amount) {
    return NextResponse.json(
      { ok: false, message: "잔액이 부족합니다." },
      { status: 400 }
    );
  }

  const fromIsCorp = (fromQuery.data.account_type ?? "STUDENT") === "CORPORATION";
  if (fromIsCorp) {
    return NextResponse.json(
      { ok: false, message: "법인 계정은 직접 송금할 수 없고, 지분 배당만 가능합니다." },
      { status: 400 }
    );
  }
  if (!fromIsCorp && (isContribution || isVaultDeposit)) {
    const maxPerTransfer = maxAmountPerTransfer(fromBalance, dp);
    if (amount > maxPerTransfer) {
      return NextResponse.json(
        {
          ok: false,
          message: `한 번에 보낼 수 있는 최대액은 현재 잔액의 10%입니다. (최대 ${maxPerTransfer} 클로버, 여러 번 나누어 보낼 수 있어요)`
        },
        { status: 400 }
      );
    }
  }

  let effectiveAmount = amount;
  let memo: string;
  let cappedMessage = "";
  /** 펀딩에 실제 반영된 금액 (거래 기록용). 0이면 contribution 타입 메인 로그 생략 */
  let contributionToGoal = 0;

  if (isContribution) {
    const goalQuery = await supabase
      .from("goals")
      .select("id, name, target_amount, current_amount")
      .eq("id", toGoalId!)
      .eq("is_active", true)
      .single<GoalRow>();

    if (goalQuery.error || !goalQuery.data) {
      return NextResponse.json(
        { ok: false, message: "펀딩 목표를 찾을 수 없거나 비활성입니다." },
        { status: 404 }
      );
    }

    const vaultRes = await supabase
      .from("vault")
      .select("id, central_balance")
      .limit(1)
      .single<VaultRow>();

    if (vaultRes.error || !vaultRes.data) {
      return NextResponse.json(
        { ok: false, message: "중앙 금고 정보를 찾을 수 없습니다." },
        { status: 500 }
      );
    }

    const goalRow = goalQuery.data;
    const currentAmount = goalRow.current_amount ?? 0;
    const targetAmount = goalRow.target_amount ?? 0;
    const split = splitGoalFunding(currentAmount, targetAmount, amount, dp);
    contributionToGoal = split.toGoal;

    if (split.needsStaleCompletion) {
      if (currentAmount > 0) {
        await insertTransaction(supabase, {
          txType: "burn",
          amount: currentAmount,
          fromProfileId: null,
          toProfileId: null,
          toGoalId: toGoalId!,
          memo: `소각: ${goalRow.name} 펀딩 완료(정리)`
        });
      }
      const staleClose = await supabase
        .from("goals")
        .update({ is_active: false, current_amount: 0 })
        .eq("id", toGoalId!);
      if (staleClose.error) {
        return NextResponse.json(
          { ok: false, message: "펀딩 목표 정리 중 오류가 발생했습니다." },
          { status: 500 }
        );
      }
      cappedMessage =
        split.toVault > 0
          ? ` 이미 목표를 달성한 펀딩이었습니다. 보낸 ${split.toVault} 클로버는 중앙 금고로 전달되었습니다.`
          : "";
    } else if (split.toGoal > 0) {
      if (split.goalReached) {
        const goalClose = await supabase
          .from("goals")
          .update({ is_active: false, current_amount: 0 })
          .eq("id", toGoalId!);
        if (goalClose.error) {
          return NextResponse.json(
            { ok: false, message: "펀딩 적립 중 오류가 발생했습니다." },
            { status: 500 }
          );
        }
        await insertTransaction(supabase, {
          txType: "burn",
          amount: split.newGoalTotal,
          fromProfileId: null,
          toProfileId: null,
          toGoalId: toGoalId!,
          memo: `소각: ${goalRow.name} 펀딩 완료`
        });
        cappedMessage =
          split.toVault > 0
            ? ` 펀딩 목표를 달성했습니다! 초과분 ${split.toVault} 클로버는 중앙 금고로 전달되었습니다.`
            : " 펀딩 목표를 달성했습니다!";
      } else {
        const goalUpdate = await supabase
          .from("goals")
          .update({ current_amount: split.newGoalTotal })
          .eq("id", toGoalId!);
        if (goalUpdate.error) {
          return NextResponse.json(
            { ok: false, message: "펀딩 적립 중 오류가 발생했습니다." },
            { status: 500 }
          );
        }
        cappedMessage =
          split.toVault > 0
            ? ` 목표에 ${split.toGoal} 클로버가 반영되었고, 나머지 ${split.toVault} 클로버는 중앙 금고로 전달되었습니다.`
            : "";
      }
    } else if (split.toVault > 0) {
      cappedMessage = ` 보낸 ${split.toVault} 클로버는 중앙 금고로 전달되었습니다.`;
    }

    if (split.toVault > 0) {
      const vb = vaultRes.data.central_balance ?? 0;
      const vaultAdd = await supabase
        .from("vault")
        .update({ central_balance: vb + split.toVault })
        .eq("id", vaultRes.data.id);
      if (vaultAdd.error) {
        return NextResponse.json(
          { ok: false, message: "중앙 금고 적립 중 오류가 발생했습니다." },
          { status: 500 }
        );
      }
      await insertTransaction(supabase, {
        txType: "funding_overflow",
        amount: split.toVault,
        fromProfileId: null,
        toProfileId: null,
        toGoalId: null,
        memo: `펀딩 초과분 → 중앙 금고 (${goalRow.name})`
      });
    }

    effectiveAmount = amount;
    memo = `${fromQuery.data.name ?? "이름 없음"} → 펀딩: ${goalRow.name}`;
  } else if (isVaultDeposit) {
    const vaultRes = await supabase
      .from("vault")
      .select("id, central_balance")
      .limit(1)
      .single<VaultRow>();

    if (vaultRes.error || !vaultRes.data) {
      return NextResponse.json(
        { ok: false, message: "중앙 금고 정보를 찾을 수 없습니다." },
        { status: 500 }
      );
    }

    const newVaultBalance = (vaultRes.data.central_balance ?? 0) + amount;
    const vaultUpdate = await supabase
      .from("vault")
      .update({ central_balance: newVaultBalance })
      .eq("id", vaultRes.data.id);

    if (vaultUpdate.error) {
      return NextResponse.json(
        { ok: false, message: "중앙 금고 적립 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    memo = `${fromQuery.data.name ?? "이름 없음"} → 중앙 금고${
      praiseMessage ? ` | 사유: ${praiseMessage}` : ""
    }`;
  } else {
    const toQuery = await supabase
      .from("profiles")
      .select("id, name, balance, account_type")
      .eq("id", toStudentId!)
      .single<ProfileRow & { account_type: string | null }>();

    if (toQuery.error || !toQuery.data) {
      return NextResponse.json(
        { ok: false, message: "받는 학생 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const toIsCorp = (toQuery.data.account_type ?? "STUDENT") === "CORPORATION";
    /** 법인 연관 거래는 10% 상한 없음 */
    const maxPerTransfer =
      fromIsCorp || toIsCorp || (isP2P && fairMode)
        ? fromBalance
        : maxAmountPerTransfer(fromBalance, dp);
    if (amount > maxPerTransfer) {
      const msg =
        fromIsCorp || toIsCorp || (isP2P && fairMode)
          ? `송금 금액이 잔액을 초과할 수 없습니다. (최대 ${maxPerTransfer} 클로버)`
          : `한 번에 보낼 수 있는 최대액은 현재 잔액의 10%입니다. (최대 ${maxPerTransfer} 클로버, 여러 번 나누어 보낼 수 있어요)`;
      return NextResponse.json({ ok: false, message: msg }, { status: 400 });
    }

    const toBalance = toQuery.data.balance ?? 0;
    const receivedBalance = toBalance + amount;

    const updateTo = await supabase
      .from("profiles")
      .update({ balance: receivedBalance })
      .eq("id", toStudentId!);

    if (updateTo.error) {
      return NextResponse.json(
        { ok: false, message: "송금 처리 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    memo = `${fromQuery.data.name ?? "이름 없음"} → ${toQuery.data.name ?? "이름 없음"} | 칭찬: ${praiseMessage}`;
  }

  const remainingBalance = fromBalance - effectiveAmount;

  const updateFrom = await supabase
    .from("profiles")
    .update({ balance: remainingBalance })
    .eq("id", fromStudentId);

  if (updateFrom.error) {
    return NextResponse.json(
      { ok: false, message: "송금 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }

  const txType = isContribution
    ? "contribution"
    : isVaultDeposit
      ? "vault_deposit"
      : "transfer";
  const shouldInsertMainTx = !isContribution || contributionToGoal > 0;
  const txResult = shouldInsertMainTx
    ? await insertTransaction(supabase, {
        txType,
        amount: isContribution ? contributionToGoal : effectiveAmount,
        fromProfileId: fromStudentId,
        toProfileId: isP2P ? toStudentId : null,
        toGoalId: isContribution ? toGoalId : null,
        memo
      })
    : { ok: true as const };

  const baseMessage = isContribution
    ? "기부가 완료되었습니다."
    : isVaultDeposit
      ? "중앙 금고로 송금이 완료되었습니다."
      : "송금이 완료되었습니다.";
  const fullMessage =
    isContribution && cappedMessage ? baseMessage + cappedMessage : baseMessage;

  if (!txResult.ok) {
    return NextResponse.json(
      {
        ok: true,
        message: fullMessage,
        txRecorded: false,
        txError: txResult.error,
        remainingBalance
      },
      { status: 200 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: fullMessage,
    txRecorded: true,
    remainingBalance
  });
}
