import { createHash, timingSafeEqual } from "crypto";

function hashPin(pin: string): string {
  return createHash("sha256").update(pin, "utf8").digest("hex");
}

export function verifyStudentPassword(pin: string, storedHash: string | null): boolean {
  if (!storedHash || typeof storedHash !== "string") return false;
  const p = String(pin ?? "").trim();
  if (p.length !== 4) return false;
  const a = Buffer.from(hashPin(p), "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function hashStudentPassword(pin: string): string {
  return hashPin(String(pin).trim());
}
