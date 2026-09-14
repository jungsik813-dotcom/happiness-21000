import MainHeader from "@/components/layout/main-header";
import { CURRENCY } from "@/lib/constants";
import { formatCloverAmount } from "@/lib/money";
import type { DecimalPlaces } from "@/lib/money";
import { getVaultBranding, normalizeDecimalPlaces } from "@/lib/vault-settings";
import StudentGrid from "@/components/dashboard/student-grid";
import FundingGoalsDisplay from "@/components/dashboard/funding-goals-display";
import PraiseTimeline from "@/components/dashboard/praise-timeline";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { computeCloverSupply } from "@/lib/clover-supply";
import { shouldIncludeInGoalContributorRank } from "@/lib/goal-contribution-rank";
import { fetchTransactionsWithTypeFallback } from "@/lib/transactions";
import Link from "next/link";

export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  name: string | null;
  balance: number | null;
  account_type?: string | null;
};

type VaultRow = {
  central_balance: number | null;
  issuance_total: number | null;
  issuance_count: number | null;
  fair_mode?: boolean | null;
  transfer_hours_enforced?: boolean | null;
  decimal_places?: number | null;
};

type GoalRow = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  is_active: boolean;
};

export default async function HomePage() {
  const supabase = await createSupabaseServerClient().catch(() => null);
  if (!supabase) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-12 md:px-10">
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          서버 데이터 클라이언트 초기화에 실패했습니다. 잠시 후 다시 시도해주세요.
        </section>
      </main>
    );
  }
  const branding = await getVaultBranding();
  const dp = branding.decimal_places as DecimalPlaces;

  const queries = await Promise.all([
      supabase.from("profiles").select("id, name, balance, account_type").order("name"),
      supabase
        .from("vault")
        .select(
          "central_balance, issuance_total, issuance_count, fair_mode, transfer_hours_enforced, decimal_places"
        )
        .limit(1)
        .maybeSingle<VaultRow>(),
      supabase
        .from("goals")
        .select("id, name, target_amount, current_amount, is_active")
        .order("created_at", { ascending: false }),
      fetchTransactionsWithTypeFallback(
        supabase,
        "from_profile_id, to_profile_id, to_goal_id, amount, memo, created_at"
      )
    ]).catch(() => null);
  if (!queries) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-12 md:px-10">
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          데이터 로딩 중 예외가 발생했습니다. 잠시 후 다시 시도해주세요.
        </section>
      </main>
    );
  }
  const [profilesQuery, vaultQuery, goalsQuery, txResult] = queries;

  const goalsRaw = Array.isArray(goalsQuery.data) ? goalsQuery.data : (goalsQuery.data ?? []);
  const profiles = ((profilesQuery.data as ProfileRow[] | null) ?? [])
    .filter((profile) => (profile.account_type ?? "STUDENT") === "STUDENT")
    .map((profile) => ({
      id: profile.id,
      name: profile.name?.trim() || "이름 없음",
      balance: profile.balance ?? 0
    }));

  const issuanceTotal = Number(vaultQuery.data?.issuance_total ?? 0);
  const issuanceCount = Number(vaultQuery.data?.issuance_count ?? 0);
  const vaultBalance = Number(vaultQuery.data?.central_balance ?? 0);
  const fairMode = Boolean(vaultQuery.data?.fair_mode ?? false);
  const transferHoursEnforced = vaultQuery.data?.transfer_hours_enforced ?? true;
  const displayDp = normalizeDecimalPlaces(vaultQuery.data?.decimal_places ?? dp) as DecimalPlaces;

  const goals = goalsRaw
    .filter((g) => g && typeof g.id === "string")
    .map((g) => ({
      id: String(g.id),
      name: String(g.name ?? ""),
      target_amount: Number(g.target_amount) || 0,
      current_amount: Number(g.current_amount) || 0,
      is_active: Boolean(g.is_active)
    }));

  const profileMap = new Map(profiles.map((p) => [p.id, p.name]));
  const contributionRows = txResult.data;
  const contributionsByGoal = new Map<
    string,
    { total: number; byPerson: Array<{ id: string; name: string; amount: number; percent: number }> }
  >();

  for (const row of contributionRows) {
    if (!shouldIncludeInGoalContributorRank(row)) continue;
    const toGoalId = typeof row.to_goal_id === "string" ? row.to_goal_id : null;
    if (!toGoalId) continue;
    const fromId = typeof row.from_profile_id === "string" ? row.from_profile_id : null;
    if (!fromId) continue;
    const amount = Number(row.amount) || 0;
    if (amount <= 0) continue;

    if (!contributionsByGoal.has(toGoalId)) {
      contributionsByGoal.set(toGoalId, { total: 0, byPerson: [] });
    }
    const entry = contributionsByGoal.get(toGoalId)!;
    let person = entry.byPerson.find((p) => p.id === fromId);
    if (!person) {
      person = {
        id: fromId,
        name: profileMap.get(fromId) ?? "알 수 없음",
        amount: 0,
        percent: 0
      };
      entry.byPerson.push(person);
    }
    person.amount += amount;
    entry.total += amount;
  }

  for (const entry of contributionsByGoal.values()) {
    entry.byPerson.sort((a, b) => b.amount - a.amount);
    for (const p of entry.byPerson) {
      p.percent = entry.total > 0 ? (p.amount / entry.total) * 100 : 0;
    }
  }

  const contributions = Object.fromEntries(
    contributionsByGoal.entries()
  ) as Record<string, { total: number; byPerson: Array<{ id: string; name: string; amount: number; percent: number }> }>;

  const praiseTimelineItems = contributionRows
    .filter((row) => (row.tx_type ?? row.type ?? "") === "transfer")
    .map((row) => {
      const fromId = typeof row.from_profile_id === "string" ? row.from_profile_id : null;
      const toId = typeof row.to_profile_id === "string" ? row.to_profile_id : null;
      const memo = typeof row.memo === "string" ? row.memo : "";
      const created = typeof row.created_at === "string" ? row.created_at : null;
      const amount = Number(row.amount) || 0;
      const praise = memo.includes("칭찬: ") ? memo.split("칭찬: ")[1]?.trim() ?? memo : memo;
      return {
        fromName: fromId ? profileMap.get(fromId) ?? "알 수 없음" : "알 수 없음",
        toName: toId ? profileMap.get(toId) ?? "알 수 없음" : "알 수 없음",
        amount,
        praise: praise || "-",
        createdAt: created
      };
    })
    .sort((a, b) => {
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const burnedByGoal = new Map<string, number>();
  for (const row of contributionRows) {
    const txType = (row.tx_type ?? row.type ?? "") as string;
    if (txType !== "burn") continue;
    const toGoalId = typeof row.to_goal_id === "string" ? row.to_goal_id : null;
    if (!toGoalId) continue;
    const amount = Number(row.amount) || 0;
    if (amount <= 0) continue;
    burnedByGoal.set(toGoalId, (burnedByGoal.get(toGoalId) ?? 0) + amount);
  }
  const totalProfileBalances = profiles.reduce((sum, p) => sum + Number(p.balance ?? 0), 0);
  const totalGoalBalances = goals.reduce((sum, g) => sum + Number(g.current_amount ?? 0), 0);
  const { circulating, burned: totalBurned } = computeCloverSupply({
    issuanceTotal,
    profileBalances: totalProfileBalances,
    vaultBalance,
    goalBalances: totalGoalBalances
  });

  const hasError = Boolean(profilesQuery.error || vaultQuery.error || txResult.errorMessage);
  const errorDetails: string[] = [];
  if (profilesQuery.error) errorDetails.push(`profiles: ${profilesQuery.error.message}`);
  if (vaultQuery.error) errorDetails.push(`vault: ${vaultQuery.error.message}`);
  if (txResult.errorMessage) errorDetails.push(`transactions: ${txResult.errorMessage}`);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10 md:px-10 md:py-12">
      <MainHeader title={branding.site_title} subtitle={branding.site_subtitle} />

      <section className="animate-pop-in mb-8 overflow-hidden rounded-[2rem] border border-[#d7efe2] bg-white/90 p-6 shadow-[0_12px_40px_rgba(47,191,113,0.1)] md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2fbf71]">누적 발행</p>
            <p
              className="mt-2 text-3xl font-semibold text-[#1f3d32] md:text-5xl"
              style={{ fontFamily: "var(--font-fredoka), sans-serif" }}
            >
              {formatCloverAmount(issuanceTotal, displayDp)}
              <span className="text-2xl text-[#5d7a6c] md:text-3xl"> / 21,000 {CURRENCY}</span>
            </p>
            <p className="mt-2 text-sm text-[#5d7a6c]">{issuanceCount}회차 · 학급 클로버가 얼마나 자랐는지 보여줘요</p>
          </div>
          <div className="animate-float-soft rounded-2xl border border-[#c9f0db] bg-[#dff8ea] px-4 py-3 text-sm font-bold text-[#1f7a4a]">
            중앙 금고 {formatCloverAmount(vaultBalance, displayDp)} {CURRENCY}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <p className="rounded-2xl border border-[#e8f4ff] bg-[#f3f9ff] px-4 py-3 text-sm text-[#3d5a6c]">
            현재 유통중{" "}
            <span className="font-bold text-[#1f3d32]">
              {formatCloverAmount(circulating, displayDp)} {CURRENCY}
            </span>
          </p>
          <p className="rounded-2xl border border-[#ffe8de] bg-[#fff7f3] px-4 py-3 text-sm text-[#7a5345]">
            누적 소각{" "}
            <span className="font-bold text-[#ff7a59]">
              {formatCloverAmount(totalBurned, displayDp)} {CURRENCY}
            </span>
          </p>
        </div>
        <p className="mt-2 text-xs text-[#9bb5a8]">
          발행 {formatCloverAmount(issuanceTotal, displayDp)} = 유통{" "}
          {formatCloverAmount(circulating, displayDp)} + 소각{" "}
          {formatCloverAmount(totalBurned, displayDp)}
        </p>

        <Link
          href="/transactions"
          className="mt-5 inline-flex rounded-full bg-[#2fbf71] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#28a862] hover:shadow-md"
        >
          거래내역 보기
        </Link>
      </section>

      <FundingGoalsDisplay
        goals={goals}
        contributions={contributions}
        burnedByGoal={Object.fromEntries(burnedByGoal.entries())}
        decimalPlaces={displayDp}
      />

      <PraiseTimeline items={praiseTimelineItems} decimalPlaces={displayDp} />

      {hasError ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">데이터 로딩 중 오류가 발생했습니다.</p>
          {errorDetails.length > 0 && (
            <p className="mt-1 text-xs text-red-600">{errorDetails.join(" · ")}</p>
          )}
          <p className="mt-3 text-xs">
            Supabase 대시보드에서 <strong>profiles</strong>, <strong>vault</strong> 테이블이 있고
            RLS로 anon의 SELECT가 허용되어야 합니다.{" "}
            <code className="rounded bg-white px-1">supabase/migrations/</code>의
            <strong> 000_init.sql → 001~004</strong>를 SQL Editor에서 순서대로 실행하세요.
          </p>
        </section>
      ) : (
        <StudentGrid
          students={profiles}
          goals={goals}
          fairMode={fairMode}
          transferHoursEnforced={transferHoursEnforced}
          decimalPlaces={displayDp}
        />
      )}
    </main>
  );
}
