import { NextRequest, NextResponse } from "next/server";
import { archiveClickSignSignedDocuments } from "@/lib/clicksign-archive";

export const maxDuration = 120;

// Fase 2 do ciclo ClickSign. Mesmo padrão de auth Bearer CRON_SECRET dos
// demais /api/cron/* (ver app/api/cron/cm-sla-alert/route.ts).
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const result = await archiveClickSignSignedDocuments();

  if (!result.ok) {
    console.error("[cron/clicksign-archive] falha:", result.error);
    return NextResponse.json(result, { status: 502 });
  }

  if (result.orphaned.length > 0) {
    console.warn("[cron/clicksign-archive] e-mails com PDF não correlacionados a nenhum contrato:", result.orphaned);
  }

  return NextResponse.json(result);
}
