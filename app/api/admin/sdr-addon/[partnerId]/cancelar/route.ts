import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

const ADMIN_ROLES = ["ADMIN", "GESTAO"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// PATCH — cancela definitivamente o add-on. Também desconecta a sessão
// WhatsApp no gateway (logout), pra não deixar número conectado ocupando
// espaço à toa; se o partner contratar de novo, escaneia um QR novo.
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ partnerId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number])) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { partnerId } = await params;
  const db = svc();

  const { data: conexao } = await db
    .from("partner_sdr_connections")
    .select("openwa_session_id")
    .eq("partner_id", partnerId)
    .maybeSingle();

  if (conexao?.openwa_session_id) {
    try {
      await fetch(`${process.env.OPENWA_API_URL}/api/sessions/${conexao.openwa_session_id}/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENWA_API_KEY}` },
      });
    } catch {
      // best-effort -- não bloqueia o cancelamento se o gateway estiver fora
    }
  }

  const { error } = await db.from("partner_sdr_connections").update({
    addon_ativo: false,
    addon_status: "cancelado",
    addon_cancelado_em: new Date().toISOString(),
    status: "desconectado",
    updated_at: new Date().toISOString(),
  }).eq("partner_id", partnerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from("notifications").insert({
    user_id: partnerId,
    title: "Add-on de Atendimento IA cancelado",
    message: "Sua assinatura foi cancelada. Fale com a V3 se quiser contratar de novo.",
    type: "SDR_ADDON_CANCELADO",
    action_url: "/meu-atendimento-ia",
    read: false,
  });

  return NextResponse.json({ ok: true });
}
