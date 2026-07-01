import type { SupabaseClient } from "@supabase/supabase-js";

const INSTANCE = "v3-sdr-whatsapp";

export async function sendWhatsApp(phone: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${process.env.EVOLUTION_API_URL}/message/sendText/${INSTANCE}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.EVOLUTION_API_KEY!,
        },
        body: JSON.stringify({ number: phone, text }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 11 && !digits.startsWith("55")) return `55${digits}`;
  return digits;
}

// Prioridade: cobranding_whatsapp → phone do perfil → telefone do cadastro original
export async function resolvePartnerPhone(db: SupabaseClient, partnerId: string): Promise<string | null> {
  const { data: profile } = await db
    .from("profiles")
    .select("phone, cobranding_whatsapp, email")
    .eq("id", partnerId)
    .single();

  const p = profile as { phone?: string | null; cobranding_whatsapp?: string | null; email?: string | null } | null;
  let phoneRaw = p?.cobranding_whatsapp ?? p?.phone ?? null;

  if (!phoneRaw && p?.email) {
    const { data: reg } = await db
      .from("partner_registrations")
      .select("telefone")
      .eq("email", p.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    phoneRaw = (reg as { telefone?: string | null } | null)?.telefone ?? null;
  }

  return phoneRaw ? formatPhone(phoneRaw) : null;
}

export function planoLabel(plano: string): string {
  return plano === "PARTNER_PRO" ? "Partner PRO"
    : plano === "STARTER" ? "Starter"
    : plano === "ENTERPRISE" ? "Enterprise"
    : "Partner";
}

type CobrancaParams = {
  nome: string;
  plano: string;
  dueDate: string;
  valorCents: number;
  pixEmv: string | null;
  boletoBarcode: string | null;
  boletoPdf?: string | null;
};

// D-5: cobrança inicial, com PIX/boleto completos
export function buildCobrancaMessage(params: CobrancaParams): string {
  const { nome, plano, dueDate, valorCents, pixEmv, boletoBarcode, boletoPdf } = params;
  const valor = (valorCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const dataVenc = new Date(dueDate + "T12:00:00").toLocaleDateString("pt-BR");
  const firstName = nome?.split(" ")[0] ?? "Partner";

  let msg = `Olá, *${firstName}*! 👋\n\n`;
  msg += `Sua assinatura *V3 Partners ${plano}* vence em *${dataVenc}*.\n\n`;
  msg += `Para manter seu acesso por mais *30 dias*, realize o pagamento de *${valor}*:\n\n`;

  if (pixEmv) {
    msg += `*🔵 PIX — copie o código abaixo:*\n${pixEmv}\n\n`;
  }
  if (boletoBarcode) {
    msg += `*📄 Boleto — código de barras:*\n${boletoBarcode}\n`;
    if (boletoPdf) msg += `📎 PDF: ${boletoPdf}\n`;
    msg += `\n`;
  }

  msg += `✅ Reconhecemos o pagamento automaticamente pelo extrato Cora e seu acesso é renovado na hora.\n\n`;
  msg += `Dúvidas? Fale com nossa equipe. 🤝\n`;
  msg += `_V3 Partners — Boutique institucional multiproduto_`;
  return msg;
}

// D-3: lembrete, caso ainda não tenha pago
export function buildLembreteMessage(params: CobrancaParams): string {
  const { nome, plano, dueDate, valorCents, pixEmv, boletoBarcode } = params;
  const valor = (valorCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const dataVenc = new Date(dueDate + "T12:00:00").toLocaleDateString("pt-BR");
  const firstName = nome?.split(" ")[0] ?? "Partner";

  let msg = `Oi, *${firstName}*! ⏰\n\n`;
  msg += `Lembrete: sua assinatura *V3 Partners ${plano}* vence em *${dataVenc}* (${valor}) e ainda não identificamos o pagamento.\n\n`;
  if (pixEmv) msg += `*🔵 PIX:*\n${pixEmv}\n\n`;
  if (boletoBarcode) msg += `*📄 Boleto:*\n${boletoBarcode}\n\n`;
  msg += `Assim que o pagamento cair, seu acesso é renovado automaticamente. Qualquer dúvida, é só chamar. 🤝\n`;
  msg += `_V3 Partners_`;
  return msg;
}

// D-1: aviso final — login será bloqueado
export function buildAvisoBloqueioMessage(params: CobrancaParams): string {
  const { nome, plano, dueDate, valorCents, pixEmv, boletoBarcode } = params;
  const valor = (valorCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const dataVenc = new Date(dueDate + "T12:00:00").toLocaleDateString("pt-BR");
  const firstName = nome?.split(" ")[0] ?? "Partner";

  let msg = `*${firstName}*, atenção! ⚠️\n\n`;
  msg += `Sua assinatura *V3 Partners ${plano}* vence *amanhã (${dataVenc})*. Sem o pagamento de *${valor}*, seu login será bloqueado e você deixará de ter acesso à plataforma — incluindo os leads em andamento.\n\n`;
  msg += `Conforme contrato, mantenha o acesso ativo para não perder as oportunidades em negociação.\n\n`;
  if (pixEmv) msg += `*🔵 PIX:*\n${pixEmv}\n\n`;
  if (boletoBarcode) msg += `*📄 Boleto:*\n${boletoBarcode}\n\n`;
  msg += `Qualquer dúvida, fale com nossa equipe agora. 🤝\n`;
  msg += `_V3 Partners_`;
  return msg;
}

// Renovação manual pelo admin (+30 dias)
export function buildRenovacaoManualMessage(params: { nome: string; plano: string; novaExpiracao: string }): string {
  const { nome, plano, novaExpiracao } = params;
  const dataExp = new Date(novaExpiracao).toLocaleDateString("pt-BR");
  const firstName = nome?.split(" ")[0] ?? "Partner";

  let msg = `Boa notícia, *${firstName}*! 🎉\n\n`;
  msg += `Seu plano *V3 Partners ${plano}* foi renovado por mais *30 dias* — acesso garantido até *${dataExp}*.\n\n`;
  msg += `Aproveite para usar a plataforma e gerar negócios! 💼\n\n`;
  msg += `_V3 Partners — Boutique institucional multiproduto_`;
  return msg;
}
