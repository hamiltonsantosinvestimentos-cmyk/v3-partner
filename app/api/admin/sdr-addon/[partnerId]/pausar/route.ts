import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

const ADMIN_ROLES = ["ADMIN", "GESTAO"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// PATCH — pausa o add-on (ex: partner atrasou o pagamento). Bloqueia o
// acesso igual "não contratado", mas mantém a sessão WhatsApp e a config da
// IA guardadas — retomando depois, volta tudo como estava.
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

  const { error } = await db.from("partner_sdr_connections").update({
    addon_ativo: false,
    addon_status: "pausado",
    addon_pausado_em: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("partner_id", partnerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from("notifications").insert({
    user_id: partnerId,
    title: "Atendimento IA no WhatsApp pausado",
    message: "Seu add-on foi pausado. Fale com a V3 pra reativar.",
    type: "SDR_ADDON_PAUSADO",
    action_url: "/meu-atendimento-ia",
    read: false,
  });

  return NextResponse.json({ ok: true });
}
