import Link from "next/link";

type MainHeaderProps = {
  title: string;
  subtitle: string;
};

export default function MainHeader({ title, subtitle }: MainHeaderProps) {
  return (
    <header className="mb-10 flex items-start justify-between gap-4 border-b border-[#d7efe2] pb-5">
      <div className="animate-pop-in">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#2fbf71]">
          행복 장터
        </p>
        <h1
          className="mt-2 text-4xl font-semibold tracking-tight text-[#1f3d32] md:text-5xl"
          style={{ fontFamily: "var(--font-fredoka), var(--font-nunito), sans-serif" }}
        >
          {title}
        </h1>
        <p className="mt-3 max-w-xl text-sm text-[#5d7a6c] md:text-base">{subtitle}</p>
      </div>
      <nav className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <Link
          href="/guide"
          className="rounded-full border border-[#b9ebcf] bg-white px-4 py-2 text-sm font-bold text-[#2fbf71] shadow-sm transition hover:-translate-y-0.5 hover:border-[#2fbf71] hover:shadow-md"
        >
          가이드
        </Link>
        <Link
          href="/admin"
          className="rounded-full border border-[#ffd2c4] bg-[#fff4f0] px-4 py-2 text-sm font-bold text-[#ff7a59] transition hover:-translate-y-0.5 hover:border-[#ff7a59]"
        >
          관리자
        </Link>
      </nav>
    </header>
  );
}
