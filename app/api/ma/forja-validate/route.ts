import { NextResponse } from "next/server";

const IS_DEMO =
  !process.env.ANTHROPIC_API_KEY ||
  process.env.ANTHROPIC_API_KEY.includes("sk-ant-api03-...") ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("SEU_PROJETO");

const FORJA_SYSTEM = `Você é o FORJA — validador M&A da V3 Partners. Sua função é analisar os dados de um ativo de M&A cadastrado na plataforma e retornar um relatório de validação estruturado em JSON.

Você deve:
1. Validar campos que estão corretos e completos
2. Identificar campos com dados inconsistentes ou que podem ser melhorados (corrigir com justificativa)
3. Apontar campos críticos ausentes que impactam a geração dos criativos
4. Gerar uma narrativa de tese de investimento em PT-BR e EN baseada nos dados fornecidos
5. Dar uma pontuação de qualidade (0-100) e uma recomendação

Responda SOMENTE com JSON válido, sem markdown, sem explicações fora do JSON. Formato exato:
{
  "score": <número 0-100>,
  "validated": [
    { "field": "nome do campo", "value": "valor validado", "note": "observação opcional" }
  ],
  "corrected": [
    { "field": "nome do campo", "original": "valor original", "corrected": "valor corrigido", "reason": "justificativa técnica" }
  ],
  "missing": [
    { "field": "nome do campo", "impact": "impacto na geração dos criativos", "priority": "ALTA|MEDIA|BAIXA" }
  ],
  "narrative_pt": "Parágrafo de tese de investimento em português (150-250 palavras)",
  "narrative_en": "Investment thesis paragraph in English (150-250 words)",
  "recommendation": "APROVADO|APROVADO_COM_RESSALVAS|PENDENTE|BLOQUEADO",
  "recommendation_note": "Justificativa da recomendação em uma frase"
}`;

