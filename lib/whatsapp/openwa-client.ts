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

  await startSession(sessionId);
  return sessionId;
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

// Número com "+" (E.164, ex: +15551234567) já traz o DDI e nunca recebe o 55 do Brasil
// (26/09/2026: um +1 EUA de 11 dígitos virava DDD 15 de São Paulo e a mensagem ia para
// um terceiro). Sem "+", a regra de sempre vale (10/11 dígitos = Brasil).
function toDialDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return phone.trim().startsWith("+") ? digits : normalizeBrazilianPhone(digits);
}

// OpenWA chatId format: "<digits>@c.us" (individual) or "<digits>@g.us" (group).
// Fallback ingênuo — usado só quando /contacts/check falha; ver resolveChatId abaixo.
export function phoneToChatId(phone: string): string {
  const digits = toDialDigits(phone);
  return `${digits}@c.us`;
}

// Contas do WhatsApp registradas antes da adoção do 9º dígito (comum em vários DDDs) usam
// um JID interno de 12 dígitos (sem o 9), mesmo o número dialável tendo 13. Montar o chatId
// só com regex erra esses casos — a mensagem "sai" (OpenWA responde ok) mas nunca chega,
// sem nenhum erro visível. /contacts/check devolve o whatsappId canônico; se a checagem
// falhar por qualquer motivo, cai no formato ingênuo de phoneToChatId como fallback.
async function resolveChatId(phone: string, sessionId?: string): Promise<string> {
  const digits = toDialDigits(phone);
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

// ── Sessão própria (MY ASSISTANT IA) ─────────────────────────────────────────
// Estas funções nunca passam por resolveSessionId: sessão vazia ou igual à da V3
// é recusada, para uma limpeza ou um envio pessoal nunca atingirem a sessão do SDR.
export function exigirSessaoPropria(sessionId: string): string {
  if (!sessionId || !sessionId.trim() || sessionId === DEFAULT_SESSION_ID) {
    throw new Error("OpenWA: operação exige sessão própria");
  }
  return encodeURIComponent(sessionId);
}

function gatewaySessao(sessionId: string, caminho: string, init: RequestInit = {}, timeoutMs = 15000) {
  return fetch(`${BASE_URL}/api/sessions/${exigirSessaoPropria(sessionId)}${caminho}`, {
    ...init,
    headers: headers(),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/** null quando a sessão não existe mais no gateway (404). */
export async function statusSessaoPropria(sessionId: string): Promise<OpenwaSessionStatus | null> {
  const res = await gatewaySessao(sessionId, "");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`OpenWA: falha ao consultar sessão (${res.status})`);
  return res.json();
}

export async function qrSessaoPropria(sessionId: string): Promise<string | null> {
  const res = await gatewaySessao(sessionId, "/qr");
  if (!res.ok) return null;
  const data = await res.json() as { qrCode?: string };
  return data.qrCode ?? null;
}

/** whatsappId canônico devolvido pelo gateway, ou null se o número não tem WhatsApp. */
export async function whatsappIdSessaoPropria(sessionId: string, digits: string): Promise<string | null> {
  const res = await gatewaySessao(sessionId, `/contacts/check/${digits}`);
  if (!res.ok) throw new Error(`OpenWA: falha ao checar contato (${res.status})`);
  const data = await res.json() as { exists?: boolean; whatsappId?: string };
  return data.exists && data.whatsappId ? data.whatsappId : null;
}

export async function enviarTextoSessaoPropria(sessionId: string, chatId: string, text: string, timeoutMs = 5000): Promise<boolean> {
  const res = await gatewaySessao(sessionId, "/messages/send-text", {
    method: "POST",
    body: JSON.stringify({ chatId, text }),
  }, timeoutMs);
  return res.ok;
}

/** Registra o webhook assinado da sessão, sem duplicar quando já existe para a mesma URL. */
export async function garantirWebhookSessaoPropria(sessionId: string, url: string, secret: string): Promise<void> {
  const lista = await gatewaySessao(sessionId, "/webhooks");
  if (!lista.ok) throw new Error(`OpenWA: falha ao listar webhooks (${lista.status})`);
  const atuais = await lista.json() as { url?: string }[];
  if (Array.isArray(atuais) && atuais.some((w) => w.url === url)) return;
  const res = await gatewaySessao(sessionId, "/webhooks", {
    method: "POST",
    body: JSON.stringify({ url, events: ["message.received"], secret }),
  });
  if (!res.ok) throw new Error(`OpenWA: falha ao registrar webhook (${res.status})`);
}

/** Sessão já parada (400) ou já apagada (404) segue para o passo seguinte; 409 é "repetir". */
export async function pararSessaoPropria(sessionId: string): Promise<void> {
  const res = await gatewaySessao(sessionId, "/stop", { method: "POST" }, 30000);
  if (res.ok || res.status === 400 || res.status === 404) return;
  throw new Error(`OpenWA: falha ao parar sessão (${res.status})`);
}

export async function apagarMensagensGuardadas(sessionId: string, beforeIso: string): Promise<{ pending: number }> {
  const res = await gatewaySessao(sessionId, `/messages/stored?before=${encodeURIComponent(beforeIso)}`, { method: "DELETE" }, 30000);
  if (!res.ok) throw new Error(`OpenWA: falha ao apagar mensagens guardadas (${res.status})`);
  const data = await res.json() as { pending?: number };
  return { pending: data.pending ?? 0 };
}

export async function apagarMapeamentosLid(sessionId: string, phones: string[]): Promise<void> {
  const res = await gatewaySessao(sessionId, "/lid-mappings", { method: "DELETE", body: JSON.stringify({ phones }) });
  if (!res.ok) throw new Error(`OpenWA: falha ao apagar mapeamentos (${res.status})`);
}

/** 404 conta como já apagada; 409 é "repetir". */
export async function apagarSessaoPropria(sessionId: string): Promise<void> {
  const res = await gatewaySessao(sessionId, "", { method: "DELETE" }, 30000);
  if (res.ok || res.status === 404) return;
  throw new Error(`OpenWA: falha ao apagar sessão (${res.status})`);
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
