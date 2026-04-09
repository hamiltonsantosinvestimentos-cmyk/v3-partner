import { NextResponse } from "next/server";

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

export async function GET() {
  if (IS_DEMO) {
    return NextResponse.json([]);
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();

  if (!profile || !["ADMIN", "GESTAO"].includes(profile.role)) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }

  // RLS já aplica filtro: ADMIN vê tudo, GESTAO vê apenas as próprias
  const { data, error } = await supabase
    .from("kyc_analyses")
    .select("id, entity_doc, entity_name, entity_type, operation_type, dd_level, score, risk_label, verdict, sources_used, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
