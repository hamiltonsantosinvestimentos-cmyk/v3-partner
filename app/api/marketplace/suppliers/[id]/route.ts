import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** GET /api/marketplace/suppliers/[id] — supplier fetches own profile */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const svc = serviceClient();

  const { data, error } = await svc
    .from("marketplace_suppliers")
    .select("id, company_name, cnpj, contact_name, email, phone, city, state, website, description, categories, status")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Fornecedor não encontrado" }, { status: 404 });
  return NextResponse.json({ supplier: data });
}

/** PATCH /api/marketplace/suppliers/[id] — supplier edits own profile */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const allowed = ["company_name", "contact_name", "phone", "city", "state", "website", "description", "categories"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) {
      update[key] = key === "website" ? (body[key] || null) : body[key];
    }
  }

  const svc = serviceClient();
  const { data, error } = await svc
    .from("marketplace_suppliers")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ supplier: data });
}

/** DELETE /api/marketplace/suppliers/[id] — admin deletes supplier */
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

  const { error } = await svc.from("marketplace_suppliers").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
