"use client";

import { FormEvent, useState } from "react";
import { useAdmin } from "./admin-provider";

type AdminGateProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

export default function AdminGate({ children, fallback }: AdminGateProps) {
  const { isUnlocked, unlock } = useAdmin();
  const [showModal, setShowModal] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await unlock(password);
    setLoading(false);
    if (result.ok) {
      setShowModal(false);
      setPassword("");
    } else {
      setError(result.message || "비밀번호가 올바르지 않습니다.");
    }
  }

  if (isUnlocked) return <>{children}</>;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setShowModal(true)}
        onKeyDown={(e) => e.key === "Enter" && setShowModal(true)}
      >
        {fallback ?? (
          <section className="ui-card cursor-pointer p-4 text-center transition hover:border-[#2fbf71]">
            <p className="text-sm font-semibold text-[#1f3d32]">관리자 로그인이 필요합니다</p>
            <p className="mt-1 text-xs text-[#2fbf71]">클릭하여 비밀번호 입력</p>
          </section>
        )}
      </div>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1f3d32]/35 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-sm rounded-3xl border border-[#d7efe2] bg-white p-6 shadow-xl"
          >
            <h3 className="text-lg font-bold text-[#1f3d32]">관리자 모드</h3>
            <p className="mt-1 text-sm text-[#5d7a6c]">비밀번호를 입력하세요</p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="ui-input mt-4"
              autoFocus
            />
            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setPassword("");
                  setError("");
                }}
                className="ui-btn-secondary flex-1"
              >
                취소
              </button>
              <button type="submit" disabled={loading || !password} className="ui-btn-primary flex-1">
                {loading ? "확인 중..." : "입장"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
