import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

const PARTNER_ROLES = ["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// POST — desconecta Instagram/Messenger (a mesma Página cobre os dois).
// Só limpa os campos no nosso banco — não revoga o token na Meta (o partner
// pode fazer isso do lado dele em Configurações do Facebook > Apps, se quiser).
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!PARTNER_ROLES.includes(profile?.role as typeof PARTNER_ROLES[number])) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  await svc().from("partner_sdr_connections").update({
    meta_page_id: null,
    meta_page_name: null,
    meta_page_access_token_encrypted: null,
    messenger_status: "desconectado",
    instagram_business_account_id: null,
    instagram_username: null,
    instagram_status: "desconectado",
    meta_pending_pages: null,
    meta_pending_at: null,
    updated_at: new Date().toISOString(),
  }).eq("partner_id", user.id);

  return NextResponse.json({ ok: true });
}