function buildDemoResponse(deal: Record<string, unknown>): Record<string, unknown> {
  const ad = (deal.asset_data as Record<string, unknown>) ?? {};
  const company = deal.target_company as string ?? "Empresa Alvo";
  const sector = deal.sector as string ?? "Setor não informado";
  const value = deal.deal_value as number ?? 0;
  const hasEbitda = !!deal.ebitda_multiple;
  const hasLocation = !!deal.location;
  const hasRevenue = !!deal.revenue_ttm;
  const hasDescricao = !!(ad.descricao || ad.tese_investimento);
  const hasDiferenciais = Array.isArray(ad.diferenciais) && (ad.diferenciais as unknown[]).length > 0;

  const validated = [
    { field: "Empresa Alvo", value: company, note: "Nome registrado e único no pipeline" },
    { field: "Setor", value: sector },
    { field: "Valor do Deal", value: `R$ ${(value / 1e6).toFixed(1)}M`, note: "Dentro da faixa mid-market V3 (R$5M–R$500M)" },
    { field: "Stage", value: deal.stage, note: "Status atual do pipeline consistente" },
    { field: "Probabilidade", value: `${deal.probability_percent}%` },
  ];

  if (hasLocation) validated.push({ field: "Localização", value: deal.location as string });
  if (hasDescricao) validated.push({ field: "Descrição do Ativo", value: "Presente e legível" });
  if (hasDiferenciais) validated.push({ field: "Diferenciais", value: `${(ad.diferenciais as unknown[]).length} pontos listados` });

  const corrected = [];
  if (!hasEbitda) {
    corrected.push({
      field: "Múltiplo EBITDA",
      original: "Não informado",
      corrected: "Estimar com base no setor (média 6-8x para mineração/agro)",
      reason: "Campo crítico para precificação — buyers institucionais usam múltiplo EBITDA como referência primária de valuation"
    });
  }

  const missing = [];
  if (!hasRevenue) {
    missing.push({ field: "Receita TTM", impact: "Sem receita TTM não é possível calcular múltiplo EV/Revenue para o CIM", priority: "ALTA" });
  }
  if (!ad.produtos_servicos) {
    missing.push({ field: "Produtos / Serviços", impact: "Teaser Cego fica genérico sem descrição de produtos", priority: "ALTA" });
  }
  if (!ad.mercado_atendido) {
    missing.push({ field: "Mercado Atendido", impact: "Narrativa de TAM/SAM ausente no CIM", priority: "MEDIA" });
  }
  if (!deal.expected_close_date) {
    missing.push({ field: "Data Prevista de Fechamento", impact: "Timeline do deal ausente — buyers questionam urgência", priority: "MEDIA" });
  }
  if (!ad.processo_regulatorio) {
    missing.push({ field: "Registro Regulatório / Licença", impact: "Para ativos regulados (mineração, financeiro) é obrigatório no CIM", priority: "BAIXA" });
  }

  const score = Math.min(95, 50 + (validated.length * 5) - (missing.filter(m => m.priority === "ALTA").length * 10));

  const rec = missing.filter(m => m.priority === "ALTA").length === 0
    ? "APROVADO"
    : missing.filter(m => m.priority === "ALTA").length <= 2
    ? "APROVADO_COM_RESSALVAS"
    : "PENDENTE";

  return {
    score,
    validated,
    corrected,
    missing,
    narrative_pt: `${company} representa uma oportunidade singular no segmento de ${sector.toLowerCase()}, com valor de deal indicativo de R$ ${(value / 1e6).toFixed(1)} milhões. O ativo apresenta ${hasDiferenciais ? `${(ad.diferenciais as unknown[]).length} diferenciais competitivos documentados` : "diferenciais a serem aprofundados"}, posicionando-se estrategicamente em um mercado com demanda crescente. A estrutura do deal é compatível com o perfil de investidores institucionais mid-market, alvo da carteira V3. A probabilidade de fechamento indicada (${deal.probability_percent}%) reflete o estágio atual de ${deal.stage} e o alinhamento de expectativas entre as partes. Recomenda-se aprofundar os dados financeiros (EBITDA e receita TTM) para elevar a qualidade do CIM e maximizar o interesse dos compradores na fase de apresentação.`,
    narrative_en: `${company} represents a distinctive opportunity in the ${sector.toLowerCase()} segment, with an indicative deal value of USD ${(value / 5.0 / 1e6).toFixed(1)} million (at current FX). The asset ${hasDiferenciais ? `features ${(ad.diferenciais as unknown[]).length} documented competitive advantages` : "has competitive advantages to be further detailed"}, strategically positioned in a growing market with institutional demand. The deal structure aligns with mid-market institutional investor profiles, V3's core target audience. The indicated closing probability (${deal.probability_percent}%) reflects the current ${deal.stage} stage and alignment between parties. Enhancing financial data (EBITDA and LTM revenue) is recommended to maximize CIM quality and buyer engagement.`,
    recommendation: rec,
    recommendation_note: rec === "APROVADO"
      ? "Todos os campos críticos preenchidos — prosseguir para geração dos criativos"
      : rec === "APROVADO_COM_RESSALVAS"
      ? "Dados suficientes para geração, mas campos de alta prioridade devem ser preenchidos antes da apresentação ao mercado"
      : "Preencher campos de alta prioridade antes de gerar o kit de criativos"
  };
}

export async function POST(request: Request) {
  try {
    const { deal } = await request.json();

    if (!deal) {
      return NextResponse.json({ error: "Deal não fornecido" }, { status: 400 });
    }

    if (IS_DEMO) {
      // Simula latência do modelo
      await new Promise((r) => setTimeout(r, 2200));
      return NextResponse.json(buildDemoResponse(deal));
    }

    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const dealJson = JSON.stringify(deal, null, 2);
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: FORJA_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Analise os dados deste ativo M&A e retorne o relatório FORJA em JSON:\n\n${dealJson}`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "{}";
    const result = JSON.parse(text);
    return NextResponse.json(result);
  } catch (err) {
    console.error("FORJA validate error:", err);
    return NextResponse.json({ error: "Erro na validação FORJA" }, { status: 500 });
  }
}
