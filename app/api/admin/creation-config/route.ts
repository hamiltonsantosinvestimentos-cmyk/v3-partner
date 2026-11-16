// GET/POST /api/admin/creation-config: limites e chaves da cota de criação (BRIEF 15/11/2026). Só ADMIN, validado aqui
// no servidor. Quem muda um limite muda a regra de bloqueio, então toda alteração grava auditoria com await (autor,
// valor anterior, valor novo, motivo) ANTES de gravar; se a auditoria falhar, nada muda.
// As chaves ip_registro_ativo e bloqueio_automatico_ativo nascem desligadas: ligar depende da resposta escrita do Robson.
import { NextRequest, NextResponse } from "next/server";
import { chamador, svcDb } from "@/lib/integracao-api";
import { CAMPOS_CONFIG, diferencaDeConfig, schemaConfig } from "@/lib/creation-admin";

export const dynamic = "force-dynamic";

const COLUNAS = CAMPOS_CONFIG.join(", ");

async function exigirAdmin(req: NextRequest) {
  const c = await chamador(req);
  if (!c) return { c: null, res: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) } as const;
  if (c.role !== "ADMIN") return { c: null, res: NextResponse.json({ error: "Acesso restrito ao ADMIN." }, { status: 403 }) } as const;
  return { c, res: null } as const;
}

export async function GET(req: NextRequest) {
  const { c, res } = await exigirAdmin(req);
  if (!c) return res;
  const { data, error } = await svcDb().from("creation_quota_config").select(`${COLUNAS}, updated_at`).eq("id", true).maybeSingle();
  if (error || !data) {
    console.error("[admin/creation-config GET] falha", { code: error?.code });
    return NextResponse.json({ error: "Não foi possível carregar a configuração." }, { status: 500 });
  }
  return NextResponse.json({ config: data });
}

export async function POST(req: NextRequest) {
  const { c, res } = await exigirAdmin(req);
  if (!c) return res;

  const parsed = schemaConfig.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 422 });
  }
  const { motivo, ...valores } = parsed.data;
  const db = svcDb();

  const { data: atual, error: erroLeitura } = await db.from("creation_quota_config").select(COLUNAS).eq("id", true).maybeSingle();
  if (erroLeitura || !atual) {
    console.error("[admin/creation-config POST] falha ao ler a configuração", { code: erroLeitura?.code });
    return NextResponse.json({ error: "Não foi possível carregar a configuração." }, { status: 500 });
  }
  const mudancas = diferencaDeConfig(atual as unknown as Record<string, unknown>, parsed.data);
  if (mudancas.length === 0) return NextResponse.json({ ok: true, alterado: false });

  const { error: erroAuditoria } = await db.from("audit_logs").insert({
    user_id: c.id,
    user_name: c.nome,
    action: "creation_config_update",
    entity: "creation_quota_config",
    entity_id: "config",
    old_data: Object.fromEntries(mudancas.map((m) => [m.campo, m.antes])),
    new_data: { ...Object.fromEntries(mudancas.map((m) => [m.campo, m.depois])), motivo },
    ip_address: c.ip,
  });
  if (erroAuditoria) {
    console.error("[admin/creation-config POST] falha ao gravar a auditoria", { code: erroAuditoria.code });
    return NextResponse.json({ error: "Não foi possível registrar a auditoria. Nada foi alterado." }, { status: 500 });
  }

  const { error } = await db.from("creation_quota_config")
    .update({ ...valores, updated_by: c.id }).eq("id", true);
  if (error) {
    console.error("[admin/creation-config POST] falha ao gravar", { code: error.code });
    return NextResponse.json({ error: "Não foi possível salvar a configuração." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, alterado: true, campos: mudancas.map((m) => m.campo) });
}
