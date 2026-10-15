import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { coraFetch } from "@/lib/cora";
import { sendText } from "@/lib/whatsapp/openwa-client";
import { numerosAlertaQuiz, telefoneChave } from "@/lib/quiz-lead-unico";

// Webinar "Crédito Estruturado com Garantia" (15/10/2026, pedido do Hamilton, a partir do post
// do Instagram DehwC5GlrvN): LP /webinar → checkout /webinar/checkout com Pix ou boleto da Cora.
// A inscrição é um lead em prospeccao_leads (origem "webinar") com tudo do ingresso em
// metadata.webinar. Quem deixou nome + WhatsApp e não pagou recebe UMA mensagem no WhatsApp com
// o link do checkout (recuperarCheckoutsWebinar, chamada a cada minuto pelo pg_cron via
// /api/cron/lembrete-agenda-prospeccao). Pagamento confirmado pelo webhook da Cora ou consultando
// a fatura (status da página de checkout e o próprio cron).

export const WEBINAR = {
  titulo: "Crédito Estruturado com Garantia",
  dataLabel: "06/11 · 20h",
  dataLonga: "6 de novembro, quinta-feira, às 20h",
  inicioISO: "2026-11-06T20:00:00-03:00",
  precoCents: 2700,
  apresentadores: "Hamilton Santos e Robson Lino",
  /** Grupo do WhatsApp onde sai o link da sala. Só é mostrado/enviado depois do pagamento confirmado. */
  grupoUrl: "https://chat.whatsapp.com/BljzUDOR86Q0dvKmSKhMmT",
};

export const APP_URL = "https://app.v3partners.com.br";
/** Minutos depois do cadastro sem pagamento identificado até a mensagem de recuperação. */
export const RECUPERACAO_MIN = 20;

export type WebinarStatus = "aguardando" | "pago";

export type WebinarMeta = {
  token: string;
  status: WebinarStatus;
  /** Nome digitado na inscrição (o lead pode ser de outra origem, com outro nome gravado). */
  nome?: string;
  criado_em: string;
  cpf?: string;
  forma?: "pix" | "boleto";
  cora_invoice_id?: string;
  cobranca_gerada_em?: string;
  vencimento?: string;
  pix_emv?: string | null;
  pix_qr_code?: string | null;
  boleto_barcode?: string | null;
  boleto_pdf?: string | null;
  consultado_cora_em?: string;
  recuperacao_enviada_em?: string;
  pago_em?: string;
  tracking?: Record<string, string> | null;
};

export type LeadWebinar = { id: string; nome: string; telefone: string | null; etapa: string; metadata: Record<string, unknown> | null };

export function inscricoesAbertas(agora = Date.now()): boolean {
  // Aceita inscrição até meia hora depois do início (quem chega atrasado ainda entra).
  return agora < new Date(WEBINAR.inicioISO).getTime() + 30 * 60_000;
}

export function novoToken(): string {
  return randomBytes(16).toString("hex");
}

export function linkCheckout(token: string): string {
  return `${APP_URL}/webinar/checkout?t=${token}`;
}

export function webinarDe(lead: { metadata: Record<string, unknown> | null }): WebinarMeta | null {
  const w = lead.metadata?.webinar;
  return w && typeof w === "object" ? (w as WebinarMeta) : null;
}

export async function leadPorToken(db: SupabaseClient, token: string): Promise<LeadWebinar | null> {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const { data } = await db.from("prospeccao_leads")
    .select("id, nome, telefone, etapa, metadata")
    .eq("metadata->webinar->>token", token)
    .limit(1)
    .maybeSingle();
  return (data as LeadWebinar | null) ?? null;
}

/** Lead da Prospecção com o mesmo WhatsApp (qualquer origem), o mais recente. */
export async function leadPorTelefone(db: SupabaseClient, telefone: string): Promise<LeadWebinar | null> {
  const tel = telefoneChave(telefone);
  if (tel.length < 10) return null;
  const { data } = await db.from("prospeccao_leads")
    .select("id, nome, telefone, etapa, metadata")
    .ilike("telefone", `%${tel.slice(-8)}%`)
    .order("created_at", { ascending: false })
    .limit(10);
  return ((data ?? []) as LeadWebinar[]).find((l) => telefoneChave(l.telefone) === tel) ?? null;
}

/** Grava metadata.webinar relendo o metadata do banco (não apaga o que mudou no meio). */
export async function salvarWebinar(db: SupabaseClient, leadId: string, alterar: (w: WebinarMeta) => WebinarMeta, extra: Record<string, unknown> = {}) {
  const { data } = await db.from("prospeccao_leads").select("metadata").eq("id", leadId).single();
  const meta = ((data?.metadata as Record<string, unknown> | null) ?? {});
  const webinar = alterar(meta.webinar as WebinarMeta);
  await db.from("prospeccao_leads")
    .update({ metadata: { ...meta, webinar }, updated_at: new Date().toISOString(), ...extra })
    .eq("id", leadId);
  return webinar;
}

export function primeiroNome(nome: string): string {
  const p = nome.trim().split(/\s+/)[0] ?? "";
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}

