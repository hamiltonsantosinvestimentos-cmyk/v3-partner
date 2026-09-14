const BASE_URL = process.env.OPENWA_API_URL ?? "http://localhost:2785";
const API_KEY = process.env.OPENWA_API_KEY!;
const DEFAULT_SESSION_ID = process.env.OPENWA_SESSION_ID!;

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${API_KEY}`,
  };
}

// White label: cada partner tem a própria sessão OpenWA (o próprio número).
// Toda função abaixo aceita um sessionId opcional — quando omitido, cai na
// sessão global da V3 (DEFAULT_SESSION_ID), preservando o comportamento do
// bot interno sem exigir mudança nos call sites existentes.
function resolveSessionId(sessionId?: string): string {
  return sessionId ?? DEFAULT_SESSION_ID;
}

// Cria uma sessão OpenWA nova (um número de WhatsApp novo) e já inicia ela —
// usado pra provisionar a conexão de um partner. O gateway já suporta
// múltiplas sessões simultâneas nativamente; a V3 continua sendo a única
// dona da OPENWA_API_KEY, o partner nunca vê essa chave, só escaneia o QR
// da sessão criada pra ele.
//
// Duas pegadinhas do CreateSessionDto do gateway (services/whatsapp-gateway):
// 1. `name` é obrigatório (3-50 chars, só letras/números/hífen) — POST com
//    corpo vazio devolve 400 Bad Request, sem isso a sessão nunca é criada.
// 2. Criar a sessão só a deixa em status "created" (engine ainda não
//    carregado) — sem chamar POST /api/sessions/:id/start ela nunca sai
//    desse estado e o QR nunca é gerado. Ver services/whatsapp-gateway/src/
//    modules/session/session.controller.ts (@Post() e @Post(':id/start')).
// Eventos que o /api/sdr/webhook sabe processar — mesma assinatura do
// webhook já registrado manualmente pra sessão global da V3
// (v3-partners-prod) desde 13/08/2026. Sessão nova nenhuma tinha isso.
const SDR_WEBHOOK_EVENTS = ["message.received", "session.qr", "session.authenticated", "session.disconnected"];

export async function createSession(name: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/sessions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`OpenWA: falha ao criar sessão (${res.status}) ${await res.text().catch(() => "")}`);
  const data = (await res.json()) as { id?: string; sessionId?: string };
  const sessionId = data.id ?? data.sessionId;
  if (!sessionId) throw new Error("OpenWA: resposta de criação de sessão sem id");

  // Achado 14/09/2026: toda sessão de partner criada por createSession()
  // nascia SEM webhook nenhum registrado no gateway (webhooks são por
  // sessão, não globais — ver services/whatsapp-gateway/src/modules/webhook).
  // A conexão do WhatsApp completava normalmente (QR, "conectado"...), mas
  // nenhuma mensagem recebida chegava nunca em /api/sdr/webhook -- a aba
  // Conversas ficava vazia pra sempre, silenciosamente, sem erro nenhum. Best
  // effort de propósito: um webhook que falha ao registrar não deve impedir
  // a conexão do WhatsApp em si (o partner ainda consegue conectar e usar
  // Automação/Envio em Massa); a falta do webhook fica só sem Conversas.
  try {
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br"}/api/sdr/webhook`;
    const whRes = await fetch(`${BASE_URL}/api/sessions/${sessionId}/webhooks`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ url: webhookUrl, events: SDR_WEBHOOK_EVENTS }),
    });
    if (!whRes.ok) {
      console.error(`[openwa] falha ao registrar webhook da sessão ${sessionId}: ${whRes.status} ${await whRes.text().catch(() => "")}`);
    }
  } catch (e) {
    console.error(`[openwa] falha ao registrar webhook da sessão ${sessionId}:`, e);
  }

  await startSession(sessionId);
  return sessionId;
}

// Garante que uma sessão já existente (criada antes desse fix, ou por
// qualquer outro caminho) tem o webhook do SDR registrado -- idempotente,
// não duplica se já existir. Chamado tanto no restart de sessão morta
// (connect/route.ts) quanto disponível pra rodar manualmente em sessões
// órfãs como a do próprio Hamilton.
export async function ensureSessionWebhook(sessionId: string): Promise<void> {
  const listRes = await fetch(`${BASE_URL}/api/sessions/${sessionId}/webhooks`, { headers: headers() });
  if (listRes.ok) {
    const existing = (await listRes.json()) as { url?: string }[];
    if (existing.some((w) => w.url?.endsWith("/api/sdr/webhook"))) return;
  }
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br"}/api/sdr/webhook`;
  const whRes = await fetch(`${BASE_URL}/api/sessions/${sessionId}/webhooks`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ url: webhookUrl, events: SDR_WEBHOOK_EVENTS }),
  });
  if (!whRes.ok) {
    throw new Error(`OpenWA: falha ao registrar webhook (${whRes.status}) ${await whRes.text().catch(() => "")}`);
  }
}

// (Re)inicia uma sessão já existente — necessário tanto pra criação (acima)
// quanto pro caso de uma sessão que ficou "disconnected"/engine não carregado
// (crash do gateway, restart do processo, etc.). Achado 14/09/2026: o QR
// nunca reaparecia pro partner porque connect/route.ts, quando já existia
// um openwa_session_id salvo, só devolvia esse id de volta sem nunca chamar
// /start de novo — uma sessão morta ficava morta pra sempre, sem forma de o
// partner tentar de novo pela UI.
export async function startSession(sessionId: string): Promise<void> {
  const startRes = await fetch(`${BASE_URL}/api/sessions/${sessionId}/start`, {
    method: "POST",
    headers: headers(),
  });
  if (!startRes.ok) throw new Error(`OpenWA: falha ao iniciar sessão (${startRes.status})`);
}

