import type { Metadata } from "next";
import "./globals.css";
import { getVaultBranding } from "@/lib/vault-settings";

export async function generateMetadata(): Promise<Metadata> {
  const b = await getVaultBranding();
  return {
    title: b.site_title,
    description: b.site_meta_description
  };
}

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
