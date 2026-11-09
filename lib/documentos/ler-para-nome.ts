/**
 * LEITURA DE UM ANEXO PARA GERAR O NOME (BRIEF 09/11/2026: docs/briefs/2026-11-09_nomear-documentos-propostas.md)
 *
 * Só no servidor (service role). Baixa o arquivo, manda SÓ A PRIMEIRA PÁGINA do PDF ao Claude (inline, base64,
 * sem Files API: nada fica armazenado na Anthropic como arquivo) e, só se a confiança vier abaixo de 0,7 e o
 * PDF tiver mais páginas, faz UMA segunda leitura com as 3 primeiras. Imagem vai inteira (é uma página só).
 * Modelo de menor custo (decisão do Hamilton): Claude Haiku 5.5, effort low, sem pensamento, JSON estruturado.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveBucket } from "@/lib/documentos/bucket";
import { CONFIANCA_MINIMA, TIPOS_DOCUMENTO, type LeituraDocumento } from "@/lib/documentos/nome-arquivo";

export const MODELO_NOMEAR = "claude-haiku-5-5";
const TAMANHO_MAX = 20 * 1024 * 1024;   // acima disso: ignorado
const IMAGEM_MAX = 5 * 1024 * 1024;     // limite de imagem base64 da API
const PDF_SEM_CORTE_MAX = 5 * 1024 * 1024; // PDF que o pdf-lib não abre: só vai inteiro até 5 MB

const IMAGENS: Record<string, "image/jpeg" | "image/png" | "image/gif" | "image/webp"> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
};

export type ResultadoLeitura =
  | { status: "ok" | "sem_leitura"; leitura: LeituraDocumento; modelo: string; uso: { entrada: number; saida: number; chamadas: number } }
  | { status: "ignorado"; motivo: string }
  | { status: "erro"; motivo: string };

const SYSTEM = `Você identifica documentos brasileiros anexados a propostas de crédito, para dar nome ao arquivo.
Responda só com o JSON pedido. Regras:
- "tipo": escolha exatamente um da lista. Se nenhum servir, "Outro".
- "periodo": o ano de referência que o documento declara ("2026"), ou dois anos quando ele cobre os dois ("2025-2026"). Faturamento, DRE, balanço, balancete e extrato: o ano da competência. Imposto de Renda e recibo do IR: o EXERCÍCIO (ano da entrega; "IRPF 2025" = exercício 2025, ano-calendário 2024). Documento sem ano de referência (RG, CNH, contrato social etc.): null. Nunca use a data de emissão como período.
- "titular": o nome da pessoa ou empresa a quem o documento pertence, como está escrito, com maiúsculas e minúsculas normais (não tudo em caixa alta). Sem CPF, CNPJ ou números. Se não estiver legível: null.
- "confianca": de 0 a 1, o quanto você tem certeza do tipo e do período.
Nunca invente dado que não está no documento.`;

const SCHEMA = {
  type: "object",
  properties: {
    tipo: { type: "string", enum: [...TIPOS_DOCUMENTO] },
    periodo: { type: ["string", "null"] },
    titular: { type: ["string", "null"] },
    confianca: { type: "number" },
  },
  required: ["tipo", "periodo", "titular", "confianca"],
  additionalProperties: false,
} as const;

function extensao(path: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(path);
  return m ? m[1].toLowerCase() : "";
}

/** Recorta as `n` primeiras páginas. Devolve null se o pdf-lib não abrir; "senha" se protegido. */
async function recortarPdf(bytes: Uint8Array, n: number): Promise<{ pdf: Uint8Array; total: number } | null | "senha"> {
  const { PDFDocument, EncryptedPDFError } = await import("pdf-lib");
  try {
    const src = await PDFDocument.load(bytes, { updateMetadata: false });
    const total = src.getPageCount();
    if (total <= n) return { pdf: bytes, total };
    const out = await PDFDocument.create();
    const paginas = await out.copyPages(src, Array.from({ length: n }, (_, i) => i));
    paginas.forEach((p) => out.addPage(p));
    return { pdf: await out.save(), total };
  } catch (e) {
    if (e instanceof EncryptedPDFError) return "senha";
    return null;
  }
}

async function chamarClaude(bloco: Record<string, unknown>): Promise<{ leitura: LeituraDocumento; entrada: number; saida: number } | null> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const resp = await anthropic.messages.create({
    model: MODELO_NOMEAR,
    max_tokens: 300,
    system: SYSTEM,
    thinking: { type: "disabled" },
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> } },
    messages: [{
      role: "user",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      content: [bloco, { type: "text", text: "Identifique este documento." }] as any,
    }],
  });
  const entrada = resp.usage?.input_tokens ?? 0;
  const saida = resp.usage?.output_tokens ?? 0;
  if (resp.stop_reason === "refusal" || resp.stop_reason === "max_tokens") return { leitura: { tipo: null, periodo: null, titular: null, confianca: 0 }, entrada, saida };
  const texto = resp.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
  try {
    const j = JSON.parse(texto) as Record<string, unknown>;
    return {
      leitura: {
        tipo: typeof j.tipo === "string" ? j.tipo : null,
        periodo: typeof j.periodo === "string" ? j.periodo : null,
        titular: typeof j.titular === "string" ? j.titular : null,
        confianca: typeof j.confianca === "number" ? Math.max(0, Math.min(1, j.confianca)) : 0,
      },
      entrada, saida,
    };
  } catch {
    return null;
  }
}

