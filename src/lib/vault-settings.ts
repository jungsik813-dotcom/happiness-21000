import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DecimalPlaces } from "@/lib/money";
import {
  DEFAULT_GUIDE_CONTENT,
  parseGuideContent,
  type GuideContent
} from "@/lib/guide-content";

export type VaultBranding = {
  site_title: string;
  site_subtitle: string;
  site_meta_description: string;
  decimal_places: DecimalPlaces;
  guide: GuideContent;
};

const DEFAULTS: VaultBranding = {
  site_title: "2100 행복 시스템",
  site_subtitle: "칭찬과 함께 나누는 우리 반 클로버",
  site_meta_description: "Next.js + Tailwind + Supabase 기반 학급 경제 앱",
  decimal_places: 0,
  guide: DEFAULT_GUIDE_CONTENT
};

export function normalizeDecimalPlaces(raw: unknown): DecimalPlaces {
  const n = Number(raw);
  if (n === 1) return 1;
  if (n === 2) return 2;
  return 0;
}

export async function getVaultBranding(): Promise<VaultBranding> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("vault")
      .select("site_title, site_subtitle, site_meta_description, decimal_places, guide_html")
      .limit(1)
      .maybeSingle();
    if (error || !data) return DEFAULTS;
    return {
      site_title:
        typeof data.site_title === "string" && data.site_title.trim()
          ? data.site_title.trim()
          : DEFAULTS.site_title,
      site_subtitle:
        typeof data.site_subtitle === "string" && data.site_subtitle.trim()
          ? data.site_subtitle.trim()
          : DEFAULTS.site_subtitle,
      site_meta_description:
        typeof data.site_meta_description === "string" && data.site_meta_description.trim()
          ? data.site_meta_description.trim()
          : DEFAULTS.site_meta_description,
      decimal_places: normalizeDecimalPlaces(data.decimal_places),
      guide: parseGuideContent(
        typeof data.guide_html === "string" ? data.guide_html : null
      )
    };
  } catch {
    return DEFAULTS;
  }
}
