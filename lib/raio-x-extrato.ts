import type { SupabaseClient } from "@supabase/supabase-js";
import { extrairDadosDoArquivo } from "@/lib/analise-estruturada/extracao";
import { raioX } from "@/lib/analise-estruturada/calculo";

// Raio-X de extrato dentro da proposta (Mesa de Crédito): o mesmo levantamento de tarifas,
// seguros, juros e serviços da Análise Estruturada V3, rodado sobre os extratos anexados à
// proposta. O resultado fica em credit_desk_proposals.metadata.raio_x_extrato.

const DEFAULT_BUCKET = "credit-documents";
const GOVERNED_BUCKET = "v3-docs-publico";

export interface ArquivoProposta {
  id: string;            // storage_path (anexo) ou a URL (documento da captação)
  nome: string;
  rotulo: string;        // item do checklist ou rótulo da captação
  origem: "anexo" | "captacao";
  bucket?: string;
  extratoProvavel: boolean;
}

export type ResultadoRaioX = NonNullable<ReturnType<typeof raioX>>;

export interface RaioXExtratoSalvo {
  gerado_em: string;
  gerado_por: string;
  arquivos: Array<{ id: string; nome: string; banco: string | null; status: "lido" | "erro" | "nao_suportado"; erro: string | null; meses: number }>;
  resultado: ResultadoRaioX | null;
  movimento: Array<{ mes: string; entradas: number; saidas: number }>;
}

type DocEntry = { doc_id: string; file_name: string; storage_path: string; bucket?: string };

const pareceExtrato = (s: string) => /extrat|ofx|banc|conta corrente|movimenta/i.test(s);

function bucketDe(doc: { storage_path?: string; bucket?: string }): string {
  if (doc.bucket) return doc.bucket;
  if (doc.storage_path?.startsWith("Credito/") || doc.storage_path?.startsWith("MA/") || doc.storage_path?.startsWith("Administracao/")) return GOVERNED_BUCKET;
  return DEFAULT_BUCKET;
}

/** Arquivos da proposta que podem ser extratos: anexos do checklist e documentos da captação. */
export function arquivosDaProposta(proposta: { documents: unknown; metadata: unknown }): ArquivoProposta[] {
  const docs = (Array.isArray(proposta.documents) ? proposta.documents : []) as DocEntry[];
  const meta = (proposta.metadata ?? {}) as Record<string, unknown>;
  const capt = (Array.isArray(meta.documentos) ? meta.documentos : []) as Array<{ label?: string; name?: string; url?: string }>;
  const lista: ArquivoProposta[] = docs.map((d) => ({
    id: d.storage_path, nome: d.file_name, rotulo: d.doc_id, origem: "anexo" as const, bucket: bucketDe(d),
    extratoProvavel: pareceExtrato(`${d.doc_id} ${d.file_name}`),
  }));
  for (const c of capt) {
    if (!c.url) continue;
    lista.push({ id: c.url, nome: c.name ?? "documento", rotulo: c.label ?? "captação", origem: "captacao", extratoProvavel: pareceExtrato(`${c.label ?? ""} ${c.name ?? ""}`) });
  }
  return lista;
}

async function baixar(db: SupabaseClient, a: ArquivoProposta): Promise<Buffer> {
  if (a.origem === "anexo") {
    const { data, error } = await db.storage.from(a.bucket ?? DEFAULT_BUCKET).download(a.id);
    if (error || !data) throw new Error("Arquivo não encontrado no storage.");
    return Buffer.from(await data.arrayBuffer());
  }
  // Documento da captação: só baixa URL do próprio Supabase da plataforma.
  const base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  const u = new URL(a.id);
  if (u.host !== base.host) throw new Error("Documento fora do armazenamento da plataforma.");
  const r = await fetch(u);
  if (!r.ok) throw new Error(`Falha ao baixar (${r.status}).`);
  return Buffer.from(await r.arrayBuffer());
}

/** Lê os extratos escolhidos, roda o raio-X de custos e grava na proposta. */
export async function gerarRaioXExtrato(
  db: SupabaseClient, propostaId: string, escolhidos: ArquivoProposta[], autor: string,
): Promise<RaioXExtratoSalvo> {
  const lidos: RaioXExtratoSalvo["arquivos"] = [];
  const extratos: Array<{ banco: string | null; dados: Record<string, unknown> }> = [];

  // até 3 leituras em paralelo (PDF de extrato longo leva dezenas de segundos)
  const fila = [...escolhidos];
  async function trabalhador() {
    for (let a = fila.shift(); a; a = fila.shift()) {
      try {
        const buffer = await baixar(db, a);
        const r = await extrairDadosDoArquivo(buffer, a.nome, "extrato", `Extrato bancário (${a.rotulo})`);
        if ("naoSuportado" in r) { lidos.push({ id: a.id, nome: a.nome, banco: null, status: "nao_suportado", erro: r.naoSuportado, meses: 0 }); continue; }
        const banco = (r.dados.banco as string | null) ?? null;
        extratos.push({ banco, dados: r.dados });
        lidos.push({ id: a.id, nome: a.nome, banco, status: "lido", erro: null, meses: Array.isArray(r.dados.meses) ? r.dados.meses.length : 0 });
      } catch (e) {
        lidos.push({ id: a.id, nome: a.nome, banco: null, status: "erro", erro: e instanceof Error ? e.message.slice(0, 300) : "Falha na leitura.", meses: 0 });
      }
    }
  }
  await Promise.all([trabalhador(), trabalhador(), trabalhador()]);

  const porMes = new Map<string, { entradas: number; saidas: number }>();
  for (const e of extratos) {
    for (const m of (e.dados.meses as Array<{ mes?: string; entradas?: number; saidas?: number }>) ?? []) {
      if (!m.mes) continue;
      const x = porMes.get(m.mes) ?? { entradas: 0, saidas: 0 };
      x.entradas += Number(m.entradas) || 0; x.saidas += Math.abs(Number(m.saidas) || 0);
      porMes.set(m.mes, x);
    }
  }

  const salvo: RaioXExtratoSalvo = {
    gerado_em: new Date().toISOString(),
    gerado_por: autor,
    arquivos: lidos,
    resultado: extratos.length ? raioX(extratos) : null,
    movimento: [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, v]) => ({ mes, entradas: Math.round(v.entradas * 100) / 100, saidas: Math.round(v.saidas * 100) / 100 })),
  };

  const { data: atual } = await db.from("credit_desk_proposals").select("metadata").eq("id", propostaId).single();
  const meta = ((atual?.metadata as Record<string, unknown> | null) ?? {});
  await db.from("credit_desk_proposals").update({ metadata: { ...meta, raio_x_extrato: salvo } }).eq("id", propostaId);
  return salvo;
}
