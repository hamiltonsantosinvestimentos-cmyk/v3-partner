import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: supplierId } = await params;
  const svc = serviceClient();

  // Fetch supplier data
  const { data: supplier } = await svc
    .from("marketplace_suppliers")
    .select("id, company_name, cnpj, description, city, state, website, created_at, status, is_verified")
    .eq("id", supplierId)
    .single();

  if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  // Fetch their products
  const { data: products } = await svc
    .from("marketplace_products")
    .select("id, name, description, category, price, price_type, partner_commission_percent, status, views")
    .eq("supplier_id", supplierId)
    .eq("status", "APPROVED");

  // Fetch their reviews avg
  const { data: reviews } = await svc
    .from("marketplace_product_reviews")
    .select("rating, comment")
    .in("product_id", (products ?? []).map(p => p.id));

  const avgRating = reviews?.length
    ? (reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviews.length).toFixed(1)
    : null;

  // Generate AI due diligence
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1200,
    messages: [{
      role: "user",
      content: `Você é um analista de due diligence de fornecedores para assessores financeiros no Brasil.
Gere um relatório executivo CONCISO em português para o seguinte fornecedor do Marketplace V3 Partners.

DADOS DO FORNECEDOR:
- Empresa: ${supplier.company_name}
- CNPJ: ${supplier.cnpj ?? "Não informado"}
- Localização: ${supplier.city ?? "—"}, ${supplier.state ?? "—"}
- Site: ${supplier.website ?? "Não informado"}
- Descrição: ${supplier.description ?? "Não informada"}
- Status: ${supplier.is_verified ? "Verificado pela V3 Partners" : "Não verificado"}
- Cadastro desde: ${new Date(supplier.created_at).toLocaleDateString("pt-BR")}

PRODUTOS ATIVOS (${products?.length ?? 0}):
${(products ?? []).slice(0, 5).map(p => `- ${p.name} (${p.category}) | Comissão parceiro: ${p.partner_commission_percent ?? "N/A"}%`).join("\n")}

AVALIAÇÕES: ${reviews?.length ?? 0} avaliações | Nota média: ${avgRating ?? "sem avaliações"}

INSTRUÇÕES:
- Gere um relatório com 4 seções: 1) Resumo Executivo (2-3 frases), 2) Pontos Positivos (3 bullets), 3) Pontos de Atenção (2-3 bullets honestos), 4) Recomendação Final (1 frase com score de 1-10)
- Seja objetivo e profissional
- Foque em riscos e oportunidades para o assessor parceiro
- NÃO invente dados que não foram fornecidos
- Formato: Markdown simples`,
    }],
  });

  const report = msg.content[0].type === "text" ? msg.content[0].text : "";

  return NextResponse.json({
    supplier: {
      id: supplier.id,
      company_name: supplier.company_name,
      is_verified: supplier.is_verified,
      products_count: products?.length ?? 0,
      avg_rating: avgRating,
    },
    report,
    generated_at: new Date().toISOString(),
  });
}
