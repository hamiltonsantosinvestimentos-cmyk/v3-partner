/**
 * NOMEAÇÃO DOS ANEXOS NOVOS DAS PROPOSTAS (BRIEF 09/11/2026: docs/briefs/2026-11-09_nomear-documentos-propostas.md)
 *
 * Usada no `after()` do upload (uma proposta) e no cron diário (todas). Só lê arquivos com
 * `uploaded_at >= NOMEAR_A_PARTIR_DE` (decisão do Hamilton: os anexos antigos não são lidos).
 * Grava só na tabela credit_document_names (service role); `credit_desk_proposals.documents` não é alterada.
 */
import { createClient as sc, type SupabaseClient } from "@supabase/supabase-js";
import { lerDocumentoParaNome } from "@/lib/documentos/ler-para-nome";
import {
  montarNomeBase, normalizarPeriodo, normalizarTipo, limparTrecho, selecionarPendentes, type LinhaNome,
} from "@/lib/documentos/nome-arquivo";

/**
 * Corte: só arquivos enviados a partir daqui são lidos. Data e hora (UTC) do go da entrada no ar.
 * NÃO mover para antes de 09/11/2026 (o teste unitário falha): uma data antiga faria o cron ler os
 * 2.651 anexos antigos. Uma data posterior ao deploy deixaria os primeiros arquivos novos sem nome.
 */
export const NOMEAR_A_PARTIR_DE = "2026-11-09T22:00:00.000Z";

type Doc = { doc_id?: string; file_name: string; storage_path: string; uploaded_at?: string | null; bucket?: string };
type Proposta = { id: string; documents: unknown };

export type ResumoNomeacao = {
  lidos: number; ok: number; sem_leitura: number; ignorado: number; erro: number;
  chamadas: number; tokens_entrada: number; tokens_saida: number; pendentes_restantes: number;
};

