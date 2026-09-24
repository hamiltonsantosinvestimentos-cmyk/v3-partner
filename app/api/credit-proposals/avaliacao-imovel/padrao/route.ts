import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { atualizarMetadata } from "@/lib/credit-proposal-meta";

export const maxDuration = 120;

// POST /api/credit-proposals/avaliacao-imovel/padrao
// Classifica o PADRÃO CONSTRUTIVO do imóvel em garantia (baixo / médio / alto) a partir das
// fotos internas e externas anexadas nos documentos da proposta (23/09/2026, pedido do
// Hamilton). O padrão define qual R$/m² dos comparáveis a avaliação usa: baixo = menor,
// médio = média, alto = maior (ver valorPorPadrao no modal). O resultado fica gravado em
// metadata.imoveis[idx].padrao_construtivo, com os arquivos analisados, pra não refazer à toa.

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
const DEFAULT_BUCKET = "credit-documents";
const GOVERNED_BUCKET = "v3-docs-publico";
const MAX_FOTOS_POR_TIPO = 6;
const MAX_BYTES = 8 * 1024 * 1024;

type DocEntry = { doc_id: string; file_name: string; storage_path: string; bucket?: string };

function resolveBucket(doc: { storage_path?: string; bucket?: string }): string {
  if (doc.bucket) return doc.bucket;
  if (doc.storage_path?.startsWith("Credito/") || doc.storage_path?.startsWith("MA/") || doc.storage_path?.startsWith("Administracao/")) return GOVERNED_BUCKET;
  return DEFAULT_BUCKET;
}

function mimeDe(nome: string): string | null {
  const ext = nome.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "pdf") return "application/pdf";
  return null;
}

