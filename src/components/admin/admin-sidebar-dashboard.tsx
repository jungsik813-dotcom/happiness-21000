"use client";

import { useMemo, useState } from "react";
import AdminSiteRoster from "@/components/admin/admin-site-roster";
import StudentRosterManager from "@/components/admin/student-roster-manager";
import StudentPasswordReset from "@/components/dashboard/student-password-reset";
import CorporationAdmin from "@/components/dashboard/corporation-admin";
import AdminSection from "@/components/dashboard/admin-section";
import VaultTransfer from "@/components/dashboard/vault-transfer";
import { formatCloverAmount } from "@/lib/money";
import type { DecimalPlaces } from "@/lib/money";

type Student = { id: string; name: string };
type Corporation = { id: string; name: string };
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
  corporations: Corporation[];
  goals: Goal[];
  contributions: Record<string, { total: number; byPerson: Contribution[] }>;
  burnedByGoal: Record<string, number>;
  fairMode: boolean;
  transferHoursEnforced: boolean;
  displayDp: DecimalPlaces;
  initialSiteTitle: string;
  initialSiteSubtitle: string;
  vaultBalance: number;
  issuanceTotal: number;
  issuanceCount: number;
};

type TabId = "settings" | "members" | "operations";

export default function AdminSidebarDashboard(props: Props) {
  const [tab, setTab] = useState<TabId>("settings");

  const nav = useMemo(
    () => [
      { id: "settings" as const, label: "설정" },
      { id: "members" as const, label: "학생·법인 관리" },
      { id: "operations" as const, label: "운영 현황" }
    ],
    []
  );

  const totalBurned = Object.values(props.burnedByGoal).reduce((a, b) => a + b, 0);
  const circulating = Math.max(0, props.issuanceTotal - totalBurned);

  return (
    <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="md:sticky md:top-6 md:self-start">
        <nav className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
          {nav.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setTab(n.id)}
              className={`mb-2 w-full rounded-lg px-3 py-2 text-left text-sm last:mb-0 ${
                tab === n.id
                  ? "bg-orange-500/20 font-semibold text-orange-300"
                  : "text-gray-300 hover:bg-slate-800"
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
          />
        )}

        {tab === "members" && (
          <div className="space-y-6">
            <StudentRosterManager students={props.students} />
            <StudentPasswordReset students={props.students} />
            <CorporationAdmin students={props.students} corporations={props.corporations} />
          </div>
        )}

        {tab === "operations" && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-orange-400/40 bg-slate-900/80 p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-orange-300">21,000 행복 중앙 금고</p>
              <p className="mt-2 text-3xl font-extrabold text-orange-400 md:text-4xl">
                누적 발행: {formatCloverAmount(props.issuanceTotal, props.displayDp)} / 21,000 클로버 ({props.issuanceCount}회차)
              </p>
              <p className="mt-2 text-sm text-gray-400">
                중앙 금고 잔액 {formatCloverAmount(props.vaultBalance, props.displayDp)} 클로버
              </p>
              <p className="mt-3 rounded-lg border border-white/10 bg-slate-800/50 px-4 py-2 text-sm">
                <span className="text-gray-400">현재 유통중:</span>{" "}
                <span className="font-bold text-orange-400">
                  {formatCloverAmount(circulating, props.displayDp)} 클로버
                </span>
              </p>
              <VaultTransfer
                vaultBalance={props.vaultBalance}
                profiles={props.students}
                goals={props.goals.map((g) => ({ id: g.id, name: g.name, is_active: g.is_active }))}
                decimalPlaces={props.displayDp}
              />
            </section>

            <AdminSection
              goals={props.goals}
              contributions={props.contributions}
              burnedByGoal={props.burnedByGoal}
              fairMode={props.fairMode}
              transferHoursEnforced={props.transferHoursEnforced}
              decimalPlaces={props.displayDp}
            />
          </div>
        )}
      </section>
    </div>
  );
}
