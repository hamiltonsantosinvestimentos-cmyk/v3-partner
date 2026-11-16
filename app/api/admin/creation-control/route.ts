// POST /api/admin/creation-control: ADMIN suspende ou libera a criação de operações de um usuário (BRIEF 15/11/2026).
// Só o login continua ativo; o usuário recebe a mensagem de suspensão com o contato da compliance.
// Papel ADMIN validado aqui no servidor (esconder o botão não basta). A auditoria é gravada com await ANTES de mudar o
// estado: se a auditoria falhar, nada muda. Motivo obrigatório (5 a 500 caracteres).
import { NextRequest, NextResponse } from "next/server";
import { chamador, svcDb } from "@/lib/integracao-api";
import { alvoPodeSerSuspenso, estadoDoControle, schemaControle } from "@/lib/creation-admin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const c = await chamador(req);
  if (!c) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (c.role !== "ADMIN") return NextResponse.json({ error: "Acesso restrito ao ADMIN." }, { status: 403 });

  const parsed = schemaControle.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 422 });
  }
  const p = parsed.data;
  const db = svcDb();

  const { data: alvo } = await db.from("profiles").select("id, full_name, role").eq("id", p.user_id).maybeSingle();
  const alvoRole = (alvo as { role?: string | null } | null)?.role;
  const podeSer = alvoPodeSerSuspenso(alvoRole);
  if (!podeSer.ok) return NextResponse.json({ error: podeSer.erro }, { status: 422 });

  const { data: antes } = await db.from("partner_creation_controls")
    .select("blocked_until, block_reason, blocked_by").eq("user_id", p.user_id).maybeSingle();
  const novo = estadoDoControle(p, c.id);

  // Auditoria primeiro, com await: sem trilha não há mudança.
  const { error: erroAuditoria } = await db.from("audit_logs").insert({
    user_id: c.id,
    user_name: c.nome,
    action: p.acao === "suspender" ? "creation_suspend" : "creation_release",
    entity: "partner_creation_controls",
    entity_id: p.user_id,
    old_data: antes ?? null,
    new_data: { ...novo, motivo: p.motivo, horas: p.acao === "suspender" ? (p.horas ?? 24) : null },
    ip_address: c.ip,
  });
  if (erroAuditoria) {
    console.error("[admin/creation-control] falha ao gravar a auditoria", { code: erroAuditoria.code });
    return NextResponse.json({ error: "Não foi possível registrar a auditoria. Nada foi alterado." }, { status: 500 });
  }

  const { error } = await db.from("partner_creation_controls").upsert({ user_id: p.user_id, ...novo }, { onConflict: "user_id" });
  if (error) {
    console.error("[admin/creation-control] falha ao gravar o controle", { code: error.code });
    return NextResponse.json({ error: "Não foi possível alterar o controle. Tente novamente." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, blocked_until: novo.blocked_until });
}
