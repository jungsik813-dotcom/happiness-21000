"use client";

import GoalManager from "./goal-manager";
import FundingSection from "./funding-section";
import StudentPasswordReset from "./student-password-reset";
import FairModeToggle from "./fair-mode-toggle";
import AdminGate from "@/components/admin/admin-gate";

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

type Student = { id: string; name: string };

type AdminSectionProps = {
  goals: Goal[];
  students?: Student[];
  contributions?: Record<string, GoalContributions>;
  burnedByGoal?: Record<string, number>;
  fairMode?: boolean;
};

export default function AdminSection({
  goals,
  students = [],
  contributions = {},
  burnedByGoal = {},
  fairMode = false
}: AdminSectionProps) {
  return (
    <>
      <AdminGate
        fallback={
          <section className="mb-6 rounded-xl border border-slate-600/50 bg-slate-900/50 p-4">
            <p className="text-sm text-gray-400">🔒 장터 모드 설정 (관리자 전용)</p>
          </section>
        }
      >
        <FairModeToggle fairMode={fairMode} />
      </AdminGate>
      <StudentPasswordReset students={students} />
      <GoalManager goals={goals} />
      <FundingSection
        goals={goals}
        contributions={contributions}
        burnedByGoal={burnedByGoal}
      />
    </>
  );
}
