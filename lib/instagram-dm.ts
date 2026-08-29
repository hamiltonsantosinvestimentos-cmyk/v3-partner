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

// Comment-to-DM: manda uma "Private Reply" pro autor de um comentário —
// funciona como resposta ao comment_id em vez de um IGSID direto. Regra da
// Meta: só é possível uma private reply por comentário, e só dentro de 7
// dias da publicação do comentário (fora disso a Graph API rejeita).
export async function sendInstagramPrivateReply(commentId: string, text: string): Promise<void> {
  const res = await fetch(`${GRAPH_BASE}/me/messages?access_token=${encodeURIComponent(pageAccessToken())}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { comment_id: commentId },
      message: { text },
    }),
  });

  const json = (await res.json()) as MetaErrorBody;
  if (!res.ok || json.error) {
    const err = json.error;
    throw new InstagramDmError(err?.message ?? `Erro HTTP ${res.status} na Private Reply do Instagram`, {
      code: err?.code,
      subcode: err?.error_subcode,
    });
  }
}

// Checa se o IGSID segue a conta comercial (usado no gate do Comment-to-DM
// pra não liberar a DM do gatilho pra quem ainda não segue). Retorna null
// (não false!) quando a consulta falha -- quem chama deve tratar null como
// "não sei", fail-open, pra um erro de API não bloquear a conversa indevidamente.
export async function checkIsFollowing(igsid: string): Promise<boolean | null> {
  try {
    const res = await fetch(
      `${GRAPH_BASE}/${igsid}?fields=is_user_follow_business&access_token=${encodeURIComponent(pageAccessToken())}`
    );
    const json = (await res.json()) as MetaErrorBody & { is_user_follow_business?: boolean };
    if (!res.ok || json.error) return null;
    return json.is_user_follow_business ?? null;
  } catch {
    return null;
  }
}

export type InstagramQuickReply = { title: string; payload: string };

// Private Reply com botões (quick replies) -- usado pro pedido de "segue a
// gente" no gate do Comment-to-DM. Título tem limite curto na API (~20
// caracteres), quem chama deve manter os títulos enxutos.
export async function sendInstagramPrivateReplyWithQuickReplies(
  commentId: string,
  text: string,
  quickReplies: InstagramQuickReply[]
): Promise<void> {
  const res = await fetch(`${GRAPH_BASE}/me/messages?access_token=${encodeURIComponent(pageAccessToken())}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { comment_id: commentId },
      message: {
        text,
        quick_replies: quickReplies.map((q) => ({ content_type: "text", title: q.title, payload: q.payload })),
      },
    }),
  });

  const json = (await res.json()) as MetaErrorBody;
  if (!res.ok || json.error) {
    const err = json.error;
    throw new InstagramDmError(err?.message ?? `Erro HTTP ${res.status} na Private Reply com quick replies do Instagram`, {
      code: err?.code,
      subcode: err?.error_subcode,
    });
  }
}

export type InstagramMediaSummary = {
  id: string;
  caption?: string;
  permalink?: string;
  media_type?: string;
  thumbnail_url?: string;
  media_url?: string;
  timestamp?: string;
};

// Lista os posts recentes da conta — usado pra deixar escolher o post de um
// gatilho de Comment-to-DM numa lista em vez de exigir colar a URL (que não
// dá pra resolver pro media_id sem outra chamada à API mesmo assim).
export async function listRecentInstagramMedia(limit = 25): Promise<InstagramMediaSummary[]> {
  const res = await fetch(
    `${GRAPH_BASE}/me/media?fields=id,caption,permalink,media_type,thumbnail_url,media_url,timestamp&limit=${limit}&access_token=${encodeURIComponent(pageAccessToken())}`
  );
  const json = (await res.json()) as MetaErrorBody & { data?: InstagramMediaSummary[] };
  if (!res.ok || json.error) {
    const err = json.error;
    throw new InstagramDmError(err?.message ?? `Erro HTTP ${res.status} ao listar posts do Instagram`, {
      code: err?.code,
      subcode: err?.error_subcode,
    });
  }
  return json.data ?? [];
}

// Resposta pública opcional no próprio comentário (complementa a private
// reply — ex: "Te chamei no Direct! 📩"), via endpoint de replies do comentário.
// ── Modo white label (partner) ──────────────────────────────────────────────
// As funções acima usam o Instagram User Access Token (login direto do IG,
// prefixo IGAAU) do bot interno da V3, via graph.instagram.com. Isso só
// funciona pra UMA conta (quem fez o login direto na Meta pra gerar esse
// token). Pra atender vários partners, cada um com a própria Página/conta
// profissional, usamos o outro fluxo oficial da Meta — "Facebook Login for
// Business" (OAuth, ver lib/meta-oauth.ts) — que devolve um token de PÁGINA,
// aceito em graph.facebook.com (não graph.instagram.com), endereçado pelo
// instagram_business_account_id da conta vinculada àquela Página.
const GRAPH_FACEBOOK_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export async function sendInstagramTextAsPage(
  igBusinessAccountId: string,
  igsid: string,
  text: string,
  pageAccessToken: string
): Promise<void> {
  const res = await fetch(`${GRAPH_FACEBOOK_BASE}/${igBusinessAccountId}/messages?access_token=${encodeURIComponent(pageAccessToken)}`, {
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
    throw new InstagramDmError(err?.message ?? `Erro HTTP ${res.status} no Send API do Instagram (Página)`, {
      code: err?.code,
      subcode: err?.error_subcode,
    });
  }
}

export async function replyToInstagramComment(commentId: string, text: string): Promise<void> {
  const res = await fetch(`${GRAPH_BASE}/${commentId}/replies?access_token=${encodeURIComponent(pageAccessToken())}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: text }),
  });

  const json = (await res.json()) as MetaErrorBody;
  if (!res.ok || json.error) {
    const err = json.error;
    throw new InstagramDmError(err?.message ?? `Erro HTTP ${res.status} ao responder o comentário`, {
      code: err?.code,
      subcode: err?.error_subcode,
    });
  }
}
