import { chaveIaMesas } from "@/lib/ai/chave-mesas";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET_ANALISE, extensaoDe, itemDoPerfil, perfilPeloDocumento } from "@/lib/analise-estruturada/checklist";
import { pastaDoPedido, type PedidoAnalise } from "@/lib/analise-estruturada/documentos";
import { TIPO_POR_ITEM, SYSTEM_EXTRACAO, promptExtracao, validar, type TipoDado, type Validacao } from "@/lib/analise-estruturada/esquemas";
import { lerOfx } from "@/lib/analise-estruturada/ofx";

// Leitura dos documentos da Análise Estruturada V3 (MELHORIA DA CONSULTA, entrega 2).
// Cada arquivo gera um resultado em analise-estruturada/<pedido>/_dados/<item>/<arquivo>.json
// com os dados extraídos, as checagens automáticas e, quando a Mesa corrige, quem corrigiu.

export const MODELO_EXTRACAO = "claude-sonnet-4-6";

export interface ResultadoLeitura {
  versao: 1;
  item: string;
  tipo: TipoDado;
  caminho: string;
  arquivo: string;
  status: "lido" | "erro" | "nao_suportado";
  origem: "ofx" | "ia" | null;
  lido_em: string;
  modelo: string | null;
  dados: Record<string, unknown> | null;
  validacoes: Validacao[];
  erro: string | null;
  revisado_por: string | null;
  revisado_em: string | null;
}

/** analise-estruturada/<pedido>/<item>/<arquivo> → analise-estruturada/<pedido>/_dados/<item>/<arquivo>.json */
export function caminhoResultado(orderId: string, caminhoArquivo: string): string {
  const relativo = caminhoArquivo.slice(pastaDoPedido(orderId).length + 1);
  return `${pastaDoPedido(orderId)}/_dados/${relativo}.json`;
}

export function caminhoPertenceAoPedido(orderId: string, caminho: string): boolean {
  const rel = caminho.startsWith(`${pastaDoPedido(orderId)}/`) ? caminho.slice(pastaDoPedido(orderId).length + 1) : null;
  return !!rel && !rel.startsWith("_") && !rel.includes("..") && rel.split("/").length === 2;
}

function jsonDaResposta(texto: string): Record<string, unknown> {
  const limpo = texto.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const ini = limpo.indexOf("{"), fim = limpo.lastIndexOf("}");
  return JSON.parse(ini >= 0 && fim > ini ? limpo.slice(ini, fim + 1) : limpo) as Record<string, unknown>;
}

async function chamarIa(conteudo: Array<Record<string, unknown>>): Promise<Record<string, unknown>> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const anthropic = new Anthropic({ apiKey: chaveIaMesas() });
  const resp = await anthropic.messages.create({
    model: MODELO_EXTRACAO,
    max_tokens: 16000,
    system: SYSTEM_EXTRACAO,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: [{ role: "user", content: conteudo as any }],
  });
  const texto = resp.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
  return jsonDaResposta(texto);
}

async function lerPlanilha(buffer: Buffer): Promise<string> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "buffer" });
  return wb.SheetNames.slice(0, 10).map((nome) => `### Aba: ${nome}\n${XLSX.utils.sheet_to_csv(wb.Sheets[nome])}`).join("\n\n").slice(0, 400_000);
}

async function lerWord(buffer: Buffer): Promise<string> {
  const mammoth = (await import("mammoth")).default;
  const { value } = await mammoth.extractRawText({ buffer });
  return value.slice(0, 400_000);
}

const MIME_IMAGEM: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };

/**
 * Extrai os dados de um arquivo já baixado, pelo esquema do tipo (OFX de extrato sem IA; o resto
 * pela IA). Devolve `{ naoSuportado }` quando o formato não é lido automaticamente. Lança em falha.
 * Usada pela leitura do pedido (abaixo) e pelo raio-X de extrato da proposta (lib/raio-x-extrato.ts).
 */
