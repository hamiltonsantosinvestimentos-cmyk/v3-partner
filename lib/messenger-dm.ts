// Cliente fino sobre o Send API do Facebook Messenger (Messenger Platform).
// Requer uma Página do Facebook com o produto Messenger ativado no App e um
// token de acesso de Página com o escopo pages_messaging. Irmão direto de
// lib/instagram-dm.ts — mesma API (Send API da Meta), host diferente:
// Messenger fala com graph.facebook.com, não graph.instagram.com (esse é
// exclusivo de Instagram Login). Ver lib/meta-ads.ts pro cliente da
// Marketing API (contas de anúncio) — tokens diferentes, não reaproveitar.

const GRAPH_API_VERSION = "v26.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// Sem token explícito, cai no bot interno da V3 (MESSENGER_PAGE_ACCESS_TOKEN
// no env). Partners white label passam o próprio token de Página (obtido via
// OAuth "Conectar com Facebook" — ver lib/meta-oauth.ts), guardado
// criptografado em partner_sdr_connections.meta_page_access_token_encrypted.
function pageAccessToken(token?: string): string {
  const v = token ?? process.env.MESSENGER_PAGE_ACCESS_TOKEN;
  if (!v) throw new Error("MESSENGER_PAGE_ACCESS_TOKEN não configurado — preencha no .env.local antes de usar o SDR no Messenger.");
  return v;
}

export class MessengerDmError extends Error {
  code?: number;
  subcode?: number;
  constructor(message: string, opts?: { code?: number; subcode?: number }) {
    super(message);
    this.name = "MessengerDmError";
    this.code = opts?.code;
    this.subcode = opts?.subcode;
  }
}

type MetaErrorBody = { error?: { message?: string; code?: number; error_subcode?: number } };

// Envia texto simples pra um PSID (Page-Scoped ID) via Send API. Igual o
// WhatsApp e o Instagram, opções de resposta rápida aqui são simuladas por
// texto (ver lib/whatsapp/quick-reply.ts) — mesmo método nos 4 canais, em
// vez de usar o quick_replies nativo do Messenger, pra manter o comportamento
// idêntico entre canais (edição/resolução de resposta compartilhada).
// Fora da janela de 24h pós-contato a Meta rejeita mensagens fora de tag
// aprovada — não há tagging de mensagem implementado ainda (mesma limitação
// já assumida no WhatsApp/Instagram).
export async function sendMessengerText(psid: string, text: string, token?: string): Promise<void> {
  const res = await fetch(`${GRAPH_BASE}/me/messages?access_token=${encodeURIComponent(pageAccessToken(token))}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: psid },
      message: { text },
      messaging_type: "RESPONSE",
    }),
  });

  const json = (await res.json()) as MetaErrorBody;
  if (!res.ok || json.error) {
    const err = json.error;
    throw new MessengerDmError(err?.message ?? `Erro HTTP ${res.status} no Send API do Messenger`, {
      code: err?.code,
      subcode: err?.error_subcode,
    });
  }
}
