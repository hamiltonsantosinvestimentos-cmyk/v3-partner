import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { SQUADS } from "@/lib/squads";

const SYSTEM_HTML = `Você é um especialista em design editorial da V3 Partners.
Converta o conteúdo recebido em um relatório HTML completo, visualmente rico e profissional.

IDENTIDADE VISUAL V3 OBRIGATÓRIA:
- Fonte: DM Sans (Google Fonts)
- Background: #09081A (navy profundo)
- Cards: #111F35 (navy base) / #162744 (navy card)
- Ouro: #C9A84C (labels, badges, destaques, bordas de acento)
- Ouro claro: #E8C97A (hover, gradientes)
- Texto: #F0ECE4 (cream, títulos) / #7A8FA8 (muted, corpo)
- Regra 90/8/2: 90% navy · 8% cream/muted · 2% ouro

ESTRUTURA OBRIGATÓRIA:
1. DOCTYPE html + meta charset + viewport
2. Import DM Sans: https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap
3. CSS reset + variáveis de cor
4. HEADER: badge "RELATÓRIO DE INTELIGÊNCIA · V3 PARTNERS", título principal, data atual, classificação "Uso Interno · Confidencial"
5. SEÇÕES: cada seção com card navy, título com badge dourado, conteúdo bem organizado
6. TABELAS: bordas navy-card, header dourado, rows alternadas sutis
7. BADGES/CHIPS: fundo gold/10%, texto gold, border gold/30%, letra-espaçamento
8. FOOTER: "V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50 · v3partners.com.br · Rua Visconde de Pirajá, 414, Sala 718 — Ipanema, Rio de Janeiro"
9. Print-ready: @media print com -webkit-print-color-adjust: exact

IMPORTANTE:
- Retorne APENAS o HTML completo, começando com <!DOCTYPE html>
- Sem markdown, sem explicações, sem blocos de código
- O HTML deve ser 100% autossuficiente e funcional`;

export async function POST(req: NextRequest) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { content, squad_id, title, session_id } = await req.json() as {
    content: string;
    squad_id: string;
    title: string;
    session_id?: string;
  };

  if (!content || !squad_id) return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });

  const squad = SQUADS[squad_id];
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "API key não configurada" }, { status: 500 });

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey });

    const squadLabel = squad?.nome ?? squad_id;
    const dateStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

    const userPrompt = `Converta o seguinte conteúdo em relatório HTML V3 Partners.

Squad: ${squadLabel}
Título: ${title}
Data: ${dateStr}

CONTEÚDO:
${content}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      system: SYSTEM_HTML,
      messages: [{ role: "user", content: userPrompt }],
    });

    const html = response.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("")
      .trim();

    if (!html.startsWith("<!DOCTYPE") && !html.startsWith("<html")) {
      return NextResponse.json({ error: "Falha ao gerar HTML" }, { status: 500 });
    }

    // Salvar no Supabase
    const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: report, error } = await svc
      .from("generated_reports")
      .insert({
        user_id: user.id,
        session_id: session_id ?? null,
        squad_id,
        title,
        html,
      })
      .select("id")
      .single();

    if (error) console.error("[export-report] Supabase error:", error.message);

    return NextResponse.json({
      ok: true,
      report_id: report?.id,
      html,
    });
  } catch (err) {
    console.error("[export-report]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro interno" }, { status: 500 });
  }
}
