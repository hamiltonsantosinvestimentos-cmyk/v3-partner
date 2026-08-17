import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// GET — retorna perfil do usuário autenticado
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile, error } = await serviceClient()
    .from("profiles")
    .select("id, full_name, email, role, avatar_url, phone, document_cpf, nationality, marital_status, profession, is_socio, created_at, last_login_at, is_active, onboarding_dismissed")
    .eq("id", user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Retorna email do auth se não estiver no profile
  return NextResponse.json({ profile: { ...profile, email: profile?.email ?? user.email } });
}

// PATCH — atualiza nome, telefone do usuário autenticado
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  // 17/08/2026: nationality/marital_status/profession adicionados —
  // fecham o bloqueio de CPF de lib/ncnda-desk-head.ts (Hamilton/Robson),
  // cada Head da mesa preenche a própria qualificação jurídica aqui,
  // mesmo padrão de auto-edição já usado para document_cpf.
  const allowed = ["full_name", "phone", "document_cpf", "nationality", "marital_status", "profession", "cobranding_slug", "cobranding_bio", "cobranding_whatsapp", "cobranding_instagram", "onboarding_dismissed"];
  const updates: Record<string, string> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nenhum campo válido para atualizar" }, { status: 400 });
  }

  const { data, error } = await serviceClient()
    .from("profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, profile: data });
}
