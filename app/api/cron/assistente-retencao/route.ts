import { NextRequest, NextResponse } from "next/server";
import { aplicarRevogacoes, svcAssistente, type ConfigAssistente } from "@/lib/assistente/conexao";
import { apagarMensagensGuardadas } from "@/lib/whatsapp/openwa-client";

// GET /api/cron/assistente-retencao: limpeza diária do MY ASSISTANT IA. /api/cron/ é público no proxy e esta rota
// APAGA dados: o Bearer CRON_SECRET é validado aqui dentro, e variável vazia recusa. Falhas vão para execution_errors,
// sem conteúdo de mensagens. Sem sessão própria, o gateway não é chamado.
export const maxDuration = 60;

const DIA_MS = 24 * 60 * 60 * 1000;
const RETENCAO_MENSAGENS_DIAS = 90;
const PRESA_MS = 10 * 60 * 1000;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const db = svcAssistente();
  const agora = Date.now();
  const falhas: string[] = [];
  const registrar = (etapa: string, codigo?: string) => falhas.push(codigo ? `${etapa}:${codigo}` : etapa);

  const presas = await db.from("assistente_mensagens").update({ status: "falhou" })
    .eq("status", "recebida").lt("created_at", new Date(agora - PRESA_MS).toISOString());
  if (presas.error) registrar("presas", presas.error.code);

  const antigas = await db.from("assistente_mensagens").delete()
    .lt("created_at", new Date(agora - RETENCAO_MENSAGENS_DIAS * DIA_MS).toISOString());
  if (antigas.error) registrar("mensagens", antigas.error.code);

  const verificacoes = await db.from("assistente_verificacao").delete().lt("expira_em", new Date(agora - DIA_MS).toISOString());
  if (verificacoes.error) registrar("verificacoes", verificacoes.error.code);

  const revogacoes = await aplicarRevogacoes(db).catch(() => ({ revogados: 0, falhas: 1 }));
  if (revogacoes.falhas > 0) registrar("revogacao");

  const { data: configs, error: erroConfigs } = await db.from("assistente_config").select("user_id, openwa_session_id");
  if (erroConfigs) registrar("configs", erroConfigs.code);

  for (const config of (configs ?? []) as Pick<ConfigAssistente, "user_id" | "openwa_session_id">[]) {
    let limpo = true;
    if (config.openwa_session_id) {
      try {
        const { pending } = await apagarMensagensGuardadas(config.openwa_session_id, new Date(agora - DIA_MS).toISOString());
        if (pending > 0) { limpo = false; registrar("gateway_pendentes"); }
      } catch {
        limpo = false;
        registrar("gateway");
      }
    }
    if (limpo && falhas.length === 0) {
      const { error } = await db.from("assistente_config")
        .update({ ultima_limpeza_em: new Date().toISOString() }).eq("user_id", config.user_id);
      if (error) registrar("ultima_limpeza", error.code);
    }
  }

  if (falhas.length > 0) {
    const { error } = await db.from("execution_errors").insert({
      source: "assistente-retencao",
      error_type: "limpeza_falhou",
      error_message: "Limpeza diária do assistente incompleta",
      context: { etapas: falhas },
      resolved: false,
    });
    if (error) console.error("[cron assistente-retencao] falha ao registrar erro", { codigo: error.code });
    return NextResponse.json({ ok: false, etapas: falhas }, { status: 500 });
  }
  return NextResponse.json({ ok: true, revogados: revogacoes.revogados });
}
