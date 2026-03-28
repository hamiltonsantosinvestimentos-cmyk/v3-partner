import { NextResponse } from "next/server";

const IS_DEMO =
  !process.env.ANTHROPIC_API_KEY ||
  process.env.ANTHROPIC_API_KEY.includes("sk-ant-api03-...") ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("SEU_PROJETO");

const DEMO_RESPONSES: Record<string, string> = {
  default: `Olá! Sou o **V3 IA**, especialista em mercado financeiro brasileiro.

Posso te ajudar com:
- **Crédito Varejo**: Home Equity, Aval, análise de score
- **Crédito Estruturado**: FIDC, CRI, CRA, Debêntures
- **High Ticket**: Operações acima de R$ 5M, Project Finance
- **M&A**: Valuations, múltiplos de EBITDA, due diligence
- **Split Fiscal**: Estruturação de receitas, tributação

💡 *Modo demonstração ativo. Configure sua chave ANTHROPIC_API_KEY para ativar o IA completo.*

Como posso te ajudar hoje?`,
  home: `## Home Equity — Guia Completo

**O que é?**
Financiamento com garantia de imóvel próprio quitado ou em processo de quitação.

**Características principais:**
- **LTV (Loan-to-Value)**: até 60-70% do valor do imóvel avaliado
- **Prazo**: até 240 meses (20 anos)
- **Taxa**: a partir de 0,89% a.m. + IPCA ou TR
- **Valor mínimo**: R$ 50.000 | Máximo: até R$ 5.000.000

**Documentos necessários:**
- RG/CPF do solicitante e cônjuge
- Comprovante de renda (3 últimos meses)
- Matrícula atualizada do imóvel (máx. 30 dias)
- IPTU do ano corrente
- Certidão de casamento (se aplicável)

**Processo:**
1. Análise de crédito (score + renda)
2. Avaliação do imóvel (laudo CRECI)
3. Análise jurídica da documentação
4. Formalização + registro em cartório

> Regulamentação: Resolução CMN 4.676/2018`,
  fidc: `## FIDC — Fundo de Investimento em Direitos Creditórios

**Conceito:**
Fundo que aplica no mínimo 50% do patrimônio em direitos creditórios (recebíveis).

**Estrutura:**
- **Cotas Sênior**: menor risco, rentabilidade pré-definida
- **Cotas Mezanino**: risco intermediário
- **Cotas Subordinadas**: maior risco, cedente geralmente fica com estas

**Vantagens para o cedente:**
- Antecipação de recebíveis com custo competitivo
- Melhora do balanço (off-balance)
- Sem restrição de uso dos recursos

**Regulação:** ICVM 356/2001 (atualizada pela RCVM 175/2022)

**Valores mínimos:** a partir de R$ 1.000.000 para estruturação`,
};

function getDemoResponse(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("home equity") || lower.includes("imóvel") || lower.includes("imovel")) {
    return DEMO_RESPONSES.home;
  }
  if (lower.includes("fidc") || lower.includes("estruturado") || lower.includes("cri") || lower.includes("cra")) {
    return DEMO_RESPONSES.fidc;
  }
  return DEMO_RESPONSES.default;
}

export async function POST(request: Request) {
  const { messages } = await request.json();
  const lastMessage = messages[messages.length - 1]?.content || "";

  if (IS_DEMO) {
    const response = getDemoResponse(lastMessage);
    const stream = new ReadableStream({
      async start(controller) {
        const words = response.split(" ");
        for (const word of words) {
          controller.enqueue(new TextEncoder().encode(word + " "));
          await new Promise((r) => setTimeout(r, 20));
        }
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  // Production: use Anthropic
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const SYSTEM_PROMPT = `Você é o V3 IA, assistente especializado da plataforma V3 PARTNER para o mercado financeiro brasileiro.
Responda sempre em português do Brasil. Seja técnico, objetivo e use formatação markdown.
Especialidades: Home Equity, Aval, FIDC, CRI, CRA, Debêntures, M&A, Project Finance, Split Fiscal, correspondentes bancários, regulamentações BACEN/CVM.`;

  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages,
  });

  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
          controller.enqueue(new TextEncoder().encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readableStream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}
