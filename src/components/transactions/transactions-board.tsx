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
  dividend: "법인 배당",
  dividend_tax: "법인 배당 세금",
  funding_overflow: "펀딩 초과·중앙 금고",
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

  // Use fixed KST format to avoid server/client locale mismatch.
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

  const filteredItems = useMemo(() => {
    const q = keyword.trim().toLowerCase();

    return transactions.filter((item) => {
      const matchesType = typeFilter === "all" ? true : item.txType === typeFilter;
      const matchesKeyword =
        q.length === 0
          ? true
          : item.fromName.toLowerCase().includes(q) ||
            item.toName.toLowerCase().includes(q) ||
            item.memo.toLowerCase().includes(q);

      return matchesType && matchesKeyword;
    });
  }, [transactions, typeFilter, keyword]);

  return (
    <section>
      <div className="mb-4 grid gap-3 rounded-xl border border-white/10 bg-slate-900/70 p-4 md:grid-cols-3">
        <label className="text-sm text-gray-300">
          <span className="mb-1 block text-xs uppercase tracking-wider text-orange-300">
            거래 타입
          </span>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="w-full rounded-md border border-white/20 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-orange-400"
          >
            <option value="all">전체</option>
            <option value="transfer">송금</option>
            <option value="contribution">펀딩 기부</option>
            <option value="burn">소각</option>
            <option value="mining">클로버 씨앗 보상</option>
            <option value="tax">세금</option>
            <option value="tax_deposit">세금 적립</option>
            <option value="mining_remainder">클로버 씨앗 나머지</option>
            <option value="vault_transfer">중앙 금고 송금</option>
            <option value="vault_deposit">학생→중앙 금고</option>
            <option value="dividend">법인 배당</option>
            <option value="dividend_tax">법인 배당 세금</option>
            <option value="funding_overflow">펀딩 초과·중앙 금고</option>
            <option value="etc">기타</option>
          </select>
        </label>

        <label className="md:col-span-2 text-sm text-gray-300">
          <span className="mb-1 block text-xs uppercase tracking-wider text-orange-300">
            이름/메모 검색
          </span>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="예: 권순규, 세금, 중앙 금고"
            className="w-full rounded-md border border-white/20 bg-slate-950 px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500 focus:border-orange-400"
          />
        </label>
      </div>

      <div className="mb-3 text-sm text-gray-400">조회 결과: {filteredItems.length}건</div>

      <div className="grid gap-3">
        {filteredItems.map((item) => (
          <article
            key={item.id}
            className="rounded-xl border border-white/10 bg-slate-900/70 p-4 shadow-lg shadow-black/10"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-orange-300">
                  {getTxTypeLabel(item.txType)}
                </p>
                <p className="mt-1 text-lg font-bold text-orange-400">
                  {formatCloverAmount(item.amount, decimalPlaces)} {CURRENCY}
                </p>
              </div>
              <p className="text-xs text-gray-400">{formatDate(item.createdAt)}</p>
            </div>
            <p className="mt-3 text-sm text-gray-200">
              <span className="text-gray-400">From:</span> {item.fromName}
            </p>
            <p className="text-sm text-gray-200">
              <span className="text-gray-400">To:</span> {item.toName}
            </p>
            <p className="mt-1 text-sm text-gray-300">
              <span className="text-gray-400">Memo:</span> {item.memo}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
