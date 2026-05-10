import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** GET /api/marketplace/export-leads — admin exports all leads as CSV */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = serviceClient();
  const { data: caller } = await svc.from("profiles").select("role").eq("id", user.id).single();
  if (!["ADMIN", "GESTAO"].includes((caller as { role: string } | null)?.role ?? "")) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }

  const productId = new URL(req.url).searchParams.get("product_id");

  let query = svc
    .from("marketplace_leads")
    .select(`
      id, status, message, client_name, client_contact, notes, created_at,
      product:marketplace_products(name, category, commission_percent),
      partner:profiles(full_name, email),
      supplier:marketplace_suppliers(company_name)
    `)
    .order("created_at", { ascending: false });

  if (productId) query = query.eq("product_id", productId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as Array<{
    id: string;
    status: string;
    message: string | null;
    client_name: string | null;
    client_contact: string | null;
    notes: string | null;
    created_at: string;
    product: { name: string; category: string; commission_percent: number } | null;
    partner: { full_name: string; email: string } | null;
    supplier: { company_name: string } | null;
  }>;

  const headers = ["Data", "Status", "Produto", "Categoria", "Fornecedor", "Partner", "Email Partner", "Cliente", "Contato Cliente", "Mensagem", "Notas"];
  const escape = (v: string | null | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`;

  const csvRows = rows.map(r => [
    new Date(r.created_at).toLocaleDateString("pt-BR"),
    r.status,
    escape(r.product?.name),
    escape(r.product?.category),
    escape(r.supplier?.company_name),
    escape(r.partner?.full_name),
    escape(r.partner?.email),
    escape(r.client_name),
    escape(r.client_contact),
    escape(r.message),
    escape(r.notes),
  ].join(","));

  const csv = [headers.join(","), ...csvRows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="marketplace-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