/** Consulta a fatura na Cora: true se já está PAID. */
export async function faturaPaga(invoiceId: string): Promise<boolean> {
  try {
    const res = await coraFetch(`/v2/invoices/${invoiceId}`, { method: "GET" });
    if (!res.ok) return false;
    const j = (await res.json()) as { status?: string };
    return j.status === "PAID";
  } catch {
    return false;
  }
}

/**
 * Marca a inscrição como paga (uma vez só) e avisa no WhatsApp: o inscrito (confirmação) e o
 * time (números dos alertas de lead). Devolve false se já estava paga.
 */
export async function confirmarPagamentoWebinar(db: SupabaseClient, leadId: string, pagoEm?: string): Promise<boolean> {
  const { data } = await db.from("prospeccao_leads").select("nome, telefone, metadata").eq("id", leadId).single();
  if (!data) return false;
  const meta = ((data.metadata as Record<string, unknown> | null) ?? {});
  const w = meta.webinar as WebinarMeta | undefined;
  if (!w || w.status === "pago") return false;

  const quando = pagoEm ?? new Date().toISOString();
  const { data: alterado } = await db.from("prospeccao_leads")
    .update({ metadata: { ...meta, webinar: { ...w, status: "pago", pago_em: quando } }, updated_at: new Date().toISOString() })
    .eq("id", leadId)
    .neq("metadata->webinar->>status", "pago")
    .select("id");
  if (!alterado?.length) return false;

  await db.from("prospeccao_historico").insert({
    lead_id: leadId,
    etapa_anterior: null,
    etapa_nova: null,
    nota: `Webinar ${WEBINAR.dataLabel}: ingresso pago (${w.forma === "boleto" ? "boleto" : "Pix"}).`,
  }).then(null, () => {});

  const nome = w.nome ?? String(data.nome ?? "");
  if (data.telefone) {
    await sendText(String(data.telefone),
      `✅ Inscrição confirmada, ${primeiroNome(nome)}!\n\n` +
      `Webinar *${WEBINAR.titulo}*\n📅 ${WEBINAR.dataLonga}\n🎙 Com ${WEBINAR.apresentadores}\n\n` +
      `👉 Entre agora no grupo exclusivo dos inscritos. É por lá que enviamos o link da sala ao vivo:\n${WEBINAR.grupoUrl}\n\nAté lá!\nV3 Partners`,
    ).catch(() => false);
  }
  await Promise.allSettled(numerosAlertaQuiz().map((n) => sendText(n,
    `🎟 Ingresso pago no webinar ${WEBINAR.dataLabel}\n\n${nome}` +
    (data.telefone ? `\n📱 ${data.telefone}` : "") +
    `\n💳 ${w.forma === "boleto" ? "Boleto" : "Pix"}\n\nVer: ${APP_URL}/prospeccao`,
  ).catch(() => false)));
  return true;
}

/**
 * Recuperação de checkout: inscrito que deixou nome + WhatsApp há mais de RECUPERACAO_MIN minutos
 * e cujo pagamento não foi identificado recebe UMA mensagem com o link do checkout.
 * Antes de mandar, consulta a fatura na Cora (pode ter sido paga e o webhook não ter chegado).
 */
export async function recuperarCheckoutsWebinar(db: SupabaseClient): Promise<number> {
  if (!inscricoesAbertas()) return 0;
  const limite = new Date(Date.now() - RECUPERACAO_MIN * 60_000).toISOString();
  const { data } = await db.from("prospeccao_leads")
    .select("id, nome, telefone, etapa, metadata")
    .eq("metadata->webinar->>status", "aguardando")
    .is("metadata->webinar->>recuperacao_enviada_em", null)
    .lt("metadata->webinar->>criado_em", limite)
    .limit(30);

  let enviados = 0;
  for (const lead of (data ?? []) as LeadWebinar[]) {
    const w = webinarDe(lead);
    if (!w || !lead.telefone) continue;
    if (w.cora_invoice_id && (await faturaPaga(w.cora_invoice_id))) {
      await confirmarPagamentoWebinar(db, lead.id);
      continue;
    }
    // Marca antes de enviar: duas execuções sobrepostas não mandam em dobro.
    await salvarWebinar(db, lead.id, (atual) => ({ ...atual, recuperacao_enviada_em: new Date().toISOString() }));
    const boleto = w.forma === "boleto";
    await sendText(lead.telefone,
      `Oi, ${primeiroNome(w.nome ?? lead.nome)}! Aqui é da V3 Partners. 👋\n\n` +
      `Você começou sua inscrição no webinar *${WEBINAR.titulo}* (${WEBINAR.dataLabel}, ao vivo), mas ainda não identificamos o pagamento.\n\n` +
      `Para garantir sua vaga, é só concluir por aqui (Pix ou boleto, R$ 27):\n${linkCheckout(w.token)}` +
      (boleto ? `\n\nSe você já pagou o boleto, pode desconsiderar: a compensação leva até 2 dias úteis.` : ""),
    ).catch(() => false);
    enviados++;
  }
  return enviados;
}
