import { createClient as sc } from "@supabase/supabase-js";
import { ASSET_DECLINE_REASONS } from "@/lib/cm-decline-reasons";

// E-mail de movimentação do ativo da Bolsa de Ativos (30/09/2026, Entrega 2 do BRIEF
// "Cauda Athaydes e e-mail de movimentação do ativo").
//
// Fluxo: cada linha nova de cm_status_transitions enfileira, por gatilho no banco
// (cm_enqueue_movement_emails), um e-mail por destinatário em cm_movement_email_outbox. Aqui a
// fila é reservada (claim_cm_movement_emails), cada linha vira o payload do webhook do n8n
// (montagem do e-mail, Brand Gate e Resend) e o resultado volta ao banco
// (finish_cm_movement_email). O e-mail NUNCA sai direto desta API: regra permanente V3.
//
// Chave de desligamento: cm_feature_flags.movement_emails (nasce desligada). Com ela
// desligada o gatilho não enfileira e o claim não devolve nada.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const N8N_WEBHOOK_PATH = "/webhook/v3-movimentacao-ativo-email";
const SEND_TIMEOUT_MS = 40_000; // n8n no Render pode levar até ~30 s no cold start
const PORTAL = "https://app.v3partners.com.br";

export type MovementRole = "partner" | "mesa" | "cedente";

// Etapas cobertas, da entrada até a decisão. Rótulos em português legível (mesmos de
// STATUS_LABELS em listings/[id]/status/route.ts), nunca o valor técnico.
export const MOVEMENT_STAGES: Record<string, { label: string; next: string }> = {
  reuniao_validada: { label: "Reunião Validada", next: "A equipe V3 Partners vai enviar o formulário do ativo." },
  formulario_preenchido: { label: "Formulário Preenchido", next: "A Mesa vai agendar a reunião de qualificação." },
  reuniao_agendada: { label: "Reunião Agendada", next: "Reunião de qualificação marcada. Compareça no horário combinado." },
  em_qualificacao: { label: "Em Qualificação", next: "A Mesa está reunindo e conferindo a documentação do ativo." },
  nda_assinado: { label: "NDA Assinado", next: "O ativo segue para a análise da Mesa." },
  em_analise: { label: "Em Análise", next: "O ativo está em análise pela Mesa e pela Diretoria." },
  aprovado_head: { label: "Aprovado pela Diretoria", next: "Decisão final positiva. O próximo passo é a publicação do ativo." },
  aprovado_com_restricoes: { label: "Aprovado com Restrições", next: "Decisão final positiva, sujeita às restrições abaixo." },
  reprovado: { label: "Reprovado", next: "Decisão final: o ativo não foi aprovado." },
};

export function isMovementStage(status: string): boolean {
  return Object.prototype.hasOwnProperty.call(MOVEMENT_STAGES, status);
}

// DD/MM/AAAA HH:mm em America/Sao_Paulo, sem deslocamento de fuso ao converter timestamptz.
export function formatSaoPaulo(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}

interface ClaimedRow {
  id: string;
  attempts: number;
  recipient_email: string;
  recipient_name: string | null;
  recipient_role: MovementRole;
  listing_id: string;
  anonymous_id: string | null;
  to_status: string;
  reason: string | null;
  reason_category: string | null;
  occurred_at: string;
}

export interface MovementEmailPayload {
  to: string;
  recipientName: string;
  recipientRole: MovementRole;
  assetLabel: string;
  stageKey: string;
  stageLabel: string;
  occurredAtText: string;
  nextStep: string;
  detailLabel: string | null; // "Restrições" ou "Motivo"
  detailText: string | null;
  portalUrl: string | null;
}

