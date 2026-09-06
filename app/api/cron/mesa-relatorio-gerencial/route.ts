import { NextRequest, NextResponse } from "next/server";
import { gerarRelatorioGerencial } from "@/lib/mesa-relatorio-gerencial";

// BRIEF aprovado por João em 05/09/2026 (2026-09-05_Operacional_BRIEF-
// Relatorio-Gerencial-Mesa-MA-Bolsa-Ativos_v1.html), "Go". Reaproveita o
// mesmo padrão de cron já em produção 3x (weekly-digest, monthly-report,
// cm-sla-alert): Bearer CRON_SECRET, chamado por workflow n8n thin-trigger.
//
// 05/09/2026, mesmo dia: lógica de cálculo extraída para
// lib/mesa-relatorio-gerencial.ts (BRIEF "Painel de Governança da
// Diretoria /socios"), reaproveitada também pela geração sob demanda em
// POST /api/socios/relatorio-gerencial. Esta rota nunca muda de
// comportamento para os 2 workflows n8n já agendados: sem `mesa` na
// query string, o padrão continua sendo "todas" (as duas mesas juntas,
// igual sempre foi).
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const period = url.searchParams.get("period") ?? "";
  const mesa = url.searchParams.get("mesa");

  const result = await gerarRelatorioGerencial(period, mesa);
  if ("error" in result) return NextResponse.json(result, { status: 422 });
  return NextResponse.json(result);
}
