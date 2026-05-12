/**
 * Cora Bank API — Integração Direta (mTLS)
 * Usa https nativo do Node.js para suportar mTLS no Vercel
 */
import https from "https";

const IS_STAGE = (process.env.CORA_ENV ?? "stage") === "stage";

export const CORA_BASE_HOST = IS_STAGE
  ? "matls-clients.api.stage.cora.com.br"
  : "matls-clients.api.cora.com.br";

export const CORA_BASE = `https://${CORA_BASE_HOST}`;

const CLIENT_ID = process.env.CORA_CLIENT_ID!;

function getCert(): string {
  return (process.env.CORA_CERTIFICATE ?? "").replace(/\\n/g, "\n");
}

function getKey(): string {
  return (process.env.CORA_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
}

// Faz uma requisição HTTPS com mTLS usando o módulo nativo do Node
function httpsRequest(options: https.RequestOptions, body?: string): Promise<{ status: number; data: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve({ status: res.statusCode ?? 0, data }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// Cache de token em memória (válido por 23h)
let _tokenCache: { token: string; expiresAt: number } | null = null;

export async function getCoraToken(): Promise<string> {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt) {
    return _tokenCache.token;
  }

  const body = `grant_type=client_credentials&client_id=${encodeURIComponent(CLIENT_ID)}`;

  const { status, data } = await httpsRequest({
    hostname: CORA_BASE_HOST,
    path: "/token",
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(body),
    },
    cert: getCert(),
    key: getKey(),
  }, body);

  if (status !== 200) {
    throw new Error(`Cora auth error ${status}: ${data}`);
  }

  const parsed = JSON.parse(data) as { access_token: string; expires_in: number };
  _tokenCache = {
    token: parsed.access_token,
    expiresAt: Date.now() + (parsed.expires_in - 3600) * 1000,
  };
  return _tokenCache.token;
}

/** Faz uma requisição autenticada com mTLS para a API Cora */
export async function coraFetch(
  path: string,
  options: { method?: string; body?: string; idempotencyKey?: string } = {}
): Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }> {
  const token = await getCoraToken();

  const headers: Record<string, string | number> = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  if (options.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  if (options.body) {
    headers["Content-Length"] = Buffer.byteLength(options.body);
  }

  const { status, data } = await httpsRequest({
    hostname: CORA_BASE_HOST,
    path,
    method: options.method ?? "GET",
    headers,
    cert: getCert(),
    key: getKey(),
  }, options.body);

  const ok = status >= 200 && status < 300;

  return {
    ok,
    status,
    json: async () => {
      try { return JSON.parse(data); } catch { return {}; }
    },
  };
}

/** Formata centavos para R$ */
export function formatBRL(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
