import { NextResponse } from "next/server";

/** POST/PUT 본문 JSON 파싱 실패 시 400 */
export async function readJsonObject(
  request: Request
): Promise<{ ok: true; data: unknown } | { ok: false; response: NextResponse }> {
  try {
    const data = await request.json();
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, message: "요청 본문이 올바른 JSON이 아닙니다." },
        { status: 400 }
      )
    };
  }
}
