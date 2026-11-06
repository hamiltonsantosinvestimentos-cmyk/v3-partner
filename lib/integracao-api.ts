// Servidor da tela "Integração por API" (partner) e da página "Chaves de API" (ADMIN).
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc, type SupabaseClient } from "@supabase/supabase-js";
import { getClientIp } from "@/lib/audit";
import { planoTemApi } from "@/lib/api-keys";

export function svcDb(): SupabaseClient {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export type Chamador = { id: string; email: string | null; nome: string | null; role: string | null; ip: string | null; userAgent: string | null };

export async function chamador(req: NextRequest): Promise<Chamador | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await svcDb().from("profiles").select("full_name, role").eq("id", user.id).maybeSingle();
  return {
    id: user.id,
    email: user.email ?? null,
    nome: (perfil as { full_name?: string } | null)?.full_name ?? null,
    role: (perfil as { role?: string } | null)?.role ?? null,
    ip: getClientIp(req),
    userAgent: req.headers.get("user-agent"),
  };
}

export function podeUsarApi(c: Chamador | null): c is Chamador {
  return !!c && planoTemApi(c.role);
}

/** Cláusulas exibidas em destaque na tela de aceite (Termo v2.1, cláusula 14.6). */
export const CLAUSULAS_DESTAQUE = ["4.8", "4.9", "11.4", "12.4", "12.5", "12.7", "12.8"];

/** Recorta do texto do termo o trecho de cada cláusula em destaque, para a tela. */
export function trechosEmDestaque(texto: string): { clausula: string; texto: string }[] {
  const linhas = texto.split(/\r?\n/);
  const out: { clausula: string; texto: string }[] = [];
  for (const c of CLAUSULAS_DESTAQUE) {
    const ini = linhas.findIndex((l) => l.trim().startsWith(`${c}.`));
    if (ini < 0) continue;
    let fim = ini + 1;
    while (fim < linhas.length && !/^\s*(\d+\.\d+\.|##\s|\d+\.\s)/.test(linhas[fim])) fim++;
    out.push({ clausula: c, texto: linhas.slice(ini, fim).join("\n").trim() });
  }
  return out;
}

export function emailHtml(titulo: string, paragrafos: string[]): string {
  const corpo = paragrafos.map((p) => `<p style="margin:0 0 14px;color:#F0ECE4;font-size:14px;line-height:1.6">${p}</p>`).join("");
  return `<div style="background:#09081A;padding:32px;font-family:'DM Sans',Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#111F35;border:1px solid #162744;border-radius:10px;padding:28px">
    <p style="margin:0 0 6px;color:#C9A84C;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase">V3 Partners · Integração por API</p>
    <h1 style="margin:0 0 18px;color:#F0ECE4;font-size:20px">${titulo}</h1>
    ${corpo}
    <p style="margin:18px 0 0;color:#7A8FA8;font-size:12px">Se você não reconhece esta ação, revogue as chaves em app.v3partners.com.br/integracao-api e escreva para suporte@v3partners.com.br.</p>
  </div></div>`;
}
