"use client";

import { useMemo, useState } from "react";
import { CURRENCY } from "@/lib/constants";
import { formatCloverAmount } from "@/lib/money";
import type { DecimalPlaces } from "@/lib/money";

const TX_TYPE_LABELS: Record<string, string> = {
  transfer: "송금",
  contribution: "펀딩 기부",
  burn: "소각",
  mining: "클로버 씨앗 보상",
  tax: "세금",
  tax_deposit: "세금 적립",
  mining_remainder: "클로버 씨앗 나머지",
  vault_transfer: "중앙 금고 송금",
  vault_deposit: "학생→중앙 금고",
  dividend: "과거 배당",
  dividend_tax: "과거 배당 세금",
  funding_overflow: "펀딩 초과·중앙 금고",
  funding_reclaim: "펀딩 환수·중앙 금고",
  etc: "기타"
};

function getTxTypeLabel(txType: string): string {
  return TX_TYPE_LABELS[txType] ?? txType;
}

type TransactionItem = {
  id: string;
  txType: string;
  amount: number;
  fromName: string;
  toName: string;
  memo: string;
  createdAt: string | null;
};

type TransactionsBoardProps = {
  transactions: TransactionItem[];
  decimalPlaces?: DecimalPlaces;
};

function formatDate(iso: string | null) {
  if (!iso) return "시간 정보 없음";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "시간 정보 없음";

  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const month = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kst.getUTCDate()).padStart(2, "0");
  const hour = String(kst.getUTCHours()).padStart(2, "0");
  const minute = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${month}.${day} ${hour}:${minute}`;
}

export default function TransactionsBoard({
  transactions,
  decimalPlaces = 0
}: TransactionsBoardProps) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [keyword, setKeyword] = useState("");

  const availableTypes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of transactions) {
      const key = item.txType || "etc";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => getTxTypeLabel(a[0]).localeCompare(getTxTypeLabel(b[0]), "ko"))
      .map(([type, count]) => ({ type, count }));
  }, [transactions]);

  const effectiveTypeFilter =
    typeFilter === "all" || availableTypes.some((t) => t.type === typeFilter)
      ? typeFilter
      : "all";

  const filteredItems = useMemo(() => {
    const q = keyword.trim().toLowerCase();

    return transactions.filter((item) => {
      const matchesType =
        effectiveTypeFilter === "all" ? true : item.txType === effectiveTypeFilter;
      const matchesKeyword =
        q.length === 0
          ? true
          : item.fromName.toLowerCase().includes(q) ||
            item.toName.toLowerCase().includes(q) ||
            item.memo.toLowerCase().includes(q);

      return matchesType && matchesKeyword;
    });
  }, [transactions, effectiveTypeFilter, keyword]);

  return (
    <section>
      <div className="mb-4 grid gap-3 rounded-3xl border border-[#d7efe2] bg-white p-4 shadow-[0_8px_24px_rgba(47,191,113,0.06)] md:grid-cols-3">
        <label className="text-sm text-[#3d5a4f]">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#2fbf71]">
            거래 타입
          </span>
          <select
            value={effectiveTypeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="w-full rounded-xl border border-[#d7efe2] bg-[#f7fcf9] px-3 py-2 text-sm text-[#1f3d32] outline-none focus:border-[#2fbf71]"
          >
            <option value="all">전체</option>
            {availableTypes.map(({ type, count }) => (
              <option key={type} value={type}>
                {getTxTypeLabel(type)} ({count})
              </option>
            ))}
          </select>
        </label>

        <label className="md:col-span-2 text-sm text-[#3d5a4f]">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#2fbf71]">
            이름/메모 검색
          </span>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="예: 권순규, 세금, 중앙 금고"
            className="w-full rounded-xl border border-[#d7efe2] bg-[#f7fcf9] px-3 py-2 text-sm text-[#1f3d32] outline-none placeholder:text-[#9bb5a8] focus:border-[#2fbf71]"
          />
        </label>
      </div>

      <div className="mb-3 text-sm text-[#5d7a6c]">조회 결과: {filteredItems.length}건</div>

      <div className="grid gap-3">
        {filteredItems.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border border-[#d7efe2] bg-white p-4 shadow-[0_6px_18px_rgba(47,191,113,0.06)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2fbf71]">
                  {getTxTypeLabel(item.txType)}
                </p>
                <p className="mt-1 text-lg font-bold text-[#ff7a59]">
                  {formatCloverAmount(item.amount, decimalPlaces)} {CURRENCY}
                </p>
              </div>
              <p className="text-xs text-[#9bb5a8]">{formatDate(item.createdAt)}</p>
            </div>
            <p className="mt-3 text-sm text-[#1f3d32]">
              <span className="text-[#5d7a6c]">From:</span> {item.fromName}
            </p>
            <p className="text-sm text-[#1f3d32]">
              <span className="text-[#5d7a6c]">To:</span> {item.toName}
            </p>
            <p className="mt-1 text-sm text-[#3d5a4f]">
              <span className="text-[#5d7a6c]">Memo:</span> {item.memo}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
