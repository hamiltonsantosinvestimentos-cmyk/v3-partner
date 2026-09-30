import { NextRequest, NextResponse } from "next/server";
import { dispatchMovementEmails } from "@/lib/movement-email";

export const maxDuration = 60;

// GET /api/cron/movement-emails (30/09/2026, Entrega 2): rede de segurança diária. Reenvia o que
// ficou pendente ou travado em "enviando" (por exemplo, n8n fora do ar na hora da transição).
// O envio normal acontece na própria transição; aqui só se reprocessa a fila. Bearer CRON_SECRET.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const result = await dispatchMovementEmails({ limit: 100 });
  return NextResponse.json({ ok: true, ...result });
}
