import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

const PARTNER_ROLES = ["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// POST — partner pede pra contratar o add-on de Atendimento IA no WhatsApp
// (R$29,90/mês, ativação manual). Marca o pedido e avisa ADMIN/GESTAO via
// notificação — Hamilton confirma o pagamento por fora e ativa com um clique
// em /api/admin/sdr-addon/[partnerId]/ativar.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!PARTNER_ROLES.includes(profile?.role as typeof PARTNER_ROLES[number])) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const db = svc();

  const { data: existente } = await db
    .from("partner_sdr_connections")
    .select("addon_ativo, addon_solicitado_em")
    .eq("partner_id", user.id)
    .maybeSingle();

  if (existente?.addon_ativo) {
    return NextResponse.json({ ok: true, ja_ativo: true });
  }

  await db.from("partner_sdr_connections").upsert({
    partner_id: user.id,
    addon_solicitado_em: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "partner_id" });

  const { data: admins } = await db.from("profiles").select("id").in("role", ["ADMIN", "GESTAO"]);
  if (admins?.length) {
    await db.from("notifications").insert(
      admins.map((a) => ({
        user_id: a.id,
        title: "Novo pedido de add-on: Atendimento IA WhatsApp",
        message: `${profile?.full_name ?? "Um partner"} quer contratar o add-on de R$29,90/mês. Confirme o pagamento e ative.`,
        type: "SDR_ADDON_SOLICITADO",
        action_url: "/admin-sdr-addon",
        read: false,
      }))
    );
  }

  return NextResponse.json({ ok: true });
}
