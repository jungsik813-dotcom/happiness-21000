import MainHeader from "@/components/layout/main-header";
import StudentGrid from "@/components/dashboard/student-grid";
import AdminSection from "@/components/dashboard/admin-section";
import VaultTransfer from "@/components/dashboard/vault-transfer";
import { AdminProvider } from "@/components/admin/admin-provider";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
      .select("central_balance, issuance_total, issuance_count")
      .limit(1)
      .maybeSingle<VaultRow>(),
    supabase
      .from("goals")
      .select("id, name, target_amount, current_amount, is_active")
      .order("created_at", { ascending: false }),
    supabase.from("transactions").select("from_profile_id, to_goal_id, amount, tx_type, type").limit(2000)
  ]);

  const goalsRaw = Array.isArray(goalsQuery.data) ? goalsQuery.data : (goalsQuery.data ?? []);
  const profiles = ((profilesQuery.data as ProfileRow[] | null) ?? []).map(
    (profile) => ({
      id: profile.id,
      name: profile.name?.trim() || "이름 없음",
      balance: profile.balance ?? 0
    })
  );

  const vaultBalance = vaultQuery.data?.central_balance ?? 0;
  const issuanceTotal = Number(vaultQuery.data?.issuance_total ?? 0);
  const issuanceCount = Number(vaultQuery.data?.issuance_count ?? 0);

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
    const txType = (row.tx_type ?? row.type ?? "") as string;
    if (txType !== "contribution") continue;
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

  const hasError = Boolean(profilesQuery.error || vaultQuery.error);

  return (
    <AdminProvider>
      <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-12 md:px-10">
        <MainHeader />

      <section className="mb-8 rounded-2xl border border-orange-400/40 bg-slate-900/80 p-6 shadow-[0_0_32px_rgba(247,147,26,0.15)]">
        <p className="text-xs uppercase tracking-[0.2em] text-orange-300">
          21,000 행복 중앙 금고
        </p>
        <p className="mt-2 text-3xl font-extrabold text-orange-400 md:text-5xl">
          누적 발행: {toWon(issuanceTotal)} / 21,000 P ({issuanceCount}회차)
        </p>
        <p className="mt-2 text-sm text-gray-400">
          중앙 금고 잔액 {toWon(vaultBalance)} P · 오늘의 학급 경제 총예산을 한눈에 확인하세요.
        </p>
        <VaultTransfer
          vaultBalance={vaultBalance}
          profiles={profiles.map((p) => ({ id: p.id, name: p.name }))}
          goals={goals.map((g) => ({ id: g.id, name: g.name, is_active: g.is_active }))}
        />
        <Link
          href="/transactions"
          className="mt-4 inline-block rounded-md border border-orange-400/50 px-4 py-2 text-sm font-semibold text-orange-300 transition hover:bg-orange-500/10"
        >
          거래내역 보기
        </Link>
      </section>

      <AdminSection
        goals={goals}
        students={profiles.map((p) => ({ id: p.id, name: p.name }))}
        contributions={contributions}
        burnedByGoal={Object.fromEntries(burnedByGoal.entries())}
      />

      {hasError ? (
        <section className="rounded-xl border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-200">
          데이터 로딩 중 오류가 발생했습니다. Supabase 테이블/권한 설정을 확인해주세요.
        </section>
      ) : (
        <StudentGrid students={profiles} goals={goals} />
      )}
      </main>
    </AdminProvider>
  );
}
