import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { stripJsonFences, safeJsonParse } from "@/lib/ma/forja-utils";

export const maxDuration = 60;

const WRITE_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ExtractionField = {
  valor:       string | number | boolean | null;
  confianca:   number;     // 0-100
  evidencia:   string;     // trecho exato do doc que sustenta o valor
  pagina?:     string;     // "p.3", "Seção 2", etc.
};

type Phase1Result = {
  tipo_documento: string;
  dados_extraidos: Record<string, ExtractionField>;
  pendencias:      string[];
  validade:        string | null;
  resumo:          string;
  confiabilidade_geral: number;
};

type Phase2Result = {
  aprovado:          boolean;
  flags:             string[];
  campos_corrigidos: { campo: string; anterior: unknown; corrigido: unknown; motivo: string }[];
  confiabilidade_final: number;
  requer_revisao_humana: boolean;
};

// ─── Prompts calibrados ───────────────────────────────────────────────────────

const PHASE1_SYSTEM = `Você é o EXTRATOR CIRÚRGICO V3 — especialista em leitura de documentos financeiros e jurídicos para M&A.

MISSÃO: Extrair dados com precisão absoluta. Tolerância zero a erros ou invenções.

REGRAS INVIOLÁVEIS:
1. NUNCA invente dados. Se não está no documento: valor = null
2. NUNCA arredonde. Use o valor EXATO conforme aparece no documento
3. Para cada campo extraído, cite o trecho EXATO do documento (evidencia)
4. Valores monetários: sempre em R$ com centavos (ex: 1.234.567,89)
5. Datas: formato YYYY-MM-DD
6. Percentuais: número decimal (15,5% → 15.5)
7. CNPJ: formato XX.XXX.XXX/XXXX-XX

SCORING DE CONFIANÇA POR CAMPO (0-100):
- 95-100: valor explícito, legível, sem ambiguidade, citável diretamente
- 80-94: valor claro mas requer leitura contextual simples
- 60-79: inferido de contexto com alta probabilidade
- 40-59: calculado/derivado de outros campos presentes
- 20-39: estimado com incerteza significativa
- 0-19: especulativo — incluir apenas com flag explícita

CAMPOS CRÍTICOS A EXTRAIR (se presentes):
Financeiro: receita_bruta, receita_liquida, ebitda, ebitda_margin, lucro_liquido, noi, noi_margin,
            despesas_operacionais, capex, divida_liquida, divida_total, caixa, patrimonio_liquido,
            ativo_total, passivo_total, cap_rate, multiplo_ebitda, tir_estimada
Período: ano_referencia, periodo_inicio, periodo_fim, trimestre
Legal: cnpj, razao_social, socios, data_constituicao, objeto_social, capital_social,
       processos_judiciais, certidao_negativa, validade_certidao, irregularidades
Imóvel: area_total_m2, area_construida_m2, matricula, cartorio_ri, inscricao_municipal,
        localizacao, uf, municipio, tipo_imovel, ano_construcao
Operacional: taxa_ocupacao_pct, num_locatarios, receita_por_m2, despesa_por_m2,
             contratos_vigencia, ancoras, vpl, prazo_medio_contratos

Retorne APENAS JSON válido:
{
  "tipo_documento": "DRE" | "Balanco" | "Contrato Social" | "Certidao" | "Laudo" | "NDA" | "Contrato" | "Relatorio" | "Outro",
  "dados_extraidos": {
    "<nome_campo>": {
      "valor": <valor_exato_ou_null>,
      "confianca": <0-100>,
      "evidencia": "<trecho exato do documento>",
      "pagina": "<referência de localização no doc>"
    }
  },
  "pendencias": ["<irregularidade ou dado inconsistente encontrado>"],
  "validade": "<YYYY-MM-DD ou null — para certidões e contratos>",
  "resumo": "<3 frases: tipo do doc, principais dados financeiros/jurídicos, estado geral>",
  "confiabilidade_geral": <média ponderada 0-100>
}`;

