import MainHeader from "@/components/layout/main-header";
import { CURRENCY } from "@/lib/constants";
import StudentGrid from "@/components/dashboard/student-grid";
import FundingGoalsDisplay from "@/components/dashboard/funding-goals-display";
import PraiseTimeline from "@/components/dashboard/praise-timeline";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { shouldIncludeInGoalContributorRank } from "@/lib/goal-contribution-rank";
import Link from "next/link";

type ProfileRow = {
  id: string;
  name: string | null;
  balance: number | null;
};

type VaultRow = {
  central_balance: number | null;
  issuance_total: number | null;
  issuance_count: number | null;
  fair_mode?: boolean | null;
  transfer_hours_enforced?: boolean | null;
};

type GoalRow = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  is_active: boolean;
};

function toWon(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();

  const [profilesQuery, vaultQuery, goalsQuery, txQuery] = await Promise.all([
    supabase.from("profiles").select("id, name, balance").order("name"),
    supabase
      .from("vault")
      .select("central_balance, issuance_total, issuance_count, fair_mode, transfer_hours_enforced")
      .limit(1)
      .maybeSingle<VaultRow>(),
    supabase
      .from("goals")
      .select("id, name, target_amount, current_amount, is_active")
      .order("created_at", { ascending: false }),
    supabase.from("transactions").select("from_profile_id, to_profile_id, to_goal_id, amount, tx_type, type, memo, created_at").limit(2000)
  ]);

  const goalsRaw = Array.isArray(goalsQuery.data) ? goalsQuery.data : (goalsQuery.data ?? []);
  const profiles = ((profilesQuery.data as ProfileRow[] | null) ?? []).map(
    (profile) => ({
      id: profile.id,
      name: profile.name?.trim() || "이름 없음",
      balance: profile.balance ?? 0
    })
  );

  const issuanceTotal = Number(vaultQuery.data?.issuance_total ?? 0);
  const issuanceCount = Number(vaultQuery.data?.issuance_count ?? 0);
  const vaultBalance = Number(vaultQuery.data?.central_balance ?? 0);
  const fairMode = Boolean(vaultQuery.data?.fair_mode ?? false);
  const transferHoursEnforced = vaultQuery.data?.transfer_hours_enforced ?? true;

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
  const contributionRows = (txQuery.data as Array<Record<string, unknown>> | null) ?? [];
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
  const totalBurned = [...burnedByGoal.values()].reduce((a, b) => a + b, 0);
  const circulating = Math.max(0, issuanceTotal - totalBurned);

  const hasError = Boolean(profilesQuery.error || vaultQuery.error);
  const errorDetails: string[] = [];
  if (profilesQuery.error) errorDetails.push(`profiles: ${profilesQuery.error.message}`);
  if (vaultQuery.error) errorDetails.push(`vault: ${vaultQuery.error.message}`);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-12 md:px-10">
      <MainHeader />

      <section className="mb-8 rounded-2xl border border-orange-400/40 bg-slate-900/80 p-6 shadow-[0_0_32px_rgba(247,147,26,0.15)]">
        <p className="text-xs uppercase tracking-[0.2em] text-orange-300">
          누적 발행
        </p>
        <p className="mt-2 text-3xl font-extrabold text-orange-400 md:text-5xl">
          {toWon(issuanceTotal)} / 21,000 {CURRENCY} ({issuanceCount}회차)
        </p>
        <p className="mt-2 text-sm text-gray-400">
          학급 클로버 총발행량을 한눈에 확인하세요.
        </p>
        <p className="mt-2 text-sm text-gray-400">
          중앙 금고 잔액{" "}
          <span className="font-semibold text-orange-300">
            {toWon(vaultBalance)} {CURRENCY}
          </span>
        </p>
        <p className="mt-3 rounded-lg border border-white/10 bg-slate-800/50 px-4 py-2 text-sm">
          <span className="text-gray-400">현재 유통중:</span>{" "}
          <span className="font-bold text-orange-400">{toWon(circulating)} {CURRENCY}</span>
          <span className="ml-2 text-xs text-gray-500">(누적 발행 − 소각)</span>
        </p>
        <Link
          href="/transactions"
          className="mt-4 inline-block rounded-md border border-orange-400/50 px-4 py-2 text-sm font-semibold text-orange-300 transition hover:bg-orange-500/10"
        >
          거래내역 보기
        </Link>
      </section>

      <FundingGoalsDisplay
        goals={goals}
        contributions={contributions}
        burnedByGoal={Object.fromEntries(burnedByGoal.entries())}
      />

      <PraiseTimeline items={praiseTimelineItems} />

      {hasError ? (
        <section className="rounded-xl border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-200">
          <p className="font-semibold">데이터 로딩 중 오류가 발생했습니다.</p>
          {errorDetails.length > 0 && (
            <p className="mt-1 text-xs text-red-300">{errorDetails.join(" · ")}</p>
          )}
          <p className="mt-3 text-xs">
            Supabase 대시보드에서 <strong>profiles</strong>, <strong>vault</strong> 테이블이 있고
            RLS로 anon의 SELECT가 허용되어야 합니다.{" "}
            <code className="rounded bg-slate-800 px-1">supabase/migrations/</code>의
            <strong> 000_init.sql → 001~004</strong>를 SQL Editor에서 순서대로 실행하세요.
          </p>
        </section>
      ) : (
        <StudentGrid
          students={profiles}
          goals={goals}
          fairMode={fairMode}
          transferHoursEnforced={transferHoursEnforced}
        />
      )}
    </main>
  );
}
