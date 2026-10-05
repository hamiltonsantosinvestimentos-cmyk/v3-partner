import type { SupabaseClient } from "@supabase/supabase-js";
import { sendText } from "@/lib/whatsapp/openwa-client";
import { notifyByRoles, createNotification } from "@/lib/notify";
import { isAnaliseEstruturadaOrder } from "@/lib/credit-analysis-pricing";
import {
  CHECKLIST, BUCKET_ANALISE, PREFIXO_ANALISE, PRAZO_ENTREGA_HORAS, WHATSAPP_ALERTA_DOCUMENTOS,
  perfilPeloDocumento, type PerfilAnalise,
} from "@/lib/analise-estruturada/checklist";

// Estado dos documentos de um pedido da Análise Estruturada V3 (ver checklist.ts).

export interface PedidoAnalise {
  id: string;
  service_type?: string | null;
  client_name: string | null;
  client_doc: string | null;
  amount_cents: number | null;
  status: string | null;
  intake_token: string | null;
  credit_desk_proposal_id: string | null;
  ref_partner_id: string | null;
  partner_id: string | null;
}

export interface ArquivoEnviado { nome: string; caminho: string; enviado_em: string | null }

export interface ItemStatus {
  key: string;
  label: string;
  descricao: string;
  obrigatorio: boolean;
  arquivos: ArquivoEnviado[];
}

export interface StatusDocumentos {
  perfil: PerfilAnalise;
  itens: ItemStatus[];
  obrigatoriosFaltando: number;
  completo: boolean;
  completoEm: string | null;
  prazoEntrega: string | null;
}

const COLUNAS_PEDIDO = "id, client_name, client_doc, amount_cents, service_type, status, intake_token, credit_desk_proposal_id, ref_partner_id, partner_id";

/** Pedido pago da Análise Estruturada V3 (Access ou Completa) pelo token do link do cliente; null se não for um. */
export async function pedidoPeloToken(db: SupabaseClient, token: string): Promise<PedidoAnalise | null> {
  const { data } = await db.from("partner_service_orders").select(COLUNAS_PEDIDO).eq("intake_token", token).maybeSingle();
  const pedido = data as PedidoAnalise | null;
  if (!pedido || pedido.status !== "PAID" || !isAnaliseEstruturadaOrder(pedido)) return null;
  return pedido;
}

export async function pedidoPeloId(db: SupabaseClient, orderId: string): Promise<PedidoAnalise | null> {
  const { data } = await db.from("partner_service_orders").select(COLUNAS_PEDIDO).eq("id", orderId).maybeSingle();
  const pedido = data as PedidoAnalise | null;
  if (!pedido || !isAnaliseEstruturadaOrder(pedido)) return null;
  return pedido;
}

export const pastaDoPedido = (orderId: string) => `${PREFIXO_ANALISE}/${orderId}`;
const caminhoMarcador = (orderId: string) => `${pastaDoPedido(orderId)}/_completo.json`;

/** Nome original do arquivo sem o prefixo "<timestamp>_" que o upload acrescenta. */
function nomeOriginal(nomeNoStorage: string): string {
  return nomeNoStorage.replace(/^\d+_/, "");
}

export async function statusDocumentos(db: SupabaseClient, pedido: PedidoAnalise): Promise<StatusDocumentos> {
  const perfil = perfilPeloDocumento(pedido.client_doc);
  const storage = db.storage.from(BUCKET_ANALISE);

  const itens: ItemStatus[] = await Promise.all(
    CHECKLIST[perfil].map(async (item) => {
      const pasta = `${pastaDoPedido(pedido.id)}/${item.key}`;
      const { data } = await storage.list(pasta, { limit: 100, sortBy: { column: "created_at", order: "asc" } });
      const arquivos = (data ?? [])
        .filter((f) => f.name && !f.name.startsWith(".") && f.id)
        .map((f) => ({ nome: nomeOriginal(f.name), caminho: `${pasta}/${f.name}`, enviado_em: f.created_at ?? null }));
      return { ...item, arquivos };
    }),
  );

  const obrigatoriosFaltando = itens.filter((i) => i.obrigatorio && i.arquivos.length === 0).length;
  const completoEm = await lerMarcador(db, pedido.id);
  return {
    perfil,
    itens,
    obrigatoriosFaltando,
    completo: obrigatoriosFaltando === 0,
    completoEm,
    prazoEntrega: completoEm ? new Date(new Date(completoEm).getTime() + PRAZO_ENTREGA_HORAS * 3600 * 1000).toISOString() : null,
  };
}

