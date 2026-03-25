import Link from "next/link";

/** 프로덕션에서도 매 요청 최신 소스 반영 (빌드 시점 고정 방지) */
export const dynamic = "force-dynamic";

export default function ClassCurrencyGuidePage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-12 md:px-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-orange-400">행복 장터</p>
          <h1 className="mt-2 text-2xl font-extrabold text-white md:text-3xl">학급화폐 가이드</h1>
          <p className="mt-2 text-sm text-gray-400">
            우리 반 클로버 경제, 함께 읽는 안내
          </p>
        </div>
        <Link
          href="/"
          className="shrink-0 rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-gray-300 transition hover:border-orange-400/50 hover:text-orange-300"
        >
          ← 홈
        </Link>
      </header>

      <article className="max-w-none rounded-2xl border border-orange-400/30 bg-slate-900/70 p-6 shadow-[0_0_32px_rgba(247,147,26,0.12)] md:p-8">
        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-orange-300">1. 클로버란?</h3>
          <p className="text-sm leading-relaxed text-gray-200">
            학급 내 학생들이 서로 칭찬과 함께 송금하고 학급 공동목표에 기여할 수 있는 학급화폐입니다.
          </p>
        </section>

        <section className="mt-8 space-y-4 border-t border-white/10 pt-6">
          <h3 className="text-lg font-semibold text-orange-300">2. 어떻게 모으나요?</h3>
          <p className="text-sm leading-relaxed text-gray-200">
            매주 월요일 모두에게 동일한 양을 나누어줍니다. 보상은 학급장터가 열릴 때마다 반으로 줄어듭니다.
            <br />
            <br />
            주차별로 한 사람당 받는 클로버 씨앗은 아래와 같습니다. (회차당 학급 전체 발행량 기준)
          </p>
          <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm leading-relaxed text-gray-200">
            <li>1~8회: 1,400</li>
            <li>9~16회: 700</li>
            <li>17~24회: 350</li>
            <li>25~33회: 134</li>
            <li>34회: 194</li>
          </ul>
          <p className="mt-3 text-sm leading-relaxed text-gray-200">
            34주간 운영되며 총 21,000개 발행 예정입니다.
            <br />
            추가적으로 얻고 싶으면, 다른 학생에게 도움을 주세요.
          </p>
        </section>

        <section className="mt-8 space-y-4 border-t border-white/10 pt-6">
          <h3 className="text-lg font-semibold text-orange-300">3. 송금·펀딩 때 지켜 줄 것</h3>
          <p className="text-sm leading-relaxed text-gray-200">
            메모에 고마운 점 10자 이상 적어주세요.
            <br />
            장터날을 제외하고 한 번에 자기가 가지고 있는 양의 10%만 송금할 수 있습니다.
          </p>
        </section>

        <section className="mt-8 space-y-4 border-t border-white/10 pt-6">
          <h3 className="text-lg font-semibold text-orange-300">4. 기타</h3>
          <p className="text-sm leading-relaxed text-gray-200">
            현실사회도 열심히 일을 하고, 남을 도와야 돈을 얻을 수 있습니다.
            <br />
            스스로를 이해하며 친구들에게 기여하고, 학급목표에 기여하는 기쁨을 누려보세요.
            <br />
            나 또는 남에게 신체적 정신적으로 피해를 주는 경우 예고없이 중단될 수 있습니다.
          </p>
        </section>
      </article>
    </main>
  );
}
