import type { SupabaseClient } from "@supabase/supabase-js";
import { logAudit } from "@/lib/audit";

// Exclusão de análise de crédito (Pedidos de Partners). Apaga TODAS as análises (credit_profiles)
// ligadas a uma proposta — a atual e as antigas de execuções repetidas —, junto com o que nasce
// delas: processos e restrições (cascata no banco), dossiês em PDF do Storage e, no pedido, o
// relatório/link do cliente. A proposta e o pedido continuam; volta a ser possível "Rodar análise".
//
// NÃO desfaz comissão já gerada (é registro financeiro, com fluxo próprio de autorização) e, como o
// pedido/documento mantém a marca de comissão, uma nova análise + nova entrega não paga em dobro.

const BUCKET = "credit-documents";
const PDFS_DERIVADOS_DO_PEDIDO = ["relatorio-", "dossie-unificado-"];

export interface AnaliseResumo {
  id: string;
  created_at: string;
  tier: string | null;
  score_total: number | null;
  atual: boolean;
}

export interface ImpactoExclusao {
  ok: true;
  proposal_id: string;
  cliente: string | null;
  analises: AnaliseResumo[];
  /** Já existe comissão gerada para este pedido/documento (ela NÃO é apagada). */
  comissao_gerada: boolean;
  /** O relatório já foi enviado ao cliente (o link deixa de funcionar). */
  relatorio_entregue: boolean;
  /** Existe link público de relatório (deixa de funcionar). */
  relatorio_publicado: boolean;
}

export type ErroExclusao = { ok: false; status: number; error: string };

interface Contexto {
  proposal: { id: string; client_name: string | null; credit_profile_id: string | null };
  perfis: { id: string; created_at: string; tier: string | null; score_total: number | null; report_pdf_path: string | null }[];
  pedidos: { id: string; partner_commission_id: string | null; report_public_token: string | null; report_delivered_at: string | null }[];
  consents: { id: string; partner_service_order_id: string | null; report_public_token: string | null; report_delivered_at: string | null }[];
}

