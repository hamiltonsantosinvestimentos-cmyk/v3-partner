import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET_ANALISE } from "@/lib/analise-estruturada/checklist";
import { pastaDoPedido, statusDocumentos, type PedidoAnalise } from "@/lib/analise-estruturada/documentos";
import { carregarResultado } from "@/lib/analise-estruturada/extracao";
import { calcular, type ResultadoCalculo } from "@/lib/analise-estruturada/calculo";
import { calcularRating, type DadosCreditoParte, type ResultadoRating } from "@/lib/analise-estruturada/rating";
import { resolverPartesDoPedido } from "@/lib/credit-unified-pdf";
import { buildCreditReportData } from "@/lib/credit-report-data";
import { situacaoDaParte, type SituacaoCreditoParte } from "@/lib/analise-estruturada/situacao-credito";

// Junta as leituras (já conferidas pela Mesa) de um pedido, roda o motor de cálculo e
// grava o resultado em analise-estruturada/<pedido>/_calculo.json (entrega 3).

const caminhoCalculo = (orderId: string) => `${pastaDoPedido(orderId)}/_calculo.json`;

export interface CalculoSalvo extends ResultadoCalculo {
  calculadoPor: string | null;
  arquivosNaoLidos: number;
  /** Rating V3 2.0 (Fase 2). Ausente em cálculos salvos antes dele. */
  rating?: ResultadoRating;
  /** Serasa, SCR, processos, cadastro e CEIS de cada parte, para o parecer. Ausente em cálculos antigos. */
  situacaoCredito?: { partes: SituacaoCreditoParte[]; semAnalise: number };
}

/** Dados de crédito já consultados (Serasa, SCR, processos, cadastro, CEIS) de cada parte do pedido. */
async function dadosDeCredito(db: SupabaseClient, orderId: string): Promise<{ partes: DadosCreditoParte[]; situacao: SituacaoCreditoParte[]; semAnalise: number }> {
  const r = await resolverPartesDoPedido(db, orderId);
  if (!r.ok) return { partes: [], situacao: [], semAnalise: 1 };
  const partes: DadosCreditoParte[] = [];
  const situacao: SituacaoCreditoParte[] = [];
  for (const [i, p] of r.partes.slice(0, 8).entries()) {
    const d = await buildCreditReportData(p.profileId);
    if (!d) continue;
    const papel = i === 0 ? "principal" : p.papel === "CNPJ do grupo" ? "empresa_grupo" : "socio";
    situacao.push(situacaoDaParte(d, papel));
    partes.push({
      papel,
      nome: d.subjectName ?? p.nomeRotulo,
      serasa: d.serasa,
      bacenScr: d.bacenScr,
      processos: d.processos,
      cadastro: d.cadastro,
      ceis: d.ceis,
    });
  }
  return { partes, situacao, semAnalise: r.ausentes.length };
}

export async function calcularPedido(db: SupabaseClient, pedido: PedidoAnalise, autor: string | null): Promise<CalculoSalvo> {
  const status = await statusDocumentos(db, pedido);
  const caminhos = status.itens.flatMap((i) => i.arquivos.map((a) => a.caminho));
  const leituras = (await Promise.all(caminhos.map((c) => carregarResultado(db, pedido.id, c))))
    .filter((l): l is NonNullable<typeof l> => !!l);
  const resultado = calcular(status.perfil, leituras.map((l) => ({ item: l.item, tipo: l.tipo, arquivo: l.arquivo, status: l.status, dados: l.dados })));
  const credito = await dadosDeCredito(db, pedido.id).catch(() => ({ partes: [] as DadosCreditoParte[], situacao: [] as SituacaoCreditoParte[], semAnalise: 1 }));
  const rating = calcularRating({
    perfil: status.perfil,
    calculo: resultado,
    partes: credito.partes,
    partesSemAnalise: credito.semAnalise,
    obrigatoriosFaltando: status.obrigatoriosFaltando,
    temGarantia: status.itens.some((i) => i.key === "garantia" && i.arquivos.length > 0),
  });
  if (!credito.partes.length) {
    resultado.alertas.push({ nivel: "medio", tema: "Documentos", texto: "A consulta de crédito (Serasa, SCR, processos) ainda não foi rodada: o rating saiu sem comportamento de crédito e jurídico." });
  }
  const salvo: CalculoSalvo = { ...resultado, rating, situacaoCredito: { partes: credito.situacao, semAnalise: credito.semAnalise }, calculadoPor: autor, arquivosNaoLidos: caminhos.length - leituras.filter((l) => l.status === "lido").length };
  await db.storage.from(BUCKET_ANALISE).upload(
    caminhoCalculo(pedido.id),
    new Blob([JSON.stringify(salvo)], { type: "application/json" }),
    { contentType: "application/json", upsert: true },
  );
  return salvo;
}

export async function carregarCalculo(db: SupabaseClient, orderId: string): Promise<CalculoSalvo | null> {
  const { data } = await db.storage.from(BUCKET_ANALISE).download(caminhoCalculo(orderId));
  if (!data) return null;
  try { return JSON.parse(await data.text()) as CalculoSalvo; } catch { return null; }
}
