import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Roda a cada 10 minutos via Vercel Cron
// Previne cold start de 30s no n8n Render (idle timeout de 15min)
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const n8nBase = process.env.N8N_API_URL?.replace("/api/v1", "");
  if (!n8nBase) {
    return NextResponse.json({ ok: false, reason: "N8N_API_URL não configurada" });
  }

  try {
    const res = await fetch(`${n8nBase}/healthz`, {
      method: "GET",
      signal: AbortSignal.timeout(8000),
    });
    return NextResponse.json({ ok: true, status: res.status, ts: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg, ts: new Date().toISOString() });
  }
}
