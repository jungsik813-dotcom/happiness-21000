"use client";

import { useState, type ReactNode } from "react";

type AdminCollapsibleProps = {
  title: string;
  description?: string;
  /** 기본값: 접힌 상태 */
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
};

export default function AdminCollapsible({
  title,
  description,
  defaultOpen = false,
  children,
  className = "ui-card p-5"
}: AdminCollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-[#1f3d32]">{title}</h2>
          {description ? <p className="mt-1 text-sm text-[#5d7a6c]">{description}</p> : null}
        </div>
        <span className="shrink-0 pt-0.5 text-sm font-semibold text-[#9bb5a8]">
          {open ? "접기 ▲" : "펼치기 ▼"}
        </span>
      </button>
      {open ? <div className="mt-4 space-y-4">{children}</div> : null}
    </section>
  );
}
