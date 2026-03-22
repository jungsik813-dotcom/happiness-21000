"use client";

import { useCallback, useState } from "react";
import { useAdmin } from "./admin-provider";

type AdminGateProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

export default function AdminGate({ children, fallback }: AdminGateProps) {
  const { isUnlocked, unlock } = useAdmin();
  const [password, setPassword] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUnlock = useCallback(async () => {
    if (!password.trim()) {
      setError("비밀번호를 입력해주세요.");
      return;
    }
    setLoading(true);
    setError("");
    const result = await unlock(password);
    setLoading(false);
    if (result.ok) {
      setPassword("");
      setShowModal(false);
    } else {
      setError(result.message);
    }
  }, [password, unlock]);

  const openModal = useCallback(() => {
    setShowModal(true);
    setPassword("");
    setError("");
  }, []);

  if (isUnlocked) {
    return <>{children}</>;
  }

  if (fallback) {
    return (
      <>
        <div
          onClick={openModal}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && openModal()}
          className="cursor-pointer"
        >
          {fallback}
        </div>
        {showModal && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"
            onClick={(e) => e.target === e.currentTarget && (setShowModal(false), setError(""))}
            role="presentation"
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-orange-400/40 bg-slate-900 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-white">관리자 모드</h3>
              <p className="mt-1 text-sm text-gray-400">비밀번호를 입력하세요</p>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                placeholder="비밀번호"
                className="mt-4 w-full rounded-md border border-white/20 bg-slate-800 px-3 py-2 text-white outline-none focus:border-orange-400"
                autoFocus
              />
              {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setError(""); }}
                  className="flex-1 rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-gray-300"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleUnlock}
                  disabled={loading}
                  className="flex-1 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
                >
                  {loading ? "확인 중..." : "확인"}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
