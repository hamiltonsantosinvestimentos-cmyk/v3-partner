import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { z } from "zod";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const registerSchema = z.object({
  company_name: z.string().min(2).max(200),
  cnpj: z.string().min(14).max(18),
  contact_name: z.string().min(2).max(200),
  email: z.string().email(),
  phone: z.string().min(10).max(20),
  city: z.string().min(2).max(100),
  state: z.string().length(2),
  website: z.union([z.string().url(), z.literal(""), z.null()]).optional().nullable(),
  description: z.string().min(20).max(2000),
  categories: z.array(z.string()).min(1).max(5),
  password: z.string().min(8),
});

/** POST /api/marketplace/suppliers — supplier self-registration */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = Object.values(parsed.error.flatten().fieldErrors).flat()[0]
        ?? parsed.error.flatten().formErrors[0]
        ?? "Dados inválidos";
      return NextResponse.json({ error: firstError }, { status: 422 });
    }

    const svc = serviceClient();
    const { company_name, cnpj, contact_name, email, phone, city, state, website, description, categories, password } = parsed.data;

    // Check if email already registered
    const { data: existing } = await svc
      .from("marketplace_suppliers")
      .select("id")
      .eq("email", email)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Email já cadastrado" }, { status: 409 });
    }

    // Create Supabase auth user
    const { data: authData, error: authError } = await svc.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: contact_name, role: "FORNECEDOR", company_name },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    // Insert supplier record
    const { data: supplier, error: insertError } = await svc
      .from("marketplace_suppliers")
      .insert({
        auth_user_id: authData.user.id,
        company_name,
        cnpj,
        contact_name,
        email,
        phone,
        city,
        state,
        website: website || null,
        description,
        categories,
        status: "PENDING",
      })
      .select()
      .single();

    if (insertError) {
      // Rollback auth user
      await svc.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ supplier: { id: supplier.id, status: supplier.status } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

/** GET /api/marketplace/suppliers — admin list suppliers */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = serviceClient();
  const { data: caller } = await svc.from("profiles").select("role").eq("id", user.id).single();
  if (!["ADMIN", "GESTAO"].includes(caller?.role ?? "")) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }

  const { data, error } = await svc
    .from("marketplace_suppliers")
    .select("id, company_name, cnpj, contact_name, email, phone, city, state, categories, status, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ suppliers: data ?? [] });
}

/** PATCH /api/marketplace/suppliers — admin approves/rejects supplier */
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = serviceClient();
  const { data: caller } = await svc.from("profiles").select("role").eq("id", user.id).single();
  if (!["ADMIN", "GESTAO"].includes(caller?.role ?? "")) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }

  const { id, status, rejection_reason } = await req.json();
  if (!id || !status) return NextResponse.json({ error: "id e status obrigatórios" }, { status: 400 });

  const { data, error } = await svc
    .from("marketplace_suppliers")
    .update({ status, rejection_reason: rejection_reason ?? null, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ supplier: data });
}
