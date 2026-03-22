import Link from "next/link";

export default function MainHeader() {
  return (
    <header className="mb-10 flex items-start justify-between gap-4 border-b border-white/10 pb-4">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-orange-400">
          행복 장터
        </p>
        <h1 className="mt-2 text-3xl font-extrabold text-white md:text-5xl">
          행복반 경제교육
        </h1>
        <p className="mt-3 text-sm text-gray-400 md:text-base">
          칭찬과 함께 나누는 우리 반 클로버
        </p>
      </div>
      <Link
        href="/admin"
        className="shrink-0 rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-gray-400 transition hover:border-orange-400/50 hover:text-orange-300"
      >
        관리자
      </Link>
    </header>
  );
}
