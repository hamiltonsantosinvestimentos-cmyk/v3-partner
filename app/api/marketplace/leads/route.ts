import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { notifyMarketplaceLead } from "@/lib/email";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** POST /api/marketplace/leads — partner expresses interest in a product */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { product_id, message, client_name, client_contact } = await req.json();
  if (!product_id) return NextResponse.json({ error: "product_id obrigatório" }, { status: 400 });

  const svc = serviceClient();

  // Verify product is approved
  const { data: product } = await svc
    .from("marketplace_products")
    .select("id, supplier_id, status")
    .eq("id", product_id)
    .single();

  if (!product || product.status !== "APPROVED") {
    return NextResponse.json({ error: "Produto não disponível" }, { status: 404 });
  }

  const { data, error } = await svc
    .from("marketplace_leads")
    .insert({
      product_id,
      partner_id: user.id,
      supplier_id: product.supplier_id,
      message: message ?? null,
      client_name: client_name ?? null,
      client_contact: client_contact ?? null,
      status: "NEW",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Busca dados adicionais em paralelo
  const [productRes, profileRes, supplierRes] = await Promise.all([
    svc.from("marketplace_products").select("name, category").eq("id", product_id).single(),
    svc.from("profiles").select("full_name").eq("id", user.id).single(),
    svc.from("marketplace_suppliers").select("email, company_name").eq("id", product.supplier_id).single(),
  ]);

  const productName = (productRes.data as { name?: string } | null)?.name ?? "Produto";
  const partnerName = (profileRes.data as { full_name?: string } | null)?.full_name ?? "Partner";
  const supplierEmail = (supplierRes.data as { email?: string } | null)?.email ?? null;
  const supplierCompany = (supplierRes.data as { company_name?: string } | null)?.company_name ?? "Fornecedor";

  // CRM lead
  const crmResult = await svc.from("crm_leads").insert({
    code: `MKT-${Date.now().toString(36).toUpperCase()}`,
    name: client_name ?? `Lead Marketplace — ${productName}`,
    email: null,
    phone: client_contact ?? null,
    person_type: "PF",
    status: "prospect",
    source: "marketplace",
    notes: `Lead via Marketplace — Produto: ${productName}${message ? `\nMensagem: ${message}` : ""}`,
    product_interest: productName,
    interactions: [],
    partner_id: user.id,
    partner_name: partnerName,
    created_by: user.id,
  });
  if (crmResult.error) console.error("CRM lead create error:", crmResult.error.message);

  // Email ao fornecedor (aguardado para garantir envio antes de encerrar a função)
  if (supplierEmail) {
    await notifyMarketplaceLead({
      supplierEmail,
      supplierName: supplierCompany,
      productName,
      partnerName,
      clientName: client_name ?? null,
      clientContact: client_contact ?? null,
      message: message ?? null,
    }).catch((err: unknown) => console.error("Email supplier error:", err));
  } else {
    console.warn("Fornecedor sem email cadastrado — supplier_id:", product.supplier_id);
  }

  return NextResponse.json({ lead: data }, { status: 201 });
}

/** GET /api/marketplace/leads — supplier (via x-supplier-id header), partner, or admin */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const isAdmin = searchParams.get("admin") === "true";
  const productId = searchParams.get("product_id");
  const svc = serviceClient();

  // Fornecedor autenticado via header (sessionStorage no dashboard)
  const supplierIdHeader = req.headers.get("x-supplier-id");
  if (supplierIdHeader) {
    // Valida que o fornecedor existe
    const { data: supplier, error: supErr } = await svc
      .from("marketplace_suppliers")
      .select("id")
      .eq("id", supplierIdHeader)
      .single();
    if (supErr) console.error("Supplier lookup error:", supErr.message, "id:", supplierIdHeader);
    if (!supplier) return NextResponse.json({ error: "Fornecedor não encontrado", debug_id: supplierIdHeader }, { status: 403 });

    const { data, error } = await svc
      .from("marketplace_leads")
      .select(`
        id, message, client_name, client_contact, status, notes, created_at,
        product:marketplace_products(id, name, category, commission_percent),
        partner:profiles(id, full_name, email),
        supplier:marketplace_suppliers(id, company_name)
      `)
      .eq("supplier_id", supplierIdHeader)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Leads query error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    console.log(`Leads para supplier ${supplierIdHeader}: ${data?.length ?? 0} encontrados`);
    return NextResponse.json({ leads: data ?? [] });
  }

  // Partner ou admin autenticado via Supabase session
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (isAdmin) {
    const { data: caller } = await svc.from("profiles").select("role").eq("id", user.id).single();
    if (!["ADMIN", "GESTAO", "FINANCEIRO"].includes((caller as { role: string } | null)?.role ?? "")) {
      return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
    }
  }

  let query = svc
    .from("marketplace_leads")
    .select(`
      id, message, client_name, client_contact, status, notes, created_at,
      product:marketplace_products(id, name, category, commission_percent),
      partner:profiles(id, full_name, email),
      supplier:marketplace_suppliers(id, company_name)
    `)
    .order("created_at", { ascending: false });

  if (isAdmin) {
    if (productId) query = query.eq("product_id", productId);
  } else {
    query = query.eq("partner_id", user.id);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leads: data ?? [] });
}
