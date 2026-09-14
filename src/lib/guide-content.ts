export type GuideSection = {
  title: string;
  body: string;
};

export type GuideContent = {
  sections: GuideSection[];
};

export const GUIDE_SECTION_COUNT = 4;

export const DEFAULT_GUIDE_CONTENT: GuideContent = {
  sections: [
    {
      title: "1. 클로버란?",
      body: "학급 내 학생들이 서로 칭찬과 함께 송금하고 학급 공동목표에 기여할 수 있는 학급화폐입니다."
    },
    {
      title: "2. 어떻게 모으나요?",
      body: `매주 월요일 모두에게 동일한 양을 나누어줍니다. 보상은 학급장터가 열릴 때마다 반으로 줄어듭니다.

주차별로 한 사람당 받는 클로버 씨앗은 아래와 같습니다. (회차당 학급 전체 발행량 기준)
• 1~8회: 1,400
• 9~16회: 700
• 17~24회: 350
• 25~33회: 134
• 34회: 194

34주간 운영되며 총 21,000개 발행 예정입니다.
추가적으로 얻고 싶으면, 다른 학생에게 도움을 주세요.`
    },
    {
      title: "3. 송금·펀딩 때 지켜 줄 것",
      body: `친구에게 보낼 때는 칭찬 사유를 고르고, 짧은 한마디를 5자 이상 적어주세요.
펀딩·중앙 금고로 보낼 때는 사유를 10자 이상 적어주세요.
장터날을 제외하고 한 번에 자기가 가지고 있는 양의 10%만 송금할 수 있습니다.`
    },
    {
      title: "4. 기타",
      body: `현실사회도 열심히 일을 하고, 남을 도와야 돈을 얻을 수 있습니다.
스스로를 이해하며 친구들에게 기여하고, 학급목표에 기여하는 기쁨을 누려보세요.
나 또는 남에게 신체적 정신적으로 피해를 주는 경우 예고없이 중단될 수 있습니다.`
    }
  ]
};

function emptySections(): GuideSection[] {
  return Array.from({ length: GUIDE_SECTION_COUNT }, (_, i) => ({
    title: `${i + 1}. `,
    body: ""
  }));
}

function normalizeSections(raw: unknown): GuideSection[] {
  const base = emptySections();
  if (!Array.isArray(raw)) return base;
  for (let i = 0; i < GUIDE_SECTION_COUNT; i++) {
    const item = raw[i];
    if (!item || typeof item !== "object") continue;
    const title = typeof (item as GuideSection).title === "string" ? (item as GuideSection).title : base[i].title;
    const body = typeof (item as GuideSection).body === "string" ? (item as GuideSection).body : "";
    base[i] = { title, body };
  }
  return base;
}

/** DB(guide_html 컬럼)에 저장된 문자열 → 구조화 가이드 */
export function parseGuideContent(raw: string | null | undefined): GuideContent {
  if (!raw || !raw.trim()) return DEFAULT_GUIDE_CONTENT;
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed) as { sections?: unknown };
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.sections)) {
      return { sections: normalizeSections(parsed.sections) };
    }
  } catch {
    /* 예전 HTML 저장분이면 기본값으로 폴백 */
  }
  return DEFAULT_GUIDE_CONTENT;
}

export function serializeGuideContent(content: GuideContent): string {
  return JSON.stringify({
    sections: normalizeSections(content.sections)
  });
}

/** XSS 방지: 일반 텍스트를 안전하게 HTML로 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderGuideBodyHtml(body: string): string {
  const escaped = escapeHtml(body);
  return escaped
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}
