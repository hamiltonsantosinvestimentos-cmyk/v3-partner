import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Roda todo dia útil às 8h via Vercel Cron
// Authorization: Bearer <CRON_SECRET>
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const hoje = new Date();
  const diaSemana = hoje.getDay(); // 0=dom, 6=sáb
  if (diaSemana === 0 || diaSemana === 6) {
    return NextResponse.json({ ok: true, skipped: "fim de semana" });
  }

  const hojeStr = hoje.toISOString().split("T")[0]; // YYYY-MM-DD

  // ── 1. Follow-ups de HOJE ─────────────────────────────────────────────────
  const { data: leadsHoje } = await svc()
    .from("crm_leads")
    .select("id, name, phone, segment, status, next_contact, created_by, partner_id")
    .eq("next_contact", hojeStr)
    .not("status", "in", '("ganho","perdido")');

  // ── 2. Leads esquecidos (sem interação/contato há 7+ dias) ────────────────
  const seteDiasAtras = new Date(hoje);
  seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
  const seteDiasStr = seteDiasAtras.toISOString().split("T")[0];

  const { data: leadsEsquecidos } = await svc()
    .from("crm_leads")
    .select("id, name, phone, segment, status, next_contact, created_by, partner_id")
    .or(`next_contact.lt.${seteDiasStr},next_contact.is.null`)
    .not("status", "in", '("ganho","perdido")')
    .lt("created_at", seteDiasAtras.toISOString());

  const notificacoes = new Map<string, {
    userId: string;
    email: string;
    name: string;
    hoje: typeof leadsHoje;
    esquecidos: typeof leadsEsquecidos;
  }>();

  // Agrupa por partner
  const agrupar = (leads: typeof leadsHoje, tipo: "hoje" | "esquecidos") => {
    if (!leads) return;
    for (const lead of leads) {
      const uid = lead.partner_id ?? lead.created_by;
      if (!uid) continue;
      if (!notificacoes.has(uid)) {
        notificacoes.set(uid, { userId: uid, email: "", name: "", hoje: [], esquecidos: [] });
      }
      const entry = notificacoes.get(uid)!;
      if (tipo === "hoje") entry.hoje = [...(entry.hoje ?? []), lead];
      else entry.esquecidos = [...(entry.esquecidos ?? []), lead];
    }
  };

  agrupar(leadsHoje, "hoje");
  agrupar(leadsEsquecidos, "esquecidos");

  if (notificacoes.size === 0) {
    return NextResponse.json({ ok: true, notificados: 0 });
  }

  // Busca e-mails e nomes dos partners em lote
  const uids = Array.from(notificacoes.keys());
  const { data: profiles } = await svc()
    .from("profiles")
    .select("id, full_name, email")
    .in("id", uids);

  for (const p of profiles ?? []) {
    if (notificacoes.has(p.id)) {
      const entry = notificacoes.get(p.id)!;
      entry.email = p.email;
      entry.name  = p.full_name ?? "Parceiro";
    }
  }

  const { notifyFollowUpsDodia } = await import("@/lib/email");
  const { createNotification } = await import("@/lib/notify");

  let notificados = 0;

  for (const entry of notificacoes.values()) {
    if (!entry.email) continue;

    const totalHoje     = (entry.hoje ?? []).length;
    const totalEsquec   = (entry.esquecidos ?? []).length;

    // Notificação in-app — follow-ups de hoje
    if (totalHoje > 0) {
      const nomes = (entry.hoje ?? []).slice(0, 3).map((l) => l.name).join(", ");
      const extra = totalHoje > 3 ? ` +${totalHoje - 3}` : "";
      await createNotification({
        user_id:    entry.userId,
        type:       "info",
        title:      `📞 ${totalHoje} follow-up${totalHoje > 1 ? "s" : ""} para hoje`,
        message:    `${nomes}${extra}`,
        action_url: "/crm",
      });
    }

    // Notificação in-app — leads esquecidos
    if (totalEsquec > 0) {
      await createNotification({
        user_id:    entry.userId,
        type:       "info",
        title:      `⚠ ${totalEsquec} lead${totalEsquec > 1 ? "s" : ""} sem contato há 7+ dias`,
        message:    "Retome o contato para não perder oportunidades",
        action_url: "/crm",
      });
    }

    // E-mail de resumo (somente se tiver follow-ups de hoje)
    if (totalHoje > 0 || totalEsquec > 0) {
      await notifyFollowUpsDodia({
        partnerEmail:     entry.email,
        partnerName:      entry.name,
        followUpsHoje:    (entry.hoje ?? []).map((l) => ({ name: l.name, phone: l.phone, segment: l.segment })),
        leadsEsquecidos:  (entry.esquecidos ?? []).slice(0, 5).map((l) => ({ name: l.name, diasSemContato: Math.floor((Date.now() - new Date(l.next_contact ?? hoje).getTime()) / 86400000) })),
      });
      notificados++;
    }
  }

  return NextResponse.json({ ok: true, notificados });
}
