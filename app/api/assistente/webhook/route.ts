import { NextRequest, NextResponse, after } from "next/server";
import { assinaturaValida, remetenteConfere, usuarioAutorizado } from "@/lib/assistente/acesso";
import { svcAssistente } from "@/lib/assistente/conexao";
import { processarMensagem } from "@/lib/assistente/executar";

// MY ASSISTANT IA. Público no proxy só neste caminho exato: a proteção é a assinatura, checada antes de qualquer
// gravação ou chamada de IA. Ao contrário do webhook SDR, não registra telefone, texto, transcrição nem valor.
export const maxDuration = 60;

type Payload = {
  event?: string;
  sessionId?: string;
  data?: {
    id?: string;
    from?: string;
    chatId?: string;
    body?: string;
    type?: string;
    fromMe?: boolean;
    isGroup?: boolean;
    isStatusBroadcast?: boolean;
    senderPhone?: string | null;
    media?: { data?: string; mimetype?: string; omitted?: boolean } | null;
  };
};

const ok = () => NextResponse.json({ ok: true });

function tipoDaMensagem(tipo: string | undefined): "texto" | "audio" | "outro" {
  if (tipo === "text" || tipo === "chat") return "texto";
  if (tipo === "audio" || tipo === "ptt" || tipo === "voice") return "audio";
  return "outro";
}

export async function POST(req: NextRequest) {
  const corpo = await req.text();
  if (!assinaturaValida(corpo, req.headers.get("x-openwa-signature"), process.env.ASSISTENTE_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  let payload: Payload;
  try {
    payload = JSON.parse(corpo) as Payload;
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }
  const { event, sessionId, data } = payload;
  if (event !== "message.received" || !sessionId || !data?.id || data.fromMe || data.isGroup || data.isStatusBroadcast) return ok();

  const db = svcAssistente();
  const { data: config, error: erroConfig } = await db.from("assistente_config")
    .select("user_id, ativo, whatsapp_id, phone_e164")
    .eq("openwa_session_id", sessionId).maybeSingle();
  if (erroConfig) {
    console.error("[Assistente] falha ao localizar sessão", { codigo: erroConfig.code });
    return NextResponse.json({ error: "Falha temporária" }, { status: 500 });
  }
  if (!config?.ativo || !usuarioAutorizado(config.user_id) || !remetenteConfere(data, config)) return ok();

  const tipo = tipoDaMensagem(data.type);
  const texto = tipo === "texto" ? data.body ?? null : null;
  const { data: mensagem, error } = await db.from("assistente_mensagens")
    .insert({ user_id: config.user_id, wa_message_id: data.id, tipo, texto })
    .select("id").single();
  if (error) {
    if (error.code === "23505") return ok(); // reentrega do mesmo wa_message_id
    console.error("[Assistente] falha ao gravar mensagem", { codigo: error.code });
    return NextResponse.json({ error: "Falha temporária" }, { status: 500 });
  }

  after(() => processarMensagem(db, {
    userId: config.user_id,
    sessionId,
    chatId: config.whatsapp_id as string,
    mensagemId: mensagem.id,
    tipo,
    texto,
    media: data.media ?? null,
  }).catch((e) => console.error("[Assistente] erro em segundo plano", { mensagem: mensagem.id, erro: e instanceof Error ? e.name : "erro" })));

  return ok();
}
