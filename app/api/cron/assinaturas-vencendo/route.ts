import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Roda diariamente via Vercel Cron (vercel.json) ou chamada manual
// Authorization: Bearer <CRON_SECRET>
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const now = new Date();
  const em7dias = new Date(now);
  em7dias.setDate(em7dias.getDate() + 7);

  // Busca partners com trial expirando nos próximos 7 dias (ou já expirado e ainda ativos)
  const { data: partners } = await svc()
    .from("profiles")
    .select("id, full_name, email, role, trial_expires_at, created_at, is_active")
    .in("role", ["PARTNER", "PARTNER_PRO"])
    .eq("is_active", true);

  if (!partners || partners.length === 0) {
    return NextResponse.json({ ok: true, notificados: 0 });
  }

  // Filtra quem vence em até 7 dias
  const vencendo = partners.filter(p => {
    const expires = p.trial_expires_at
      ? new Date(p.trial_expires_at).getTime()
      : new Date(p.created_at).getTime() + 30 * 86400000;
    const diasRestantes = Math.floor((expires - now.getTime()) / 86400000);
    return diasRestantes >= 0 && diasRestantes <= 7;
  });

  if (vencendo.length === 0) {
    return NextResponse.json({ ok: true, notificados: 0 });
  }

  // Busca todos os admins ativos
  const { data: admins } = await svc()
    .from("profiles")
    .select("id")
    .eq("role", "ADMIN")
    .eq("is_active", true);

  if (!admins || admins.length === 0) {
    return NextResponse.json({ ok: true, notificados: 0 });
  }

  // Monta lista resumida dos que vão vencer
  const lista = vencendo.map(p => {
    const expires = p.trial_expires_at
      ? new Date(p.trial_expires_at).getTime()
      : new Date(p.created_at).getTime() + 30 * 86400000;
    const dias = Math.max(Math.floor((expires - now.getTime()) / 86400000), 0);
    const plano = p.role === "PARTNER_PRO" ? "Partner PRO" : "Partner";
    return `${p.full_name ?? p.email} (${plano}) — ${dias === 0 ? "vence hoje" : `vence em ${dias}d`}`;
  }).join("; ");

  // Cria uma notificação por admin com resumo de todos
  await svc().from("notifications").insert(
    admins.map(a => ({
      user_id: a.id,
      title: `⚠️ ${vencendo.length} assinatura(s) vencendo`,
      message: `Partners com acesso próximo do vencimento: ${lista}. Acesse Financeiro → Assinaturas para renovar.`,
      type: "ASSINATURA_VENCENDO",
      action_url: "/financeiro",
      read: false,
    }))
  );

  return NextResponse.json({ ok: true, notificados: vencendo.length, lista: vencendo.map(p => p.email) });
}
