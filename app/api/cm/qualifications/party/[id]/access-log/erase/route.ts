import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

// Eliminação de registros específicos do log de acesso a pedido do titular (BRIEF 5.12 D, migration
// 20261002c). SÓ ADMIN. A função SQL cm_erase_access_logs apaga e grava a auditoria no mesmo comando;
// valida que os ids pertencem à qualificação e recusa registro com menos de 24 horas. Motivo obrigatório.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const NO_STORE = { "Cache-Control": "no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatBr(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: NO_STORE });
  const db = svc();
  const { data: profile } = await db.from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile || profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Somente o ADMIN pode apagar registros de acesso" }, { status: 403, headers: NO_STORE });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { source?: unknown; ids?: unknown; reason?: unknown };
  const source = body.source;
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string" && UUID.test(x)) : [];
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (source !== "field_views" && source !== "document_views") {
    return NextResponse.json({ error: "Origem inválida" }, { status: 422, headers: NO_STORE });
  }
  if (!ids.length || ids.length > 200) {
    return NextResponse.json({ error: "Selecione de 1 a 200 registros" }, { status: 422, headers: NO_STORE });
  }
  if (reason.length < 10) {
    return NextResponse.json({ error: "Informe o motivo (mínimo de 10 caracteres)" }, { status: 422, headers: NO_STORE });
  }

  const { data, error } = await db.rpc("cm_erase_access_logs", {
    p_qualification_id: id,
    p_source: source,
    p_ids: ids,
    p_reason: reason,
    p_executor: user.id,
  });

  if (error) {
    const m = error.message.match(/ELEGIVEL_A_PARTIR_DE:(\S+)/);
    if (m) {
      return NextResponse.json(
        { error: `Registro com menos de 24 horas. Poderá ser eliminado a partir de ${formatBr(m[1])}.` },
        { status: 422, headers: NO_STORE },
      );
    }
    if (/nao pertencem/.test(error.message)) {
      return NextResponse.json({ error: "Os registros não pertencem a esta qualificação" }, { status: 422, headers: NO_STORE });
    }
    console.error("[access-log erase] falha", { code: error.code, message: error.message });
    return NextResponse.json({ error: "Não foi possível apagar os registros" }, { status: 500, headers: NO_STORE });
  }

  return NextResponse.json({ ok: true, apagados: data }, { headers: NO_STORE });
}
