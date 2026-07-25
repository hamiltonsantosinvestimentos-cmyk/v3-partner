import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { auditText } from "@/lib/brand-guardian-gate";
import { redactMarginText } from "@/lib/matching-redaction";

export const maxDuration = 120;

const ALLOWED = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

type EspecificacoesTecnicas = {
  tipo?: string;
  quantidade?: number;
  tonelagem_bruta_por_embarcacao_t?: number;
  tonelagem_bruta_total_t?: number;
  comprimento_m?: number;
  boca_m?: number;
  calado_m?: number;
  local_origem?: string;
  local_destino?: string;
  escopo_maritimo?: string;
};

// ── POST /api/propostas/gerar-narrativa ─────────────────────────────────────
// Gera a narrativa persuasiva (apresentação + estrutura de custos + fechamento)
// de uma proposta comercial a partir de um deal já cadastrado. Specs técnicas
// são renderizadas de forma determinística (nunca geradas pela IA): só o texto
// de conexão (apresentação/custos em prosa/fechamento) é gerado, sempre grounded
// nos números reais do deal, nunca inventado.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED.includes(profile?.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({})) as { deal_id?: string };
  if (!body.deal_id) return NextResponse.json({ error: "deal_id obrigatório" }, { status: 422 });

  const { data: deal, error: dealErr } = await db
    .from("ma_deals")
    .select("id, code, v3_code, legacy_code, title, sector, deal_value, notes, asset_data, location")
    .eq("id", body.deal_id)
    .single();

  if (dealErr || !deal) return NextResponse.json({ error: "Deal não encontrado" }, { status: 404 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada" }, { status: 500 });
  }

  const assetData = (deal.asset_data as Record<string, unknown>) ?? {};
  const specs = (assetData.especificacoes_tecnicas as EspecificacoesTecnicas | undefined) ?? null;
  const pedidoCompra = assetData.pedido_compra as Record<string, unknown> | undefined;
  const isMatching = assetData.tipo_operacao_v3 === "matching";

  // Nunca expor a margem/spread da V3 ao destinatário externo da proposta,
  // mesmo que a linha apareça nas notas internas do deal.
  const notesForPrompt = deal.notes ? (isMatching ? redactMarginText(deal.notes) : deal.notes) : null;

  const referenciaMercado = assetData.referencia_mercado as string | undefined;

  const matchingRules = isMatching
    ? ` Esta é uma operação de estruturação (a V3 compra de um vendedor e coloca junto a um comprador). ` +
      `Não é uma empresa operacional com receita recorrente, é uma transação única de compra e revenda de um lote de ativos físicos. ` +
      `PROIBIDO usar as palavras "intermediação" ou "intermediário" em qualquer forma, use sempre "estruturação"/"estrutura"/"estruturar". ` +
      `PROIBIDO mencionar qualquer percentual ou valor de margem, spread ou lucro da V3.` +
      (referenciaMercado?.trim()
        ? ` Use a referência de mercado internacional fornecida abaixo na apresentação, comparando o preço desta operação com a referência, usando exatamente os valores fornecidos, sem recalcular nem converter câmbio por conta própria.`
        : "")
    : "";

  const prompt =
    `Você é redator institucional da V3 Partners, mesa independente de estruturação financeira. ` +
    `Escreva no Registro 1 (Governante + Sábio): sóbrio, cirúrgico, assertivo. Projeta controle, nunca pede permissão. ` +
    `Frases construídas sobre dados verificáveis, nunca adjetivos vagos ("excelente", "ótima oportunidade"). ` +
    `NUNCA use o caractere travessão em nenhum texto, use vírgula, dois-pontos ou ponto.${matchingRules}\n\n` +
    `Gere o texto de uma proposta comercial de venda para o seguinte deal, USANDO APENAS os dados abaixo ` +
    `(nunca invente números, nomes ou condições que não estejam aqui):\n\n` +
    `Título: ${deal.title}\n` +
    `Setor: ${deal.sector ?? "não informado"}\n` +
    `Localização: ${deal.location ?? "não informada"}\n` +
    `Valor total da operação: R$ ${deal.deal_value ?? "não informado"}\n` +
    `Resumo financeiro/notas internas (fonte da verdade para custos, NUNCA recalcule nem arredonde diferente do texto): ${notesForPrompt ?? "não informado"}\n` +
    (referenciaMercado?.trim() ? `Referência de mercado (dado real, use os números exatamente como estão, nunca recalcule): ${referenciaMercado}\n` : "") +
    (pedidoCompra?.empresa ? `Comprador identificado: ${pedidoCompra.empresa}\n` : "") +
    `\nRetorne APENAS JSON válido, sem markdown, no formato:\n` +
    `{\n` +
    `  "apresentacao": "<1-2 parágrafos de abertura institucional, contexto de mercado e da negociação>",\n` +
    `  "estrutura_custos_texto": "<1 parágrafo explicando a composição de custo em prosa, usando SOMENTE os valores do resumo financeiro fornecido acima>",\n` +
    `  "fechamento": "<1-2 parágrafos de fechamento assertivo, chamando para o próximo passo comercial, sem hype>"\n` +
    `}`;

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (msg.content[0] as { text: string }).text
    .trim()
    .replace(/^```json\s*/i, "").replace(/```\s*$/i, "");

  let parsed: { apresentacao?: string; estrutura_custos_texto?: string; fechamento?: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Resposta da IA inválida", raw }, { status: 500 });
  }

  const apresentacao = auditText(parsed.apresentacao ?? "").corrected;
  const custosTexto = auditText(parsed.estrutura_custos_texto ?? "").corrected;
  const fechamento = auditText(parsed.fechamento ?? "").corrected;

  const specsTexto = specs
    ? [
        "ESPECIFICAÇÕES TÉCNICAS",
        specs.tipo ? `Tipo: ${specs.tipo}` : null,
        specs.quantidade ? `Quantidade: ${specs.quantidade} embarcações` : null,
        specs.tonelagem_bruta_por_embarcacao_t ? `Tonelagem bruta por embarcação: ${specs.tonelagem_bruta_por_embarcacao_t} t` : null,
        specs.tonelagem_bruta_total_t ? `Tonelagem bruta total: ${specs.tonelagem_bruta_total_t} t` : null,
        specs.comprimento_m ? `Comprimento: ${specs.comprimento_m} m` : null,
        specs.boca_m ? `Boca: ${specs.boca_m} m` : null,
        specs.calado_m ? `Calado: ${specs.calado_m} m` : null,
        specs.local_origem ? `Local de origem: ${specs.local_origem}` : null,
        specs.local_destino ? `Local de destino: ${specs.local_destino}` : null,
        specs.escopo_maritimo ? `Escopo marítimo: ${specs.escopo_maritimo}` : null,
      ].filter(Boolean).join("\n")
    : null;

  const descricao = [
    apresentacao,
    specsTexto,
    `ESTRUTURA DE CUSTOS\n${custosTexto}`,
    fechamento,
  ].filter(Boolean).join("\n\n");

  return NextResponse.json({
    ok: true,
    apresentacao,
    especificacoes_tecnicas: specs,
    estrutura_custos_texto: custosTexto,
    fechamento,
    descricao_sugerida: descricao,
  });
}