const PHASE2_SYSTEM = `Você é o VALIDADOR V3 — auditoria cruzada de dados extraídos de documentos M&A.

MISSÃO: Verificar consistência interna dos dados extraídos. Detectar anomalias, erros de extração e inconsistências matemáticas.

REGRAS DE VALIDAÇÃO:
1. Consistência matemática:
   - EBITDA = Receita Líquida - Despesas Operacionais (tolerância ±5%)
   - Lucro Líquido ≤ EBITDA
   - Ativo Total = Passivo Total + Patrimônio Líquido (tolerância ±2%)
   - Cap Rate = NOI / Valor de Mercado × 100
   - Taxa de ocupação entre 0% e 100%
2. Consistência temporal:
   - Datas de validade devem ser futuras (para certidões ativas)
   - Período início < Período fim
   - Ano de referência coerente com data do documento
3. Formato e integridade:
   - CNPJ: 14 dígitos, formato XX.XXX.XXX/XXXX-XX
   - Valores negativos em Passivo/Dívida são aceitáveis
   - Confiança < 60 em campos críticos = flag obrigatória
4. Red flags automáticos:
   - Receita_bruta < EBITDA → erro aritmético
   - Capital_social = 0 em empresa operacional → suspeito
   - Todos os sócios com 0% de participação → erro
   - Certidão com validade vencida → pendência crítica

Retorne APENAS JSON válido:
{
  "aprovado": <true se dados consistentes, false se há erros graves>,
  "flags": ["<descrição específica do problema encontrado com valores>"],
  "campos_corrigidos": [
    { "campo": "<nome>", "anterior": <valor_extraido>, "corrigido": <valor_correto>, "motivo": "<cálculo ou regra aplicada>" }
  ],
  "confiabilidade_final": <0-100 após validação>,
  "requer_revisao_humana": <true se confiabilidade_final < 70 ou flags críticas>
}`;

