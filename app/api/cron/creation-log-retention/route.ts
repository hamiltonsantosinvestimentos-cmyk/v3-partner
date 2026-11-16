import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { executarDescarteDoLog, type ContagemDescarte, type PortaDescarte } from "@/lib/creation-log-retention";

// GET /api/cron/creation-log-retention: descarte do log de criação de operações (BRIEF 15/11/2026): IP em 90 dias e
// linha de contagem em 12 meses (valores em creation_quota_config), IP de conta excluída antes do prazo.
// Mesmo padrão de /api/cron/chat-retention. /api/cron/ é público no proxy.ts e esta rota APAGA dados: o Bearer
// CRON_SECRET é validado aqui dentro, sempre.
//
// MODO SIMULAÇÃO: `?dry=1` (só com o Bearer) OU CREATION_LOG_RETENTION_ENABLED diferente de "true". Em simulação nada é
// alterado. O descarte real só liga quando o João configura CREATION_LOG_RETENTION_ENABLED=true na Vercel, depois de
// uma simulação conferida. Auditoria em audit_logs, só contagens.

export const maxDuration = 60;

function porta(): PortaDescarte {
  const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  return {
    async executar(real) {
      const { data, error } = await db.rpc("creation_log_retention", { p_real: real });
      if (error || !data || typeof data !== "object" || "erro" in (data as object)) {
        console.error("[cron creation-log-retention] função falhou", { code: error?.code });
        return null;
      }
      return data as ContagemDescarte;
    },
    async auditar(action, dados) {
      const { error } = await db.from("audit_logs").insert({ action, entity: "ma_deal_creation_log", entity_id: "cron", new_data: dados });
      if (error) console.error("[cron creation-log-retention] falha ao auditar", { action, code: error.code });
      return !error;
    },
  };
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const dryRequested = req.nextUrl.searchParams.get("dry") === "1";
  const real = !dryRequested && process.env.CREATION_LOG_RETENTION_ENABLED === "true";
  const r = await executarDescarteDoLog(porta(), { real });
  if (!r.ok) {
    return NextResponse.json({ error: "Falha no descarte do log de criação", detalhe: r.erro }, { status: 500 });
  }
  return NextResponse.json({
    ok: true, simulacao: r.simulacao, ...r.contagem,
    aviso: !real && !dryRequested ? "CREATION_LOG_RETENTION_ENABLED não está como true: rodou como simulação" : undefined,
  });
}
