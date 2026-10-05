import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET_ANALISE } from "@/lib/analise-estruturada/checklist";
import { pastaDoPedido, statusDocumentos, type PedidoAnalise } from "@/lib/analise-estruturada/documentos";
import { carregarResultado } from "@/lib/analise-estruturada/extracao";
import { calcular, type ResultadoCalculo } from "@/lib/analise-estruturada/calculo";

// Junta as leituras (já conferidas pela Mesa) de um pedido, roda o motor de cálculo e
// grava o resultado em analise-estruturada/<pedido>/_calculo.json (entrega 3).

const caminhoCalculo = (orderId: string) => `${pastaDoPedido(orderId)}/_calculo.json`;

export interface CalculoSalvo extends ResultadoCalculo { calculadoPor: string | null; arquivosNaoLidos: number }

export async function calcularPedido(db: SupabaseClient, pedido: PedidoAnalise, autor: string | null): Promise<CalculoSalvo> {
  const status = await statusDocumentos(db, pedido);
  const caminhos = status.itens.flatMap((i) => i.arquivos.map((a) => a.caminho));
  const leituras = (await Promise.all(caminhos.map((c) => carregarResultado(db, pedido.id, c))))
    .filter((l): l is NonNullable<typeof l> => !!l);
  const resultado = calcular(status.perfil, leituras.map((l) => ({ item: l.item, tipo: l.tipo, arquivo: l.arquivo, status: l.status, dados: l.dados })));
  const salvo: CalculoSalvo = { ...resultado, calculadoPor: autor, arquivosNaoLidos: caminhos.length - leituras.filter((l) => l.status === "lido").length };
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
