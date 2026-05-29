import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

const IS_DEMO = false;

const DEMO_RESULT = {
  score: 72,
  aprovado: false,
  documentos_presentes: ["Contrato Social", "DRE 2024-2025"],
  documentos_faltantes: ["Balanço Patrimonial 2023", "Certidão Negativa Federal"],
  dados_extraidos: {
    cnpj_confirmado: true,
    socios_identificados: ["Nome Sócio 1", "Nome Sócio 2"],
    receita_auditada: "R$ 12MM (DRE 2025)",
    pendencias: "Nenhuma identificada nos documentos analisados",
  },
  observacoes: "Faltam documentos obrigatórios para aprovação completa.",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { deal } = body;

    if (!deal) {
      return NextResponse.json({ error: "deal é obrigatório" }, { status: 400 });
    }

    // ── Demo mode ──────────────────────────────────────────────────────────────
    if (IS_DEMO) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      return NextResponse.json(DEMO_RESULT);
    }

    // ── Produção: Anthropic SDK ───────────────────────────────────────────────
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system:
        "Você é o FORJA validador documental da V3 Partners. " +
        "Analise os metadados dos documentos e os dados do deal fornecidos. " +
        "Retorne APENAS um JSON válido com a seguinte estrutura: " +
        "{ score: number (0-100), aprovado: boolean, documentos_presentes: string[], " +
        "documentos_faltantes: string[], dados_extraidos: { cnpj_confirmado: boolean, " +
        "socios_identificados: string[], receita_auditada: string, pendencias: string }, " +
        "observacoes: string }. " +
        "Não inclua markdown, apenas o JSON puro.",
      messages: [
        {
          role: "user",
          content: `Analise o seguinte deal para validação documental:\n\n${JSON.stringify(deal, null, 2)}`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Resposta inesperada da IA");
    }

    const parsed = JSON.parse(content.text);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("[validacao-documental]", error);
    return NextResponse.json(
      { error: "Erro ao processar validação" },
      { status: 500 }
    );
  }
}