export async function extrairDadosDoArquivo(buffer: Buffer, arquivo: string, tipo: TipoDado, rotulo: string):
  Promise<{ dados: Record<string, unknown>; origem: "ofx" | "ia" } | { naoSuportado: string }> {
  const ext = extensaoDe(arquivo);
  if (ext === "ofx" && tipo === "extrato") return { dados: lerOfx(buffer.toString("latin1")), origem: "ofx" };
  const prompt = promptExtracao(tipo, rotulo, arquivo);
  let conteudo: Array<Record<string, unknown>>;
  if (ext === "pdf") {
    conteudo = [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") } }, { type: "text", text: prompt }];
  } else if (MIME_IMAGEM[ext]) {
    conteudo = [{ type: "image", source: { type: "base64", media_type: MIME_IMAGEM[ext], data: buffer.toString("base64") } }, { type: "text", text: prompt }];
  } else if (ext === "xlsx" || ext === "xls") {
    conteudo = [{ type: "text", text: `Conteúdo da planilha (CSV por aba):\n\n${await lerPlanilha(buffer)}\n\n${prompt}` }];
  } else if (ext === "docx" || ext === "doc") {
    conteudo = [{ type: "text", text: `Texto do documento:\n\n${await lerWord(buffer)}\n\n${prompt}` }];
  } else if (ext === "csv" || ext === "txt" || ext === "xml" || ext === "ofx") {
    conteudo = [{ type: "text", text: `Conteúdo do arquivo:\n\n${buffer.toString("utf8").slice(0, 400_000)}\n\n${prompt}` }];
  } else {
    return { naoSuportado: `Formato .${ext} não é lido automaticamente; a Mesa confere manualmente.` };
  }
  return { dados: await chamarIa(conteudo), origem: "ia" };
}

/** Lê um arquivo do pedido, valida e grava o resultado. Nunca lança: erro vira status "erro". */
export async function lerArquivo(db: SupabaseClient, pedido: PedidoAnalise, caminho: string): Promise<ResultadoLeitura> {
  const [, item, nomeNoStorage] = caminho.slice(pastaDoPedido(pedido.id).length).split("/");
  const tipo = TIPO_POR_ITEM[item] ?? "generico";
  const rotulo = itemDoPerfil(perfilPeloDocumento(pedido.client_doc), item)?.label ?? item;
  const arquivo = nomeNoStorage.replace(/^\d+_/, "");
  const base: ResultadoLeitura = {
    versao: 1, item, tipo, caminho, arquivo, status: "erro", origem: null, lido_em: new Date().toISOString(),
    modelo: null, dados: null, validacoes: [], erro: null, revisado_por: null, revisado_em: null,
  };

  let resultado: ResultadoLeitura;
  try {
    const { data: blob, error } = await db.storage.from(BUCKET_ANALISE).download(caminho);
    if (error || !blob) throw new Error("Arquivo não encontrado no storage.");
    const buffer = Buffer.from(await blob.arrayBuffer());

    const lido = await extrairDadosDoArquivo(buffer, arquivo, tipo, rotulo);
    if ("naoSuportado" in lido) {
      resultado = { ...base, status: "nao_suportado", erro: lido.naoSuportado };
      await salvar(db, pedido.id, resultado);
      return resultado;
    }
    const { dados, origem } = lido;
    resultado = { ...base, status: "lido", origem, modelo: origem === "ia" ? MODELO_EXTRACAO : null, dados, validacoes: validar(tipo, dados) };
  } catch (e) {
    resultado = { ...base, status: "erro", erro: e instanceof Error ? e.message.slice(0, 500) : "Falha na leitura." };
  }
  await salvar(db, pedido.id, resultado);
  return resultado;
}

async function salvar(db: SupabaseClient, orderId: string, r: ResultadoLeitura) {
  await db.storage.from(BUCKET_ANALISE).upload(
    caminhoResultado(orderId, r.caminho),
    new Blob([JSON.stringify(r)], { type: "application/json" }),
    { contentType: "application/json", upsert: true },
  );
}

export async function carregarResultado(db: SupabaseClient, orderId: string, caminho: string): Promise<ResultadoLeitura | null> {
  const { data } = await db.storage.from(BUCKET_ANALISE).download(caminhoResultado(orderId, caminho));
  if (!data) return null;
  try { return JSON.parse(await data.text()) as ResultadoLeitura; } catch { return null; }
}

/** Correção da Mesa: grava os dados ajustados, refaz as checagens e registra quem revisou. */
export async function salvarRevisao(
  db: SupabaseClient, orderId: string, caminho: string, dados: Record<string, unknown>, revisor: string,
): Promise<ResultadoLeitura | null> {
  const atual = await carregarResultado(db, orderId, caminho);
  if (!atual) return null;
  const revisado: ResultadoLeitura = {
    ...atual, status: "lido", dados, validacoes: validar(atual.tipo, dados), erro: null,
    revisado_por: revisor, revisado_em: new Date().toISOString(),
  };
  await salvar(db, orderId, revisado);
  return revisado;
}
