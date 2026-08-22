import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { auditText } from "@/lib/brand-guardian-gate";

// POST /api/cm/forja/compile-thesis — Forja Jurídico, Etapa 7 (21/08/2026).
// Compila cadastro + documentos (OCR/transcrição) + due diligence (Escavador)
// de um ativo da Bolsa de Ativos num Parecer Preliminar Executivo INTERNO
// (nunca anônimo, nunca exposto na vitrine — ver public_narrative para o
// equivalente externo em app/api/cm/listings/[id]/narrative/route.ts, que
// é um domínio de dado completamente separado, não confundir).

export const maxDuration = 60;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getCaller(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile || !["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

// Corta cada fonte num tamanho razoável antes de entrar no prompt — nunca
// deixar o input crescer sem limite (risco real de timeout Vercel 60s
// documentado no BRIEF). 15 documentos e 3 achados de due diligence cobrem
// qualquer caso real hoje (o ativo com mais documentos na Mesa tem 11).
const MAX_DOCS = 15;
const MAX_CHARS_PER_DOC = 1200;
const MAX_DD_RECORDS = 3;

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}… (truncado)` : s;
}

export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ error: "Apenas ADMIN/GESTAO/MESA_OPERACIONAL" }, { status: 403 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const listingId = body.listing_id as string | undefined;
  if (!listingId) return NextResponse.json({ error: "Campo obrigatório: listing_id" }, { status: 422 });

  const db = svc();

  const { data: listing } = await db
    .from("cm_asset_listings")
    .select(`
      id, anonymous_id, apelido, asset_type, seller_name, seller_cpf_cnpj,
      ente_devedor, esfera, tribunal, natureza, numero_processo,
      valor_face, valor_atualizado, desagio_pretendido, tir_estimada, vpl,
      prazo_estimado_meses, risk_score, risk_details,
      uf_ente_devedor, municipio_ente_devedor, listing_status
    `)
    .eq("id", listingId)
    .single();

  if (!listing) return NextResponse.json({ error: "Ativo não encontrado" }, { status: 404 });

  const { data: docs } = await db
    .from("cm_listing_documents")
    .select("document_type, ocr_result, validation_status, original_filename, created_at")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false })
    .limit(MAX_DOCS);

  const { data: ddRecords } = await db
    .from("cm_due_diligence_records")
    .select("tool, query_type, query_value, result, created_at")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false })
    .limit(MAX_DD_RECORDS);

  // ocr_result tem duas formas reais possíveis, confirmadas no schema:
  //   { transcription, model, language, processed_at } — áudio (W-CM-Audio-Intake)
  //   { dados_extraidos, confiabilidade } — OCR de documento (W9)
  // Nunca inventar uma terceira, nunca assumir sem checar qual das duas é.
  const docsSummary = (docs ?? []).map((d) => {
    const ocr = d.ocr_result as Record<string, unknown> | null;
    let extracted = "Sem dado extraído (documento pendente de processamento).";
    if (ocr && typeof ocr === "object") {
      if (typeof ocr.transcription === "string") {
        extracted = `Transcrição de áudio: ${truncate(ocr.transcription, MAX_CHARS_PER_DOC)}`;
      } else if (ocr.dados_extraidos) {
        extracted = truncate(JSON.stringify(ocr.dados_extraidos), MAX_CHARS_PER_DOC);
      }
    }
    return `- [${d.document_type}] ${d.original_filename ?? "sem nome"} (status: ${d.validation_status ?? "n/d"})\n  ${extracted}`;
  }).join("\n\n");

  const ddSummary = (ddRecords ?? []).map((r) => {
    const result = truncate(JSON.stringify(r.result ?? {}), MAX_CHARS_PER_DOC);
    return `- [${r.tool} · ${r.query_type}] consulta "${r.query_value}": ${result}`;
  }).join("\n\n");

  const valor = listing.valor_face
    ? `R$ ${Number(listing.valor_face).toLocaleString("pt-BR")}`
    : "não informado";

  const prompt = `Você é um analista jurídico sênior da V3 Partners, escrevendo um PARECER PRELIMINAR EXECUTIVO ` +
    `interno sobre um ativo da Bolsa de Ativos, para uso exclusivo da Mesa e da Governança (Dr. Luís Athaydes). ` +
    `Este texto NUNCA é anônimo e NUNCA vai para a vitrine pública de compradores — cite nomes e dados reais ` +
    `livremente. NUNCA invente dado que não esteja nas fontes abaixo — se uma informação não está disponível, ` +
    `escreva explicitamente "não disponível nas fontes analisadas", nunca preencha com suposição.\n\n` +
    `── CADASTRO DO ATIVO ──\n` +
    `Código: ${listing.anonymous_id}${listing.apelido ? ` (${listing.apelido})` : ""}\n` +
    `Tipo: ${listing.asset_type}${listing.natureza ? ` · ${listing.natureza}` : ""}\n` +
    `Titular/Vendedor: ${listing.seller_name ?? "não informado"}${listing.seller_cpf_cnpj ? ` (${listing.seller_cpf_cnpj})` : ""}\n` +
    `Ente Devedor: ${listing.ente_devedor ?? "não informado"}${listing.uf_ente_devedor ? ` · ${listing.uf_ente_devedor}` : ""}${listing.municipio_ente_devedor ? `/${listing.municipio_ente_devedor}` : ""}\n` +
    `Esfera: ${listing.esfera ?? "não informada"} · Tribunal: ${listing.tribunal ?? "não informado"} · Processo: ${listing.numero_processo ?? "não informado"}\n` +
    `Valor de Face: ${valor}${listing.desagio_pretendido ? ` · Deságio pretendido: ${listing.desagio_pretendido}%` : ""}\n` +
    `Score V3: ${listing.risk_score ?? "não calculado"}/100\n` +
    `Status na esteira: ${listing.listing_status}\n\n` +
    `── DOCUMENTOS ANALISADOS (${docs?.length ?? 0}) ──\n${docsSummary || "Nenhum documento anexado ainda."}\n\n` +
    `── DUE DILIGENCE / ESCAVADOR (${ddRecords?.length ?? 0} consultas) ──\n${ddSummary || "Nenhuma consulta de due diligence realizada ainda."}\n\n` +
    `Escreva o parecer com estas seções, nesta ordem, em português institucional, direto, SEM travessão ` +
    `(use vírgula, dois-pontos ou ponto), SEM markdown, SEM emojis:\n` +
    `1. RESUMO DO ATIVO (2-3 frases)\n` +
    `2. SITUAÇÃO DOCUMENTAL (o que foi analisado, o que falta)\n` +
    `3. ACHADOS DE DUE DILIGENCE (resuma os achados reais, ou declare ausência de achados se não houver consulta)\n` +
    `4. RISCOS IDENTIFICADOS (liste riscos concretos encontrados nas fontes, nunca genéricos)\n` +
    `5. RECOMENDAÇÃO PRELIMINAR (avançar / avançar com ressalvas / não avançar, com justificativa)\n`;

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let rawThesis: string;
  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });
    rawThesis = (msg.content[0] as { text: string }).text.trim();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: `Falha ao gerar parecer: ${message}` }, { status: 502 });
  }

  const gate = auditText(rawThesis);

  const { data: updated, error } = await db
    .from("cm_asset_listings")
    .update({
      internal_thesis: gate.corrected,
      internal_thesis_generated_at: new Date().toISOString(),
    })
    .eq("id", listingId)
    .select("internal_thesis, internal_thesis_generated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    internal_thesis: updated.internal_thesis,
    internal_thesis_generated_at: updated.internal_thesis_generated_at,
    sources: { documents: docs?.length ?? 0, due_diligence_records: ddRecords?.length ?? 0 },
    brand_gate: { violations_found: gate.violations.length },
  });
}
