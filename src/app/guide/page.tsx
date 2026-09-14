import Link from "next/link";
import { getVaultBranding } from "@/lib/vault-settings";
import { escapeHtml, renderGuideBodyHtml } from "@/lib/guide-content";

export const dynamic = "force-dynamic";

export default async function ClassCurrencyGuidePage() {
  const branding = await getVaultBranding();

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-12 md:px-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-[#d7efe2] pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#2fbf71]">행복 장터</p>
          <h1
            className="mt-2 text-2xl font-semibold text-[#1f3d32] md:text-3xl"
            style={{ fontFamily: "var(--font-fredoka), sans-serif" }}
          >
            학급화폐 가이드
          </h1>
          <p className="mt-2 text-sm text-[#5d7a6c]">우리 반 클로버 경제, 함께 읽는 안내</p>
        </div>
        <Link href="/" className="ui-btn-secondary shrink-0">
          ← 홈
        </Link>
      </header>

      <article className="guide-content ui-card space-y-0 p-6 md:p-8">
        {branding.guide.sections.map((section, index) => (
          <section key={index}>
            <h3 dangerouslySetInnerHTML={{ __html: escapeHtml(section.title) }} />
            <div dangerouslySetInnerHTML={{ __html: renderGuideBodyHtml(section.body) }} />
          </section>
        ))}
      </article>
    </main>
  );
}
