import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

const svcClient = () =>
  sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// POST — Claude lê todas as sessões do workspace e gera deal brief consolidado
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const svc = svcClient();

  // Busca workspace + sessões
  const [wsResult, sessionsResult] = await Promise.all([
    svc.from("deal_workspaces")
      .select("id, name, context, status")
      .eq("id", id)
      .eq("created_by", user.id)
      .single(),
    svc.from("agent_sessions")
      .select("id, squad_id, title, messages, updated_at")
      .eq("workspace_id", id)
      .eq("archived", false)
      .order("updated_at", { ascending: true }),
  ]);

  if (wsResult.error || !wsResult.data) {
    return NextResponse.json({ error: "Workspace não encontrado" }, { status: 404 });
  }

  const sessions = sessionsResult.data ?? [];
  if (sessions.length === 0) {
    return NextResponse.json({ error: "Nenhuma sessão encontrada neste workspace" }, { status: 400 });
  }

  // Monta o contexto de todas as conversas para o Claude sintetizar
  const squadNames: Record<string, string> = {
    "analista-ma": "Analista M&A",
    "deal-hunter": "Deal Hunter",
    "estrategista": "Estrategista",
    "monitor-regulatorio": "Monitor Regulatório",
    "pesquisador": "Pesquisador de Mercado",
    "market-scout": "Market Scout",
    "executor-deals": "Executor de Deals",
  };

  const conversasTexto = sessions.map(sess => {
    const squadNome = squadNames[sess.squad_id] ?? sess.squad_id;
    const msgs = (sess.messages as Array<{ role: string; content: string }> ?? []);
    const resumo = msgs
      .map(m => `[${m.role === "user" ? "João" : squadNome}]: ${m.content}`)
      .join("\n");
    return `=== ${squadNome.toUpperCase()} — ${sess.title} ===\n${resumo}`;
  }).join("\n\n");

  const systemPrompt = `Você é o sintetizador de deals da V3 Partners.
Sua missão: ler todas as conversas dos squads de IA sobre um deal específico e gerar um deal brief consolidado, estruturado e pronto para uso em negociação ou construção de CIM.

V3 Partners: boutique institucional de securitização e estruturação financeira.
4 verticais: Securitização de Crédito, Real Estate Estruturado, Mineração/Commodities, M&A Cross-Border.
Taxas V3: estruturação 3% + distribuição 3,5% = 6,5% (negociável acima de R$10M).`;

  const userPrompt = `DEAL WORKSPACE: ${wsResult.data.name}
${wsResult.data.context ? `CONTEXTO INICIAL: ${wsResult.data.context}` : ""}

CONVERSAS DOS SQUADS:
${conversasTexto}

---

Com base em tudo que foi pesquisado acima, gere o DEAL BRIEF CONSOLIDADO com as seguintes seções:

## 1. SUMÁRIO EXECUTIVO
- Nome do deal / empresa alvo
- Vertical V3 aplicável
- Ticket estimado
- Tipo de operação recomendada

## 2. TESE DE INVESTIMENTO
- Por que este deal faz sentido agora
- Oportunidade central (1 parágrafo direto)
- Riscos principais identificados

## 3. ESTRUTURA SUGERIDA
- Instrumento financeiro recomendado (CRI, FIDC, SLB, Token RWA, etc.)
- Lógica da estruturação
- Fee V3 estimado

## 4. MAPA DE PARTES
- Buyer side (quem compra/investe)
- Seller side (quem vende/capta)
- Intermediários e mandatários identificados

## 5. PLANO DE AÇÃO
- Próximos 3 passos concretos para João Lemos (Head de Ativos)
- Prazo sugerido para cada passo
- Responsável (João / Hamilton / Robson)

## 6. ALERTAS E PENDÊNCIAS
- Pontos que precisam de validação (jurídico, regulatório, due diligence)
- Sinalizar com ⚠️ temas para Robson Lino (Compliance)

Seja direto, técnico, sem rodeios. Este brief será usado internamente pela liderança V3.`;

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "API key não configurada" }, { status: 500 });

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const synthesis = response.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("");

    const synthesisData = {
      text: synthesis,
      sessions_count: sessions.length,
      generated_at: new Date().toISOString(),
    };

    // Salva síntese no workspace e atualiza status
    await svc.from("deal_workspaces")
      .update({
        synthesis: synthesisData,
        status: "sintetizado",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    return NextResponse.json({ synthesis: synthesisData });
  } catch (err) {
    console.error("[workspaces/synthesize]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro interno" }, { status: 500 });
  }
}
