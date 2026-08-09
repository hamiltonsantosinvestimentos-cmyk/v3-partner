import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { nextLegacyCode } from "@/lib/v3-codes";

interface DealPayload {
  empresa_nome: string;
  setor: string;
  valor_estimado: number;
  tipo_operacao: string;
  contato_nome: string;
  contato_telefone?: string;
  contato_email?: string;
  origem_lead: string;
  observacoes?: string;
}

export async function POST(req: NextRequest) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const deal = await req.json() as DealPayload;

  if (!deal.empresa_nome || !deal.setor || !deal.valor_estimado || !deal.tipo_operacao || !deal.contato_nome || !deal.origem_lead) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
  }
  if (deal.valor_estimado < 500000) {
    return NextResponse.json({ error: "Valor mínimo: R$ 500.000" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();

  // Gerar tese de investimento via Claude
  let sugestao_tese = "";
  let deal_card_html = "";

  if (apiKey) {
    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const anthropic = new Anthropic({ apiKey });

      const prompt = `Você é analista sênior de M&A da V3 Partners, boutique institucional de securitização e estruturação financeira.

Gere uma sugestão de tese de investimento em 3-4 frases. Indique o instrumento financeiro mais adequado (CGI, CRI, FIDC, SLB, BTS, Security Token), o racional estratégico e o posicionamento da V3.

Dados do deal:
- Empresa: ${deal.empresa_nome}
- Setor: ${deal.setor}
- Valor estimado: R$ ${deal.valor_estimado.toLocaleString("pt-BR")}
- Tipo de operação: ${deal.tipo_operacao}
- Observações: ${deal.observacoes || "Nenhuma"}

Responda apenas com a sugestão de tese, sem prefixo.`;

      const [teseRes, htmlRes] = await Promise.all([
        // Tese
        anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 400,
          messages: [{ role: "user", content: prompt }],
        }),
        // Deal Card HTML
        anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4000,
          system: `Gere um deal card HTML completo com identidade visual V3 Partners:
- Fundo: #09081A | Cards: #111F35 | Ouro: #C9A84C | Texto: #F0ECE4
- Fonte DM Sans (Google Fonts)
- Header com badge "DEAL CARD · V3 PARTNERS", título, data
- Grid de métricas (setor, tipo, valor)
- Bloco de tese destacado em ouro
- Footer V3 Partners
Retorne apenas o HTML completo, sem explicações.`,
          messages: [{ role: "user", content: `Deal Card para:\n- Empresa: ${deal.empresa_nome}\n- Setor: ${deal.setor}\n- Valor: R$ ${deal.valor_estimado.toLocaleString("pt-BR")}\n- Tipo: ${deal.tipo_operacao}\n- Tese será gerada separadamente` }],
        }),
      ]);

      sugestao_tese = teseRes.content.filter(b => b.type === "text").map(b => (b as { type: "text"; text: string }).text).join("");

      deal_card_html = htmlRes.content.filter(b => b.type === "text").map(b => (b as { type: "text"; text: string }).text).join("");

      // Injeta a tese real no HTML
      deal_card_html = deal_card_html.replace("Tese será gerada separadamente", sugestao_tese);
    } catch (e) {
      console.error("[new-deal] Claude error:", e);
    }
  }

  // Inserir no Supabase
  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: inserted, error } = await svc
    .from("deal_intakes")
    .insert({
      ...deal,
      sugestao_tese,
      deal_card_html,
      status: "novo",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[new-deal] Supabase:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Bridge A: Hub → CRM (fire-and-forget, não bloqueia resposta)
  if (inserted?.id) {
    try {
      // MAX real, nunca COUNT(*). Ver incidente de 31/07/2026 no link de captação.
      const crmCode = await nextLegacyCode(svc, "crm_leads", "CRM-26");
      void svc.from("crm_leads").insert({
        code:             crmCode,
        name:             deal.empresa_nome,
        person_type:      "PJ",
        segment:          deal.setor ?? "M&A",
        annual_revenue:   deal.valor_estimado ?? 0,
        status:           "prospect",
        source:           "hub",
        product_interest: "ma",
        credit_line:      "M&A",
        notes:            deal.observacoes ?? null,
        partner_id:       user.id,
        partner_name:     user.email ?? "Partner",
        created_by:       user.id,
        interactions:     [],
        metadata:         { deal_intake_id: inserted.id, tipo_operacao: deal.tipo_operacao },
      });
    } catch { /* CRM é best-effort — falha não afeta deal */ }
  }

  return NextResponse.json({
    ok: true,
    deal_id: inserted.id,
    sugestao_tese,
  });
}