export interface PadraoConstrutivo {
  padrao: "BAIXO" | "MEDIO" | "ALTO";
  confianca: "ALTA" | "MEDIA" | "BAIXA";
  justificativa: string;
  conservacao: string | null;
  observacoes: string | null;
  fotos_internas: number;
  fotos_externas: number;
  /** storage_path dos arquivos analisados — o modal só reanalisa se esse conjunto mudar. */
  arquivos: string[];
  analisado_em: string;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes(profile?.role ?? "")) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada no servidor" }, { status: 500 });

  const body = (await req.json().catch(() => ({}))) as {
    proposal_id?: string;
    imovel_idx?: number;
    /** doc_ids do checklist cujo rótulo é "fotos internas" / "fotos externas" (o modal resolve pelo rótulo). */
    docs_internas?: string[];
    docs_externas?: string[];
  };
  const idx = Number(body.imovel_idx ?? 0);
  if (!body.proposal_id || !Number.isInteger(idx) || idx < 0) {
    return NextResponse.json({ error: "proposal_id e imovel_idx obrigatórios" }, { status: 400 });
  }

  const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: proposal } = await db
    .from("credit_desk_proposals")
    .select("id, documents, metadata, imovel_endereco, imovel_cidade, imovel_estado")
    .eq("id", body.proposal_id)
    .single();
  if (!proposal) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });

  const docs = (Array.isArray(proposal.documents) ? proposal.documents : []) as DocEntry[];
  const selecionar = (ids: string[] | undefined) =>
    docs.filter((d) => (ids ?? []).includes(d.doc_id) && mimeDe(d.file_name || d.storage_path)).slice(0, MAX_FOTOS_POR_TIPO);
  const internas = selecionar(body.docs_internas);
  const externas = selecionar(body.docs_externas);
  if (internas.length + externas.length === 0) {
    return NextResponse.json({ error: "Nenhuma foto interna ou externa do imóvel anexada nos documentos." }, { status: 422 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocos: any[] = [];
  const baixar = async (d: DocEntry, tipo: "interna" | "externa") => {
    const { data } = await db.storage.from(resolveBucket(d)).download(d.storage_path);
    if (!data) return false;
    const buf = Buffer.from(await data.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) return false;
    const mime = mimeDe(d.file_name || d.storage_path)!;
    blocos.push({ type: "text", text: `Foto ${tipo} do imóvel (${d.file_name}):` });
    blocos.push(
      mime === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: mime, data: buf.toString("base64") } }
        : { type: "image", source: { type: "base64", media_type: mime, data: buf.toString("base64") } }
    );
    return true;
  };
  let nInternas = 0;
  let nExternas = 0;
  for (const d of internas) if (await baixar(d, "interna")) nInternas++;
  for (const d of externas) if (await baixar(d, "externa")) nExternas++;
  if (nInternas + nExternas === 0) {
    return NextResponse.json({ error: "Não foi possível ler as fotos anexadas (formato ou tamanho)." }, { status: 422 });
  }

  const prompt = `Você é avaliador de imóveis (padrão NBR 12721 / prática de mercado) da V3 Partners, analisando um imóvel dado em garantia de crédito.
Com base APENAS nas fotos acima (internas e externas), classifique o PADRÃO CONSTRUTIVO:
- BAIXO: acabamentos simples ou populares (piso cerâmico comum, esquadrias simples, pouca ou nenhuma área de lazer, construção econômica, sinais de autoconstrução).
- MEDIO: acabamentos intermediários (porcelanato ou laminado, armários planejados simples, fachada com algum tratamento, condomínio com estrutura básica).
- ALTO: acabamentos superiores (pedras naturais, marcenaria de alto padrão, pé-direito alto, automação, fachada/paisagismo elaborados, área de lazer completa).
Avalie também o estado de conservação. Não invente o que não aparece nas fotos; se as fotos forem poucas ou ruins, diga isso e reduza a confiança.

Responda SOMENTE com JSON válido, sem markdown:
{"padrao":"BAIXO|MEDIO|ALTO","confianca":"ALTA|MEDIA|BAIXA","justificativa":"2-3 frases citando o que foi visto","conservacao":"ex: bom, regular, precisa de reforma","observacoes":"limitações das fotos ou pontos de atenção"}`;

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      messages: [{ role: "user", content: [...blocos, { type: "text", text: prompt }] }],
    });
    const texto = msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    const ini = texto.indexOf("{");
    const fim = texto.lastIndexOf("}");
    if (ini === -1 || fim <= ini) throw new Error("A IA não devolveu a classificação. Tente novamente.");
    const p = JSON.parse(texto.slice(ini, fim + 1)) as Partial<PadraoConstrutivo>;
    const padrao = (["BAIXO", "MEDIO", "ALTO"] as const).find((x) => x === String(p.padrao ?? "").toUpperCase().replace("É", "E"));
    if (!padrao) throw new Error("Classificação de padrão inválida. Tente novamente.");

    const resultado: PadraoConstrutivo = {
      padrao,
      confianca: (["ALTA", "MEDIA", "BAIXA"] as const).find((x) => x === p.confianca) ?? "MEDIA",
      justificativa: String(p.justificativa ?? ""),
      conservacao: p.conservacao ? String(p.conservacao) : null,
      observacoes: p.observacoes ? String(p.observacoes) : null,
      fotos_internas: nInternas,
      fotos_externas: nExternas,
      arquivos: [...internas, ...externas].map((d) => d.storage_path).sort(),
      analisado_em: new Date().toISOString(),
    };

    const salvo = await atualizarMetadata(db, proposal.id, (meta) => {
      let imoveis = Array.isArray(meta.imoveis) ? [...(meta.imoveis as Record<string, unknown>[])] : [];
      // Proposta antiga sem metadata.imoveis: parte do imóvel das colunas legadas (igual ao modal).
      if (imoveis.length === 0) {
        imoveis = [{ endereco: proposal.imovel_endereco ?? undefined, cidade: proposal.imovel_cidade ?? undefined, estado: proposal.imovel_estado ?? undefined }];
      }
      while (imoveis.length <= idx) imoveis.push({});
      imoveis[idx] = { ...imoveis[idx], padrao_construtivo: resultado };
      return { ...meta, imoveis };
    });
    if (!salvo.ok) return NextResponse.json({ error: `Classificado, mas não foi gravado: ${salvo.error}` }, { status: 500 });
    return NextResponse.json({ padrao_construtivo: resultado, metadata: salvo.metadata });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Erro ao analisar as fotos" }, { status: 502 });
  }
}
