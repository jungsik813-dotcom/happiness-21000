import { createHmac, createHash, timingSafeEqual } from "crypto";

const EXPIRY_SEC = 30 * 60; // 30분

function getSecret(): string {
  const raw = process.env.ADMIN_PASSWORD ?? "";
  const secret = raw.trim();
  if (!secret || secret.length < 4) {
    throw new Error("ADMIN_PASSWORD가 .env에 설정되지 않았거나 4자 이상이어야 합니다.");
  }
  return secret;
}

function hashInput(input: string): Buffer {
  return createHash("sha256").update(input, "utf8").digest();
}

export function verifyAdminPassword(password: string): boolean {
  try {
    const secret = getSecret();
    const pwd = String(password ?? "").trim();
    if (!pwd) return false;
    const a = hashInput(pwd);
    const b = hashInput(secret);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function createAdminToken(): string {
  const secret = getSecret();
  const exp = Math.floor(Date.now() / 1000) + EXPIRY_SEC;
  const payload = JSON.stringify({ admin: true, exp });
  const payloadB64 = Buffer.from(payload, "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(payloadB64).digest("base64url");
  return payloadB64 + "." + signature;
}

export function verifyAdminToken(token: string | null | undefined): boolean {
  if (!token || typeof token !== "string") return false;
  try {
    const secret = getSecret();
    const [payloadB64, signature] = token.split(".");
    if (!payloadB64 || !signature) return false;
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    if (!payload.admin || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return false;
    const expected = createHmac("sha256", secret).update(payloadB64).digest("base64url");
    return timingSafeEqual(Buffer.from(signature, "base64url"), Buffer.from(expected, "base64url"));
  } catch {
    return false;
  }
}

export function getAdminTokenFromRequest(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return request.headers.get("x-admin-token");
}
