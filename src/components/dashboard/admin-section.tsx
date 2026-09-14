"use client";

import GoalManager from "./goal-manager";
import FundingSection from "./funding-section";
import FairModeToggle from "./fair-mode-toggle";
import BusinessHoursToggle from "./business-hours-toggle";
import AdminGate from "@/components/admin/admin-gate";
import AdminCollapsible from "@/components/admin/admin-collapsible";
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
  issuanceTotal?: number;
  issuanceCount?: number;
  studentCount?: number;
};

export default function AdminSection({
  goals,
  contributions = {},
  burnedByGoal = {},
  fairMode = false,
  transferHoursEnforced = true,
  decimalPlaces = 0,
  issuanceTotal = 0,
  issuanceCount = 0,
  studentCount = 0
}: AdminSectionProps) {
  return (
    <>
      <AdminGate
        fallback={
          <section className="ui-card mb-6 p-4">
            <p className="text-sm text-[#5d7a6c]">🔒 장터·영업시간 설정 (관리자 전용)</p>
          </section>
        }
      >
        <AdminCollapsible
          title="장터·영업시간 설정"
          description="공정 장터 모드와 송금 가능 시간을 켭니다."
          className="ui-card mb-6 p-5"
        >
          <FairModeToggle fairMode={fairMode} />
          <BusinessHoursToggle transferHoursEnforced={transferHoursEnforced} />
        </AdminCollapsible>
      </AdminGate>
      <GoalManager goals={goals} />
      <FundingSection
        goals={goals}
        contributions={contributions}
        burnedByGoal={burnedByGoal}
        decimalPlaces={decimalPlaces}
        issuanceTotal={issuanceTotal}
        issuanceCount={issuanceCount}
        studentCount={studentCount}
      />
    </>
  );
}
