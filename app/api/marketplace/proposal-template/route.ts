import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function formatPrice(price: number | null, type: string): string {
  if (type === "ON_REQUEST") return "Sob consulta";
  if (!price) return "Negociável";
  const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);
  if (type === "NEGOTIABLE") return `A partir de ${fmt}`;
  return fmt;
}

/** POST /api/marketplace/proposal-template
 *  Generates a professional sales proposal using Claude Haiku.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  let body: {
    product_id?: string;
    client_name?: string;
    client_profile?: string;
    custom_note?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { product_id, client_name, client_profile, custom_note } = body;
  if (!product_id || !client_name) {
    return NextResponse.json({ error: "product_id e client_name são obrigatórios" }, { status: 400 });
  }

  const svc = serviceClient();
  const { data: product, error: prodErr } = await svc
    .from("marketplace_products")
    .select("id, name, category, description, price, price_type, commission_percent, partner_commission_percent")
    .eq("id", product_id)
    .single();

  if (prodErr || !product) {
    return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
  }

  const price = formatPrice(product.price, product.price_type);

  const prompt = `Gere uma proposta comercial profissional em português para um assessor financeiro enviar a um cliente.

Produto: ${product.name}
Categoria: ${product.category}
Descrição: ${product.description}
Valor: ${price}
Nome do cliente: ${client_name}
${client_profile ? `Perfil: ${client_profile}` : ""}
${custom_note ? `Observação adicional: ${custom_note}` : ""}

Gere:
1. Texto para WhatsApp (máx 3 parágrafos, informal mas profissional)
2. Assunto de e-mail
3. Corpo do e-mail (formatado, com saudação e despedida)

Formato de resposta: JSON com keys "whatsapp", "email_subject", "email_body"
Responda APENAS com o JSON, sem markdown ou texto adicional.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ error: "Resposta inválida da IA" }, { status: 500 });
    }

    let parsed: { whatsapp: string; email_subject: string; email_body: string };
    try {
      parsed = JSON.parse(content.text.trim());
    } catch {
      // Try to extract JSON if wrapped in other text
      const match = content.text.match(/\{[\s\S]*\}/);
      if (!match) return NextResponse.json({ error: "Resposta da IA não pôde ser parseada" }, { status: 500 });
      parsed = JSON.parse(match[0]);
    }

    return NextResponse.json({
      proposal_text: parsed.whatsapp,
      whatsapp_text: parsed.whatsapp,
      email_subject: parsed.email_subject,
      email_body: parsed.email_body,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao gerar proposta";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
