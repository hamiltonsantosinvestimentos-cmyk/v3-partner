import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { sendMonthlyReport } from "@/lib/email";
import Anthropic from "@anthropic-ai/sdk";

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
    .in("role", ["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE"])
    .eq("is_active", true);

  if (!partners || partners.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  let sent = 0;
  const erros: string[] = [];

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const OP_LABELS: Record<string, string> = {
    CREDITO: "crédito estruturado",
    MA: "M&A",
    CONSORCIO: "consórcio",
    SPLIT_FISCAL: "split fiscal",
    MARKETPLACE: "marketplace financeiro",
  };

  for (const partner of partners) {
    try {
      // Comissões do mês anterior (com operation_type para insights de IA)
      const { data: prevMonthCommissions } = await svc()
        .from("commissions")
        .select("commission_value, status, operation_type")
        .eq("partner_id", partner.id)
        .gte("created_at", inicioMesAnterior.toISOString())
        .lte("created_at", fimMesAnterior.toISOString());

      const commissions = prevMonthCommissions ?? [];

      // Operações do mês anterior
      const { count: totalOps } = await svc()
        .from("credit_desk_proposals")
        .select("*", { count: "exact", head: true })
        .eq("partner_id", partner.id)
        .gte("created_at", inicioMesAnterior.toISOString())
        .lte("created_at", fimMesAnterior.toISOString());

      const totalRecebido = commissions.filter(c => c.status === "PAGA").reduce((s, c) => s + c.commission_value, 0);
      const totalPendente = commissions.filter(c => c.status === "A_PAGAR").reduce((s, c) => s + c.commission_value, 0);

      // Determina operação principal para personalizar insights de IA
      const opCounts: Record<string, number> = {};
      commissions.forEach((c: { operation_type?: string }) => {
        if (c.operation_type) {
          opCounts[c.operation_type] = (opCounts[c.operation_type] ?? 0) + 1;
        }
      });
      const topOp = Object.entries(opCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "CREDITO";
      const topOpLabel = OP_LABELS[topOp] ?? "crédito estruturado";

      // Gera insights de mercado com IA (não bloqueante — falha silenciosa)
      let aiInsights = "";
      try {
        const msg = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 300,
          messages: [{
            role: "user",
            content: `Você é analista financeiro da V3 Partners. Gere 3 insights de mercado CONCISOS e ACIONÁVEIS para um assessor financeiro no Brasil especializado em ${topOpLabel}. Contexto: Selic ~13,25%, mercado de crédito estruturado aquecido. Formato: 3 bullets curtos (máx 15 palavras cada). Em português. Sem markdown pesado.`,
          }],
        });
        aiInsights = msg.content[0].type === "text" ? msg.content[0].text : "";
      } catch {
        aiInsights = "";
      }

      await sendMonthlyReport({
        partnerEmail: partner.email,
        partnerName: partner.full_name ?? partner.email,
        plano: partner.role === "ENTERPRISE" ? "Enterprise" : partner.role === "PARTNER_PRO" ? "Partner PRO" : partner.role === "STARTER" ? "Starter" : "Partner",
        mes: mesLabel,
        totalRecebido,
        totalPendente,
        totalOperacoes: totalOps ?? 0,
        totalComissoes: commissions.length,
        aiInsights,
      });

      sent++;
    } catch {
      erros.push(partner.email);
    }
  }

  return NextResponse.json({ ok: true, sent, erros });
}
