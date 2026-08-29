// OAuth "Conectar com Facebook" (Facebook Login for Business) — usado só no
// SDR white label pra partner conectar a própria Página do Facebook (e, se
// houver, a conta profissional do Instagram vinculada a ela) sem precisar
// colar token manualmente. Diferente do bot interno da V3 (que usa um
// Instagram User Access Token fixo gerado uma vez via login direto — ver
// lib/instagram-dm.ts), aqui cada partner autoriza a própria Página e a V3
// nunca vê a senha/login dele, só o token de Página que a Meta devolve.
//
// IMPORTANTE — isso só funciona de ponta a ponta pra QUALQUER partner depois
// que o App da V3 em developers.facebook.com passar pela revisão da Meta
// (Business Verification + App Review dos escopos abaixo). Enquanto o App
// estiver em modo Development, só usuários cadastrados como Admin/
// Developer/Tester DESSE App conseguem completar o fluxo — é uma trava da
// própria Meta, não do código.
//
// Requer no .env.local: META_APP_ID, META_APP_SECRET (do mesmo App usado
// pros webhooks de Instagram/Messenger em developers.facebook.com/apps).

import { encryptSecret, decryptSecret } from "@/lib/crypto/secret";

const GRAPH_API_VERSION = "v26.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// Escopos mínimos pra: listar Páginas do usuário, mandar/receber mensagem no
// Messenger, ler/gerenciar mensagem do Instagram profissional vinculado.
export const META_OAUTH_SCOPES = [
  "pages_show_list",
  "pages_messaging",
  "instagram_basic",
  "instagram_manage_messages",
  "pages_manage_metadata",
  "business_management",
].join(",");

function appId(): string {
  const v = process.env.META_APP_ID;
  if (!v) throw new Error("META_APP_ID não configurado — preencha no .env.local com o ID do App em developers.facebook.com.");
  return v;
}

function appSecret(): string {
  const v = process.env.META_APP_SECRET;
  if (!v) throw new Error("META_APP_SECRET não configurado — preencha no .env.local com o App Secret em developers.facebook.com.");
  return v;
}

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.v3partners.com.br";
}

export function metaOauthRedirectUri(): string {
  // Precisa bater EXATAMENTE (inclusive barra final) com o cadastrado em
  // "Valid OAuth Redirect URIs" no painel do App, em Facebook Login for
  // Business > Configurações.
  return `${siteUrl()}/api/partner/sdr/meta-oauth/callback`;
}

export class MetaOAuthError extends Error {}

// ── State assinado (anti-CSRF) ──────────────────────────────────────────────
// Em vez de guardar o state num banco/sessão, criptografamos {partnerId, ts}
// com a mesma chave simétrica já usada pros segredos do SDR (SDR_SECRET_KEY)
// — o próprio payload cifrado vira o state. Se alguém adulterar o valor, a
// descriptografia falha (AES-GCM autentica); se for reaproveitado depois de
// velho, expiramos por timestamp.
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutos — tempo de sobra pro partner completar o consentimento na Meta

export function buildOAuthState(partnerId: string): string {
  return encryptSecret(JSON.stringify({ partnerId, ts: Date.now() }));
}

export function readOAuthState(state: string): { partnerId: string } {
  let parsed: { partnerId?: string; ts?: number };
  try {
    parsed = JSON.parse(decryptSecret(state));
  } catch {
    throw new MetaOAuthError("state inválido ou adulterado");
  }
  if (!parsed.partnerId || !parsed.ts) throw new MetaOAuthError("state incompleto");
  if (Date.now() - parsed.ts > STATE_TTL_MS) throw new MetaOAuthError("state expirado — tente conectar de novo");
  return { partnerId: parsed.partnerId };
}

export function buildOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: appId(),
    redirect_uri: metaOauthRedirectUri(),
    state,
    scope: META_OAUTH_SCOPES,
    response_type: "code",
  });
  return `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
}

type MetaErrorBody = { error?: { message?: string; type?: string; code?: number } };

async function metaGet<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = (await res.json()) as T & MetaErrorBody;
  if (!res.ok || json.error) {
    throw new MetaOAuthError(json.error?.message ?? `Erro HTTP ${res.status} na Graph API`);
  }
  return json;
}

// Troca o "code" do redirect pelo token de usuário de curta duração (~1-2h).
export async function exchangeCodeForUserToken(code: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: appId(),
    redirect_uri: metaOauthRedirectUri(),
    client_secret: appSecret(),
    code,
  });
  const data = await metaGet<{ access_token: string }>(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`);
  return data.access_token;
}

// Troca o token de curta duração por um de longa duração (~60 dias) — os
// tokens de Página derivados dele (fetchManagedPages) herdam essa duração
// longa e, na prática, não expiram enquanto o partner não revogar o acesso.
export async function exchangeForLongLivedUserToken(shortLivedToken: string): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId(),
    client_secret: appSecret(),
    fb_exchange_token: shortLivedToken,
  });
  const data = await metaGet<{ access_token: string }>(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`);
  return data.access_token;
}

export type ManagedPage = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string; username?: string } | null;
};

// Lista as Páginas que o usuário administra, já com o access_token de cada
// Página e a conta profissional do Instagram vinculada (quando houver).
export async function fetchManagedPages(longLivedUserToken: string): Promise<ManagedPage[]> {
  const params = new URLSearchParams({
    fields: "id,name,access_token,instagram_business_account{id,username}",
    access_token: longLivedUserToken,
  });
  const data = await metaGet<{ data: ManagedPage[] }>(`${GRAPH_BASE}/me/accounts?${params.toString()}`);
  return data.data ?? [];
}

// Inscreve a Página nos campos do webhook do App (Messenger: messages/
// messaging_postbacks; Instagram, quando há conta vinculada: comments —
// mensagens do Instagram chegam pela própria inscrição da Página). Sem essa
// chamada, a Meta nunca entrega evento nenhum pro nosso webhook pra essa
// Página específica, mesmo com o App já com o webhook configurado.
export async function subscribePageWebhook(pageId: string, pageAccessToken: string): Promise<void> {
  const params = new URLSearchParams({
    subscribed_fields: "messages,messaging_postbacks,comments",
    access_token: pageAccessToken,
  });
  const res = await fetch(`${GRAPH_BASE}/${pageId}/subscribed_apps?${params.toString()}`, { method: "POST" });
  const json = (await res.json()) as { success?: boolean } & MetaErrorBody;
  if (!res.ok || json.error || !json.success) {
    throw new MetaOAuthError(json.error?.message ?? `Erro HTTP ${res.status} ao inscrever a Página no webhook`);
  }
}

// ── Helpers de criptografia do token de Página (mesmo formato de
// lib/crypto/secret.ts usado em sdr_agents.api_key_encrypted) ─────────────
export const encryptPageToken = encryptSecret;
export const decryptPageToken = decryptSecret;