async function carregar(db: SupabaseClient, proposalId: string): Promise<(Contexto & { ok: true }) | ErroExclusao> {
  const { data: proposal } = await db
    .from("credit_desk_proposals")
    .select("id, client_name, credit_profile_id")
    .eq("id", proposalId)
    .single();
  if (!proposal) return { ok: false, status: 404, error: "Proposta não encontrada" };

  // Análise atual + análises antigas da mesma proposta
  const [{ data: porProposta }, { data: atual }] = await Promise.all([
    db.from("credit_profiles").select("id, created_at, tier, score_total, report_pdf_path").eq("deal_proposal_id", proposalId),
    proposal.credit_profile_id
      ? db.from("credit_profiles").select("id, created_at, tier, score_total, report_pdf_path").eq("id", proposal.credit_profile_id)
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const mapa = new Map<string, Contexto["perfis"][number]>();
  for (const p of [...(porProposta ?? []), ...(atual ?? [])]) mapa.set(p.id, p as Contexto["perfis"][number]);
  const perfis = [...mapa.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (!perfis.length) return { ok: false, status: 409, error: "Esta proposta não tem análise para excluir." };

  // Uma análise usada por OUTRA proposta não pode ser apagada daqui
  const { data: compartilhadas } = await db
    .from("credit_desk_proposals")
    .select("id")
    .in("credit_profile_id", perfis.map((p) => p.id))
    .neq("id", proposalId);
  if (compartilhadas?.length) {
    return { ok: false, status: 409, error: "Esta análise é usada também por outra proposta e não pode ser excluída por aqui." };
  }

  const [{ data: pedidos }, { data: consents }] = await Promise.all([
    db.from("partner_service_orders").select("id, partner_commission_id, report_public_token, report_delivered_at").eq("credit_desk_proposal_id", proposalId),
    db.from("credit_consents").select("id, partner_service_order_id, report_public_token, report_delivered_at").eq("credit_desk_proposal_id", proposalId),
  ]);

  return {
    ok: true,
    proposal: proposal as Contexto["proposal"],
    perfis,
    pedidos: (pedidos ?? []) as Contexto["pedidos"],
    consents: (consents ?? []) as Contexto["consents"],
  };
}

/** Calcula o impacto a partir de um contexto já carregado (evita recarregar
 *  proposta/perfis/pedidos/consents quando excluirAnalises já tem tudo em mãos). */
async function calcularImpacto(db: SupabaseClient, proposalId: string, c: Contexto): Promise<ImpactoExclusao> {
  let comissao = c.pedidos.some((p) => !!p.partner_commission_id);
  // Comissão de "documento adicional" (sócio/CNPJ) nasce presa ao PEDIDO pai
  // (commissions.operation_id = partner_service_orders.id, nunca o id do
  // consent -- ver lib/consulta-commissions.ts), então o fallback busca pelos
  // pedidos pai dos consents, não pelos próprios consents.
  if (!comissao && c.consents.length) {
    const pedidosPaiIds = [...new Set(c.consents.map((x) => x.partner_service_order_id).filter(Boolean))] as string[];
    if (pedidosPaiIds.length) {
      const { count } = await db
        .from("commissions")
        .select("id", { count: "exact", head: true })
        .eq("operation_type", "CREDITO")
        .in("operation_id", pedidosPaiIds);
      comissao = (count ?? 0) > 0;
    }
  }

  return {
    ok: true,
    proposal_id: proposalId,
    cliente: c.proposal.client_name,
    analises: c.perfis.map((p) => ({ id: p.id, created_at: p.created_at, tier: p.tier, score_total: p.score_total, atual: p.id === c.proposal.credit_profile_id })),
    comissao_gerada: comissao,
    relatorio_entregue: [...c.pedidos, ...c.consents].some((x) => !!x.report_delivered_at),
    relatorio_publicado: [...c.pedidos, ...c.consents].some((x) => !!x.report_public_token),
  };
}

/** O que será apagado e o que o operador precisa saber antes de confirmar. Não altera nada. */
export async function impactoDaExclusao(db: SupabaseClient, proposalId: string): Promise<ImpactoExclusao | ErroExclusao> {
  const c = await carregar(db, proposalId);
  if (!c.ok) return c;
  return calcularImpacto(db, proposalId, c);
}

export interface ResultadoExclusao {
  ok: true;
  proposal_id: string;
  analises_excluidas: number;
  arquivos_removidos: number;
  comissao_mantida: boolean;
}

async function removerPasta(db: SupabaseClient, pasta: string, prefixos?: string[]): Promise<number> {
  const { data: arquivos } = await db.storage.from(BUCKET).list(pasta, { limit: 200 });
  const alvos = (arquivos ?? [])
    .filter((f) => f.id && (!prefixos || prefixos.some((p) => f.name.startsWith(p))))
    .map((f) => `${pasta}/${f.name}`);
  if (alvos.length) await db.storage.from(BUCKET).remove(alvos);
  return alvos.length;
}

export async function excluirAnalises(
  db: SupabaseClient,
  proposalId: string,
  autor: { userId: string; userName: string | null }
): Promise<ResultadoExclusao | ErroExclusao> {
  const c = await carregar(db, proposalId);
  if (!c.ok) return c;
  const impacto = await calcularImpacto(db, proposalId, c);

  const ids = c.perfis.map((p) => p.id);

  // 1) Desfaz o que apontava para a análise (relatório/link do cliente e vínculo da proposta)
  for (const p of c.pedidos) {
    await db.from("partner_service_orders")
      .update({ report_public_token: null, report_pdf_path: null, report_delivered_at: null })
      .eq("id", p.id);
  }
  const pedidosPaiDeDocumento = [...new Set(c.consents.map((x) => x.partner_service_order_id).filter(Boolean))] as string[];
  for (const x of c.consents) {
    await db.from("credit_consents").update({ report_public_token: null, report_pdf_path: null, report_delivered_at: null }).eq("id", x.id);
  }
  // O PDF do pedido (relatório/unificado) inclui este documento: fica defasado
  for (const orderId of pedidosPaiDeDocumento) {
    await db.from("partner_service_orders").update({ report_pdf_path: null }).eq("id", orderId);
  }
  await db.from("credit_desk_proposals").update({ credit_profile_id: null }).eq("id", proposalId);

  // 2) Apaga as análises (judicial_records e asset_restrictions caem em cascata)
  const { error: delErr } = await db.from("credit_profiles").delete().in("id", ids);
  if (delErr) return { ok: false, status: 500, error: `Falha ao excluir a análise: ${delErr.message}` };

  // 3) Storage (best effort: o dado já saiu do banco; sobra de arquivo não reabre a análise)
  let arquivos = 0;
  try {
    for (const p of c.perfis) {
      arquivos += await removerPasta(db, `dossies/${p.id}`);
      if (p.report_pdf_path && !p.report_pdf_path.startsWith(`dossies/${p.id}/`)) {
        await db.storage.from(BUCKET).remove([p.report_pdf_path]);
        arquivos += 1;
      }
    }
    for (const orderId of [...c.pedidos.map((p) => p.id), ...pedidosPaiDeDocumento]) {
      arquivos += await removerPasta(db, `partner-orders/${orderId}`, PDFS_DERIVADOS_DO_PEDIDO);
    }
  } catch (e) {
    console.error("[excluir análise] falha ao limpar arquivos do Storage:", (e as Error).message);
  }

  // 4) Trilha de auditoria (o que foi apagado, por quem)
  await logAudit({
    userId: autor.userId,
    userName: autor.userName,
    action: "DELETE",
    entity: "credit_desk_proposals",
    entityId: proposalId,
    oldData: {
      tipo: "analise_de_credito",
      cliente: c.proposal.client_name,
      analises: c.perfis.map((p) => ({ id: p.id, criada_em: p.created_at, tier: p.tier, score_total: p.score_total })),
      comissao_gerada_mantida: impacto.comissao_gerada,
      relatorio_entregue: impacto.relatorio_entregue,
      arquivos_removidos: arquivos,
    },
  });

  return {
    ok: true,
    proposal_id: proposalId,
    analises_excluidas: ids.length,
    arquivos_removidos: arquivos,
    comissao_mantida: impacto.comissao_gerada,
  };
}
