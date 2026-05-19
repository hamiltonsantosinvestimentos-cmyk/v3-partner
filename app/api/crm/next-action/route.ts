import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { lead_id } = await req.json();

  const { data: rawLead } = await supabase
    .from("crm_leads")
    .select("full_name, name, status, product_interest, notes, updated_at, credit_line")
    .eq("id", lead_id)
    .eq("partner_id", user.id)
    .single();

  if (!rawLead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const lead = rawLead as {
    full_name?: string;
    name?: string;
    status?: string;
    product_interest?: string;
    credit_line?: string;
    notes?: string;
    updated_at?: string;
  };

  const daysSince = lead.updated_at
    ? Math.floor((Date.now() - new Date(lead.updated_at).getTime()) / 86400000)
    : 0;

  const leadName = lead.full_name ?? lead.name ?? "Lead";

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 80,
    messages: [{
      role: "user",
      content: `Você é coach de vendas para assessores financeiros brasileiros. Lead: ${leadName} | Status: ${lead.status ?? "prospect"} | Produto: ${lead.product_interest ?? lead.credit_line ?? "não definido"} | Último contato: ${daysSince} dias atrás | Obs: ${lead.notes ?? "nenhuma"}. Sugira em UMA frase (máx 12 palavras) a próxima ação ideal. Seja específico.`,
    }],
  });

  const suggestion =
    msg.content[0].type === "text" ? msg.content[0].text.trim() : "Entre em contato com o lead";

  return NextResponse.json({ suggestion });
}
