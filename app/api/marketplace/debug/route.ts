import { NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** GET /api/marketplace/debug — verifica estado do banco */
export async function GET() {
  const svc = serviceClient();

  const [leadsRes, suppliersRes, productsRes] = await Promise.all([
    svc.from("marketplace_leads").select("id, supplier_id, partner_id, status, created_at").order("created_at", { ascending: false }).limit(10),
    svc.from("marketplace_suppliers").select("id, company_name, status").limit(10),
    svc.from("marketplace_products").select("id, name, supplier_id, status").limit(10),
  ]);

  return NextResponse.json({
    leads: {
      count: leadsRes.data?.length ?? 0,
      error: leadsRes.error?.message ?? null,
      data: leadsRes.data ?? [],
    },
    suppliers: {
      count: suppliersRes.data?.length ?? 0,
      error: suppliersRes.error?.message ?? null,
      data: suppliersRes.data ?? [],
    },
    products: {
      count: productsRes.data?.length ?? 0,
      error: productsRes.error?.message ?? null,
      data: productsRes.data ?? [],
    },
  });
}
