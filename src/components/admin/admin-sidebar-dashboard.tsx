"use client";

import { useMemo, useState } from "react";
import AdminSiteRoster from "@/components/admin/admin-site-roster";
import StudentRosterManager from "@/components/admin/student-roster-manager";
import StudentPasswordReset from "@/components/dashboard/student-password-reset";
import AdminSection from "@/components/dashboard/admin-section";
import VaultTransfer from "@/components/dashboard/vault-transfer";
import AdminCollapsible from "@/components/admin/admin-collapsible";
import { formatCloverAmount } from "@/lib/money";
import type { DecimalPlaces } from "@/lib/money";
import type { GuideContent } from "@/lib/guide-content";

type Student = { id: string; name: string };
type Goal = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  is_active: boolean;
};
type Contribution = { id: string; name: string; amount: number; percent: number };

type Props = {
  students: Student[];
  goals: Goal[];
  contributions: Record<string, { total: number; byPerson: Contribution[] }>;
  burnedByGoal: Record<string, number>;
  fairMode: boolean;
  transferHoursEnforced: boolean;
  displayDp: DecimalPlaces;
  initialSiteTitle: string;
  initialSiteSubtitle: string;
  initialGuide: GuideContent;
  vaultBalance: number;
  issuanceTotal: number;
  issuanceCount: number;
  circulating: number;
  totalBurned: number;
};

type TabId = "settings" | "members" | "operations";

export default function AdminSidebarDashboard(props: Props) {
  const [tab, setTab] = useState<TabId>("settings");

  const nav = useMemo(
    () => [
      { id: "settings" as const, label: "설정" },
      { id: "members" as const, label: "학생 관리" },
      { id: "operations" as const, label: "운영 현황" }
    ],
    []
  );

  return (
    <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="md:sticky md:top-6 md:self-start">
        <nav className="rounded-3xl border border-[#d7efe2] bg-white p-3 shadow-[0_8px_24px_rgba(47,191,113,0.06)]">
          {nav.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setTab(n.id)}
              className={`mb-2 w-full cursor-pointer rounded-2xl px-3 py-2 text-left text-sm last:mb-0 ${
                tab === n.id
                  ? "bg-[#dff8ea] font-semibold text-[#1f7a4a]"
                  : "text-[#5d7a6c] hover:bg-[#f7fcf9]"
              }`}
            >
              {n.label}
            </button>
          ))}
        </nav>
      </aside>

      <section>
        {tab === "settings" && (
          <AdminSiteRoster
            initialSiteTitle={props.initialSiteTitle}
            initialSiteSubtitle={props.initialSiteSubtitle}
            initialDecimalPlaces={props.displayDp}
            initialGuide={props.initialGuide}
          />
        )}

        {tab === "members" && (
          <div className="space-y-6">
            <StudentRosterManager students={props.students} />
            <StudentPasswordReset students={props.students} />
          </div>
        )}

        {tab === "operations" && (
          <div className="space-y-6">
            <AdminCollapsible
              title="중앙 금고·발행 현황"
              description={`누적 발행 ${formatCloverAmount(props.issuanceTotal, props.displayDp)} / 21,000 · ${props.issuanceCount}회차`}
              defaultOpen
              className="rounded-3xl border border-[#d7efe2] bg-white p-6 shadow-[0_8px_24px_rgba(47,191,113,0.08)]"
            >
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2fbf71]">
                21,000 행복 중앙 금고
              </p>
              <p className="mt-2 text-3xl font-extrabold text-[#1f3d32] md:text-4xl">
                누적 발행: {formatCloverAmount(props.issuanceTotal, props.displayDp)} / 21,000 클로버 (
                {props.issuanceCount}회차)
              </p>
              <p className="mt-2 text-sm text-[#5d7a6c]">
                중앙 금고 잔액 {formatCloverAmount(props.vaultBalance, props.displayDp)} 클로버
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <p className="rounded-2xl border border-[#e8f4ee] bg-[#f7fcf9] px-4 py-2 text-sm">
                  <span className="text-[#5d7a6c]">현재 유통중:</span>{" "}
                  <span className="font-bold text-[#2fbf71]">
                    {formatCloverAmount(props.circulating, props.displayDp)} 클로버
                  </span>
                </p>
                <p className="rounded-2xl border border-[#ffe0d4] bg-[#fff4f0] px-4 py-2 text-sm">
                  <span className="text-[#7a5345]">누적 소각:</span>{" "}
                  <span className="font-bold text-[#ff7a59]">
                    {formatCloverAmount(props.totalBurned, props.displayDp)} 클로버
                  </span>
                </p>
              </div>
              <p className="mt-2 text-xs text-[#9bb5a8]">
                발행 {formatCloverAmount(props.issuanceTotal, props.displayDp)} = 유통{" "}
                {formatCloverAmount(props.circulating, props.displayDp)} + 소각{" "}
                {formatCloverAmount(props.totalBurned, props.displayDp)}
              </p>
              <VaultTransfer
                vaultBalance={props.vaultBalance}
                profiles={props.students}
                goals={props.goals.map((g) => ({ id: g.id, name: g.name, is_active: g.is_active }))}
                decimalPlaces={props.displayDp}
              />
            </AdminCollapsible>

            <AdminSection
              goals={props.goals}
              contributions={props.contributions}
              burnedByGoal={props.burnedByGoal}
              fairMode={props.fairMode}
              transferHoursEnforced={props.transferHoursEnforced}
              decimalPlaces={props.displayDp}
              issuanceTotal={props.issuanceTotal}
              issuanceCount={props.issuanceCount}
              studentCount={props.students.length}
            />
          </div>
        )}
      </section>
    </div>
  );
}
