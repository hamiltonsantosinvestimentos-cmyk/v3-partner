import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// GET — retorna certificados do usuário
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ certificates: [] });

  const { data } = await supabase
    .from("academy_certificates")
    .select("id, category_id, issued_at")
    .eq("user_id", user.id);

  return NextResponse.json({ certificates: data ?? [] });
}

// POST — emite certificado ao completar categoria (idempotente)
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { category_id } = await req.json();
  if (!category_id) return NextResponse.json({ error: "category_id obrigatório" }, { status: 400 });

  // Verifica se já tem certificado
  const { data: existing } = await supabase
    .from("academy_certificates")
    .select("id, issued_at")
    .eq("user_id", user.id)
    .eq("category_id", category_id)
    .single();

  if (existing) return NextResponse.json({ certificate: existing, already_had: true });

  // Emite novo certificado
  const { data, error } = await svc()
    .from("academy_certificates")
    .insert({ user_id: user.id, category_id })
    .select("id, issued_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ certificate: data, already_had: false });
}
