import { createCipheriv, createDecipheriv, randomBytes, createHash, timingSafeEqual } from "crypto";

// Criptografia simétrica para segredos guardados no banco (chaves de API dos
// agentes SDR). AES-256-GCM com chave derivada de SDR_SECRET_KEY via SHA-256.
// Formato do payload: "v1:<iv b64>:<authTag b64>:<ciphertext b64>".

function key(): Buffer {
  const raw = process.env.SDR_SECRET_KEY;
  if (!raw || raw.length < 16) {
    throw new Error("SDR_SECRET_KEY ausente ou curta demais (>= 16 chars)");
  }
  return createHash("sha256").update(raw, "utf8").digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Formato de segredo inválido");
  }
  const [, ivB, tagB, dataB] = parts;
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB, "base64"));
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB, "base64")), decipher.final()]).toString("utf8");
}

/** Dica não-sensível pra exibir na UI: 4 primeiros + 4 últimos caracteres. */
export function secretHint(plain: string): string {
  const s = plain.trim();
  if (s.length <= 10) return "••••••";
  return `${s.slice(0, 4)}••••${s.slice(-4)}`;
}

/** Comparação de segredos em tempo constante (evita timing attack). */
export function secretsEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