function blocoPdf(pdf: Uint8Array) {
  return { type: "document", source: { type: "base64", media_type: "application/pdf", data: Buffer.from(pdf).toString("base64") } };
}

export async function lerDocumentoParaNome(
  svc: SupabaseClient,
  doc: { storage_path: string; bucket?: string },
): Promise<ResultadoLeitura> {
  const ext = extensao(doc.storage_path);
  const ehPdf = ext === "pdf";
  const tipoImagem = IMAGENS[ext];
  if (!ehPdf && !tipoImagem) return { status: "ignorado", motivo: `extensão não lida: ${ext || "sem extensão"}` };

  const { data, error } = await svc.storage.from(resolveBucket(doc)).download(doc.storage_path);
  if (error || !data) return { status: "erro", motivo: "falha ao baixar o arquivo" };
  if (data.size > TAMANHO_MAX) return { status: "ignorado", motivo: "arquivo maior que 20 MB" };
  const bytes = new Uint8Array(await data.arrayBuffer());

  try {
    if (tipoImagem) {
      if (bytes.length > IMAGEM_MAX) return { status: "ignorado", motivo: "imagem maior que 5 MB" };
      const r = await chamarClaude({ type: "image", source: { type: "base64", media_type: tipoImagem, data: Buffer.from(bytes).toString("base64") } });
      if (!r) return { status: "erro", motivo: "resposta sem JSON" };
      const ok = (r.leitura.confianca ?? 0) >= CONFIANCA_MINIMA;
      return { status: ok ? "ok" : "sem_leitura", leitura: r.leitura, modelo: MODELO_NOMEAR, uso: { entrada: r.entrada, saida: r.saida, chamadas: 1 } };
    }

    const primeira = await recortarPdf(bytes, 1);
    if (primeira === "senha") return { status: "ignorado", motivo: "PDF protegido por senha" };
    if (primeira === null) {
      // PDF que o pdf-lib não abre (corrompido ou fora do padrão): vai inteiro só se for pequeno.
      if (bytes.length > PDF_SEM_CORTE_MAX) return { status: "ignorado", motivo: "PDF não recortável e maior que 5 MB" };
      const r = await chamarClaude(blocoPdf(bytes));
      if (!r) return { status: "erro", motivo: "resposta sem JSON" };
      const ok = (r.leitura.confianca ?? 0) >= CONFIANCA_MINIMA;
      return { status: ok ? "ok" : "sem_leitura", leitura: r.leitura, modelo: MODELO_NOMEAR, uso: { entrada: r.entrada, saida: r.saida, chamadas: 1 } };
    }

    const r1 = await chamarClaude(blocoPdf(primeira.pdf));
    if (!r1) return { status: "erro", motivo: "resposta sem JSON" };
    if ((r1.leitura.confianca ?? 0) >= CONFIANCA_MINIMA || primeira.total <= 1) {
      const ok = (r1.leitura.confianca ?? 0) >= CONFIANCA_MINIMA;
      return { status: ok ? "ok" : "sem_leitura", leitura: r1.leitura, modelo: MODELO_NOMEAR, uso: { entrada: r1.entrada, saida: r1.saida, chamadas: 1 } };
    }

    // Segunda leitura (3 primeiras páginas). Se falhar, fica o resultado da primeira como sem_leitura.
    try {
      const tres = await recortarPdf(bytes, 3);
      const r2 = tres && tres !== "senha" ? await chamarClaude(blocoPdf(tres.pdf)) : null;
      if (!r2) return { status: "sem_leitura", leitura: r1.leitura, modelo: MODELO_NOMEAR, uso: { entrada: r1.entrada, saida: r1.saida, chamadas: 2 } };
      const ok = (r2.leitura.confianca ?? 0) >= CONFIANCA_MINIMA;
      return { status: ok ? "ok" : "sem_leitura", leitura: r2.leitura, modelo: MODELO_NOMEAR, uso: { entrada: r1.entrada + r2.entrada, saida: r1.saida + r2.saida, chamadas: 2 } };
    } catch {
      return { status: "sem_leitura", leitura: r1.leitura, modelo: MODELO_NOMEAR, uso: { entrada: r1.entrada, saida: r1.saida, chamadas: 2 } };
    }
  } catch (e) {
    return { status: "erro", motivo: e instanceof Error ? e.message.slice(0, 200) : "falha na leitura" };
  }
}
