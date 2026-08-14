const BASE_URL = process.env.OPENWA_API_URL ?? "http://localhost:2785";
const API_KEY = process.env.OPENWA_API_KEY!;
const SESSION_ID = process.env.OPENWA_SESSION_ID!;

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${API_KEY}`,
  };
}

// Números BR sem DDI vêm com 10 dígitos (DDD + fixo) ou 11 (DDD + 9 + celular) — sem o 55
// na frente, o WhatsApp resolve pra um chatId que não existe e o envio falha em silêncio
// (a API do OpenWA retorna ok mesmo assim). Números com 12-13 dígitos já trazem o DDI.
function normalizeBrazilianPhone(digits: string): string {
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

// OpenWA chatId format: "<digits>@c.us" (individual) or "<digits>@g.us" (group)
export function phoneToChatId(phone: string): string {
  const digits = normalizeBrazilianPhone(phone.replace(/\D/g, ""));
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

export async function getSessionStatus(): Promise<OpenwaSessionStatus> {
  const res = await fetch(`${BASE_URL}/api/sessions/${SESSION_ID}`, { headers: headers() });
  if (!res.ok) throw new Error(`OpenWA: falha ao consultar sessão (${res.status})`);
  return res.json();
}

export async function getSessionQr(): Promise<string | null> {
  const res = await fetch(`${BASE_URL}/api/sessions/${SESSION_ID}/qr`, { headers: headers() });
  if (!res.ok) return null;
  const data = await res.json() as { qrCode?: string };
  return data.qrCode ?? null;
}

export async function sendText(phone: string, text: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/api/sessions/${SESSION_ID}/messages/send-text`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ chatId: phoneToChatId(phone), text }),
  });
  return res.ok;
}

export async function sendImage(phone: string, url: string, caption?: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/api/sessions/${SESSION_ID}/messages/send-image`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ chatId: phoneToChatId(phone), url, caption }),
  });
  return res.ok;
}

export async function sendVideo(phone: string, url: string, caption?: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/api/sessions/${SESSION_ID}/messages/send-video`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ chatId: phoneToChatId(phone), url, caption }),
  });
  return res.ok;
}

export type BulkRecipient = { phone: string; text: string };

export async function sendBulk(
  recipients: BulkRecipient[],
  delayBetweenMessagesMs: number
): Promise<{ batchId: string; statusUrl: string }> {
  const res = await fetch(`${BASE_URL}/api/sessions/${SESSION_ID}/messages/send-bulk`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      messages: recipients.map(r => ({ chatId: phoneToChatId(r.phone), text: r.text })),
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
  const res = await fetch(`${BASE_URL}/api/sessions/${SESSION_ID}/messages/batch/${batchId}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`OpenWA: falha ao consultar lote (${res.status})`);
  return res.json();
}
