import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notify";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** POST /api/financeiro/notificar-vencendo
 * Body: { dias: number (padrão 7) }
 * Envia notificação in-app para partners com assinatura vencendo em até N dias.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: me } = await serviceClient().from("profiles").select("role").eq("id", user.id).single();
  if (!["ADMIN", "FINANCEIRO", "GESTAO"].includes((me as { role: string } | null)?.role ?? "")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const dias = Math.min(Math.max(Number(body.dias ?? 7), 1), 30);

  const svc = serviceClient();
  const { data: partners } = await svc
    .from("profiles")
    .select("id, full_name, trial_expires_at, is_active")
    .in("role", ["PARTNER", "PARTNER_PRO"])
    .eq("is_active", true)
    .not("trial_expires_at", "is", null);

  const now = Date.now();
  const limite = now + dias * 86400000;

  const vencendo = (partners ?? []).filter(p => {
    const exp = new Date(p.trial_expires_at!).getTime();
    return exp >= now && exp <= limite;
  });

  let notificados = 0;
  for (const p of vencendo) {
    const diasRestantes = Math.floor((new Date(p.trial_expires_at!).getTime() - now) / 86400000);
    await createNotification({
      user_id: p.id,
      type: "subscription",
      title: diasRestantes === 0
        ? "⚠️ Sua assinatura vence hoje!"
        : `⚠️ Sua assinatura vence em ${diasRestantes} dia${diasRestantes === 1 ? "" : "s"}`,
      message: "Renove agora para não perder o acesso à plataforma V3 Partners.",
      action_url: "/minha-assinatura",
    });
    notificados++;
  }

  return NextResponse.json({ ok: true, notificados });
}
