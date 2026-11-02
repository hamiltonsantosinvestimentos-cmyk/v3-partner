import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { exigirUsuarioAutorizado } from "@/lib/assistente/acesso";
import { aplicarRevogacoes, desconectarSessao, garantirConfig, svcAssistente, type ConfigAssistente } from "@/lib/assistente/conexao";
import { telefoneOculto } from "@/lib/assistente/formato";
import { createSession, garantirWebhookSessaoPropria, qrSessaoPropria, startSession, statusSessaoPropria } from "@/lib/whatsapp/openwa-client";

const ALERTA_LIMPEZA_MS = 30 * 60 * 60 * 1000;

function urlWebhook(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL || "https://app.v3partners.com.br"}/api/assistente/webhook`;
}

function segredo(): string {
  const s = process.env.ASSISTENTE_WEBHOOK_SECRET;
  if (!s) throw new Error("ASSISTENTE_WEBHOOK_SECRET ausente");
  return s;
}

async function dadosComuns(db: ReturnType<typeof svcAssistente>, config: ConfigAssistente) {
  const referencia = config.ultima_limpeza_em ?? config.created_at;
  const [{ count: falhas }, { count: errosDepois }] = await Promise.all([
    db.from("assistente_mensagens").select("id", { count: "exact", head: true }).eq("user_id", config.user_id).eq("status", "falhou"),
    db.from("execution_errors").select("id", { count: "exact", head: true }).eq("source", "assistente-retencao").gt("created_at", referencia),
  ]);
  return {
    telefone: telefoneOculto(config.phone_e164),
    verificado: !!config.phone_verificado_em,
    ultimaLimpeza: config.ultima_limpeza_em,
    limpezaAtrasada: Date.now() - new Date(referencia).getTime() > ALERTA_LIMPEZA_MS || (errosDepois ?? 0) > 0,
    mensagensComFalha: falhas ?? 0,
  };
}

// GET: estado da conexão. Sem sessão própria não chama o gateway, para nunca exibir o número ou o QR do SDR.
export async function GET() {
  const auth = await exigirUsuarioAutorizado();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const db = svcAssistente();
  try {
    aplicarRevogacoes(db).catch(() => {});
    const config = await garantirConfig(db, auth.user.id);
    const comuns = await dadosComuns(db, config);
    if (!config.openwa_session_id) return NextResponse.json({ ...comuns, status: "sem_sessao", qrcode: null });

    const sessao = await statusSessaoPropria(config.openwa_session_id).catch(() => undefined);
    if (sessao === undefined) return NextResponse.json({ ...comuns, status: "erro", qrcode: null, erro: "Servidor de WhatsApp indisponível." });
    if (sessao === null) return NextResponse.json({ ...comuns, status: "desconectado", qrcode: null });
    if (sessao.status === "ready") return NextResponse.json({ ...comuns, status: "conectado", qrcode: null });
    if (sessao.status === "qr_ready") {
      // O QR só aparece com o webhook registrado.
      await garantirWebhookSessaoPropria(config.openwa_session_id, urlWebhook(), segredo());
      return NextResponse.json({ ...comuns, status: "aguardando_qr", qrcode: await qrSessaoPropria(config.openwa_session_id) });
    }
    const vivo = ["created", "initializing", "authenticating"].includes(sessao.status);
    return NextResponse.json({ ...comuns, status: vivo ? "iniciando" : "desconectado", qrcode: null });
  } catch (e) {
    console.error("[Assistente conexao] falha", { erro: e instanceof Error ? e.name : "erro" });
    return NextResponse.json({ error: "Falha ao consultar a conexão. Tente novamente." }, { status: 500 });
  }
}

// POST: cria a sessão com nome neutro e registra o webhook na mesma etapa; se já existe, reinicia a sessão parada.
export async function POST() {
  const auth = await exigirUsuarioAutorizado();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const db = svcAssistente();
  try {
    const config = await garantirConfig(db, auth.user.id);
    const url = urlWebhook();
    const chave = segredo();
    if (config.openwa_session_id) {
      const sessao = await statusSessaoPropria(config.openwa_session_id);
      if (sessao) {
        await garantirWebhookSessaoPropria(config.openwa_session_id, url, chave);
        if (["disconnected", "failed", "created"].includes(sessao.status)) await startSession(config.openwa_session_id);
        return NextResponse.json({ ok: true });
      }
    }
    const sessionId = await createSession(`assistente-${randomBytes(8).toString("hex")}`);
    const { error } = await db.from("assistente_config").update({
      openwa_session_id: sessionId, whatsapp_id: null, phone_e164: null, phone_verificado_em: null, updated_at: new Date().toISOString(),
    }).eq("user_id", auth.user.id);
    if (error) throw new Error(`Falha ao gravar sessão: ${error.code}`);
    await garantirWebhookSessaoPropria(sessionId, url, chave);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[Assistente conexao] falha ao criar", { erro: e instanceof Error ? e.name : "erro" });
    return NextResponse.json({ error: "Não foi possível preparar o número. Tente novamente." }, { status: 500 });
  }
}

// DELETE: desconectar número. Não altera `ativo` nem os dados do painel.
export async function DELETE() {
  const auth = await exigirUsuarioAutorizado();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const db = svcAssistente();
  try {
    const config = await garantirConfig(db, auth.user.id);
    await desconectarSessao(db, config);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[Assistente conexao] falha ao desconectar", { erro: e instanceof Error ? e.name : "erro" });
    return NextResponse.json({ error: "Não foi possível desconectar. Nada foi dado como concluído. Tente novamente." }, { status: 502 });
  }
}
