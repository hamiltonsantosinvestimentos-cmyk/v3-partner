/**
 * Cora Bank API — Integração Direta (mTLS)
 * Ambiente: stage → matls-clients.api.stage.cora.com.br
 * Ambiente: prod  → matls-clients.api.cora.com.br
 */
import https from "https";

const IS_STAGE = (process.env.CORA_ENV ?? "stage") === "stage";

export const CORA_BASE = IS_STAGE
  ? "https://matls-clients.api.stage.cora.com.br"
  : "https://matls-clients.api.cora.com.br";

const CLIENT_ID = process.env.CORA_CLIENT_ID!;

function getCert(): string {
  return (process.env.CORA_CERTIFICATE ?? "").replace(/\\n/g, "\n");
}

function getKey(): string {
  return (process.env.CORA_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
}

// Cache simples de token em memória (válido por 23h)
let _tokenCache: { token: string; expiresAt: number } | null = null;

export async function getCoraToken(): Promise<string> {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt) {
    return _tokenCache.token;
  }

  const agent = new https.Agent({ cert: getCert(), key: getKey() });
  const body = `grant_type=client_credentials&client_id=${CLIENT_ID}`;

  const res = await fetch(`${CORA_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    // @ts-ignore — Node fetch aceita agent
    agent,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cora auth error ${res.status}: ${text}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  _tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 3600) * 1000, // renova 1h antes
  };
  return _tokenCache.token;
}

/** Faz uma requisição autenticada com mTLS para a API Cora */
export async function coraFetch(
  path: string,
  options: RequestInit & { idempotencyKey?: string } = {}
): Promise<Response> {
  const token = await getCoraToken();
  const agent = new https.Agent({ cert: getCert(), key: getKey() });

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (options.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  return fetch(`${CORA_BASE}${path}`, {
    ...options,
    headers,
    // @ts-ignore
    agent,
  });
}

/** Formata centavos para R$ */
export function formatBRL(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
