"use client";

import Link from "next/link";
import { CURRENCY } from "@/lib/constants";
import { formatCloverAmount } from "@/lib/money";
import type { DecimalPlaces } from "@/lib/money";

type TimelineItem = {
  fromName: string;
  toName: string;
  amount: number;
  praise: string;
  createdAt: string | null;
};

type PraiseTimelineProps = {
  items: TimelineItem[];
  decimalPlaces?: DecimalPlaces;
};

function formatDate(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}.${day} ${hour}:${minute}`;
}

export default function PraiseTimeline({ items, decimalPlaces = 0 }: PraiseTimelineProps) {
  const displayItems = items.slice(0, 3);

  if (displayItems.length === 0) {
    return (
      <section className="mb-8 rounded-2xl border border-orange-400/30 bg-slate-900/70 p-6">
        <h2 className="text-xl font-bold text-white">실시간 칭찬 타임라인</h2>
        <p className="mt-3 text-sm text-gray-500">아직 칭찬 송금 내역이 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="mb-8 rounded-2xl border border-orange-400/30 bg-slate-900/70 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-white">실시간 칭찬 타임라인</h2>
        <Link
          href="/transactions"
          className="text-sm font-medium text-orange-300 transition hover:text-orange-400"
        >
          거래내역 보기 →
        </Link>
      </div>
      <p className="mt-1 text-sm text-gray-400">
        최근 3건
      </p>
      <div className="mt-4 space-y-3">
        {displayItems.map((item, i) => (
          <article
            key={i}
            className="rounded-xl border border-white/10 bg-slate-800/60 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-orange-400">
                {item.fromName} → {item.toName}
              </span>
              <span className="text-sm text-gray-400">
                {formatDate(item.createdAt)}
              </span>
            </div>
            <p className="mt-2 text-base text-white">
              &ldquo;{item.praise}&rdquo;
            </p>
            <p className="mt-1 text-sm font-bold text-orange-300">
              {formatCloverAmount(item.amount, decimalPlaces)} {CURRENCY}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
