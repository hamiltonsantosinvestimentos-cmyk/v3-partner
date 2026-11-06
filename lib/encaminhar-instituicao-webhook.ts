// Conferência da assinatura Svix do webhook do Resend (só servidor).
import { createHmac, timingSafeEqual } from "node:crypto";

// ── Webhook do Resend (assinatura Svix) ────────────────────────────────────────────────────
export function assinaturaSvixValida(o: { segredo: string; id: string | null; timestamp: string | null; assinatura: string | null; corpo: string; agora?: number }): boolean {
  const { segredo, id, timestamp, assinatura, corpo } = o;
  if (!segredo || !id || !timestamp || !assinatura) return false;
  const ts = Number(timestamp);
  const agora = Math.floor((o.agora ?? Date.now()) / 1000);
  if (!Number.isFinite(ts) || Math.abs(agora - ts) > 300) return false;
  const chave = Buffer.from(segredo.replace(/^whsec_/, ""), "base64");
  const esperado = createHmac("sha256", chave).update(`${id}.${timestamp}.${corpo}`).digest();
  for (const parte of assinatura.split(" ")) {
    const [versao, sig] = parte.split(",");
    if (versao !== "v1" || !sig) continue;
    const recebido = Buffer.from(sig, "base64");
    if (recebido.length === esperado.length && timingSafeEqual(recebido, esperado)) return true;
  }
  return false;
}