// Monta o payload por papel. Regras de conteúdo (decisão de João, 30/09/2026):
//  - cedente: etapa, data e próximo passo. Nunca restrições nem motivo de reprovação.
//  - partner e Mesa: também o texto das restrições e a categoria do motivo de reprovação.
//  - nunca CPF, CNPJ, valores nem nome do cedente: o ativo é identificado pelo ID anônimo.
//  - campo vazio vira [ INFORMAÇÃO PENDENTE ], nunca null.
export function buildMovementPayload(row: ClaimedRow): MovementEmailPayload | null {
  const stage = MOVEMENT_STAGES[row.to_status];
  if (!stage) return null;

  const internal = row.recipient_role !== "cedente";
  let detailLabel: string | null = null;
  let detailText: string | null = null;

  if (internal && row.to_status === "aprovado_com_restricoes") {
    detailLabel = "Restrições";
    detailText = row.reason?.trim() ? row.reason.trim() : "[ INFORMAÇÃO PENDENTE ]";
  }
  if (internal && row.to_status === "reprovado") {
    detailLabel = "Motivo";
    const cat = ASSET_DECLINE_REASONS.find((r) => r.value === row.reason_category);
    detailText = cat ? cat.label : "[ INFORMAÇÃO PENDENTE ]";
  }

  const portalUrl = row.recipient_role === "partner" ? `${PORTAL}/meus-ativos` : row.recipient_role === "mesa" ? `${PORTAL}/bolsa/mesa` : null;

  return {
    to: row.recipient_email,
    recipientName: row.recipient_name?.trim() || "Prezado(a)",
    recipientRole: row.recipient_role,
    assetLabel: `Ativo ${row.anonymous_id?.trim() || "[ INFORMAÇÃO PENDENTE ]"}`,
    stageKey: row.to_status,
    stageLabel: stage.label,
    occurredAtText: formatSaoPaulo(row.occurred_at),
    nextStep: stage.next,
    detailLabel,
    detailText,
    portalUrl,
  };
}

async function sendOne(row: ClaimedRow): Promise<{ ok: boolean; providerId?: string; error?: string }> {
  const payload = buildMovementPayload(row);
  if (!payload) return { ok: false, error: `etapa fora do escopo: ${row.to_status}` };

  const base = (process.env.N8N_BASE_URL || "https://n8n-514n.onrender.com").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}${N8N_WEBHOOK_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    const text = await res.text();
    let json: { ok?: boolean; email_sent?: boolean; resend_id?: string } = {};
    try { json = JSON.parse(text); } catch { /* resposta não-JSON */ }
    if (!res.ok || !(json.ok || json.email_sent)) {
      // O n8n responde 200 com corpo vazio quando a validação ou o Brand Gate bloqueiam o envio.
      const detalhe = text.trim() ? text.slice(0, 200) : "envio bloqueado pelo n8n (validação ou Brand Gate do e-mail)";
      return { ok: false, error: `n8n ${res.status}: ${detalhe}` };
    }
    return { ok: true, providerId: json.resend_id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "falha ao acionar o n8n" };
  }
}

// Reserva e envia os e-mails pendentes (de um ativo, ou de toda a fila). Nunca lança: o
// chamador já concluiu a transição de etapa e um erro de envio não pode derrubá-la. Toda
// gravação de resultado usa await (um insert sem await nunca chega ao banco).
export async function dispatchMovementEmails(opts: { listingId?: string; limit?: number } = {}): Promise<{ claimed: number; sent: number; failed: number }> {
  const out = { claimed: 0, sent: 0, failed: 0 };
  try {
    const db = svc();
    const { data, error } = await db.rpc("claim_cm_movement_emails", {
      p_limit: opts.limit ?? 30,
      p_listing: opts.listingId ?? null,
    });
    if (error) {
      console.error("[movement-email] falha ao reservar a fila:", error.message);
      return out;
    }
    const rows = (Array.isArray(data) ? data : []) as ClaimedRow[];
    out.claimed = rows.length;

    // Até 3 envios em paralelo, para não estourar o tempo da função em cold start do n8n.
    for (let i = 0; i < rows.length; i += 3) {
      const chunk = rows.slice(i, i + 3);
      const results = await Promise.all(chunk.map((r) => sendOne(r)));
      for (let j = 0; j < chunk.length; j++) {
        const r = results[j];
        const { error: finishError } = await db.rpc("finish_cm_movement_email", {
          p_id: chunk[j].id,
          p_ok: r.ok,
          p_provider: r.providerId ?? null,
          p_error: r.error ?? null,
        });
        if (finishError) console.error("[movement-email] falha ao gravar o resultado:", finishError.message);
        if (r.ok) out.sent++; else out.failed++;
      }
    }
  } catch (e) {
    console.error("[movement-email] erro inesperado:", e);
  }
  return out;
}
