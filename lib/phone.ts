// Telefone internacional (26/09/2026, achado ao vivo com João: a contraparte
// Fernando está fora do Brasil e o operador não conseguia informar o código do
// país, o sistema assumia +55). Regra 1.4 do QA de governança: guarda em
// E.164 (+5521989937178), DDI explícito e selecionável, +55 é só o padrão.
//
// Fonte única. Antes disso a mesma heurística "10 ou 11 dígitos = Brasil,
// prefixa 55" vivia copiada em 2 telas, no cliente OpenWA e em
// subscription-messages: um +1 EUA de 11 dígitos virava DDD 15 de São Paulo,
// inclusive no lembrete automático enviado sem clique humano.

export interface PhoneResult {
  ok: boolean;
  /** "+5521989937178", ou null quando vazio/inválido. */
  e164: string | null;
  /** Dígitos do E.164, sem "+". Formato exigido por wa.me e OpenWA. */
  digits: string | null;
  isBrazil: boolean;
  empty: boolean;
  error?: string;
}

export const PHONE_ERROR_MSG =
  "Informe o telefone com DDI e DDD. Fora do Brasil, comece com + e o código do país (ex: +1 555 123 4567).";

const fail = (error: string): PhoneResult => ({ ok: false, e164: null, digits: null, isBrazil: false, empty: false, error });

export function normalizePhone(input: string | null | undefined): PhoneResult {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: true, e164: null, digits: null, isBrazil: false, empty: true };
  // "+" só é aceito na primeira posição.
  if (raw.lastIndexOf("+") > 0) return fail(PHONE_ERROR_MSG);

  let d = raw.replace(/\D/g, "");
  if (!d) return fail(PHONE_ERROR_MSG);

  let international = raw.startsWith("+");
  if (!international && d.startsWith("00")) {
    d = d.slice(2);
    international = true;
  }

  if (!international) {
    // Prefixo de tronco brasileiro: 021 98993-7178 (0 + DDD + número).
    if (d.startsWith("0") && (d.length === 11 || d.length === 12)) d = d.slice(1);
    if (d.length === 10 || d.length === 11) d = `55${d}`;
    else if (!((d.length === 12 || d.length === 13) && d.startsWith("55"))) return fail(PHONE_ERROR_MSG);
  }

  if (d.startsWith("55")) {
    const national = d.slice(2);
    if (national.length !== 10 && national.length !== 11) {
      return fail("Telefone do Brasil precisa de DDD e número (10 ou 11 dígitos depois do +55).");
    }
    if (!/^[1-9][1-9]/.test(national)) return fail("DDD inválido. Use um DDD brasileiro entre 11 e 99.");
    if (national.length === 11 && national[2] !== "9") return fail("Celular do Brasil com 11 dígitos começa com 9 depois do DDD.");
    return { ok: true, e164: `+${d}`, digits: d, isBrazil: true, empty: false };
  }

  if (d.length < 8 || d.length > 15 || d.startsWith("0")) {
    return fail("Número internacional inválido: use de 8 a 15 dígitos, incluindo o código do país.");
  }
  return { ok: true, e164: `+${d}`, digits: d, isBrazil: false, empty: false };
}

/** Dígitos para wa.me/OpenWA, ou "" quando o número não normaliza (nunca chuta Brasil). */
export function whatsappDigits(phone: string | null | undefined): string {
  return normalizePhone(phone).digits ?? "";
}

/** Exibição legível. Número que não normaliza (legado) volta como foi gravado. */
export function formatPhoneIntl(phone: string | null | undefined): string {
  const raw = (phone ?? "").trim();
  const r = normalizePhone(raw);
  if (!r.ok || !r.digits) return raw;
  const d = r.digits;
  if (r.isBrazil) {
    const n = d.slice(2);
    return n.length === 11
      ? `+55 (${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`
      : `+55 (${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  }
  if (d.startsWith("1") && d.length === 11) return `+1 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  if (d.startsWith("351") && d.length === 12) return `+351 ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}`;
  return `+${d}`;
}

/**
 * Máscara progressiva do campo. Com DDI 55 aplica +55 (XX) XXXXX-XXXX; com
 * outro DDI aceita dígitos livres (até 15). Sem "+" digitado, o número é lido
 * como brasileiro (compatível com quem cola só DDD + número).
 */
export function maskPhoneIntlInput(value: string): string {
  const raw = value.trim();
  let d = raw.replace(/\D/g, "");
  if (!d) return raw.startsWith("+") ? "+" : "";
  if (!raw.startsWith("+")) {
    if (d.startsWith("00")) d = d.slice(2);
    else if (!(d.startsWith("55") && d.length >= 12)) d = `55${d.replace(/^0/, "")}`;
  }
  if (!d.startsWith("55")) return `+${d.slice(0, 15)}`;
  if (d === "5" || d === "55") return `+${d}`;
  const rest = d.slice(2, 13);
  const ddd = rest.slice(0, 2);
  const num = rest.slice(2);
  let out = `+55 (${ddd}`;
  if (ddd.length === 2) out += ")";
  if (num) {
    const split = num[0] === "9" ? 5 : 4;
    out += " " + (num.length <= split ? num : `${num.slice(0, split)}-${num.slice(split)}`);
  }
  return out;
}
