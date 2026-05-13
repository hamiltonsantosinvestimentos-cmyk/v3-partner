import { NextRequest, NextResponse } from "next/server";
import { coraFetch } from "@/lib/cora";

// GET /api/cora/cobranca/status?id=inv_xxx — consulta status de um invoice
// Público: usado no polling da tela de cadastro (sem auth de admin)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  try {
    const res = await coraFetch(`/v2/invoices/${id}`);
    if (!res.ok) return NextResponse.json({ status: "UNKNOWN" });
    const data = await res.json() as { status?: string; payment_status?: string };
    const status = data.status ?? data.payment_status ?? "UNKNOWN";
    return NextResponse.json({ status });
  } catch {
    return NextResponse.json({ status: "UNKNOWN" });
  }
}
