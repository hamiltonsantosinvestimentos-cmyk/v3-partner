/**
 * Domínio próprio do Enterprise na Vercel (24/09/2026). Cadastra/verifica/remove o domínio no
 * projeto que serve app.v3partners.com.br, via API REST da Vercel.
 *
 * Variáveis de ambiente (Vercel → Settings → Environment Variables):
 *   VERCEL_API_TOKEN   token de acesso (vercel.com/account/tokens), escopo do time do projeto
 *   VERCEL_PROJECT_ID  id do projeto que atende app.v3partners.com.br
 *   VERCEL_TEAM_ID     id do time (opcional se o projeto for de conta pessoal)
 */

const API = "https://api.vercel.com";

export const DNS_CNAME = "cname.vercel-dns.com";
export const DNS_A = "76.76.21.21";

export function vercelConfigurada() {
  return Boolean(process.env.VERCEL_API_TOKEN && process.env.VERCEL_PROJECT_ID);
}

function url(path: string) {
  const team = process.env.VERCEL_TEAM_ID ? `${path.includes("?") ? "&" : "?"}teamId=${process.env.VERCEL_TEAM_ID}` : "";
  return `${API}${path}${team}`;
}

async function chamar(path: string, init: RequestInit = {}) {
  const res = await fetch(url(path), {
    ...init,
    headers: { Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

/** "Https://Plataforma.Cliente.com.br/" → "plataforma.cliente.com.br"; null se inválido. */
export function normalizarDominio(entrada: string): string | null {
  const d = entrada.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
  if (!/^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d)) return null;
  if (d.endsWith("v3partners.com.br") || d.endsWith("vercel.app")) return null;
  return d;
}

/** Subdomínio (plataforma.cliente.com.br) usa CNAME; domínio raiz (cliente.com.br) usa registro A. */
export function ehDominioRaiz(d: string) {
  const partes = d.split(".");
  // .com.br/.net.br/.org.br etc. têm 2 níveis de sufixo
  const sufixoDuplo = /\.(com|net|org|gov|edu|adv|eng|med|ind|art)\.[a-z]{2}$/.test(d);
  return partes.length <= (sufixoDuplo ? 3 : 2);
}

export function instrucoesDns(d: string) {
  const raiz = ehDominioRaiz(d);
  const host = raiz ? "@" : d.split(".")[0];
  return raiz
    ? { tipo: "A", nome: host, valor: DNS_A }
    : { tipo: "CNAME", nome: host, valor: DNS_CNAME };
}

export async function adicionarDominio(d: string) {
  const r = await chamar(`/v10/projects/${process.env.VERCEL_PROJECT_ID}/domains`, { method: "POST", body: JSON.stringify({ name: d }) });
  // 409 = já está no projeto: tudo certo.
  if (!r.ok && r.status !== 409) {
    const err = (r.json.error as { message?: string } | undefined)?.message ?? `Vercel HTTP ${r.status}`;
    return { ok: false as const, error: err };
  }
  return { ok: true as const };
}

export async function removerDominio(d: string) {
  const r = await chamar(`/v9/projects/${process.env.VERCEL_PROJECT_ID}/domains/${d}`, { method: "DELETE" });
  return r.ok || r.status === 404;
}

/** Status atual: DNS apontando para a Vercel e domínio verificado no projeto. */
export async function statusDominio(d: string) {
  const [proj, cfg] = await Promise.all([
    chamar(`/v9/projects/${process.env.VERCEL_PROJECT_ID}/domains/${d}`),
    chamar(`/v6/domains/${d}/config`),
  ]);
  if (proj.status === 404) return { noProjeto: false, verificado: false, dnsOk: false, verificacao: [] as unknown[] };
  // Força a verificação de posse quando a Vercel pediu (TXT) — sem efeito se já verificado.
  if (proj.json.verified === false) await chamar(`/v9/projects/${process.env.VERCEL_PROJECT_ID}/domains/${d}/verify`, { method: "POST" });
  return {
    noProjeto: true,
    verificado: proj.json.verified !== false,
    dnsOk: cfg.ok && cfg.json.misconfigured === false,
    verificacao: (proj.json.verification as unknown[] | undefined) ?? [],
  };
}
