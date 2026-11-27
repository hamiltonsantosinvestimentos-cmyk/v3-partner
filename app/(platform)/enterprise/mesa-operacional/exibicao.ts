// Mesa Operacional do master Enterprise: regras de coluna, resumo e formatos (puras, sem servidor).
// BRIEF docs/briefs/2026-11-26_mesa-operacional-master-enterprise.md
// Separado de lib/enterprise/mesa-equipe.ts para o Kanban (cliente) não carregar a visão do partner,
// que depende de código de servidor. lib/enterprise/mesa-equipe.ts reexporta tudo daqui.
import { SLA_STAGES, SLA_STAGE_LABELS } from "@/lib/mesa-operacional-sla";
import { formatCurrencyBRLFromNumber } from "@/lib/utils";
import type { TarjaEnterpriseDados } from "@/components/shared/tarja-enterprise";

export const COLUNAS = [...SLA_STAGES, "ENCERRADAS"] as const;
export type ColunaMesa = (typeof COLUNAS)[number];

export const ROTULO_COLUNA: Record<ColunaMesa, string> = { ...SLA_STAGE_LABELS, ENCERRADAS: "Encerradas" };

export const LIMITE_MESA = 500;
export const SEM_NOME = "Usuário sem nome";
export const OUTRO_DOCUMENTO = "Outro documento";
export const NAO_INFORMADO = "Não informado";

/** Mesma regra da Mesa Operacional da V3 (mesa-op-client.tsx). */
export function colunaDoCard(etapa: string, status: string): ColunaMesa {
  const e = (etapa ?? "").toUpperCase();
  if (e === "REPROVADO" || e === "DECLINADO") return "ENCERRADAS";
  if (e === "FINALIZADO") {
    const s = (status ?? "").toUpperCase();
    return s === "REJECTED" || s === "CANCELLED" ? "ENCERRADAS" : "LIBERADO";
  }
  if ((SLA_STAGES as readonly string[]).includes(e)) return e as ColunaMesa;
  return "RECEBIDO";
}

export function resumoDaMesa(cards: { coluna: ColunaMesa; valor_solicitado: number | null }[]) {
  const porColuna = Object.fromEntries(COLUNAS.map((c) => [c, 0])) as Record<ColunaMesa, number>;
  let valorSolicitadoAtivas = 0;
  for (const c of cards) {
    porColuna[c.coluna] += 1;
    if (c.coluna !== "ENCERRADAS" && typeof c.valor_solicitado === "number" && Number.isFinite(c.valor_solicitado)) {
      valorSolicitadoAtivas += c.valor_solicitado;
    }
  }
  const encerradas = porColuna.ENCERRADAS;
  return { porColuna, ativas: cards.length - encerradas, encerradas, valorSolicitadoAtivas };
}

/** DD/MM/AAAA (ou DD/MM/AAAA HH:mm) no fuso de São Paulo; nulo ou inválido vira "Não informado". */
export function dataBR(iso: string | null | undefined, comHora = false): string {
  if (!iso) return NAO_INFORMADO;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NAO_INFORMADO;
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric",
      ...(comHora ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const } : {}),
    }).formatToParts(d).map((p) => [p.type, p.value]),
  );
  const data = `${partes.day}/${partes.month}/${partes.year}`;
  return comHora ? `${data} ${partes.hour}:${partes.minute}` : data;
}

/** "R$ " + máscara BRL; nulo vira "Não informado" (nunca "R$ 0,00" nem "NaN"). */
export function valorBR(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? NAO_INFORMADO : `R$ ${formatCurrencyBRLFromNumber(v)}`;
}

/**
 * Converte a resposta de GET /api/credit-proposals?id= no formato que a janela da Mesa de Crédito
 * (PropostaDetailModal) recebe. Mesma conversão campo a campo de components/mesa-credito/nivel1-client.tsx
 * e credit-desk-client.tsx: se ela mudar lá, mude aqui também (o teste congela os campos de hoje).
 * BRIEF docs/briefs/2026-11-27_mesa-operacional-master-modal-mesa-credito.md
 */
export function propostaDaMesaDeCredito(p: Record<string, unknown>) {
  const meta = p.metadata as Record<string, unknown> | null;
  const partner = p.partner as { id?: string; full_name?: string; role?: string } | null;
  return {
    id: p.id as string, code: p.code as string, title: p.title as string,
    client_name: p.client_name as string,
    cpf_cnpj: p.client_cpf_cnpj as string | undefined,
    client_type: (meta?.client_type ?? p.client_type) as string | undefined,
    email: meta?.email as string | undefined,
    telefone: meta?.telefone as string | undefined,
    prazo: meta?.prazo as string | undefined,
    finalidade: meta?.finalidade as string | undefined,
    credit_line: p.credit_line as string,
    requested_value: p.requested_value as number,
    approved_value: (p.approved_value as number | null) ?? null,
    current_level: p.current_level as string,
    status: p.status as string,
    stage: p.stage as string | undefined,
    partner_id: partner?.id,
    partner_name: partner?.full_name,
    partner_role: partner?.role,
    enterprise: (p.enterprise as TarjaEnterpriseDados | null | undefined) ?? null,
    created_at: p.created_at as string,
    valor_credito_atual: p.valor_credito_atual as number | undefined,
    comissao_mandato_perc: p.comissao_mandato_perc as number | undefined,
    comissao_instituicao_perc: p.comissao_instituicao_perc as number | undefined,
    metadata: meta ?? undefined,
    level1_notes: p.level1_notes as string | null | undefined,
    level2_notes: p.level2_notes as string | null | undefined,
    level3_notes: p.level3_notes as string | null | undefined,
    level1_at: p.level1_at as string | null | undefined,
    level2_at: p.level2_at as string | null | undefined,
    level3_at: p.level3_at as string | null | undefined,
    pending_reason: p.pending_reason as string | null | undefined,
    pending_responsible: p.pending_responsible as string | null | undefined,
    pending_at: p.pending_at as string | null | undefined,
    pending_resolved_at: p.pending_resolved_at as string | null | undefined,
    pending_resolved_by: p.pending_resolved_by as string | null | undefined,
  };
}
