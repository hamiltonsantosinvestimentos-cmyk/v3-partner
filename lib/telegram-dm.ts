// Cliente fino sobre a Telegram Bot API. Requer um bot criado via @BotFather
// com webhook registrado. Usado em dois contextos:
// 1. Bot interno da V3 (TELEGRAM_BOT_TOKEN/TELEGRAM_WEBHOOK_SECRET no env);
// 2. Bot próprio de cada partner white label (token colado por ele, guardado
//    criptografado em partner_sdr_connections — ver app/api/partner/sdr/telegram).
// Toda função aceita um token opcional; quando omitido, cai no bot interno
// (TELEGRAM_BOT_TOKEN), preservando o comportamento das chamadas existentes.
// Diferente de WhatsApp/Instagram/Messenger, Telegram não tem "janela de 24h"
// nem token de Página — qualquer usuário que já deu /start no bot (ou mandou
// qualquer mensagem) pode ser respondido a qualquer momento.

function resolveToken(token?: string): string {
  const v = token ?? process.env.TELEGRAM_BOT_TOKEN;
  if (!v) throw new Error("TELEGRAM_BOT_TOKEN não configurado — preencha no .env.local antes de usar o SDR no Telegram.");
  return v;
}

function apiBase(token?: string): string {
  return `https://api.telegram.org/bot${resolveToken(token)}`;
}

export class TelegramDmError extends Error {
  errorCode?: number;
  constructor(message: string, opts?: { errorCode?: number }) {
    super(message);
    this.name = "TelegramDmError";
    this.errorCode = opts?.errorCode;
  }
}

type TelegramApiResponse<T> = { ok: boolean; result?: T; description?: string; error_code?: number };

// Envia texto simples pro chat_id do Telegram (grupo ou conversa privada com
// o bot — o SDR só trata privado). Igual os outros 3 canais, opções de
// resposta rápida são simuladas por texto (mesmo método em todos os canais),
// em vez do inline_keyboard nativo do Telegram.
export async function sendTelegramText(chatId: string, text: string, token?: string): Promise<void> {
  const res = await fetch(`${apiBase(token)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  const json = (await res.json()) as TelegramApiResponse<unknown>;
  if (!res.ok || !json.ok) {
    throw new TelegramDmError(json.description ?? `Erro HTTP ${res.status} no sendMessage do Telegram`, {
      errorCode: json.error_code,
    });
  }
}

export type TelegramBotInfo = { id: number; username: string; first_name: string };

// Valida um token colado pelo partner e devolve os dados do bot (usado pra
// mostrar "conectado como @nome_do_bot" na UI, sem precisar guardar isso
// separado — se o token for inválido, a Telegram devolve erro aqui).
export async function getMe(token: string): Promise<TelegramBotInfo> {
  const res = await fetch(`${apiBase(token)}/getMe`);
  const json = (await res.json()) as TelegramApiResponse<TelegramBotInfo>;
  if (!res.ok || !json.ok || !json.result) {
    throw new TelegramDmError(json.description ?? `Token do Telegram inválido (HTTP ${res.status})`, {
      errorCode: json.error_code,
    });
  }
  return json.result;
}

// Registra o webhook do bot na Telegram. secretToken vira o header
// X-Telegram-Bot-Api-Secret-Token que o webhook confere em toda requisição,
// pra garantir que só a Telegram consegue postar nele.
export async function setTelegramWebhook(webhookUrl: string, secretToken: string, token?: string): Promise<void> {
  const res = await fetch(`${apiBase(token)}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl, secret_token: secretToken, allowed_updates: ["message"] }),
  });
  const json = (await res.json()) as TelegramApiResponse<unknown>;
  if (!res.ok || !json.ok) {
    throw new TelegramDmError(json.description ?? `Erro HTTP ${res.status} no setWebhook do Telegram`, {
      errorCode: json.error_code,
    });
  }
}

// Remove o webhook — usado ao desconectar um bot de partner (ou trocar de
// token), pra Telegram parar de tentar entregar updates pra uma URL que não
// vamos mais processar corretamente.
export async function deleteTelegramWebhook(token: string): Promise<void> {
  const res = await fetch(`${apiBase(token)}/deleteWebhook`, { method: "POST" });
  const json = (await res.json()) as TelegramApiResponse<unknown>;
  if (!res.ok || !json.ok) {
    throw new TelegramDmError(json.description ?? `Erro HTTP ${res.status} no deleteWebhook do Telegram`, {
      errorCode: json.error_code,
    });
  }
}
