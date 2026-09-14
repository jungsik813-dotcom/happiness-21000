"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "@/components/admin/admin-provider";
import AdminGate from "@/components/admin/admin-gate";
import AdminCollapsible from "@/components/admin/admin-collapsible";
import type { DecimalPlaces } from "@/lib/money";
import { GUIDE_SECTION_COUNT, type GuideContent, type GuideSection } from "@/lib/guide-content";

type Props = {
  initialSiteTitle: string;
  initialSiteSubtitle: string;
  initialDecimalPlaces: DecimalPlaces;
  initialGuide: GuideContent;
};

export default function AdminSiteRoster({
  initialSiteTitle,
  initialSiteSubtitle,
  initialDecimalPlaces,
  initialGuide
}: Props) {
  const router = useRouter();
  const { token } = useAdmin();

  const [siteTitle, setSiteTitle] = useState(initialSiteTitle);
  const [siteSubtitle, setSiteSubtitle] = useState(initialSiteSubtitle);
  const [decimalPlaces, setDecimalPlaces] = useState<DecimalPlaces>(initialDecimalPlaces);
  const [sections, setSections] = useState<GuideSection[]>(() =>
    Array.from({ length: GUIDE_SECTION_COUNT }, (_, i) => ({
      title: initialGuide.sections[i]?.title ?? `${i + 1}. `,
      body: initialGuide.sections[i]?.body ?? ""
    }))
  );

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  function updateSection(index: number, patch: Partial<GuideSection>) {
    setSections((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
    );
  }

  async function save(payload: Record<string, unknown>) {
    if (!token) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      if (data.ok) {
        setMsg({ tone: "ok", text: data.message ?? "저장되었습니다." });
        router.refresh();
      } else {
        setMsg({ tone: "err", text: data.message ?? "저장 실패" });
      }
    } catch {
      setMsg({ tone: "err", text: "요청 중 오류가 발생했습니다." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminGate
      fallback={
        <section className="ui-card mb-6 p-4">
          <p className="text-sm text-[#5d7a6c]">🔒 사이트·가이드 설정 (관리자 전용)</p>
        </section>
      }
    >
      <div className="space-y-4">
        <AdminCollapsible
          title="사이트 제목·부제목"
          description="브라우저 탭 제목과 메인 화면 제목·부제목, 소수 표시를 바꿉니다."
          defaultOpen
          className="ui-card p-6"
        >
          <label className="block">
            <span className="ui-label">페이지 제목 (탭·메인 큰 글씨)</span>
            <input
              value={siteTitle}
              onChange={(e) => setSiteTitle(e.target.value)}
              className="ui-input"
            />
          </label>
          <label className="block">
            <span className="ui-label">부제목 (메인 회색 한 줄)</span>
            <input
              value={siteSubtitle}
              onChange={(e) => setSiteSubtitle(e.target.value)}
              className="ui-input"
            />
          </label>
          <div className="rounded-2xl border border-[#e8f4ee] bg-[#f7fcf9] p-4">
            <p className="text-sm font-semibold text-[#2fbf71]">클로버 소수 표시</p>
            <p className="mt-1 text-xs text-[#5d7a6c]">
              유통량이 줄었을 때 더 잘게 쓰려면 첫째·둘째 자리까지 허용할 수 있습니다.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {([0, 1, 2] as const).map((d) => (
                <label key={d} className="flex cursor-pointer items-center gap-2 text-sm text-[#1f3d32]">
                  <input
                    type="radio"
                    name="decimalPlaces"
                    checked={decimalPlaces === d}
                    onChange={() => setDecimalPlaces(d)}
                  />
                  {d === 0 ? "정수만" : d === 1 ? "소수 첫째까지" : "소수 둘째까지"}
                </label>
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void save({
                siteTitle,
                siteSubtitle,
                decimalPlaces
              })
            }
            className="ui-btn-primary"
          >
            설정 저장
          </button>
        </AdminCollapsible>

        <AdminCollapsible
          title="학급화폐 가이드"
          description="HTML 없이 제목과 내용만 적어 주세요. 필요할 때만 펼쳐 편집합니다."
          className="ui-card p-6"
        >
          {sections.map((section, index) => (
            <div
              key={index}
              className="space-y-3 rounded-2xl border border-[#e8f4ee] bg-[#f7fcf9] p-4"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-[#2fbf71]">
                섹션 {index + 1}
              </p>
              <label className="block">
                <span className="ui-label">섹션 제목</span>
                <input
                  value={section.title}
                  onChange={(e) => updateSection(index, { title: e.target.value })}
                  className="ui-input"
                  placeholder={`예: ${index + 1}. 클로버란?`}
                />
              </label>
              <label className="block">
                <span className="ui-label">섹션 내용</span>
                <textarea
                  value={section.body}
                  onChange={(e) => updateSection(index, { body: e.target.value })}
                  rows={6}
                  className="ui-input min-h-[120px] leading-relaxed"
                  placeholder="학생들이 읽을 내용을 적어 주세요."
                />
              </label>
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void save({ guideSections: sections })}
              className="ui-btn-primary"
            >
              가이드 저장
            </button>
            <a
              href="/guide"
              target="_blank"
              rel="noreferrer"
              className="ui-btn-secondary inline-flex items-center"
            >
              미리보기 열기
            </a>
          </div>
        </AdminCollapsible>

        {msg ? (
          <p className={msg.tone === "ok" ? "text-sm text-[#1f7a4a]" : "text-sm text-red-600"}>
            {msg.text}
          </p>
        ) : null}
      </div>
    </AdminGate>
  );
}
