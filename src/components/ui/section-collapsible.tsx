"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

type SectionCollapsibleProps = {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
  titleStyle?: CSSProperties;
  /** 헤더 오른쪽에 접기 버튼과 함께 둘 부가 요소 (링크 등) */
  headerExtra?: ReactNode;
};

export default function SectionCollapsible({
  title,
  description,
  defaultOpen = false,
  children,
  className = "mb-8 rounded-[2rem] border border-[#d7efe2] bg-white/90 p-5 shadow-[0_8px_24px_rgba(47,191,113,0.06)] md:p-6",
  titleStyle,
  headerExtra
}: SectionCollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={className}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ui-expand-trigger flex min-w-0 flex-1 items-start justify-between gap-3 px-2 py-1 text-left"
          aria-expanded={open}
        >
          <div className="min-w-0">
            <h2
              className="text-2xl font-semibold text-[#1f3d32]"
              style={titleStyle ?? { fontFamily: "var(--font-fredoka), sans-serif" }}
            >
              {title}
            </h2>
            {description ? <p className="mt-1 text-sm text-[#5d7a6c]">{description}</p> : null}
          </div>
          <span className="ui-expand-hint shrink-0 pt-1 text-sm font-semibold text-[#9bb5a8]">
            {open ? "접기 ▲" : "펼치기 ▼"}
          </span>
        </button>
        {headerExtra}
      </div>
      {open ? <div className="mt-4 space-y-4">{children}</div> : null}
    </section>
  );
}
