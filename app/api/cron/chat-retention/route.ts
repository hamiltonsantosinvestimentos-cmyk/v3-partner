import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { ANEXOS_BUCKET } from "@/lib/chat-partners";
import { executarRetencao, mesesAtras, RETENCAO_MESES, type PortaRetencao, type MensagemVencida } from "@/lib/chat-retention";

// GET /api/cron/chat-retention: descarte do histórico do chat com partner aos 36 meses (BRIEF 07/11/2026).
// Mesmo padrão de /api/cron/dd-retention. /api/cron/ é público no proxy.ts e esta rota APAGA dados:
// o Bearer CRON_SECRET é validado aqui dentro, sempre. A lógica fica em lib/chat-retention.ts (testada).
//
// MODO SIMULAÇÃO: `?dry=1` (só com o Bearer) OU CHAT_RETENTION_ENABLED diferente de "true". Em simulação nada é
// apagado. O apagamento real só liga quando o João configura CHAT_RETENTION_ENABLED=true na Vercel, depois da
// resposta escrita do Robson, do teste do caminho de Storage e de uma simulação.
// Auditoria em audit_logs, só contagens: início (antes de apagar), uma linha por lote e uma final.
// Fora desta rotina (decisão D1 do BRIEF): team_chat_messages, proposal_messages, deal_qa_messages,
// assistente_mensagens, chat_notas_internas.

export const maxDuration = 60;

function porta(): PortaRetencao {
  const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  return {
    async contarVencidas(corte) {
      const { count, error } = await db.from("chat_messages").select("id", { count: "exact", head: true }).lt("created_at", corte);
      if (error) { console.error("[cron chat-retention] falha ao contar", { code: error.code }); return null; }
      return count ?? 0;
    },
    async lerLote(corte, limite) {
      const { data, error } = await db.from("chat_messages").select("id, anexos").lt("created_at", corte).order("created_at", { ascending: true }).limit(limite);
      if (error) { console.error("[cron chat-retention] falha ao ler lote", { code: error.code }); return null; }
      return (data ?? []) as MensagemVencida[];
    },
    async removerAnexos(paths) {
      const { error } = await db.storage.from(ANEXOS_BUCKET).remove(paths);
      if (error) console.error("[cron chat-retention] falha ao apagar anexos do lote");
      return !error;
    },
    async apagarMensagens(ids) {
      const { error } = await db.from("chat_messages").delete().in("id", ids);
      if (error) console.error("[cron chat-retention] falha ao apagar mensagens", { code: error.code });
      return !error;
    },
    async auditar(action, dados) {
      const { error } = await db.from("audit_logs").insert({ action, entity: "chat_messages", entity_id: "cron", new_data: dados });
      if (error) console.error("[cron chat-retention] falha ao auditar", { action, code: error.code });
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
  const real = !dryRequested && process.env.CHAT_RETENTION_ENABLED === "true";
  const { resultado, erro } = await executarRetencao(porta(), { real, corteIso: mesesAtras(RETENCAO_MESES) });
  // Falha de lote também vira 500, para a Vercel e o monitoramento não verem a execução como saudável.
  if (erro || (resultado && resultado.lotes_com_falha > 0)) {
    return NextResponse.json({ error: "Falha na retenção do chat", detalhe: erro ?? "lote com falha", ...(resultado ?? {}) }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...resultado, aviso: !real && !dryRequested ? "CHAT_RETENTION_ENABLED não está como true: rodou como simulação" : undefined });
}
