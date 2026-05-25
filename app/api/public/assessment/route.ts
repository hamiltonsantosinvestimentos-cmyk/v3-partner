import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://www.v3partners.com.br",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

interface AssessmentPayload {
  lead_nome: string;
  lead_email?: string;
  lead_telefone?: string;
  empresa_nome: string;
  empresa_cnpj?: string;
  // Bloco 1
  projeto_estagio?: string;
  municipio_contrato?: string;
  spe_status?: string;
  // Bloco 2
  fontes_receita?: string[];
  receita_anual_projecao?: string;
  offtake_contrato?: string;
  // Bloco 3
  carbono_tco2e_estimativa?: string;
  carbono_certificacao?: string;
  tokenizacao_motivo?: string;
  // Bloco 4
  garantias?: string[];
  investidores_existentes?: string;
  valor_captacao_necessario?: string;
  valor_captacao_brl?: number;
  // Bloco 5
  orcamento_estruturacao?: string;
}

function calcularInstrumento(p: AssessmentPayload): {
  instrumento: string;
  score: number;
  notas: string;
} {
  let score = 0;
  const motivos: string[] = [];

  // SPE constituída (+1)
  if (p.spe_status === "ativa") { score++; motivos.push("SPE ativa"); }
  // Contrato município (+1)
  if (p.municipio_contrato === "formal") { score++; motivos.push("contrato municipal formal"); }
  // Offtake assinado (+1)
  if (p.offtake_contrato === "assinado") { score++; motivos.push("offtake assinado"); }
  // Investidor com LOI (+1)
  if (p.investidores_existentes === "loi_assinada") { score++; motivos.push("investidor com LOI"); }
  // Projeto aprovado (+1)
  if (p.projeto_estagio === "aprovado") { score++; motivos.push("projeto aprovado com licenças"); }

  // Instrumento por perfil de resposta
  const temCarbono = p.fontes_receita?.includes("carbono") && p.tokenizacao_motivo;
  const temOfftake = p.offtake_contrato === "assinado";
  const semSPE = p.spe_status === "nao";
  const orçamentoRobusto = p.orcamento_estruturacao === "acima_500k";

  let instrumento = "INDEFINIDO";

  if (temOfftake && score >= 3) {
    instrumento = "CRI_VERDE";
  } else if (temCarbono && score >= 2) {
    instrumento = "TOKEN_RWA";
  } else if (p.fontes_receita && p.fontes_receita.length >= 2 && score >= 2) {
    instrumento = "FIDC_ESG";
  } else if (semSPE && orçamentoRobusto) {
    instrumento = "EQUITY_TOKEN";
  } else if (score >= 1) {
    instrumento = "MA_ESTRUTURADO";
  }

  const notas = motivos.length > 0
    ? `Pontos positivos: ${motivos.join(", ")}. Instrumento recomendado baseado no perfil de receita e estrutura jurídica.`
    : "Projeto em estágio inicial. Recomenda-se reunião exploratória antes de definir instrumento.";

  return { instrumento, score, notas };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as AssessmentPayload;

    if (!body.lead_nome || !body.empresa_nome) {
      return NextResponse.json({ error: "lead_nome e empresa_nome são obrigatórios" }, { status: 422 });
    }

    const diagnostico = calcularInstrumento(body);

    const svc = sc(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await svc
      .from("deal_assessments")
      .insert({
        ...body,
        origem: "site_publico",
        status: "completo",
        instrumento_recomendado: diagnostico.instrumento,
        score_qualificacao: diagnostico.score,
        diagnostico_notas: diagnostico.notas,
        diagnostico_gerado_em: new Date().toISOString(),
      })
      .select("id, instrumento_recomendado, score_qualificacao, diagnostico_notas")
      .single();

    if (error) {
      console.error("[assessment/public] Supabase:", error.message);
      return NextResponse.json({ error: "Erro ao salvar. Tente novamente." }, { status: 500 });
    }

    // Enriquecer diagnóstico com Haiku de forma assíncrona (não bloqueia resposta)
    enriquecerComHaiku(data.id, body, diagnostico).catch(console.error);

    return NextResponse.json({
      ok: true,
      assessment_id: data.id,
      instrumento_recomendado: data.instrumento_recomendado,
      score: data.score_qualificacao,
      diagnostico: data.diagnostico_notas,
      mensagem: getMensagemInstrumento(diagnostico.instrumento),
    }, { headers: CORS_HEADERS });

  } catch (e) {
    console.error("[assessment/public]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

function getMensagemInstrumento(instrumento: string): string {
  const msgs: Record<string, string> = {
    CRI_VERDE: "Seu projeto tem perfil para um CRI Verde — ideal para securitizar o fluxo de receita com lastro real. A V3 Partners estrutura operações a partir de R$15M.",
    TOKEN_RWA: "Seu projeto tem perfil para tokenização de ativo real (RWA). A plataforma tecnológica proprietária V3 viabiliza emissão regulada via CVM Resoluções 88 e 160.",
    FIDC_ESG: "Seu projeto tem perfil para um FIDC ESG — estrutura ideal para múltiplas fontes de receita com cota sênior para investidores institucionais.",
    EQUITY_TOKEN: "Seu projeto tem perfil para um Equity Token — financiamento via participação no crescimento, ideal para projetos em estruturação.",
    MA_ESTRUTURADO: "Seu projeto tem perfil para uma operação de M&A estruturado — entrada de fundo estratégico ou investidor âncora. A V3 Partners conecta com fundos ESG nacionais e internacionais.",
    INDEFINIDO: "Precisamos de mais informações para indicar o instrumento ideal. Nossa equipe entrará em contato em até 48 horas.",
  };
  return msgs[instrumento] ?? msgs.INDEFINIDO;
}

async function enriquecerComHaiku(
  assessmentId: string,
  dados: AssessmentPayload,
  diagnosticoBase: { instrumento: string; score: number; notas: string }
) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return;

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey });

    const prompt = `Você é analista sênior da V3 Partners, boutique de securitização.

Dados do prospect:
- Empresa: ${dados.empresa_nome}
- Estágio: ${dados.projeto_estagio ?? "não informado"}
- Contrato município: ${dados.municipio_contrato ?? "não informado"}
- SPE: ${dados.spe_status ?? "não informado"}
- Fontes de receita: ${dados.fontes_receita?.join(", ") ?? "não informado"}
- Projeção de receita anual: ${dados.receita_anual_projecao ?? "não informado"}
- Offtake: ${dados.offtake_contrato ?? "não informado"}
- Carbono tCO2e: ${dados.carbono_tco2e_estimativa ?? "não informado"}
- Certificação carbono: ${dados.carbono_certificacao ?? "não informado"}
- Garantias: ${dados.garantias?.join(", ") ?? "não informado"}
- Investidores: ${dados.investidores_existentes ?? "não informado"}
- Captação necessária: ${dados.valor_captacao_necessario ?? "não informado"}
- Orçamento estruturação: ${dados.orcamento_estruturacao ?? "não informado"}

Instrumento pré-selecionado: ${diagnosticoBase.instrumento}
Score de qualificação: ${diagnosticoBase.score}/5

Gere um diagnóstico em 3-4 frases: (1) por que este instrumento é adequado, (2) o que falta para avançar, (3) próximo passo concreto para a V3 Partners. Tom institucional, sem emojis.`;

    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const notas = res.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    const svc = sc(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await svc.from("deal_assessments").update({
      diagnostico_notas: notas,
      diagnostico_gerado_em: new Date().toISOString(),
    }).eq("id", assessmentId);

  } catch (e) {
    console.error("[enriquecerComHaiku]", e);
  }
}
