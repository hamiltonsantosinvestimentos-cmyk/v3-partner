// Cliente fino sobre o Send API do Instagram (Messenger Platform / Instagram Graph API).
// Requer uma Página do Facebook com uma conta Instagram Profissional vinculada e um
// token de acesso de Página com os escopos instagram_manage_messages/pages_messaging.
// Ver lib/meta-ads.ts para o cliente irmão da Marketing API (contas de anúncio) —
// tokens diferentes, não reaproveitar.

const GRAPH_API_VERSION = "v26.0";
// graph.instagram.com, nao graph.facebook.com -- o token e um Instagram User
// Access Token (prefixo IGAAU, gerado via Instagram API with Instagram Login),
// que so e aceito no host do Instagram. Ver lib/meta-ads.ts pro caso do token
// de Pagina classico, que usa graph.facebook.com.
const GRAPH_BASE = `https://graph.instagram.com/${GRAPH_API_VERSION}`;

function pageAccessToken(): string {
  const v = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
  if (!v) throw new Error("INSTAGRAM_PAGE_ACCESS_TOKEN não configurado — preencha no .env.local antes de usar o SDR no Instagram.");
  return v;
}

export class InstagramDmError extends Error {
  code?: number;
  subcode?: number;
  constructor(message: string, opts?: { code?: number; subcode?: number }) {
    super(message);
    this.name = "InstagramDmError";
    this.code = opts?.code;
    this.subcode = opts?.subcode;
  }
}

type MetaErrorBody = { error?: { message?: string; code?: number; error_subcode?: number } };

// Envia texto simples pra um IGSID (Instagram-Scoped ID) via Send API.
// Fora da janela de 24h pós-contato a Meta rejeita mensagens fora de tag
// aprovada — por ora só cobrimos resposta dentro da janela, igual o SDR de
// WhatsApp já assume (não há tagging de mensagem implementado em nenhum
// dos dois canais ainda).
export async function sendInstagramText(igsid: string, text: string): Promise<void> {
  const res = await fetch(`${GRAPH_BASE}/me/messages?access_token=${encodeURIComponent(pageAccessToken())}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: igsid },
      message: { text },
      messaging_type: "RESPONSE",
    }),
  });

  const json = (await res.json()) as MetaErrorBody;
  if (!res.ok || json.error) {
    const err = json.error;
    throw new InstagramDmError(err?.message ?? `Erro HTTP ${res.status} no Send API do Instagram`, {
      code: err?.code,
      subcode: err?.error_subcode,
    });
  }
}
