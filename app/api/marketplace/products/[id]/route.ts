import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** GET /api/marketplace/products/[id] — product detail + increment views */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const svc = serviceClient();

  const { data, error } = await svc
    .from("marketplace_products")
    .select(`
      id, name, description, category, price, price_type,
      commission_percent, images, specs,
      min_order, delivery_days, available_nationwide, states, status,
      created_at,
      supplier:marketplace_suppliers(id, company_name, logo_url, city, state, description, website, categories)
    `)
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

  // Increment views async (don't await — coluna pode não existir ainda)
  svc.from("marketplace_products").update({ views: ((data as { views?: number }).views ?? 0) + 1 }).eq("id", id).then(() => {}, () => {});

  return NextResponse.json({ product: data });
}

/** DELETE /api/marketplace/products/[id] — admin deletes product */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = serviceClient();
  const { data: caller } = await svc.from("profiles").select("role").eq("id", user.id).single();
  if (!["ADMIN", "GESTAO"].includes((caller as { role: string } | null)?.role ?? "")) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }

  const { error } = await svc.from("marketplace_products").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
