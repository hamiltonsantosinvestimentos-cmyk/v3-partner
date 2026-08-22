import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

const ADMIN_ROLES = ["ADMIN", "GESTAO"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// GET — lista pedidos do add-on de Atendimento IA WhatsApp (pendentes e já ativos)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number])) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const db = svc();
  const { data: conexoes } = await db
    .from("partner_sdr_connections")
    .select("partner_id, status, whatsapp_phone, addon_ativo, addon_solicitado_em, addon_ativado_em")
    .not("addon_solicitado_em", "is", null)
    .order("addon_solicitado_em", { ascending: false });

  const partnerIds = (conexoes ?? []).map((c) => c.partner_id);
  const { data: perfis } = partnerIds.length
    ? await db.from("profiles").select("id, full_name, email").in("id", partnerIds)
    : { data: [] };
  const perfilMap = new Map((perfis ?? []).map((p) => [p.id, p]));

  const pedidos = (conexoes ?? []).map((c) => ({
    ...c,
    partner_nome: perfilMap.get(c.partner_id)?.full_name ?? null,
    partner_email: perfilMap.get(c.partner_id)?.email ?? null,
  }));

  return NextResponse.json({ pedidos });
}
