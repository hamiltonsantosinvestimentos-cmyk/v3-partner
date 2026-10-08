// Consultas da aba Due Diligence da Ficha de Qualificacao (Entrega 1, 08/10/2026).
// Cada ferramenta devolve { status, summary }. Falha de fonte NUNCA vira aprovacao: o status e
// "nao_consultado" e o resumo diz o motivo. Nenhum resumo carrega nome ou CPF de socio.

import { createClient as sc } from "@supabase/supabase-js";
import { lookupCnpj } from "@/lib/cnpj-lookup";
import { buscarProcessosEscavador } from "@/lib/escavador";
import { TRIBUNAIS_PRINCIPAIS, searchTribunal, buildQuery } from "@/lib/datajud";
import { checktudoLogin, checktudoSCR } from "@/lib/checktudo";
import { parseBacenScr } from "@/lib/credit-bacen";
import { cleanDocument } from "@/lib/document-check";

export type DdTool = "receita" | "blacklist" | "escavador" | "datajud" | "scr_cnpj";
export type DdStatus = "ok" | "sem_dados" | "nao_consultado";
export type DdOutcome = { status: DdStatus; summary: Record<string, unknown> };

// Ordem em que as consultas costumam ser feitas (BRIEF).
export const DD_TOOLS_ORDER: DdTool[] = ["receita", "blacklist", "escavador", "datajud", "scr_cnpj"];
export const DD_TOOL_LABELS: Record<DdTool, string> = {
  receita: "Receita / CNPJ",
  blacklist: "Black List V3",
  escavador: "Escavador",
  datajud: "Datajud",
  scr_cnpj: "SCR do CNPJ",
};

const naoConsultado = (motivo: string): DdOutcome => ({ status: "nao_consultado", summary: { motivo } });
const hasLetters = (doc: string) => /[A-Z]/.test(doc);

async function receita(doc: string): Promise<DdOutcome> {
  // lookupCnpj normaliza com \D e so serve para CNPJ numerico; CNPJ alfanumerico nao e verificado.
  if (hasLetters(doc)) return naoConsultado("Fonte Receita não verificada para CNPJ alfanumérico");
  const r = await lookupCnpj(doc);
  if (!r.ok) return naoConsultado(r.error);
  return {
    status: "ok",
    summary: {
      situacao_cadastral: r.data.situacao_cadastral,
      razao_social: r.data.razao_social,
      socios_qtd: r.data.socios.length,
    },
  };
}

async function blacklist(doc: string): Promise<DdOutcome> {
  const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await db.from("kyc_blacklist").select("doc").eq("active", true).not("doc", "is", null);
  if (error) return naoConsultado("Não foi possível consultar a Black List");
  const qtd = (data ?? []).filter((r) => cleanDocument(r.doc as string) === doc).length;
  return { status: "ok", summary: { encontrado: qtd > 0, ocorrencias: qtd } };
}

async function escavador(doc: string): Promise<DdOutcome> {
  const token = process.env.ESCAVADOR_API_TOKEN;
  if (!token) return naoConsultado("Escavador não configurado");
  try {
    const r = await buscarProcessosEscavador("cnpj", doc, token);
    return { status: r.total_processos > 0 ? "ok" : "sem_dados", summary: { total_processos: r.total_processos, exibidos: r.processos.length } };
  } catch (e) {
    return naoConsultado(`Escavador indisponível: ${(e as Error).message.slice(0, 120)}`);
  }
}

async function datajud(doc: string): Promise<DdOutcome> {
  if (!process.env.DATAJUD_API_KEY) return naoConsultado("Datajud não configurado");
  const query = buildQuery("cnpj", doc);
  const porTribunal: Record<string, number> = {};
  let total = 0;
  const BATCH = 6;
  for (let i = 0; i < TRIBUNAIS_PRINCIPAIS.length; i += BATCH) {
    const lote = TRIBUNAIS_PRINCIPAIS.slice(i, i + BATCH);
    const res = await Promise.all(lote.map((t) => searchTribunal(t, query)));
    for (const items of res) {
      for (const it of items as { _tribunal?: string }[]) {
        const k = it._tribunal ?? "N/D";
        porTribunal[k] = (porTribunal[k] ?? 0) + 1;
        total += 1;
      }
    }
    if (total >= 50) break;
  }
  const tribunais = Object.entries(porTribunal)
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    .map(([sigla, qtd]) => ({ sigla, qtd }));
  return { status: total > 0 ? "ok" : "sem_dados", summary: { total_processos: total, tribunais } };
}

async function scrCnpj(doc: string): Promise<DdOutcome> {
  const user = process.env.CHECKTUDO_USERNAME;
  const pass = process.env.CHECKTUDO_PASSWORD;
  if (!user || !pass) return naoConsultado("CheckTudo não configurado");
  try {
    const session = await checktudoLogin(user, pass);
    const raw = await checktudoSCR(session, "cnpj", doc);
    const d = parseBacenScr(raw);
    const semScore = !d.score_pontuacao || /SEM DADOS/i.test(String(d.score_pontuacao));
    const semOperacoes = [d.credito_vencido_operacoes, d.prejuizo_operacoes, d.credito_a_vencer_operacoes, d.limite_credito_operacoes]
      .every((ops) => !ops || ops.length === 0);
    return {
      status: semScore && semOperacoes ? "sem_dados" : "ok",
      summary: {
        score_pontuacao: d.score_pontuacao,
        score_faixa: d.score_faixa,
        credito_vencido_valor: d.credito_vencido_valor,
        prejuizo_valor: d.prejuizo_valor,
        credito_a_vencer_valor: d.credito_a_vencer_valor,
        limite_credito_valor: d.limite_credito_valor,
      },
    };
  } catch (e) {
    return naoConsultado(`CheckTudo indisponível: ${(e as Error).message.slice(0, 120)}`);
  }
}

export async function runDdTool(tool: DdTool, doc: string): Promise<DdOutcome> {
  switch (tool) {
    case "receita": return receita(doc);
    case "blacklist": return blacklist(doc);
    case "escavador": return escavador(doc);
    case "datajud": return datajud(doc);
    case "scr_cnpj": return scrCnpj(doc);
  }
}
