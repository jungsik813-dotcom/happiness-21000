"use client";

import GoalManager from "./goal-manager";
import FundingSection from "./funding-section";
import FairModeToggle from "./fair-mode-toggle";
import BusinessHoursToggle from "./business-hours-toggle";
import AdminGate from "@/components/admin/admin-gate";
import type { DecimalPlaces } from "@/lib/money";

export type Goal = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  is_active: boolean;
};

export type ContributionEntry = {
  id: string;
  name: string;
  amount: number;
  percent: number;
};

export type GoalContributions = {
  total: number;
  byPerson: ContributionEntry[];
};

type AdminSectionProps = {
  goals: Goal[];
  contributions?: Record<string, GoalContributions>;
  burnedByGoal?: Record<string, number>;
  fairMode?: boolean;
  transferHoursEnforced?: boolean;
  decimalPlaces?: DecimalPlaces;
};

export default function AdminSection({
  goals,
  contributions = {},
  burnedByGoal = {},
  fairMode = false,
  transferHoursEnforced = true,
  decimalPlaces = 0
}: AdminSectionProps) {
  return (
    <>
      <AdminGate
        fallback={
          <section className="mb-6 rounded-xl border border-slate-600/50 bg-slate-900/50 p-4">
            <p className="text-sm text-gray-400">🔒 장터·영업시간 설정 (관리자 전용)</p>
          </section>
        }
      >
        <FairModeToggle fairMode={fairMode} />
        <BusinessHoursToggle transferHoursEnforced={transferHoursEnforced} />
      </AdminGate>
      <GoalManager goals={goals} />
      <FundingSection
        goals={goals}
        contributions={contributions}
        burnedByGoal={burnedByGoal}
        decimalPlaces={decimalPlaces}
      />
    </>
  );
}
