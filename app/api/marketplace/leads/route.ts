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

  // Auto-create CRM lead if client info provided
  if (client_name && data) {
    const { data: productData } = await svc
      .from("marketplace_products")
      .select("name, category")
      .eq("id", product_id)
      .single();

    const { data: profile } = await svc
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const code = `MKT-${Date.now().toString(36).toUpperCase()}`;
    await svc.from("crm_leads").insert({
      code,
      name: client_name,
      email: null,
      phone: client_contact ?? null,
      person_type: "PF",
      status: "prospect",
      source: "marketplace",
      notes: `Lead via Marketplace — Produto: ${productData?.name ?? ""}${message ? `\nMensagem: ${message}` : ""}`,
      product_interest: productData?.name ?? null,
      interactions: [],
      partner_id: user.id,
      partner_name: (profile as { full_name?: string } | null)?.full_name ?? "Partner",
      created_by: user.id,
      marketplace_lead_id: data.id,
    }).then(() => {}).catch(() => {});
  }

  // Email notification to supplier (non-blocking)
  if (data) {
    const { data: supplierData } = await svc
      .from("marketplace_suppliers")
      .select("email, company_name")
      .eq("id", product.supplier_id)
      .single();

    const { data: partnerProfile } = await svc
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const { data: productName } = await svc
      .from("marketplace_products")
      .select("name")
      .eq("id", product_id)
      .single();

    if (supplierData?.email) {
      notifyMarketplaceLead({
        supplierEmail: supplierData.email,
        supplierName: supplierData.company_name,
        productName: (productName as { name: string } | null)?.name ?? "Produto",
        partnerName: (partnerProfile as { full_name: string } | null)?.full_name ?? "Partner",
        clientName: client_name ?? null,
        clientContact: client_contact ?? null,
        message: message ?? null,
      }).catch(() => {});
    }
  }

  return NextResponse.json({ lead: data }, { status: 201 });
}

/** GET /api/marketplace/leads — supplier, partner, or admin sees leads */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const supplierId = searchParams.get("supplier_id");
  const isAdmin = searchParams.get("admin") === "true";
  const productId = searchParams.get("product_id");

  const svc = serviceClient();

  if (isAdmin) {
    const { data: caller } = await svc.from("profiles").select("role").eq("id", user.id).single();
    if (!["ADMIN", "GESTAO"].includes((caller as { role: string } | null)?.role ?? "")) {
      return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
    }
  }

  let query = svc
    .from("marketplace_leads")
    .select(`
      id, message, client_name, client_contact, status, notes, created_at,
      product:marketplace_products(id, name, category, commission_percent, partner_commission_percent),
      partner:profiles(id, full_name, email),
      supplier:marketplace_suppliers(id, company_name)
    `)
    .order("created_at", { ascending: false });

  if (isAdmin) {
    if (productId) query = query.eq("product_id", productId);
  } else if (supplierId) {
    query = query.eq("supplier_id", supplierId);
  } else {
    query = query.eq("partner_id", user.id);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leads: data ?? [] });
}
