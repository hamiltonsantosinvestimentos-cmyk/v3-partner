import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { FLAG_MEETING_AUTOTRIGGER } from "@/lib/cm-flags";

// Interruptor da chave de rollout do agendamento automatico da reuniao (Bloco 2, 08/10/2026).
// BRIEF: scratchpad brief-bloco2-flag.md, plano 2026-10-08_Operacional_BRIEF-Plano-Execucao-Pendencias-Bolsa-Prazo-09-10_v1.md
// GET e PATCH: SOMENTE ADMIN (GESTAO nao entra), checado no servidor. Lista fixa de chaves; qualquer
// outra chave devolve 404. Toda mudanca grava audit_logs com await ANTES do UPDATE; se o UPDATE
// falhar, a rota informa o erro e grava um segundo registro de falha. Nunca `void db...insert()`.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const NO_STORE = { "Cache-Control": "no-store" };
const ALLOWED_KEYS = [FLAG_MEETING_AUTOTRIGGER];

/** Data e hora no fuso de Brasilia, calculadas aqui para a tela nao deslocar o dia. */
function dateTimeBr(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

async function authorizeAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: NO_STORE }) };
  const { data: profile } = await svc().from("profiles").select("role, full_name").eq("id", user.id).single();
  if (profile?.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Apenas ADMIN pode alterar esta chave" }, { status: 403, headers: NO_STORE }) };
  }
  return { userId: user.id, userName: (profile?.full_name as string | null) ?? null };
}

async function readFlag(db: ReturnType<typeof svc>, key: string) {
  const { data, error } = await db.from("cm_feature_flags").select("key, enabled, updated_by, updated_at").eq("key", key).maybeSingle();
  if (error || !data) return null;
  let updatedByName: string | null = null;
  if (data.updated_by) {
    const { data: p } = await db.from("profiles").select("full_name").eq("id", data.updated_by).maybeSingle();
    updatedByName = (p?.full_name as string | null) ?? null;
  }
  return {
    enabled: !!data.enabled,
    updated_at_br: data.updated_by ? dateTimeBr(data.updated_at as string) : null,
    updated_by_name: updatedByName,
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const auth = await authorizeAdmin();
  if ("error" in auth) return auth.error;
  const { key } = await params;
  if (!ALLOWED_KEYS.includes(key)) return NextResponse.json({ error: "Chave não encontrada" }, { status: 404, headers: NO_STORE });

  const flag = await readFlag(svc(), key);
  if (!flag) return NextResponse.json({ error: "Não foi possível ler a chave" }, { status: 500, headers: NO_STORE });
  return NextResponse.json(flag, { headers: NO_STORE });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const auth = await authorizeAdmin();
  if ("error" in auth) return auth.error;
  const { key } = await params;
  if (!ALLOWED_KEYS.includes(key)) return NextResponse.json({ error: "Chave não encontrada" }, { status: 404, headers: NO_STORE });

  const body = (await req.json().catch(() => ({}))) as { enabled?: unknown };
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "Informe enabled como verdadeiro ou falso" }, { status: 422, headers: NO_STORE });
  }

  const db = svc();
  const { data: current } = await db.from("cm_feature_flags").select("enabled").eq("key", key).maybeSingle();
  if (!current) return NextResponse.json({ error: "Não foi possível ler a chave" }, { status: 500, headers: NO_STORE });
  const oldValue = !!current.enabled;
  if (oldValue === body.enabled) {
    return NextResponse.json({ ...(await readFlag(db, key)), changed: false }, { headers: NO_STORE });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null;

  // Auditoria ANTES da mudanca. Falhou, a chave nao muda.
  const { error: auditError } = await db.from("audit_logs").insert({
    user_id: auth.userId,
    user_name: auth.userName,
    action: "flag_meeting_autotrigger_alterada",
    entity: "cm_feature_flags",
    entity_id: key,
    old_data: { enabled: oldValue },
    new_data: { enabled: body.enabled },
    ip_address: ip,
  });
  if (auditError) {
    console.error("[feature-flags] falha ao gravar auditoria, chave nao alterada", { key, code: auditError.code });
    return NextResponse.json({ error: "Não foi possível registrar a mudança, a chave não foi alterada" }, { status: 500, headers: NO_STORE });
  }

  const { error: updateError } = await db
    .from("cm_feature_flags")
    .update({ enabled: body.enabled, updated_by: auth.userId, updated_at: new Date().toISOString() })
    .eq("key", key);
  if (updateError) {
    console.error("[feature-flags] falha ao atualizar a chave", { key, code: updateError.code });
    const { error: failLogError } = await db.from("audit_logs").insert({
      user_id: auth.userId,
      user_name: auth.userName,
      action: "flag_meeting_autotrigger_falha",
      entity: "cm_feature_flags",
      entity_id: key,
      old_data: { enabled: oldValue },
      new_data: { enabled: oldValue, tentativa: body.enabled },
      ip_address: ip,
    });
    if (failLogError) console.error("[feature-flags] falha tambem ao registrar a falha", { key, code: failLogError.code });
    return NextResponse.json({ error: "Não foi possível alterar a chave. Recarregue para ver o valor atual." }, { status: 500, headers: NO_STORE });
  }

  const flag = await readFlag(db, key);
  return NextResponse.json({ ...(flag ?? { enabled: body.enabled }), changed: true }, { headers: NO_STORE });
}
