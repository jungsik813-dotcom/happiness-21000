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
      className="shrink-0 rounded-full border border-[#d7efe2] bg-white px-4 py-2 text-sm font-bold text-[#2fbf71] transition hover:border-[#2fbf71]"
    >
      ← 학생 화면으로
    </button>
  );
}
