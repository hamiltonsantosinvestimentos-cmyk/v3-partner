import { NextResponse } from "next/server";

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

export async function GET() {
  if (IS_DEMO) return NextResponse.json([]);

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();

  if (!profile || !["ADMIN", "GESTAO"].includes(profile.role)) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("kyc_blacklist")
    .select("id, name, doc, nationality, type, notes, source, active, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  if (IS_DEMO) return NextResponse.json({ error: "Indisponível no demo" }, { status: 403 });

  const body = await req.json();
  const { name, doc, nationality, type = "v3", notes, source = "V3 Interno" } = body;

  if (!name) return NextResponse.json({ error: "name obrigatório" }, { status: 400 });

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role, id").eq("id", user.id).single();

  if (!profile || profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Apenas ADMIN pode adicionar à blacklist" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("kyc_blacklist")
    .insert({ name, doc, nationality, type, notes, source, added_by: profile.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: Request) {
  if (IS_DEMO) return NextResponse.json({ error: "Indisponível no demo" }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();

  if (!profile || profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Apenas ADMIN pode remover da blacklist" }, { status: 403 });
  }

  const { error } = await supabase.from("kyc_blacklist").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
