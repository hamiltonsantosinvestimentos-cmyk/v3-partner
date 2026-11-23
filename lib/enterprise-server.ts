import { NextResponse, type NextRequest } from "next/server";
import { createClient as sc, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { contextoEnterprise, type EnterpriseContexto } from "@/lib/enterprise";
import { decidirModoAdmin, masterDaUrl, ERRO_LOG_ADMIN } from "@/lib/enterprise-admin-modo";
import { getClientIp, logAudit, logAuditStrict, type AuditAction } from "@/lib/audit";

export const svcEnterprise = (): SupabaseClient =>
  sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/** ADMIN agindo em nome do master (modo ADMIN, `?master=`). null = o próprio Enterprise. */
export type AdminAgindo = { id: string; nome: string | null } | null;

export type AuthEnterprise = {
  ok: true;
  /** Id do master (modo ADMIN) ou do usuário logado. */
  userId: string;
  nome: string | null;
  ctx: EnterpriseContexto;
  db: SupabaseClient;
  admin: AdminAgindo;
};

/**
 * Usuário logado + contexto Enterprise; devolve 401/403/404 pronto quando não pode.
 * Modo ADMIN (BRIEF 2026-11-19_admin-configura-white-label-enterprise.md): com `req` e `?master=<id>`,
 * só ADMIN (papel lido do banco) em rota com `permitirAdmin` age em nome do master. Sem `?master`,
 * o fluxo é o de sempre. `?master` em rota sem `permitirAdmin`, ou por quem não é ADMIN: 403.
 */
export async function exigirEnterprise(
  opts: { somenteMaster?: boolean; req?: NextRequest | Request; permitirAdmin?: boolean } = {},
): Promise<AuthEnterprise | { ok: false; res: NextResponse }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, res: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  const db = svcEnterprise();

  const masterParam = opts.req ? masterDaUrl(opts.req.url) : null;
  if (masterParam !== null) {
    const { data: caller } = await db.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();
    const { data: alvo } = await db
      .from("profiles")
      .select("id, role, enterprise_id, full_name")
      .eq("id", /^[0-9a-f-]{36}$/i.test(masterParam) ? masterParam : "00000000-0000-0000-0000-000000000000")
      .maybeSingle();
    const d = decidirModoAdmin({
      permitirAdmin: !!opts.permitirAdmin,
      callerRole: (caller?.role as string | null) ?? null,
      masterParam,
      alvo: alvo ? { role: (alvo.role as string | null) ?? null, enterprise_id: (alvo.enterprise_id as string | null) ?? null } : null,
    });
    if (!d.ok) return { ok: false, res: NextResponse.json({ error: d.error }, { status: d.status }) };
    const ctx = await contextoEnterprise(db, { id: alvo!.id as string, role: "ENTERPRISE", enterprise_id: null });
    if (!ctx) return { ok: false, res: NextResponse.json({ error: "Master Enterprise não encontrado" }, { status: 404 }) };
    return {
      ok: true,
      userId: alvo!.id as string,
      nome: (alvo!.full_name as string | null) ?? null,
      ctx,
      db,
      admin: { id: user.id, nome: (caller?.full_name as string | null) ?? null },
    };
  }

  const { data: perfil } = await db.from("profiles").select("id, role, enterprise_id, full_name").eq("id", user.id).single();
  const ctx = perfil ? await contextoEnterprise(db, perfil) : null;
  if (!ctx) return { ok: false, res: NextResponse.json({ error: "Disponível apenas para Enterprise" }, { status: 403 }) };
  if (opts.somenteMaster && !ctx.ehMaster) {
    return { ok: false, res: NextResponse.json({ error: "Apenas o usuário master do Enterprise" }, { status: 403 }) };
  }
  return { ok: true, userId: user.id, nome: (perfil?.full_name as string | null) ?? null, ctx, db, admin: null };
}

type DadosLog = { action: AuditAction; oldData?: Record<string, unknown> | null; newData?: Record<string, unknown> };

function paramsLog(auth: AuthEnterprise, req: NextRequest, d: DadosLog, resultado: string) {
  return {
    userId: auth.admin!.id,
    userName: auth.admin!.nome,
    action: d.action,
    entity: "profiles" as const,
    entityId: auth.userId,
    oldData: d.oldData ?? null,
    newData: { ...(d.newData ?? {}), resultado, via_admin: { master_id: auth.userId, master_nome: auth.nome } },
    ipAddress: getClientIp(req),
  };
}

/**
 * Modo ADMIN: grava o log ANTES da escrita, de forma obrigatória. Devolve a resposta de erro pronta
 * quando o log falha (a escrita não deve acontecer). Fora do modo ADMIN, não faz nada.
 */
export async function logAntesDaEscritaAdmin(auth: AuthEnterprise, req: NextRequest, d: DadosLog): Promise<NextResponse | null> {
  if (!auth.admin) return null;
  try {
    await logAuditStrict(paramsLog(auth, req, d, "tentativa"));
    return null;
  } catch {
    return NextResponse.json({ error: ERRO_LOG_ADMIN }, { status: 500 });
  }
}

/** Modo ADMIN: segundo registro quando a escrita falhou depois do log (não bloqueia). */
export async function logFalhaAdmin(auth: AuthEnterprise, req: NextRequest, d: DadosLog, erro: string): Promise<void> {
  if (!auth.admin) return;
  await logAudit(paramsLog(auth, req, { ...d, newData: { ...(d.newData ?? {}), erro } }, "falhou"));
}

/** Modo ADMIN: leitura registrada sem bloquear (ACCESS na página, EXPORT do PDF). */
export async function logLeituraAdmin(auth: AuthEnterprise, req: NextRequest, d: DadosLog): Promise<void> {
  if (!auth.admin) return;
  await logAudit(paramsLog(auth, req, d, "ok"));
}
