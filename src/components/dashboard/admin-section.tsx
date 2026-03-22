"use client";

import GoalManager from "./goal-manager";
import FundingSection from "./funding-section";
import NfcRegister from "./nfc-register";

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
};

export default function AdminSection({
  goals,
  students = [],
  contributions = {},
  burnedByGoal = {}
}: AdminSectionProps) {
  return (
    <>
      <NfcRegister students={students} />
      <GoalManager goals={goals} />
      <FundingSection
        goals={goals}
        contributions={contributions}
        burnedByGoal={burnedByGoal}
      />
    </>
  );
}
