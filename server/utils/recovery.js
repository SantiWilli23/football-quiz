import crypto from "node:crypto";

// Código de recuperación de cuenta (no hay email de por medio): se muestra una vez al
// registrarse y se puede volver a ver en Yo › Ajustes. Se guarda cifrado con la clave
// del servidor (JWT_SECRET), nunca en claro.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I

export function newRecoveryCode() {
  const bytes = crypto.randomBytes(12);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return `FUT-${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}`;
}

const key = () => crypto.createHash("sha256").update(process.env.JWT_SECRET || "dev-secret").digest();

export function sealCode(code) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function openCode(sealed) {
  try {
    const [iv, tag, enc] = String(sealed).split(".").map((p) => Buffer.from(p, "base64"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export const normalizeCode = (code) => String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export function codesMatch(a, b) {
  const x = Buffer.from(normalizeCode(a));
  const y = Buffer.from(normalizeCode(b));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
}
