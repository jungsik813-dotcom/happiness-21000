"use client";

import Link from "next/link";
import { CURRENCY } from "@/lib/constants";
import { formatCloverAmount } from "@/lib/money";
import type { DecimalPlaces } from "@/lib/money";
import SectionCollapsible from "@/components/ui/section-collapsible";

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

  return (
    <SectionCollapsible
      title="실시간 칭찬 타임라인"
      description={
        displayItems.length === 0
          ? "아직 칭찬 송금이 없어요"
          : `최근 ${displayItems.length}건 · 펼쳐서 친구들의 칭찬을 봐요`
      }
    >
      {displayItems.length === 0 ? (
        <p className="rounded-2xl border border-[#e8f4ee] bg-[#f7fcf9] px-4 py-3 text-sm text-[#5d7a6c]">
          아직 칭찬 송금 내역이 없습니다.
        </p>
      ) : (
        <div className="space-y-3">
          {displayItems.map((item, i) => (
            <article
              key={i}
              className="rounded-2xl border border-[#e8f4ee] bg-[#f7fcf9] p-4 transition hover:border-[#b9ebcf]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold text-[#2fbf71]">
                  {item.fromName} → {item.toName}
                </span>
                <span className="text-sm text-[#9bb5a8]">{formatDate(item.createdAt)}</span>
              </div>
              <p className="mt-2 text-base text-[#1f3d32]">&ldquo;{item.praise}&rdquo;</p>
              <p className="mt-1 text-sm font-bold text-[#ff7a59]">
                {formatCloverAmount(item.amount, decimalPlaces)} {CURRENCY}
              </p>
            </article>
          ))}
        </div>
      )}
      <Link
        href="/transactions"
        className="inline-flex text-sm font-bold text-[#2fbf71] transition hover:text-[#1f7a4a]"
      >
        거래내역 보기 →
      </Link>
    </SectionCollapsible>
  );
}