function svcClient(): SupabaseClient {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function docsDe(p: Proposta): Doc[] {
  return Array.isArray(p.documents) ? (p.documents as Doc[]).filter((d) => d && typeof d.storage_path === "string") : [];
}

async function lerLinhas(svc: SupabaseClient, paths: string[]): Promise<LinhaNome[] | null> {
  const out: LinhaNome[] = [];
  for (let i = 0; i < paths.length; i += 200) {
    const { data, error } = await svc.from("credit_document_names").select("storage_path, status, tentativas").in("storage_path", paths.slice(i, i + 200));
    if (error) { console.error("[nomear-documentos] falha ao ler a tabela", { code: error.code }); return null; }
    out.push(...((data ?? []) as LinhaNome[]));
  }
  return out;
}

/** O arquivo ainda está na proposta? (relido antes de gravar, para não gravar nome de arquivo apagado) */
async function aindaExiste(svc: SupabaseClient, proposalId: string, storagePath: string): Promise<boolean> {
  const { data } = await svc.from("credit_desk_proposals").select("documents").eq("id", proposalId).maybeSingle();
  return !!data && docsDe(data as Proposta).some((d) => d.storage_path === storagePath);
}

export async function nomearDocumentosPendentes(opts: { proposalId?: string; limite: number; prazoMs: number }): Promise<ResumoNomeacao> {
  const inicio = Date.now();
  const resumo: ResumoNomeacao = { lidos: 0, ok: 0, sem_leitura: 0, ignorado: 0, erro: 0, chamadas: 0, tokens_entrada: 0, tokens_saida: 0, pendentes_restantes: 0 };
  if (!process.env.ANTHROPIC_API_KEY) { console.error("[nomear-documentos] ANTHROPIC_API_KEY ausente"); return resumo; }
  const svc = svcClient();

  let q = svc.from("credit_desk_proposals").select("id, documents").order("created_at", { ascending: false });
  if (opts.proposalId) q = q.eq("id", opts.proposalId);
  const { data: propostas, error } = await q;
  if (error || !propostas) { console.error("[nomear-documentos] falha ao ler propostas", { code: error?.code }); return resumo; }

  // Pré-filtro pelo corte antes de consultar a tabela (os antigos nem entram na consulta).
  const corte = Date.parse(NOMEAR_A_PARTIR_DE);
  const candidatos: { proposalId: string; docs: Doc[] }[] = [];
  for (const p of propostas as Proposta[]) {
    const docs = docsDe(p).filter((d) => { const t = Date.parse(d.uploaded_at ?? ""); return !Number.isNaN(t) && t >= corte; });
    if (docs.length) candidatos.push({ proposalId: p.id, docs });
  }
  if (!candidatos.length) return resumo;

  const linhas = await lerLinhas(svc, candidatos.flatMap((c) => c.docs.map((d) => d.storage_path)));
  if (!linhas) return resumo;
  const tentativasPorPath = new Map(linhas.map((l) => [l.storage_path, l.tentativas]));

  const fila = candidatos.flatMap((c) => selecionarPendentes(c.docs, linhas, NOMEAR_A_PARTIR_DE).map((x) => ({ proposalId: c.proposalId, ...x })));

  for (let i = 0; i < fila.length; i++) {
    if (resumo.lidos >= opts.limite || Date.now() - inicio > opts.prazoMs) { resumo.pendentes_restantes = fila.length - i; break; }
    const { proposalId, doc, nova } = fila[i];
    const r = await lerDocumentoParaNome(svc, doc);
    resumo.lidos++;
    resumo[r.status]++;

    let linha: Record<string, unknown>;
    if (r.status === "ok" || r.status === "sem_leitura") {
      resumo.chamadas += r.uso.chamadas;
      resumo.tokens_entrada += r.uso.entrada;
      resumo.tokens_saida += r.uso.saida;
      const titular = limparTrecho(r.leitura.titular).slice(0, 100).trim() || null;
      linha = {
        nome_exibicao: r.status === "ok" ? montarNomeBase(r.leitura, doc.file_name) : null,
        tipo: r.leitura.tipo ? normalizarTipo(r.leitura.tipo) : null,
        periodo: normalizarPeriodo(r.leitura.periodo),
        titular,
        confianca: r.leitura.confianca == null ? null : Math.round(r.leitura.confianca * 100) / 100,
        status: r.status,
        modelo: r.modelo,
      };
      console.log("[nomear-documentos] leitura", { status: r.status, chamadas: r.uso.chamadas, entrada: r.uso.entrada, saida: r.uso.saida, modelo: r.modelo });
    } else {
      linha = { nome_exibicao: null, tipo: null, periodo: null, titular: null, confianca: null, status: r.status, modelo: null };
      console.warn("[nomear-documentos] sem nome", { status: r.status, motivo: r.motivo });
    }

    if (!(await aindaExiste(svc, proposalId, doc.storage_path))) continue;

    if (nova) {
      const { error: e } = await svc.from("credit_document_names")
        .upsert({ storage_path: doc.storage_path, proposal_id: proposalId, tentativas: 1, ...linha }, { onConflict: "storage_path", ignoreDuplicates: true });
      if (e) console.error("[nomear-documentos] falha ao gravar", { code: e.code });
    } else {
      const atual = tentativasPorPath.get(doc.storage_path) ?? 1;
      const { error: e } = await svc.from("credit_document_names")
        .update({ ...linha, tentativas: atual + 1, updated_at: new Date().toISOString() })
        .eq("storage_path", doc.storage_path).eq("status", "erro").eq("tentativas", atual);
      if (e) console.error("[nomear-documentos] falha ao atualizar", { code: e.code });
    }
  }
  return resumo;
}

/** Cron: apaga linhas de arquivos que não estão mais em nenhuma proposta. Devolve quantas apagou (null = falha). */
export async function limparOrfaos(): Promise<number | null> {
  const svc = svcClient();
  const { data: propostas, error } = await svc.from("credit_desk_proposals").select("id, documents");
  if (error || !propostas) return null;
  const existentes = new Set((propostas as Proposta[]).flatMap((p) => docsDe(p).map((d) => d.storage_path)));
  const { data: linhas, error: e2 } = await svc.from("credit_document_names").select("storage_path");
  if (e2 || !linhas) return null;
  const orfas = (linhas as { storage_path: string }[]).map((l) => l.storage_path).filter((p) => !existentes.has(p));
  for (let i = 0; i < orfas.length; i += 200) {
    const { error: e3 } = await svc.from("credit_document_names").delete().in("storage_path", orfas.slice(i, i + 200));
    if (e3) { console.error("[nomear-documentos] falha ao limpar órfãos", { code: e3.code }); return null; }
  }
  return orfas.length;
}

/** Nomes base gravados para uma proposta (storage_path -> {nome, tipo, lido_em}). Vazio se a tabela falhar. */
export async function nomesGravados(svc: SupabaseClient, proposalId: string): Promise<Map<string, { nome: string | null; tipo: string | null; lido_em: string | null }>> {
  const { data, error } = await svc.from("credit_document_names").select("storage_path, nome_exibicao, tipo, updated_at, status").eq("proposal_id", proposalId);
  const out = new Map<string, { nome: string | null; tipo: string | null; lido_em: string | null }>();
  if (error) { console.error("[nomear-documentos] falha ao ler nomes", { code: error.code }); return out; }
  for (const l of (data ?? []) as { storage_path: string; nome_exibicao: string | null; tipo: string | null; updated_at: string | null; status: string }[]) {
    if (l.status === "ok" && l.nome_exibicao) out.set(l.storage_path, { nome: l.nome_exibicao, tipo: l.tipo, lido_em: l.updated_at });
  }
  return out;
}