// ─── GET: lista extrações de um deal ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  const svc = serviceClient();

  const cronSecret = req.headers.get("x-cron-secret");
  const isCronCall  = cronSecret && cronSecret === process.env.CRON_SECRET;

  if (!isCronCall) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single();
    if (!WRITE_ROLES.includes(profile?.role as typeof WRITE_ROLES[number])) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
  }

  const { searchParams } = new URL(req.url);
  const dealId = searchParams.get("deal_id");
  if (!dealId) return NextResponse.json({ error: "deal_id é obrigatório" }, { status: 400 });

  const { data, error } = await svc
    .from("ma_document_extractions")
    .select(`
      id, doc_id, doc_name, tipo_documento, confiabilidade,
      dados_extraidos, campos_baixa_confianca, pendencias,
      status, resumo, confirmed_at, confirmed_by, extracted_at
    `)
    .eq("deal_id", dealId)
    .in("status", ["done", "needs_review", "confirmed"])
    .order("extracted_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ extractions: data ?? [] });
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const svc = serviceClient();

  // Suporta dois modos de autenticação:
  // 1. Cookie (browser/UI) — fluxo padrão da Mesa
  // 2. x-cron-secret header — chamadas server-to-server do n8n (W9)
  const cronSecret = req.headers.get("x-cron-secret");
  const isCronCall  = cronSecret && cronSecret === process.env.CRON_SECRET;

  let extractedById: string;

  if (isCronCall) {
    // Usa o ID do sistema (primeiro ADMIN do projeto) como extracted_by
    const { data: adminProfile } = await svc
      .from("profiles").select("id").eq("role", "ADMIN").limit(1).single();
    extractedById = adminProfile?.id ?? "00000000-0000-0000-0000-000000000000";
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single();
    if (!WRITE_ROLES.includes(profile?.role as typeof WRITE_ROLES[number])) {
      return NextResponse.json({ error: "Apenas a Mesa pode extrair documentos" }, { status: 403 });
    }
    extractedById = user.id;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada" }, { status: 500 });
  }

  const body = await req.json() as { deal_id: string; doc_id: string; batch_id?: string };
  const { deal_id, doc_id, batch_id } = body;

  if (!deal_id || !doc_id) {
    return NextResponse.json({ error: "deal_id e doc_id são obrigatórios" }, { status: 400 });
  }

  // Marca extração como em processamento (evita corrida se chamado em paralelo)
  const { data: extraction, error: insertErr } = await svc
    .from("ma_document_extractions")
    .insert({
      deal_id, doc_id, doc_name: "", storage_path: "",
      status: "processing", extracted_by: extractedById,
      batch_id: batch_id ?? null,
    })
    .select("id")
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  const extractionId = extraction.id;

  try {
    // Busca metadados do documento no deal
    const { data: deal } = await svc
      .from("ma_deals")
      .select("documents")
      .eq("id", deal_id)
      .single();

    if (!deal) throw new Error("Deal não encontrado");

    type DocEntry = { doc_id: string; file_name: string; storage_path: string };
    const docs: DocEntry[] = Array.isArray(deal.documents) ? deal.documents : [];
    const doc = docs.find(d => d.doc_id === doc_id);
    if (!doc) throw new Error("Documento não encontrado no deal");

    // Atualiza nome e path agora que temos os metadados
    await svc.from("ma_document_extractions")
      .update({ doc_name: doc.file_name, storage_path: doc.storage_path })
      .eq("id", extractionId);

    // Download do arquivo
    const { data: fileData, error: downloadErr } = await svc.storage
      .from("ma-documents")
      .download(doc.storage_path);

    if (downloadErr || !fileData) throw new Error(`Download falhou: ${downloadErr?.message ?? "arquivo não encontrado"}`);

    const buf = await fileData.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");

    const lower = doc.file_name.toLowerCase();
    const mediaType =
      lower.endsWith(".pdf")               ? "application/pdf" :
      lower.endsWith(".png")               ? "image/png" :
      lower.endsWith(".jpg") || lower.endsWith(".jpeg") ? "image/jpeg" :
      "application/pdf";

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docBlock: any = mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 }, title: doc.file_name }
      : { type: "image",    source: { type: "base64", media_type: mediaType, data: base64 } };

    // ── FASE 1: Extração primária (Sonnet) ────────────────────────────────────
    const phase1Msg = await client.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 5000,
      system:     PHASE1_SYSTEM,
      messages: [{
        role: "user",
        content: [
          docBlock,
          { type: "text", text: `Extraia todos os dados M&A do documento: "${doc.file_name}"\n\nPense passo a passo: identifique o tipo do documento, depois extraia cada campo crítico com sua evidência exata.` },
        ],
      }],
    });

    if (phase1Msg.stop_reason === "max_tokens") throw new Error("Documento muito denso — tente com um extrato menor");

    const phase1Content = phase1Msg.content[0];
    if (phase1Content.type !== "text") throw new Error("Resposta inesperada da IA na Fase 1");

    let phase1: Phase1Result | null = safeJsonParse<Phase1Result>(stripJsonFences(phase1Content.text));

    // Fallback: se JSON inválido, tenta extração simplificada
    if (!phase1) {
      const fallbackMsg = await client.messages.create({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: `O seguinte texto foi extraído de um documento M&A. Converta para JSON válido com campos: tipo_documento, dados_extraidos, pendencias, resumo, confiabilidade_geral.\n\nTexto:\n${phase1Content.text.slice(0, 3000)}\n\nRetorne APENAS JSON válido.`,
        }],
      });
      phase1 = safeJsonParse<Phase1Result>(stripJsonFences((fallbackMsg.content[0] as { text: string }).text));
      if (!phase1) throw new Error("Falha no parse JSON mesmo após fallback");
    }

    // ── FASE 2: Validação cruzada (Haiku) ─────────────────────────────────────
    const validationSummary = JSON.stringify({
      tipo:       phase1.tipo_documento,
      campos:     Object.fromEntries(
        Object.entries(phase1.dados_extraidos).map(([k, v]) => [k, { valor: v.valor, confianca: v.confianca }])
      ),
      pendencias: phase1.pendencias,
    });

    const phase2Msg = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system:     PHASE2_SYSTEM,
      messages: [{
        role: "user",
        content: `Valide a extração abaixo do documento "${doc.file_name}":\n\n${validationSummary}`,
      }],
    });

    const phase2: Phase2Result = safeJsonParse<Phase2Result>(
      stripJsonFences((phase2Msg.content[0] as { text: string }).text)
    ) ?? { aprovado: true, flags: [], campos_corrigidos: [], confiabilidade_final: phase1.confiabilidade_geral, requer_revisao_humana: false };

    // Aplica correções da Fase 2 nos dados extraídos
    for (const correcao of phase2.campos_corrigidos) {
      if (phase1.dados_extraidos[correcao.campo]) {
        phase1.dados_extraidos[correcao.campo] = {
          ...phase1.dados_extraidos[correcao.campo],
          valor: correcao.corrigido as string | number | boolean | null,
          confianca: Math.min(phase1.dados_extraidos[correcao.campo].confianca, 85),
          evidencia: `[CORRIGIDO] ${phase1.dados_extraidos[correcao.campo].evidencia} → ${correcao.motivo}`,
        };
      }
    }

    // Flatten: dados_extraidos → objeto simples { campo: valor } para o JSONB principal
    const dadosFlat = Object.fromEntries(
      Object.entries(phase1.dados_extraidos).map(([k, v]) => [k, v.valor])
    );

    // Confiança por campo { campo: score }
    const confiancaPorCampo = Object.fromEntries(
      Object.entries(phase1.dados_extraidos).map(([k, v]) => [k, v.confianca])
    );

    // Campos com confiança baixa (< 70)
    const camposBaixaConfianca = Object.entries(phase1.dados_extraidos)
      .filter(([, v]) => v.confianca < 70)
      .map(([k, v]) => ({ campo: k, confianca: v.confianca, evidencia: v.evidencia }));

    const statusFinal = phase2.requer_revisao_humana ? "needs_review" : "done";
    const confiabilidadeFinal = phase2.confiabilidade_final;

    // Parseia validade
    let validadeDate: string | null = null;
    if (phase1.validade && /^\d{4}-\d{2}-\d{2}$/.test(phase1.validade)) {
      validadeDate = phase1.validade;
    }

    // Persiste resultado completo
    await svc.from("ma_document_extractions").update({
      doc_name:                doc.file_name,
      storage_path:            doc.storage_path,
      tipo_documento:          phase1.tipo_documento,
      dados_extraidos:         dadosFlat,
      pendencias:              [...phase1.pendencias, ...phase2.flags],
      campos_baixa_confianca:  camposBaixaConfianca,
      validade:                validadeDate,
      resumo:                  phase1.resumo,
      confiabilidade:          Math.round(confiabilidadeFinal),
      confiabilidade_por_campo: confiancaPorCampo,
      validation_flags:        phase2.flags,
      status:                  statusFinal,
      extracted_at:            new Date().toISOString(),
    }).eq("id", extractionId);

    return NextResponse.json({
      ok:                       true,
      extraction_id:            extractionId,
      tipo_documento:           phase1.tipo_documento,
      dados_extraidos:          dadosFlat,
      confiabilidade:           Math.round(confiabilidadeFinal),
      campos_baixa_confianca:   camposBaixaConfianca.length,
      pendencias:               phase1.pendencias.length + phase2.flags.length,
      requer_revisao_humana:    phase2.requer_revisao_humana,
      status:                   statusFinal,
      resumo:                   phase1.resumo,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await svc.from("ma_document_extractions")
      .update({ status: "error", error_message: msg })
      .eq("id", extractionId);

    console.error("[doc-extract] ERRO:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