async function lerMarcador(db: SupabaseClient, orderId: string): Promise<string | null> {
  const { data } = await db.storage.from(BUCKET_ANALISE).download(caminhoMarcador(orderId));
  if (!data) return null;
  try {
    const json = JSON.parse(await data.text()) as { completo_em?: string };
    return json.completo_em ?? null;
  } catch {
    return null;
  }
}

const fmtDataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * Quando os obrigatórios ficam completos pela primeira vez: grava o marcador (início do
 * prazo de 24h) e avisa no WhatsApp 51 99746-6001, a Mesa e o partner. O upload do marcador
 * com upsert=false é o trava de idempotência: se outro envio simultâneo já gravou, nada é
 * reenviado. Devolve o status atualizado.
 */
export async function registrarSeCompleto(db: SupabaseClient, pedido: PedidoAnalise): Promise<StatusDocumentos> {
  const status = await statusDocumentos(db, pedido);
  if (!status.completo || status.completoEm) return status;

  const completoEm = new Date().toISOString();
  const { error } = await db.storage
    .from(BUCKET_ANALISE)
    .upload(caminhoMarcador(pedido.id), new Blob([JSON.stringify({ completo_em: completoEm })], { type: "application/json" }), {
      contentType: "application/json",
      upsert: false,
    });
  if (error) return statusDocumentos(db, pedido); // outro envio já registrou

  const prazo = new Date(new Date(completoEm).getTime() + PRAZO_ENTREGA_HORAS * 3600 * 1000).toISOString();
  const partnerId = pedido.partner_id ?? pedido.ref_partner_id;
  const [{ data: partner }, { data: proposta }] = await Promise.all([
    partnerId ? db.from("profiles").select("full_name").eq("id", partnerId).maybeSingle() : Promise.resolve({ data: null }),
    pedido.credit_desk_proposal_id
      ? db.from("credit_desk_proposals").select("code").eq("id", pedido.credit_desk_proposal_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const nomePartner = (partner as { full_name?: string } | null)?.full_name ?? null;
  const codigoProposta = (proposta as { code?: string } | null)?.code ?? null;
  const cliente = pedido.client_name ?? "Cliente";
  const totalArquivos = status.itens.reduce((s, i) => s + i.arquivos.length, 0);

  const mensagem =
    `📂 Documentos completos — Análise Estruturada V3\n\n` +
    `Cliente: ${cliente}${pedido.client_doc ? ` (${pedido.client_doc})` : ""}\n` +
    (nomePartner ? `Partner: ${nomePartner}\n` : "") +
    (codigoProposta ? `Proposta: ${codigoProposta}\n` : "") +
    `Arquivos enviados: ${totalArquivos}\n` +
    `Prazo de entrega do parecer: ${fmtDataHora(prazo)}\n\n` +
    `Ver: app.v3partners.com.br/mesa-operacional/pedidos`;

  await Promise.allSettled([
    sendText(WHATSAPP_ALERTA_DOCUMENTOS, mensagem),
    notifyByRoles(["ADMIN", "GESTAO", "MESA_OPERACIONAL"], {
      title: "Documentos completos — Análise Estruturada",
      message: `${cliente} enviou todos os documentos obrigatórios. Parecer até ${fmtDataHora(prazo)}.`,
      type: "proposal",
      action_url: "/mesa-operacional/pedidos",
    }),
    partnerId
      ? createNotification({
          user_id: partnerId,
          title: "Seu cliente enviou os documentos",
          message: `${cliente} completou os documentos da Análise Estruturada V3. O parecer sai até ${fmtDataHora(prazo)}.`,
          type: "proposal",
          action_url: "/mesa-credito/nivel-1",
        })
      : Promise.resolve(),
  ]);

  return { ...status, completoEm, prazoEntrega: prazo };
}
