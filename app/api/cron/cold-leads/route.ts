import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

function svc() {
  return sc(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// Executa seg/qua/sex às 9h via Vercel Cron
// Authorization: Bearer <CRON_SECRET>
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const quinzeDiasAtras = new Date();
  quinzeDiasAtras.setDate(quinzeDiasAtras.getDate() - 15);

  // Busca leads frios: status ativo + sem atualização há 15+ dias
  const { data: coldLeads, error } = await svc()
    .from("crm_leads")
    .select("id, partner_id, client_name, status, product_interest, phone, email, notes, updated_at")
    .not("status", "in", '("won","lost","ganho","perdido")')
    .lt("updated_at", quinzeDiasAtras.toISOString())
    .order("updated_at", { ascending: true })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!coldLeads || coldLeads.length === 0) {
    return NextResponse.json({ processed: 0, notifications_created: 0 });
  }

  let notificationsCreated = 0;

  for (const lead of coldLeads) {
    const days = Math.floor(
      (Date.now() - new Date(lead.updated_at).getTime()) / 86400000
    );
    const clientName = lead.client_name ?? "Cliente";
    const productInterest = lead.product_interest ?? "produto financeiro";

    // Gera sugestão via Claude Haiku
    let suggestion = "";
    try {
      const completion = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 150,
        messages: [
          {
            role: "user",
            content: `Gere uma mensagem curta e amigável para WhatsApp (máx 3 linhas) para um parceiro financeiro retomar contato com um cliente.
Cliente: ${clientName}. Interesse: ${productInterest}. Dias sem contato: ${days}.
Seja direto, caloroso e crie senso de urgência sutil. Não use emojis em excesso.`,
          },
        ],
      });

      const block = completion.content[0];
      if (block.type === "text") {
        suggestion = block.text.trim();
      }
    } catch {
      suggestion = `Olá ${clientName}, tudo bem? Lembrei de você e do seu interesse em ${productInterest}. Posso tirar alguma dúvida ou apresentar uma proposta atualizada?`;
    }

    // Cria notificação para o partner
    if (lead.partner_id) {
      try {
        await svc()
          .from("notifications")
          .insert({
            user_id: lead.partner_id,
            type: "follow_up",
            title: `Lead frio: ${clientName}`,
            message: suggestion,
            action_url: "/crm",
          });
        notificationsCreated++;
      } catch {
        // fire-and-forget
      }
    }
  }

  return NextResponse.json({
    processed: coldLeads.length,
    notifications_created: notificationsCreated,
  });
}
