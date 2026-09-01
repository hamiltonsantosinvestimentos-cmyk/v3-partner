import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import {
  DEFAULT_SLA, PROPOSAL_TERMINAL_STAGES, getSlaStatus, getTicketSlaStatus,
  type SlaConfig,
} from "@/lib/mesa-operacional-sla";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// GET /api/cron/mesa-operacional-sla-alert — cron diário (ver vercel.json).
// Varre propostas de crédito (não terminais) e tickets operacionais (não
// concluídos/cancelados) com SLA vencendo hoje ("warning") ou já vencido
// ("danger"), e notifica só ADMIN + MESA_OPERACIONAL — GESTAO fica de fora
// deliberadamente aqui (pedido do Hamilton: "somente para o admin,
// operacional"), diferente do padrão usado em cm-sla-alert.
// Mesmo padrão de auth Bearer CRON_SECRET dos demais /api/cron/*.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const db = svc();

  const { data: slaConfigRow } = await db
    .from("mesa_operacional_sla_config")
    .select("config")
    .eq("id", "default")
    .maybeSingle();
  const slaConfig: SlaConfig = { ...DEFAULT_SLA, ...(slaConfigRow?.config as Partial<SlaConfig> | undefined) };

  // ── Propostas de crédito com SLA vencendo/vencido ──────────────────────
  const { data: proposals } = await db
    .from("credit_desk_proposals")
    .select("id, code, client_name, stage, created_at, metadata")
    .not("stage", "in", `(${PROPOSAL_TERMINAL_STAGES.join(",")})`);

  const propostasAlerta = (proposals ?? [])
    .map((p) => ({ ...p, sla: getSlaStatus(p, slaConfig) }))
    .filter((p) => p.sla && (p.sla.status === "warning" || p.sla.status === "danger"));

  // ── Tickets operacionais com prazo vencendo/vencido ────────────────────
  const { data: tickets } = await db
    .from("operational_tickets")
    .select("id, code, title, due_date, status")
    .not("status", "in", "(COMPLETED,CANCELLED)")
    .not("due_date", "is", null);

  const ticketsAlerta = (tickets ?? [])
    .map((t) => ({ ...t, sla: getTicketSlaStatus(t) }))
    .filter((t) => t.sla === "warning" || t.sla === "danger");

  if (propostasAlerta.length === 0 && ticketsAlerta.length === 0) {
    return NextResponse.json({ ok: true, alertas: 0 });
  }

  const vencidas = propostasAlerta.filter((p) => p.sla!.status === "danger");
  const vencendo = propostasAlerta.filter((p) => p.sla!.status === "warning");
  const ticketsVencidos = ticketsAlerta.filter((t) => t.sla === "danger");
  const ticketsVencendo = ticketsAlerta.filter((t) => t.sla === "warning");

  const linhas: string[] = [];
  if (vencidas.length) linhas.push(`🔴 ${vencidas.length} proposta(s) vencida(s): ${vencidas.map((p) => `${p.code ?? p.client_name} (${Math.abs(p.sla!.daysLeft)}d)`).join(", ")}`);
  if (vencendo.length) linhas.push(`⚠️ ${vencendo.length} proposta(s) vencendo hoje: ${vencendo.map((p) => p.code ?? p.client_name).join(", ")}`);
  if (ticketsVencidos.length) linhas.push(`🔴 ${ticketsVencidos.length} ticket(s) vencido(s): ${ticketsVencidos.map((t) => t.code ?? t.title).join(", ")}`);
  if (ticketsVencendo.length) linhas.push(`⚠️ ${ticketsVencendo.length} ticket(s) vencendo hoje: ${ticketsVencendo.map((t) => t.code ?? t.title).join(", ")}`);

  const totalAlertas = propostasAlerta.length + ticketsAlerta.length;

  const { data: mesaUsers } = await db
    .from("profiles")
    .select("id")
    .in("role", ["ADMIN", "MESA_OPERACIONAL"])
    .eq("is_active", true);

  if (mesaUsers?.length) {
    await db.from("notifications").insert(
      mesaUsers.map((u: { id: string }) => ({
        user_id: u.id,
        title: `⏰ ${totalAlertas} item(ns) com SLA vencendo ou vencido na Mesa Operacional`,
        message: linhas.join(" · "),
        type: "mesa_operacional_sla",
        action_url: "/mesa-operacional",
        read: false,
      }))
    );
  }

  return NextResponse.json({ ok: true, alertas: totalAlertas, propostas: propostasAlerta.length, tickets: ticketsAlerta.length });
}
