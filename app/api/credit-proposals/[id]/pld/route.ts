// GET /api/credit-proposals/{id}/pld — PLD informado pelo partner via API (Termo v2.1, 7.4).
// Só ADMIN, GESTAO e MESA_OPERACIONAL. Nunca para o partner nem pela API v1.
import { NextRequest, NextResponse } from "next/server";
import { chamador, svcDb } from "@/lib/integracao-api";

export const dynamic = "force-dynamic";

const MESA = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await chamador(req);
  if (!c) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!MESA.includes(c.role ?? "")) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const { data, error } = await svcDb().from("credit_proposal_pld")
    .select("pep, beneficiario_final, circunstancia_atipica, created_at").eq("proposal_id", id).maybeSingle();
  if (error) return NextResponse.json({ pld: null });
  return NextResponse.json({ pld: data ?? null });
}
