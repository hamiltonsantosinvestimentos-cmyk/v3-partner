// Remetente do e-mail pelo destinatário: equipe de Enterprise com domínio próprio verificado no
// Resend recebe de "{marca}" <naoresponda@{domínio}>. BRIEF docs/briefs/2026-11-25_emails-remetente-enterprise.md
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emailParaIlike, montarRemetente } from "@/lib/email-remetente-regras";

let cache: { ate: number; dominios: Set<string> } | null = null;

/** Domínios com status verified no Resend. Cache de 10 min; falha guarda vazio por 2 min. */
export async function dominiosVerificadosResend(): Promise<Set<string>> {
  if (cache && Date.now() < cache.ate) return cache.dominios;
  let dominios = new Set<string>();
  let validade = 2 * 60_000;
  try {
    const r = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      cache: "no-store",
    });
    if (r.ok) {
      const j = (await r.json()) as { data?: { name?: string; status?: string }[] };
      dominios = new Set((j.data ?? []).filter((d) => d.status === "verified" && d.name).map((d) => String(d.name).toLowerCase()));
      validade = 10 * 60_000;
    }
  } catch { /* vazio: tudo sai como V3 */ }
  cache = { ate: Date.now() + validade, dominios };
  return dominios;
}

export interface RemetenteMarca { from: string; marca: string }

/** Remetente e nome da marca do Enterprise do destinatário, ou null (sai como V3). */
export async function remetentePara(db: SupabaseClient, email: string): Promise<RemetenteMarca | null> {
  if (!email) return null;
  const { data: perfil } = await db.from("profiles").select("id, role, enterprise_id")
    .ilike("email", emailParaIlike(email)).limit(1).maybeSingle();
  const p = perfil as { id: string; role: string | null; enterprise_id: string | null } | null;
  if (!p || p.role !== "ENTERPRISE") return null;
  const masterId = p.enterprise_id ?? p.id;
  const { data: master } = await db.from("profiles")
    .select("full_name, white_label_nome, white_label_dominio, white_label_dominio_status").eq("id", masterId).maybeSingle();
  const m = master as { full_name: string | null; white_label_nome: string | null; white_label_dominio: string | null; white_label_dominio_status: string | null } | null;
  if (!m?.white_label_dominio) return null;
  const nome = m.white_label_nome || m.full_name;
  const from = montarRemetente({ nome, dominio: m.white_label_dominio, status: m.white_label_dominio_status, verificados: await dominiosVerificadosResend() });
  return from && nome ? { from, marca: nome } : null;
}
