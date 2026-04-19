import { NextResponse } from "next/server";

const IS_DEMO = false;

export async function GET() {
  if (IS_DEMO) {
    return NextResponse.json([]);
  }

  // Verifica autenticação e role ADMIN antes de expor todos os perfis
  const { createClient, createServiceClient } = await import("@/lib/supabase/server");
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = await createServiceClient();
  const { data: caller } = await svc.from("profiles").select("role").eq("id", user.id).single();
  if (caller?.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 });
  }

  const { data, error } = await svc
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Erro ao buscar usuários" }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const { email, password, full_name, role, phone, document_cpf } = await request.json();

  if (IS_DEMO) {
    const fakeUser = {
      id: `demo-${Date.now()}`,
      email,
      full_name,
      role,
      phone: phone || null,
      document_cpf: document_cpf || null,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    return NextResponse.json({ user: fakeUser }, { status: 201 });
  }

  const { createServiceClient } = await import("@/lib/supabase/server");
  const supabase = await createServiceClient();

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const { data: newProfile, error: profileError } = await supabase
    .from("profiles")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ role, phone, full_name, document_cpf: document_cpf || null } as any)
    .eq("id", authData.user.id)
    .select()
    .single();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ user: newProfile }, { status: 201 });
}
