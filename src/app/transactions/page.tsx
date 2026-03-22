import Link from "next/link";
import TransactionsBoard from "@/components/transactions/transactions-board";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProfileRow = {
  id: string;
  name: string | null;
};

type RawTransaction = Record<string, unknown>;

type TransactionItem = {
  id: string;
  txType: string;
  amount: number;
  fromName: string;
  toName: string;
  memo: string;
  createdAt: string | null;
};

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function pickString(row: RawTransaction, keys: string[]) {
  for (const key of keys) {
    const value = asString(row[key]);
    if (value) return value;
  }
  return null;
}

type GoalRow = { id: string; name: string };

export default async function TransactionsPage() {
  const supabase = await createSupabaseServerClient();

  const [profilesQuery, txQuery, goalsQuery] = await Promise.all([
    supabase.from("profiles").select("id, name"),
    supabase.from("transactions").select("*").limit(500),
    supabase.from("goals").select("id, name")
  ]);

  const profileMap = new Map<string, string>();
  ((profilesQuery.data as ProfileRow[] | null) ?? []).forEach((profile) => {
    profileMap.set(profile.id, profile.name?.trim() || "이름 없음");
  });

  const goalMap = new Map<string, string>();
  ((goalsQuery.data as GoalRow[] | null) ?? []).forEach((goal) => {
    goalMap.set(goal.id, goal.name);
  });

  const rows = (txQuery.data as RawTransaction[] | null) ?? [];
  const items: TransactionItem[] = rows
    .map((row, index) => {
      const id = asString(row.id) ?? `row-${index}`;
      const txType = pickString(row, ["tx_type", "type", "category"]) ?? "etc";
      const amount = asNumber(row.amount);
      const fromId = pickString(row, [
        "from_profile_id",
        "from_id",
        "sender_id",
        "from_student_id",
        "from_user_id"
      ]);
      const toId = pickString(row, [
        "to_profile_id",
        "to_id",
        "receiver_id",
        "to_student_id",
        "to_user_id"
      ]);
      const toGoalId = pickString(row, ["to_goal_id"]);
      const memo =
        pickString(row, ["memo", "note", "description", "content", "message"]) ?? "-";
      const createdAt = pickString(row, ["created_at", "createdAt", "inserted_at"]);
      const fromNameFromRow = pickString(row, [
        "from_name",
        "sender_name",
        "from_student_name",
        "sender"
      ]);
      const toNameFromRow = pickString(row, [
        "to_name",
        "receiver_name",
        "to_student_name",
        "receiver"
      ]);

      let fromName = fromId ? profileMap.get(fromId) ?? "알 수 없음" : "시스템";
      let toName: string;
      if (toGoalId) {
        toName = goalMap.get(toGoalId) ? `펀딩: ${goalMap.get(toGoalId)}` : "펀딩";
      } else {
        toName = toId ? profileMap.get(toId) ?? "알 수 없음" : "시스템";
      }

      if (fromNameFromRow) fromName = fromNameFromRow;
      if (toNameFromRow && !toGoalId) toName = toNameFromRow;

      // memo가 "A -> B" 형태면 이름 추정
      if (
        (fromName === "시스템" || fromName === "알 수 없음") &&
        (toName === "시스템" || toName === "알 수 없음") &&
        memo.includes("->")
      ) {
        const [left, right] = memo.split("->").map((value) => value.trim());
        if (left) fromName = left;
        if (right) toName = right;
      }

      return {
        id,
        txType,
        amount,
        fromName,
        toName,
        memo,
        createdAt
      };
    })
    .sort((a, b) => {
      const left = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const right = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return right - left;
    });

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-12 md:px-10">
      <header className="mb-8 border-b border-white/10 pb-4">
        <p className="text-xs uppercase tracking-[0.25em] text-orange-400">
          Transaction Ledger
        </p>
        <h1 className="mt-2 text-3xl font-extrabold text-white md:text-5xl">거래내역</h1>
        <p className="mt-2 text-sm text-gray-400">학급 경제의 모든 돈 흐름을 추적합니다.</p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-md border border-orange-400/50 px-4 py-2 text-sm font-semibold text-orange-300 transition hover:bg-orange-500/10"
        >
          메인으로 돌아가기
        </Link>
      </header>

      {txQuery.error ? (
        <section className="rounded-xl border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-200">
          거래내역을 불러오지 못했습니다. transactions 테이블/RLS를 확인해주세요.
        </section>
      ) : (
        <TransactionsBoard transactions={items} />
      )}
    </main>
  );
}
