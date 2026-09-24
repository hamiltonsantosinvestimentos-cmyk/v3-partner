import type { SupabaseClient } from "@supabase/supabase-js";

// Gravação segura do metadata da proposta (23/09/2026). O modal sempre mandou o metadata
// INTEIRO a partir da cópia que tinha em memória: duas gravações seguidas (validar vários
// OCRs, editar o imóvel logo depois) faziam a segunda apagar a primeira — era por isso que
// resultado de OCR "sumia" ao sair e voltar. Partes que o servidor grava sozinho
// (ocr_resultados, padrao_construtivo dos imóveis) passam por aqui, lendo o valor atual do
// banco na hora de gravar, e o PATCH genérico preserva essas partes (ver protegerMetadata).

type Meta = Record<string, unknown>;
type Imovel = Record<string, unknown>;

export async function atualizarMetadata(
  db: SupabaseClient,
  proposalId: string,
  alterar: (atual: Meta) => Meta,
): Promise<{ ok: true; metadata: Meta } | { ok: false; error: string }> {
  const { data, error } = await db.from("credit_desk_proposals").select("metadata").eq("id", proposalId).single();
  if (error || !data) return { ok: false, error: error?.message ?? "Proposta não encontrada" };
  const novo = alterar({ ...((data.metadata ?? {}) as Meta) });
  const { error: upErr } = await db
    .from("credit_desk_proposals")
    .update({ metadata: novo, updated_at: new Date().toISOString() })
    .eq("id", proposalId);
  if (upErr) return { ok: false, error: upErr.message };
  return { ok: true, metadata: novo };
}

/** Grava/remove resultados de OCR sem tocar no resto (chave = "docId::fileKey"). */
export function salvarOcrResultados(
  db: SupabaseClient,
  proposalId: string,
  opts: { set?: Record<string, unknown>; removerChaves?: string[] },
) {
  return atualizarMetadata(db, proposalId, (meta) => {
    const ocr = { ...((meta.ocr_resultados ?? {}) as Record<string, unknown>), ...(opts.set ?? {}) };
    for (const k of opts.removerChaves ?? []) delete ocr[k];
    return { ...meta, ocr_resultados: ocr };
  });
}

/**
 * PATCH genérico do metadata: mescla com o que está no banco (chave que o cliente não mandou
 * não some) e mantém o que é gravado só pelo servidor — ocr_resultados e o
 * padrao_construtivo de cada imóvel — mesmo que o cliente mande uma cópia desatualizada.
 */
export function protegerMetadata(banco: Meta | null | undefined, recebido: Meta): Meta {
  const atual = (banco ?? {}) as Meta;
  const out: Meta = { ...atual, ...recebido };
  if (atual.ocr_resultados !== undefined) out.ocr_resultados = atual.ocr_resultados;
  const imoveisBanco = Array.isArray(atual.imoveis) ? (atual.imoveis as Imovel[]) : [];
  if (Array.isArray(recebido.imoveis)) {
    out.imoveis = (recebido.imoveis as Imovel[]).map((im, i) =>
      imoveisBanco[i]?.padrao_construtivo !== undefined ? { ...im, padrao_construtivo: imoveisBanco[i].padrao_construtivo } : im,
    );
  }
  return out;
}
