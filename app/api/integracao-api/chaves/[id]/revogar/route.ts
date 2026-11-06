// POST /api/integracao-api/chaves/{id}/revogar — o partner revoga a própria chave.
import { NextRequest, NextResponse } from "next/server";
import { chamador, emailHtml, svcDb } from "@/lib/integracao-api";
import { enviarEmailHtml } from "@/lib/email";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await chamador(req);
  if (!c) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svcDb();
  const { data, error } = await db.from("partner_api_keys")
    .update({ revogada_em: new Date().toISOString(), revogada_por: c.id, motivo_revogacao: "Revogada pelo partner" })
    .eq("id", id).eq("partner_id", c.id).is("revogada_em", null)
    .select("id, nome, prefixo").maybeSingle();
  if (error) return NextResponse.json({ error: "Não foi possível revogar. Tente de novo." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Chave não encontrada ou já revogada." }, { status: 404 });

  await logAudit({ userId: c.id, userName: c.nome, action: "UPDATE", entity: "profiles", entityId: c.id, ipAddress: c.ip,
    newData: { evento: "api_chave_revogada", key_id: id, prefixo: data.prefixo, por: "partner" } });
  if (c.email) {
    enviarEmailHtml(c.email, "Chave de API revogada na V3", emailHtml("Chave de API revogada", [
      `A chave <b>${data.nome}</b> (${data.prefixo}…) foi revogada e parou de funcionar.`,
    ])).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
