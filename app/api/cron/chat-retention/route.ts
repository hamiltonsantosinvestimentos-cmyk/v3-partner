import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { ANEXOS_BUCKET } from "@/lib/chat-partners";

// GET /api/cron/chat-retention: descarte do histórico do chat com partner aos 36 meses.
// Cumpre o texto público da política de privacidade (seção 6) e a nota do porquê do chat.
// Mesmo padrão de /api/cron/dd-retention. /api/cron/ é público no proxy.ts e esta rota APAGA dados:
// o Bearer CRON_SECRET é validado aqui dentro, sempre.
//
// MODO SIMULAÇÃO: `?dry=1` (só com o Bearer) OU a variável CHAT_RETENTION_ENABLED diferente de "true".
// Em simulação nada é apagado: só conta e grava uma linha de auditoria (chat_retencao_simulacao).
// O apagamento real só liga quando o João configura CHAT_RETENTION_ENABLED=true na Vercel,
// depois da resposta escrita do Robson e de ver o resultado de uma simulação.
//
// O que descarta: mensagens de chat_messages com created_at anterior a 36 meses (o relógio é a data de
// cada mensagem) e os anexos delas no bucket privado chat-anexos. Ordem: arquivo no Storage primeiro
// (só pela API de Storage), depois as linhas do lote. Falha ao apagar arquivo mantém todo o lote.
// Auditoria: UMA linha por execução, só com contagens, nunca conteúdo, nome ou sala.
// Fora desta rotina (decisão pendente, ver BRIEF): team_chat_messages, proposal_messages,
// deal_qa_messages, assistente_mensagens, chat_notas_internas.

export const maxDuration = 60;

const MONTHS = 36; // fixo no código: nenhum parâmetro de requisição reduz o prazo
const BATCH = 200;
const MAX_BATCHES = 20;

type Anexo = { path?: string };

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function monthsAgo(n: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString();
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const dryRequested = req.nextUrl.searchParams.get("dry") === "1";
  const simulacao = dryRequested || process.env.CHAT_RETENTION_ENABLED !== "true";
  const db = svc();
  const cutoff = monthsAgo(MONTHS);

  const { count, error: countError } = await db
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .lt("created_at", cutoff);
  if (countError) {
    console.error("[cron chat-retention] falha ao contar", { code: countError.code });
    return NextResponse.json({ error: "Falha na retenção do chat" }, { status: 500 });
  }

  const result = {
    modo: simulacao ? "simulacao" : "real",
    prazo_meses: MONTHS,
    mensagens_vencidas: count ?? 0,
    mensagens_apagadas: 0,
    anexos_apagados: 0,
    lotes_com_falha: 0,
  };

  if (!simulacao && (count ?? 0) > 0) {
    for (let i = 0; i < MAX_BATCHES; i++) {
      const { data: lote, error } = await db
        .from("chat_messages")
        .select("id, anexos")
        .lt("created_at", cutoff)
        .order("created_at", { ascending: true })
        .limit(BATCH);
      if (error) { result.lotes_com_falha += 1; console.error("[cron chat-retention] falha ao ler lote", { code: error.code }); break; }
      if (!lote || lote.length === 0) break;

      const paths = lote.flatMap((m) => ((m.anexos as Anexo[] | null) ?? []).map((a) => a?.path).filter((p): p is string => !!p));
      if (paths.length > 0) {
        const { error: rmError } = await db.storage.from(ANEXOS_BUCKET).remove(paths);
        if (rmError) { result.lotes_com_falha += 1; console.error("[cron chat-retention] falha ao apagar anexos do lote"); break; }
        result.anexos_apagados += paths.length;
      }
      const ids = lote.map((m) => m.id as string);
      const { error: delError } = await db.from("chat_messages").delete().in("id", ids);
      if (delError) { result.lotes_com_falha += 1; console.error("[cron chat-retention] falha ao apagar mensagens", { code: delError.code }); break; }
      result.mensagens_apagadas += ids.length;
      if (lote.length < BATCH) break;
    }
  }

  // Linha de resultado, sempre com await; se falhar, a rota devolve 500.
  const { error: summaryError } = await db.from("audit_logs").insert({
    action: simulacao ? "chat_retencao_simulacao" : "chat_retencao_execucao",
    entity: "chat_messages",
    entity_id: "cron",
    new_data: result,
  });
  if (summaryError) {
    console.error("[cron chat-retention] falha ao gravar a linha de resultado", { code: summaryError.code });
    return NextResponse.json({ error: "Falha ao registrar o resultado da retenção" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...result, aviso: simulacao && !dryRequested ? "CHAT_RETENTION_ENABLED não está como true: rodou como simulação" : undefined });
}
