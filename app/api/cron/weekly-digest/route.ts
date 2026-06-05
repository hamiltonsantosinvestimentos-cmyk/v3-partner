import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const runtime = "nodejs";

export async function GET(req: Request) {
  // Validate cron secret
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all active partners
  const { data: partners } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .in("role", ["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE"])
    .eq("is_active", true);

  if (!partners?.length) return NextResponse.json({ ok: true, sent: 0 });

  const results = await Promise.allSettled(
    partners.map(async (partner) => {
      // Get their commissions and leads (last 7 days)
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [commissionsRes, leadsRes] = await Promise.all([
        supabase
          .from("commissions")
          .select("commission_value, status, operation_type")
          .eq("partner_id", partner.id)
          .gte("created_at", weekAgo),
        supabase
          .from("marketplace_leads")
          .select("id, status")
          .eq("partner_id", partner.id)
          .gte("created_at", weekAgo),
      ]);

      const weekCommissions = commissionsRes.data ?? [];
      const weekLeads = leadsRes.data ?? [];

      const totalEarned = weekCommissions
        .filter((c) => c.status === "PAGA")
        .reduce((s, c) => s + (c.commission_value ?? 0), 0);
      const pending = weekCommissions
        .filter((c) => c.status === "A_PAGAR")
        .reduce((s, c) => s + (c.commission_value ?? 0), 0);
      const convertedLeads = weekLeads.filter((l) => l.status === "CLOSED_WON").length;

      // Create in-app notification with weekly summary
      await supabase.from("notifications").insert({
        user_id: partner.id,
        title: "Seu resumo semanal V3 Partners",
        message: `Esta semana: ${weekCommissions.length} comissões (R$${totalEarned.toFixed(2)} recebido, R$${pending.toFixed(2)} a receber) · ${weekLeads.length} leads marketplace (${convertedLeads} convertidos)`,
        type: "info",
        action_url: "/comissoes",
      });

      return { partner_id: partner.id, ok: true };
    })
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  return NextResponse.json({ ok: true, sent, total: partners.length });
}
