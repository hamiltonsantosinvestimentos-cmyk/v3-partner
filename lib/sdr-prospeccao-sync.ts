import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** Normaliza telefone pros últimos 11 dígitos (DDD + número), ignorando código do país e formatação. */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-11);
}

// Mapeia o status do CRM do WhatsApp (SDR) pra etapa do Kanban de Prospecção de Partners
const STATUS_TO_ETAPA: Record<string, string> = {
  ativo: "contatado",
  qualificado: "interessado",
  agendado: "interessado",
  convertido: "convertido",
  sem_interesse: "perdido",
  arquivado: "perdido",
};

const ETAPA_RANK: Record<string, number> = {
  prospect: 0, contatado: 1, interessado: 2, trial: 3, convertido: 4,
};

export const ETAPA_LABELS: Record<string, { label: string; color: string }> = {
  prospect:    { label: "Prospect",    color: "#7A8FA8" },
  contatado:   { label: "Contatado",   color: "#60A5FA" },
  interessado: { label: "Interessado", color: "#F59E0B" },
  trial:       { label: "Em Trial",    color: "#A78BFA" },
  convertido:  { label: "Convertido",  color: "#34D399" },
  perdido:     { label: "Perdido",     color: "#EF4444" },
};

/**
 * Sincroniza um lead do CRM do WhatsApp (sdr_leads) com o Kanban de Prospecção de Partners
 * (prospeccao_leads), casando por telefone normalizado. Só avança etapa, nunca regride —
 * as duas telas alimentam o mesmo funil, então uma não pode "desfazer" progresso feito na outra.
 */
export async function syncSdrLeadToProspeccao(opts: {
  phone: string;
  status: string;
  nome?: string | null;
  responsavel_id?: string | null;
  responsavel_nome?: string | null;
  nota?: string;
}): Promise<void> {
  const etapaAlvo = STATUS_TO_ETAPA[opts.status];
  if (!etapaAlvo) return;

  const normalized = normalizePhone(opts.phone);
  if (!normalized) return;

  const db = svc();

  // Filtra candidatos pelos últimos 8 dígitos (evita puxar a tabela inteira) e casa exato depois
  const sufixo = normalized.slice(-8);
  const { data: candidatos } = await db
    .from("prospeccao_leads")
    .select("id, etapa, telefone, responsavel_id")
    .ilike("telefone", `%${sufixo}`);

  const match = (candidatos ?? []).find(c => c.telefone && normalizePhone(c.telefone) === normalized);

  if (!match) {
    // Não cria prospect a partir de um "ativo" (conversa recém-iniciada, sem sinal real ainda)
    if (opts.status === "ativo") return;

    const { data: created } = await db.from("prospeccao_leads").insert({
      nome: opts.nome ?? "Lead WhatsApp",
      telefone: opts.phone,
      origem: "whatsapp",
      responsavel_id: opts.responsavel_id ?? null,
      responsavel_nome: opts.responsavel_nome ?? null,
      etapa: etapaAlvo,
      notas: opts.nota ?? "Criado automaticamente a partir do CRM do WhatsApp (SDR)",
      ...(etapaAlvo === "convertido" ? { convertido_em: new Date().toISOString() } : {}),
    }).select("id").single();

    if (created) {
      await db.from("prospeccao_historico").insert({
        lead_id: created.id,
        etapa_anterior: null,
        etapa_nova: etapaAlvo,
        nota: "Criado automaticamente a partir do CRM do WhatsApp",
      });
    }
    return;
  }

  // "perdido" só é aplicado se o prospect ainda não passou de "interessado"
  const rankAtual = ETAPA_RANK[match.etapa] ?? 0;
  const deveAtualizar = etapaAlvo === "perdido"
    ? !["convertido", "trial", "perdido"].includes(match.etapa)
    : ETAPA_RANK[etapaAlvo] > rankAtual;

  if (!deveAtualizar) return;

  await db.from("prospeccao_leads").update({
    etapa: etapaAlvo,
    ...(opts.responsavel_id && !match.responsavel_id
      ? { responsavel_id: opts.responsavel_id, responsavel_nome: opts.responsavel_nome ?? null }
      : {}),
    ...(etapaAlvo === "convertido" ? { convertido_em: new Date().toISOString() } : {}),
  }).eq("id", match.id);

  await db.from("prospeccao_historico").insert({
    lead_id: match.id,
    etapa_anterior: match.etapa,
    etapa_nova: etapaAlvo,
    nota: opts.nota ?? "Sincronizado automaticamente do CRM do WhatsApp",
  });
}

/** Busca a etapa de Prospecção vinculada a cada telefone informado (pra exibir no CRM do WhatsApp). */
export async function lookupProspeccaoEtapaByPhones(phones: string[]): Promise<Record<string, string>> {
  if (phones.length === 0) return {};
  const db = svc();
  const { data } = await db.from("prospeccao_leads").select("telefone, etapa").not("telefone", "is", null);

  const byNormalized = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.telefone) byNormalized.set(normalizePhone(row.telefone), row.etapa);
  }

  const result: Record<string, string> = {};
  for (const phone of phones) {
    const etapa = byNormalized.get(normalizePhone(phone));
    if (etapa) result[phone] = etapa;
  }
  return result;
}
