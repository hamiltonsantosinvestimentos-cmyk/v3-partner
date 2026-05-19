import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** GET /api/marketplace/suppliers/ranking
 *  Returns approved suppliers ranked by product count.
 *  Accessible by authenticated partners.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = serviceClient();

  const { data: suppliers, error } = await svc
    .from("marketplace_suppliers")
    .select("id, company_name, logo_url, city, state, categories")
    .eq("status", "APPROVED")
    .order("company_name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!suppliers?.length) {
    return NextResponse.json({ suppliers: [] });
  }

  // Count approved products per supplier
  const supplierIds = suppliers.map((s: { id: string }) => s.id);
  const { data: products } = await svc
    .from("marketplace_products")
    .select("supplier_id")
    .eq("status", "APPROVED")
    .in("supplier_id", supplierIds);

  const productCounts: Record<string, number> = {};
  for (const p of products ?? []) {
    const sid = p.supplier_id as string;
    productCounts[sid] = (productCounts[sid] ?? 0) + 1;
  }

  const ranked = suppliers
    .map((s: { id: string; company_name: string; logo_url: string | null; city: string; state: string; categories: string[] }) => ({
      ...s,
      products_count: productCounts[s.id] ?? 0,
    }))
    .sort((a: { products_count: number }, b: { products_count: number }) => b.products_count - a.products_count);

  return NextResponse.json({ suppliers: ranked });
}