// Números BR sem DDI vêm com 10 dígitos (DDD + fixo) ou 11 (DDD + 9 + celular) — sem o 55
// na frente, o WhatsApp resolve pra um chatId que não existe e o envio falha em silêncio
// (a API do OpenWA retorna ok mesmo assim). Números com 12-13 dígitos já trazem o DDI.
function normalizeBrazilianPhone(digits: string): string {
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

// OpenWA chatId format: "<digits>@c.us" (individual) or "<digits>@g.us" (group).
// Fallback ingênuo — usado só quando /contacts/check falha; ver resolveChatId abaixo.
export function phoneToChatId(phone: string): string {
  const digits = normalizeBrazilianPhone(phone.replace(/\D/g, ""));
  return `${digits}@c.us`;
}

// Contas do WhatsApp registradas antes da adoção do 9º dígito (comum em vários DDDs) usam
// um JID interno de 12 dígitos (sem o 9), mesmo o número dialável tendo 13. Montar o chatId
// só com regex erra esses casos — a mensagem "sai" (OpenWA responde ok) mas nunca chega,
// sem nenhum erro visível. /contacts/check devolve o whatsappId canônico; se a checagem
// falhar por qualquer motivo, cai no formato ingênuo de phoneToChatId como fallback.
async function resolveChatId(phone: string, sessionId?: string): Promise<string> {
  const digits = normalizeBrazilianPhone(phone.replace(/\D/g, ""));
  try {
    const res = await fetch(`${BASE_URL}/api/sessions/${resolveSessionId(sessionId)}/contacts/check/${digits}`, {
      headers: headers(),
    });
    if (res.ok) {
      const data = await res.json() as { exists?: boolean; whatsappId?: string };
      if (data.exists && data.whatsappId) return data.whatsappId;
    }
  } catch {
    // segue com o fallback abaixo
  }
  return `${digits}@c.us`;
}

// Strips the OpenWA/Baileys chatId suffix back to plain digits
export function chatIdToPhone(chatId: string): string {
  return chatId.replace(/@(c\.us|s\.whatsapp\.net|g\.us)$/, "");
}

export type OpenwaSessionStatus = {
  id: string;
  status: "created" | "initializing" | "qr_ready" | "authenticating" | "ready" | "disconnected" | "failed";
  phone: string | null;
  pushName: string | null;
  lastError: string | null;
};

export async function getSessionStatus(sessionId?: string): Promise<OpenwaSessionStatus> {
  const res = await fetch(`${BASE_URL}/api/sessions/${resolveSessionId(sessionId)}`, { headers: headers() });
  if (!res.ok) throw new Error(`OpenWA: falha ao consultar sessão (${res.status})`);
  return res.json();
}

export async function getSessionQr(sessionId?: string): Promise<string | null> {
  const res = await fetch(`${BASE_URL}/api/sessions/${resolveSessionId(sessionId)}/qr`, { headers: headers() });
  if (!res.ok) return null;
  const data = await res.json() as { qrCode?: string };
  return data.qrCode ?? null;
}

export async function sendText(phone: string, text: string, sessionId?: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/api/sessions/${resolveSessionId(sessionId)}/messages/send-text`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ chatId: await resolveChatId(phone, sessionId), text }),
  });
  return res.ok;
}

export async function sendImage(phone: string, url: string, caption?: string, sessionId?: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/api/sessions/${resolveSessionId(sessionId)}/messages/send-image`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ chatId: await resolveChatId(phone, sessionId), url, caption }),
  });
  return res.ok;
}

export async function sendVideo(phone: string, url: string, caption?: string, sessionId?: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/api/sessions/${resolveSessionId(sessionId)}/messages/send-video`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ chatId: await resolveChatId(phone, sessionId), url, caption }),
  });
  return res.ok;
}

export type BulkRecipient = { phone: string; text: string };

export async function sendBulk(
  recipients: BulkRecipient[],
  delayBetweenMessagesMs: number
): Promise<{ batchId: string; statusUrl: string }> {
  const messages = await Promise.all(
    recipients.map(async r => ({ chatId: await resolveChatId(r.phone), text: r.text }))
  );
  const res = await fetch(`${BASE_URL}/api/sessions/${DEFAULT_SESSION_ID}/messages/send-bulk`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      messages,
      options: { delayBetweenMessages: delayBetweenMessagesMs, randomizeDelay: true },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenWA send-bulk: ${err.slice(0, 200)}`);
  }
  return res.json();
}

export type OpenwaBatchStatus = {
  batchId: string;
  status: "pending" | "processing" | "completed" | "failed";
  results: { chatId: string; status: "sent" | "failed"; error?: string }[];
};

export async function getBatchStatus(batchId: string): Promise<OpenwaBatchStatus> {
  const res = await fetch(`${BASE_URL}/api/sessions/${DEFAULT_SESSION_ID}/messages/batch/${batchId}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`OpenWA: falha ao consultar lote (${res.status})`);
  return res.json();
}
