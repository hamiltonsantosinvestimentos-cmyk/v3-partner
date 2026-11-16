// GET /api/admin/creation-log?user_id=<uuid>: painel "Criações e bloqueios" (BRIEF 15/11/2026). Só ADMIN, validado no
// servidor. Devolve o controle vigente do usuário, o estado das duas chaves e as últimas criações e recusas.
// O IP só aparece quando a chave ip_registro_ativo está ligada, e TODA consulta grava auditoria com await antes de
// devolver o dado (política de sigilo: log de acesso antes do dado pessoal).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { chamador, svcDb } from "@/lib/integracao-api";
import { linhaDoLogParaAdmin } from "@/lib/creation-admin";

export const dynamic = "force-dynamic";

const LIMITE = 100;

export async function GET(req: NextRequest) {
  const c = await chamador(req);
  if (!c) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (c.role !== "ADMIN") return NextResponse.json({ error: "Acesso restrito ao ADMIN." }, { status: 403 });

  const userId = z.string().uuid().safeParse(req.nextUrl.searchParams.get("user_id"));
  if (!userId.success) return NextResponse.json({ error: "Usuário inválido." }, { status: 422 });
  const db = svcDb();

  const { data: cfg } = await db.from("creation_quota_config")
    .select("ip_registro_ativo, bloqueio_automatico_ativo").eq("id", true).maybeSingle();
  const ipAtivo = (cfg as { ip_registro_ativo?: boolean } | null)?.ip_registro_ativo === true;

  // Log de acesso ANTES de devolver o dado.
  const { error: erroAuditoria } = await db.from("audit_logs").insert({
    user_id: c.id, user_name: c.nome, action: "creation_log_view", entity: "ma_deal_creation_log",
    entity_id: userId.data, new_data: { ip_exibido: ipAtivo }, ip_address: c.ip,
  });
  if (erroAuditoria) {
    console.error("[admin/creation-log] falha ao gravar o log de acesso", { code: erroAuditoria.code });
    return NextResponse.json({ error: "Não foi possível registrar o acesso. Nada foi exibido." }, { status: 500 });
  }

  const [controleR, logR] = await Promise.all([
    db.from("partner_creation_controls")
      .select("blocked_until, block_reason, blocked_by, override_hora, override_dia, updated_at")
      .eq("user_id", userId.data).maybeSingle(),
    db.from("ma_deal_creation_log")
      .select("id, via, outcome, ip, created_at")
      .eq("actor_kind", "user").eq("actor_id", userId.data)
      .order("created_at", { ascending: false }).limit(LIMITE),
  ]);
  if (controleR.error || logR.error) {
    console.error("[admin/creation-log] falha ao ler", { a: controleR.error?.code, b: logR.error?.code });
    return NextResponse.json({ error: "Não foi possível carregar o painel." }, { status: 500 });
  }

  const agora = Date.now();
  const bloqueadoAte = (controleR.data as { blocked_until?: string | null } | null)?.blocked_until ?? null;
  return NextResponse.json({
    chaves: {
      ip_registro_ativo: ipAtivo,
      bloqueio_automatico_ativo: (cfg as { bloqueio_automatico_ativo?: boolean } | null)?.bloqueio_automatico_ativo === true,
    },
    controle: controleR.data ?? null,
    bloqueio_vigente: !!bloqueadoAte && new Date(bloqueadoAte).getTime() > agora,
    registros: ((logR.data ?? []) as { ip?: string | null }[]).map((l) => linhaDoLogParaAdmin(l, ipAtivo)),
  });
}
