import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { z } from "zod";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const productSchema = z.object({
  name: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  category: z.string().min(1),
  price: z.number().positive().optional().nullable(),
  price_type: z.enum(["FIXED", "NEGOTIABLE", "ON_REQUEST"]),
  commission_percent: z.number().min(0).max(80),
  images: z.array(z.string().url()).max(8).optional().default([]),
  specs: z.record(z.string(), z.string()).optional().default({}),
  min_order: z.number().positive().optional().nullable(),
  delivery_days: z.number().int().positive().optional().nullable(),
  available_nationwide: z.boolean().default(true),
  states: z.array(z.string()).optional().default([]),
});

/** GET /api/marketplace/products — catalog for partners or supplier's own products */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const supplierId = searchParams.get("supplier_id");
  const isAdmin = searchParams.get("admin") === "true";

  const svc = serviceClient();
  let query = svc
    .from("marketplace_products")
    .select(`
      id, name, description, category, price, price_type,
      commission_percent, images, specs, min_order, delivery_days,
      available_nationwide, states, status, created_at,
      supplier:marketplace_suppliers(id, company_name, logo_url, city, state)
    `)
    .order("created_at", { ascending: false });

  if (isAdmin) {
    // Admin sees all products — verify role
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const { data: caller } = await svc.from("profiles").select("role").eq("id", user.id).single();
    if (!["ADMIN", "GESTAO"].includes((caller as { role: string } | null)?.role ?? "")) {
      return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
    }
    // No status filter — return all
  } else if (supplierId) {
    // Supplier viewing own products
    query = query.eq("supplier_id", supplierId);
  } else {
    // Partners see only approved products
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    query = query.eq("status", "APPROVED");
  }

  if (category) query = query.eq("category", category);
  if (search) query = query.ilike("name", `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data ?? [] });
}

/** POST /api/marketplace/products — supplier creates product */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = productSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
    }

    // Auth via supplier token in header
    const supplierId = req.headers.get("x-supplier-id");
    if (!supplierId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const svc = serviceClient();
    // Validate supplier exists and is approved
    const { data: supplier } = await svc
      .from("marketplace_suppliers")
      .select("id, status")
      .eq("id", supplierId)
      .single();

    if (!supplier || supplier.status !== "APPROVED") {
      return NextResponse.json({ error: "Fornecedor não aprovado" }, { status: 403 });
    }

    const { data, error } = await svc
      .from("marketplace_products")
      .insert({ ...parsed.data, supplier_id: supplierId, status: "PENDING" })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ product: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

/** PATCH /api/marketplace/products — admin approves/rejects */
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = serviceClient();
  const { data: caller } = await svc.from("profiles").select("role").eq("id", user.id).single();
  if (!["ADMIN", "GESTAO"].includes(caller?.role ?? "")) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }

  const body = await req.json();
  const { id, status, rejection_reason, partner_commission_percent, name, description, category, commission_percent } = body;
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (status !== undefined) {
    update.status = status;
    update.rejection_reason = rejection_reason ?? null;
    update.reviewed_at = new Date().toISOString();
    update.reviewed_by = user.id;
  }
  if (partner_commission_percent !== undefined) update.partner_commission_percent = partner_commission_percent;
  if (name !== undefined) update.name = name;
  if (description !== undefined) update.description = description;
  if (category !== undefined) update.category = category;
  if (commission_percent !== undefined) update.commission_percent = commission_percent;

  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });

  const { data, error } = await svc
    .from("marketplace_products")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire-and-forget AI matching when product is approved
  if (status === "APPROVED" && data?.id) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br";
    fetch(`${appUrl}/api/marketplace/products/${data.id}/match-partners`, {
      method: "POST",
      headers: { "x-internal-key": process.env.INTERNAL_API_KEY ?? "v3-internal" },
    }).catch(() => {});
  }

  return NextResponse.json({ product: data });
}
