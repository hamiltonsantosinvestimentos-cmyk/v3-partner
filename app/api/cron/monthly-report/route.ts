import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { sendMonthlyReport } from "@/lib/email";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(req: NextRequest) {
  // Valida segredo do cron — Vercel passa o header Authorization
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Período: mês anterior
  const now = new Date();
  const inicioMesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const fimMesAnterior    = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const mesLabel = inicioMesAnterior.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  // Busca todos os partners ativos
  const { data: partners } = await svc()
    .from("profiles")
    .select("id, full_name, email, role")
    .in("role", ["PARTNER", "PARTNER_PRO"])
    .eq("is_active", true);

  if (!partners || partners.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  let sent = 0;
  const erros: string[] = [];

  for (const partner of partners) {
    try {
      // Comissões do mês anterior
      const { data: commissions } = await svc()
        .from("commissions")
        .select("commission_value, status")
        .eq("partner_id", partner.id)
        .gte("created_at", inicioMesAnterior.toISOString())
        .lte("created_at", fimMesAnterior.toISOString());

      // Operações do mês anterior
      const { count: totalOps } = await svc()
        .from("credit_desk_proposals")
        .select("*", { count: "exact", head: true })
        .eq("partner_id", partner.id)
        .gte("created_at", inicioMesAnterior.toISOString())
        .lte("created_at", fimMesAnterior.toISOString());

      const totalRecebido = (commissions ?? []).filter(c => c.status === "PAGA").reduce((s, c) => s + c.commission_value, 0);
      const totalPendente = (commissions ?? []).filter(c => c.status === "A_PAGAR").reduce((s, c) => s + c.commission_value, 0);

      await sendMonthlyReport({
        partnerEmail: partner.email,
        partnerName: partner.full_name ?? partner.email,
        plano: partner.role === "PARTNER_PRO" ? "Partner PRO" : "Partner",
        mes: mesLabel,
        totalRecebido,
        totalPendente,
        totalOperacoes: totalOps ?? 0,
        totalComissoes: (commissions ?? []).length,
      });

      sent++;
    } catch {
      erros.push(partner.email);
    }
  }

  return NextResponse.json({ ok: true, sent, erros });
}
