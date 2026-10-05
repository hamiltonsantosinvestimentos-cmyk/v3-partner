import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET_ANALISE } from "@/lib/analise-estruturada/checklist";
import { pastaDoPedido, statusDocumentos, type PedidoAnalise } from "@/lib/analise-estruturada/documentos";
import { carregarCalculo } from "@/lib/analise-estruturada/calculo-pedido";
import { htmlParecer, opcoesPdfParecer, sugerirVeredito, type Veredito } from "@/lib/analise-estruturada/parecer-html";
import { TERMO_VERSAO } from "@/lib/analise-estruturada/termo";
import { launchBrowser } from "@/lib/credit-report-generate";

// Ciclo do parecer da Análise Estruturada V3 (entrega 4):
//   rascunho → assinado (analista da Mesa) → entregue (cliente + partner).
// PDF em analise-estruturada/<pedido>/_parecer/parecer.pdf e estado em _parecer/estado.json.

export interface EstadoParecer {
  status: "rascunho" | "assinado" | "entregue";
  veredito: Veredito;
  vereditoSugerido: Veredito;
  comentario: string | null;
  geradoEm: string;
  emitidoEm: string;
  assinadoPor: string | null;
  assinadoEm: string | null;
  entregueEm: string | null;
  entreguePor: string | null;
  termoVersao: string;
  calculadoEm: string;
}

const pastaParecer = (orderId: string) => `${pastaDoPedido(orderId)}/_parecer`;
export const caminhoPdfParecer = (orderId: string) => `${pastaParecer(orderId)}/parecer.pdf`;
const caminhoEstado = (orderId: string) => `${pastaParecer(orderId)}/estado.json`;

export async function carregarEstadoParecer(db: SupabaseClient, orderId: string): Promise<EstadoParecer | null> {
  const { data } = await db.storage.from(BUCKET_ANALISE).download(caminhoEstado(orderId));
  if (!data) return null;
  try { return JSON.parse(await data.text()) as EstadoParecer; } catch { return null; }
}

async function salvarEstado(db: SupabaseClient, orderId: string, estado: EstadoParecer) {
  await db.storage.from(BUCKET_ANALISE).upload(caminhoEstado(orderId),
    new Blob([JSON.stringify(estado)], { type: "application/json" }), { contentType: "application/json", upsert: true });
}

export const protocoloDoPedido = (orderId: string) => `AE-${orderId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;

/**
 * Gera o PDF do parecer com o cálculo salvo. Sem assinatura = rascunho; com assinatura =
 * versão final. Erro de negócio sai como Error com mensagem para a Mesa.
 */
export async function gerarParecer(
  db: SupabaseClient,
  pedido: PedidoAnalise,
  opts: { veredito?: Veredito; comentario?: string | null; assinatura?: { analista: string } | null },
): Promise<EstadoParecer> {
  const calculo = await carregarCalculo(db, pedido.id);
  if (!calculo) throw new Error("Calcule os indicadores antes de gerar o parecer.");
  const anterior = await carregarEstadoParecer(db, pedido.id);
  if (anterior?.status === "entregue") throw new Error("Este parecer já foi entregue ao cliente.");

  const documentos = await statusDocumentos(db, pedido);
  const partnerId = pedido.partner_id ?? pedido.ref_partner_id;
  const [{ data: partner }, { data: proposta }] = await Promise.all([
    partnerId ? db.from("profiles").select("full_name").eq("id", partnerId).maybeSingle() : Promise.resolve({ data: null }),
    pedido.credit_desk_proposal_id ? db.from("credit_desk_proposals").select("code").eq("id", pedido.credit_desk_proposal_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const agora = new Date().toISOString();
  const vereditoSugerido = sugerirVeredito(calculo);
  const veredito = opts.veredito ?? anterior?.veredito ?? vereditoSugerido;
  const comentario = opts.comentario !== undefined ? (opts.comentario?.trim() || null) : anterior?.comentario ?? null;
  const assinatura = opts.assinatura ? { analista: opts.assinatura.analista, em: agora } : null;
  const protocolo = protocoloDoPedido(pedido.id);

  const html = htmlParecer({
    protocolo,
    cliente: pedido.client_name ?? "Cliente",
    documento: pedido.client_doc,
    partner: (partner as { full_name?: string } | null)?.full_name ?? null,
    propostaCodigo: (proposta as { code?: string } | null)?.code ?? null,
    emitidoEm: agora,
    calculo,
    documentos,
    veredito,
    comentarioAnalista: comentario,
    assinatura,
  });

  const browser = await launchBrowser();
  let pdf: Uint8Array;
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    pdf = await page.pdf(opcoesPdfParecer({ protocolo, emitidoEm: agora }));
  } finally {
    await browser.close();
  }

  const { error } = await db.storage.from(BUCKET_ANALISE).upload(caminhoPdfParecer(pedido.id), Buffer.from(pdf), {
    contentType: "application/pdf", upsert: true,
  });
  if (error) throw new Error(`Falha ao salvar o PDF: ${error.message}`);

  const estado: EstadoParecer = {
    status: assinatura ? "assinado" : "rascunho",
    veredito, vereditoSugerido, comentario,
    geradoEm: agora, emitidoEm: agora,
    assinadoPor: assinatura?.analista ?? null, assinadoEm: assinatura?.em ?? null,
    entregueEm: null, entreguePor: null,
    termoVersao: TERMO_VERSAO,
    calculadoEm: calculo.calculadoEm,
  };
  await salvarEstado(db, pedido.id, estado);
  return estado;
}

export async function marcarEntregue(db: SupabaseClient, orderId: string, estado: EstadoParecer, por: string): Promise<EstadoParecer> {
  const entregue: EstadoParecer = { ...estado, status: "entregue", entregueEm: new Date().toISOString(), entreguePor: por };
  await salvarEstado(db, orderId, entregue);
  return entregue;
}
