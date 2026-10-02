import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

// GET /api/cron/purge-access-logs: retenção de 36 meses dos logs de acesso a dado sensível da ficha
// de qualificação (cm_party_qualification_field_views e cm_party_qualification_document_views),
// BRIEF 30/09/2026, 5.12 D, migration 20261002b. A função SQL apaga e grava a linha de auditoria
// em cm_party_qualification_log_erasures no MESMO comando (uma linha por tabela, nada apagado não
// grava linha). /api/cron/ é público no proxy.ts, e esta rota APAGA dados: o Bearer CRON_SECRET é
// validado aqui dentro, sempre.
export const maxDuration = 60;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { data, error } = await svc().rpc("cm_purge_access_logs", { p_months: 36 });
  if (error) {
    console.error("[cron purge-access-logs] falha", { code: error.code, message: error.message });
    return NextResponse.json({ error: "Falha na retenção dos logs de acesso" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, apagados: data });
}
