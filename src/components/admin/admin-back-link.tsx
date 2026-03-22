"use client";

import { useRouter } from "next/navigation";
import { useAdmin } from "./admin-provider";

export default function AdminBackLink() {
  const router = useRouter();
  const { logout } = useAdmin();

  function handleClick() {
    logout();
    router.push("/");
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="shrink-0 rounded-lg border border-orange-400/50 px-4 py-2 text-sm font-semibold text-orange-300 transition hover:bg-orange-500/10"
    >
      ← 학생 화면으로
    </button>
  );
}
