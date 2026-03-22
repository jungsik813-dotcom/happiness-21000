import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "2100 행복 시스템",
  description: "Next.js + Tailwind + Supabase 기반 학급 경제 앱"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
