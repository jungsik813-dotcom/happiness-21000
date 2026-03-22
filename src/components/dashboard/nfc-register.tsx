"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { useAdmin } from "@/components/admin/admin-provider";
import AdminGate from "@/components/admin/admin-gate";

type Student = { id: string; name: string };

type NfcRegisterProps = {
  students: Student[];
};

declare global {
  interface NDEFReadingEvent extends Event {
    serialNumber: string;
  }

  interface NDEFReader {
    scan(options?: { signal?: AbortSignal }): Promise<void>;
    onreading: ((event: NDEFReadingEvent) => void) | null;
    onreadingerror: ((event: Event) => void) | null;
  }

  interface NDEFReaderConstructor {
    new (): NDEFReader;
  }

  interface Window {
    NDEFReader?: NDEFReaderConstructor;
  }
}

export default function NfcRegister({ students }: NfcRegisterProps) {
  const router = useRouter();
  const { token, logout } = useAdmin();
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState<"idle" | "scanning" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const supportsNfc = typeof window !== "undefined" && "NDEFReader" in window;
  const isSecure = typeof window !== "undefined" && window.isSecureContext;

  const stopScan = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    setStatus("idle");
  }, [abortController]);

  async function handleStartScan() {
    if (!selectedId) {
      setStatus("error");
      setMessage("등록할 학생을 선택해주세요.");
      return;
    }

    if (!supportsNfc || !isSecure) {
      setStatus("error");
      setMessage(
        "NFC는 Android Chrome(HTTPS)에서만 사용 가능합니다. PC나 iOS에서는 NFC 카드/폰을 Android 기기로 찍어주세요."
      );
      return;
    }

    const NDEFReader = window.NDEFReader;
    if (!NDEFReader) {
      setStatus("error");
      setMessage("이 브라우저는 NFC를 지원하지 않습니다.");
      return;
    }

    const controller = new AbortController();
    setAbortController(controller);
    setStatus("scanning");
    setMessage("NFC 태그를 기기에 갖다 대주세요...");

    try {
      const reader = new NDEFReader();
      reader.onreading = async (event: NDEFReadingEvent) => {
        const serialNumber = event.serialNumber ?? "";
        if (!serialNumber) {
          setStatus("error");
          setMessage("태그에서 시리얼 번호를 읽을 수 없습니다.");
          controller.abort();
          return;
        }

        try {
          const res = await fetch(`/api/profiles/${selectedId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              ...(token && { Authorization: `Bearer ${token}` })
            },
            body: JSON.stringify({ nfcTagId: serialNumber })
          });
          const data = (await res.json()) as { ok: boolean; message?: string };

          if (data.ok) {
            setStatus("success");
            setMessage(`${students.find((s) => s.id === selectedId)?.name ?? "학생"}에게 NFC가 등록되었습니다.`);
            controller.abort();
            logout();
            router.refresh();
          } else {
            setStatus("error");
            setMessage(data.message ?? "등록에 실패했습니다.");
          }
        } catch {
          setStatus("error");
          setMessage("등록 요청 중 오류가 발생했습니다.");
        }
      };

      reader.onreadingerror = () => {
        setStatus("error");
        setMessage("태그를 읽지 못했습니다. 다시 시도해주세요.");
      };

      await reader.scan({ signal: controller.signal });
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setStatus("error");
      setMessage(
        (err as Error)?.message?.includes("permission") || (err as Error)?.message?.includes("Permission")
          ? "NFC 권한이 필요합니다. 브라우저 설정에서 허용해주세요."
          : "NFC 스캔을 시작할 수 없습니다."
      );
      setAbortController(null);
    }
  }

  return (
    <section className="mb-6 rounded-xl border border-white/10 bg-slate-900/50 p-4">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-left text-sm font-semibold text-gray-300"
      >
        학생 NFC 등록
        <span className="text-gray-500">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <AdminGate
          fallback={
            <p className="mt-4 rounded-lg border border-orange-400/30 bg-orange-500/10 px-4 py-3 text-center text-sm text-orange-300">
              🔒 관리자 전용입니다. 클릭하여 비밀번호를 입력하세요.
            </p>
          }
        >
          <div className="mt-4 space-y-4">
            {!supportsNfc && (
              <p className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-2 text-xs text-amber-200">
                ⚠️ NFC는 Android Chrome(HTTPS)에서만 사용 가능합니다.
              </p>
            )}
            <div>
              <label className="mb-2 block text-xs text-gray-400">등록할 학생</label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                disabled={status === "scanning"}
                className="w-full rounded-md border border-white/20 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-orange-400 disabled:opacity-60"
              >
                <option value="">학생 선택</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            {(status === "success" || status === "error") && (
              <p
                className={`rounded-lg px-4 py-2 text-sm ${
                  status === "success"
                    ? "border border-green-500/40 bg-green-950/30 text-green-200"
                    : "border border-red-500/40 bg-red-950/30 text-red-200"
                }`}
              >
                {message}
              </p>
            )}
            {status === "scanning" && (
              <div className="flex items-center gap-3">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
                <span className="text-sm text-orange-300">{message}</span>
                <button
                  type="button"
                  onClick={stopScan}
                  className="text-xs text-gray-400 underline hover:text-white"
                >
                  취소
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleStartScan}
                disabled={status === "scanning" || !selectedId}
                className="rounded-md bg-orange-500/80 px-4 py-2 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === "scanning" ? "스캔 중..." : "NFC 스캔"}
              </button>
              {status !== "idle" && status !== "scanning" && (
                <button
                  type="button"
                  onClick={() => { setStatus("idle"); setMessage(""); }}
                  className="rounded-md border border-white/20 px-4 py-2 text-sm text-gray-300"
                >
                  초기화
                </button>
              )}
            </div>
          </div>
        </AdminGate>
      )}
    </section>
  );
}
