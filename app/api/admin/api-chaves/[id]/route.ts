// POST  /api/admin/api-chaves/{id} { acao: "revogar", motivo }       — ADMIN revoga qualquer chave.
// PATCH /api/admin/api-chaves/{id} { limite_por_minuto, limite_propostas_dia } — ADMIN ajusta limite.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chamador, emailHtml, svcDb } from "@/lib/integracao-api";
import { enviarEmailHtml } from "@/lib/email";
import { logAuditStrict } from "@/lib/audit";

export const dynamic = "force-dynamic";

async function emailDoPartner(partnerId: string): Promise<string | null> {
  const { data } = await svcDb().auth.admin.getUserById(partnerId);
  return data?.user?.email ?? null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await chamador(req);
  if (!c) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (c.role !== "ADMIN") return NextResponse.json({ error: "Acesso restrito ao ADMIN." }, { status: 403 });

  const parsed = z.object({ acao: z.literal("revogar"), motivo: z.string().trim().min(10, "Motivo com pelo menos 10 caracteres.").max(500) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });

  const db = svcDb();
  const { data: k } = await db.from("partner_api_keys").select("id, partner_id, nome, prefixo, revogada_em").eq("id", id).maybeSingle();
  if (!k) return NextResponse.json({ error: "Chave não encontrada." }, { status: 404 });
  if (k.revogada_em) return NextResponse.json({ error: "Chave já revogada." }, { status: 409 });

  // Auditoria antes: se não gravar, a revogação não acontece sem rastro.
  try {
    await logAuditStrict({ userId: c.id, userName: c.nome, action: "UPDATE", entity: "profiles", entityId: k.partner_id, ipAddress: c.ip,
      newData: { evento: "api_chave_revogada", key_id: id, prefixo: k.prefixo, por: "ADMIN", motivo: parsed.data.motivo } });
  } catch {
    return NextResponse.json({ error: "Não foi possível registrar a auditoria. Nada foi alterado." }, { status: 500 });
  }
  const { error } = await db.from("partner_api_keys")
    .update({ revogada_em: new Date().toISOString(), revogada_por: c.id, motivo_revogacao: parsed.data.motivo })
    .eq("id", id).is("revogada_em", null);
  if (error) return NextResponse.json({ error: "Não foi possível revogar. Tente de novo." }, { status: 500 });

  const email = await emailDoPartner(k.partner_id);
  if (email) {
    enviarEmailHtml(email, "Sua chave de API da V3 foi revogada", emailHtml("Chave de API revogada pela V3", [
      `A chave <b>${k.nome}</b> (${k.prefixo}…) foi revogada pela V3 e parou de funcionar.`,
      `Motivo: ${parsed.data.motivo.replace(/</g, "&lt;")}`,
      "Para criar outra chave, acesse Integração por API na plataforma.",
    ])).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await chamador(req);
  if (!c) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (c.role !== "ADMIN") return NextResponse.json({ error: "Acesso restrito ao ADMIN." }, { status: 403 });

  const parsed = z.object({
    limite_por_minuto: z.number().int().min(1).max(600),
    limite_propostas_dia: z.number().int().min(1).max(5000),
  }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Limites inválidos: de 1 a 600 por minuto e de 1 a 5.000 propostas por dia." }, { status: 400 });

  const db = svcDb();
  const { data: k } = await db.from("partner_api_keys").select("partner_id, prefixo, limite_por_minuto, limite_propostas_dia").eq("id", id).maybeSingle();
  if (!k) return NextResponse.json({ error: "Chave não encontrada." }, { status: 404 });
  try {
    await logAuditStrict({ userId: c.id, userName: c.nome, action: "UPDATE", entity: "profiles", entityId: k.partner_id, ipAddress: c.ip,
      oldData: { limite_por_minuto: k.limite_por_minuto, limite_propostas_dia: k.limite_propostas_dia },
      newData: { evento: "api_chave_limite", key_id: id, prefixo: k.prefixo, ...parsed.data } });
  } catch {
    return NextResponse.json({ error: "Não foi possível registrar a auditoria. Nada foi alterado." }, { status: 500 });
  }
  const { error } = await db.from("partner_api_keys").update(parsed.data).eq("id", id);
  if (error) return NextResponse.json({ error: "Não foi possível salvar. Tente de novo." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
