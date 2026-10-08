import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { hasDueDiligenceAccess } from "@/lib/cm/dd-access";

// Leitura do resultado BRUTO de uma consulta de pessoa fisica (Entrega 2a, 08/10/2026).
// BRIEF: scratchpad brief-e2-dd.md (REVISAO v2). Ler o bruto e revelar dado financeiro pessoal:
// - gate por usuario (due_diligence_qualificacao), sem bypass para ADMIN;
// - registro em cm_party_dd_raw_views gravado com await ANTES de devolver o dado; falhou, nada sai;
// - limite de 30 leituras por 10 minutos por usuario, contado no proprio log; falha na contagem NEGA (fail closed);
// - Cache-Control: no-store. Nunca registrar o conteudo do bruto em mensagem de erro.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const NO_STORE = { "Cache-Control": "no-store" };
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 10 * 60 * 1000;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; runId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: NO_STORE });
  if (!(await hasDueDiligenceAccess(user.id))) {
    return NextResponse.json({ error: "Sem permissão para Due Diligence" }, { status: 403, headers: NO_STORE });
  }

  const { id, runId } = await params;
  const db = svc();

  const { data: run } = await db
    .from("cm_party_dd_runs")
    .select("id, party_id, tool, status, raw_data")
    .eq("id", runId)
    .eq("party_id", id)
    .maybeSingle();
  if (!run || run.tool !== "scr_cpf" || run.raw_data == null) {
    return NextResponse.json({ error: "Detalhe não disponível para esta consulta" }, { status: 404, headers: NO_STORE });
  }

  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count, error: countError } = await db
    .from("cm_party_dd_raw_views")
    .select("id", { count: "exact", head: true })
    .eq("viewed_by", user.id)
    .gte("viewed_at", since);
  if (countError) {
    return NextResponse.json({ error: "Não foi possível registrar o acesso, tente novamente" }, { status: 500, headers: NO_STORE });
  }
  if ((count ?? 0) >= RATE_LIMIT) {
    return NextResponse.json({ error: "Muitas leituras em pouco tempo, aguarde alguns minutos" }, { status: 429, headers: NO_STORE });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null;
  const { error: logError } = await db.from("cm_party_dd_raw_views").insert({ run_id: runId, viewed_by: user.id, ip });
  if (logError) {
    console.error("[due-diligence raw] falha ao gravar log de leitura", { run_id: runId, code: logError.code });
    return NextResponse.json({ error: "Não foi possível registrar o acesso, tente novamente" }, { status: 500, headers: NO_STORE });
  }

  return NextResponse.json({ raw: run.raw_data }, { headers: NO_STORE });
}
