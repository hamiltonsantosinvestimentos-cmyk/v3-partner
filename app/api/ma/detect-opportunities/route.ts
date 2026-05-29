import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

export const maxDuration = 300;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

// Strip HTML tags e comprime espaços para reduzir tokens
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000); // max 8k chars para o prompt
}

/**
 * POST /api/ma/detect-opportunities
 * Body: { report_id: string, save?: boolean }
 *
 * Lê o HTML de um generated_report, extrai oportunidades de negócio via Claude
 * e opcionalmente salva em deal_opportunities.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED.includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada" }, { status: 500 });
  }

  const body = await req.json() as { report_id: string; save?: boolean };
  if (!body.report_id) return NextResponse.json({ error: "report_id obrigatório" }, { status: 400 });

  // Buscar relatório
  const { data: report } = await db
    .from("generated_reports")
    .select("id, title, html, squad_id, created_at")
    .eq("id", body.report_id).single();

  if (!report?.html) {
    return NextResponse.json({ error: "Relatório não encontrado ou sem conteúdo" }, { status: 404 });
  }

  const texto = stripHtml(report.html);

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt =
    `Você é analista de M&A da V3 Partners. Leia este relatório de pesquisa e extraia TODAS as oportunidades de negócio identificáveis.\n\n` +
    `Retorne APENAS um JSON válido, sem markdown:\n` +
    `{\n` +
    `  "oportunidades": [\n` +
    `    {\n` +
    `      "empresa_blind": "<nome cego ou apelido do ativo — nunca expor razão social real>",\n` +
    `      "setor": "<setor ex: Real Estate, Saúde, Agronegócio, Logística, Mineração, Energia, Tecnologia, Outro>",\n` +
    `      "uf": "<sigla UF ex: RJ, SP, MG — ou null se não identificado>",\n` +
    `      "valor_estimado": <número em BRL ou null>,\n` +
    `      "tipo_operacao": "<ex: Aquisição, Captação de Capital, Parceria, Real Estate, Recuperação Judicial>",\n` +
    `      "descricao": "<descrição cega do ativo — máximo 200 chars>",\n` +
    `      "contexto": "<por que esta é uma oportunidade M&A — máximo 150 chars>",\n` +
    `      "score_relevancia": <0-100 baseado em qualidade das informações e potencial>\n` +
    `    }\n` +
    `  ],\n` +
    `  "resumo": "<1-2 frases sobre o que o relatório aborda e quantas oportunidades foram identificadas>"\n` +
    `}\n\n` +
    `Regras:\n` +
    `- Extraia APENAS oportunidades de negócio reais (aquisições, vendas, captações, parcerias estratégicas)\n` +
    `- NÃO invente — só extraia o que está explicitamente no texto\n` +
    `- Se não houver oportunidades claras, retorne oportunidades: []\n` +
    `- score_relevancia: 80+ = dados sólidos e oportunidade clara; 50-79 = potencial mas incerto; <50 = menção superficial\n\n` +
    `RELATÓRIO:\n${texto}`;

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (msg.content[0] as { text: string }).text
    .trim()
    .replace(/^```json\s*/i, "").replace(/```\s*$/i, "");

  let parsed: { oportunidades: Record<string, unknown>[]; resumo: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Resposta da IA inválida", raw }, { status: 500 });
  }

  const ops = parsed.oportunidades ?? [];

  // Salvar no banco se solicitado e houver oportunidades
  if (body.save && ops.length > 0) {
    const rows = ops.map(op => ({
      source_type:     "report",
      source_id:       body.report_id,
      empresa_blind:   String(op.empresa_blind ?? "Ativo Identificado"),
      setor:           String(op.setor ?? ""),
      uf:              op.uf ? String(op.uf) : null,
      valor_estimado:  op.valor_estimado ? Number(op.valor_estimado) : null,
      tipo_operacao:   String(op.tipo_operacao ?? ""),
      descricao:       String(op.descricao ?? ""),
      contexto:        String(op.contexto ?? ""),
      score_relevancia:Number(op.score_relevancia ?? 50),
      status:          "novo",
      created_by:      user.id,
    }));

    await db.from("deal_opportunities").insert(rows);

    // Marcar relatório como escaneado
    await db.from("generated_reports").update({
      opportunities_scanned_at: new Date().toISOString(),
      opportunities_found: ops.length,
    }).eq("id", body.report_id);
  }

  return NextResponse.json({
    ok: true,
    total: ops.length,
    resumo: parsed.resumo,
    oportunidades: ops,
    saved: body.save && ops.length > 0,
  });
}
