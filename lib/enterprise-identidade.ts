// Identidade do Enterprise (marca + razão social + CNPJ + site) para telas e documentos gerados pela equipe.
// BRIEF docs/briefs/2026-11-23_enterprise-identidade-fase1-chat-operacoes-simuladores.md
import type { SupabaseClient } from "@supabase/supabase-js";
import { contextoEnterprise } from "@/lib/enterprise";
import { formatCNPJ, isValidCNPJ } from "@/lib/validators/cpf-cnpj";

export interface IdentidadeEnterprise {
  nome: string;
  /** Logo para fundo escuro (telas). */
  logoUrl: string | null;
  /** Logo para fundo claro (PDFs de fundo branco). */
  logoClaroUrl: string | null;
  razaoSocial: string | null;
  /** Mascarado para exibição (XX.XXX.XXX/XXXX-XX). */
  cnpj: string | null;
  /** Domínio próprio ativo, sem protocolo. */
  site: string | null;
}

/** Formato gravado: 14 caracteres, sem pontuação, maiúsculo (aceita o CNPJ alfanumérico). */
export function normalizarCnpj(v: string | null | undefined): string {
  return String(v ?? "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

/** CNPJ normalizado e válido, ou null. */
export function cnpjCanonico(v: string | null | undefined): string | null {
  const c = normalizarCnpj(v);
  return c.length === 14 && isValidCNPJ(c) ? c : null;
}

export function normalizarRazaoSocial(v: string | null | undefined): string | null {
  const t = String(v ?? "").trim().replace(/\s+/g, " ").slice(0, 200);
  return t || null;
}

/** "Razão social · CNPJ xx · site" com o que existir; sem razão social nem CNPJ, a marca. */
export function linhaJuridica(id: IdentidadeEnterprise): string {
  const partes = [id.razaoSocial, id.cnpj ? `CNPJ ${id.cnpj}` : null, id.site].filter(Boolean) as string[];
  if (!id.razaoSocial && !id.cnpj) return [id.nome, id.site].filter(Boolean).join(" · ");
  return partes.join(" · ");
}

/**
 * Identidade do Enterprise do perfil (master ou usuário da equipe), lida com o cliente de serviço:
 * o usuário da equipe não lê a linha do master pela RLS. Não-Enterprise: null (fica V3).
 * Tolerante: sem as colunas novas (migration ainda não aplicada), sai só com a marca.
 */
export async function identidadeDoPerfil(db: SupabaseClient, perfilId: string): Promise<IdentidadeEnterprise | null> {
  const ctx = await contextoEnterprise(db, perfilId);
  if (!ctx) return null;
  const nome = ctx.marca?.nome ?? ctx.marcaNome ?? ctx.masterNome ?? "Enterprise";

  let razaoSocial: string | null = null;
  let cnpj: string | null = null;
  try {
    const { data, error } = await db.from("profiles").select("white_label_razao_social, white_label_cnpj").eq("id", ctx.masterId).maybeSingle();
    if (!error && data) {
      razaoSocial = normalizarRazaoSocial((data as { white_label_razao_social?: string | null }).white_label_razao_social);
      const c = cnpjCanonico((data as { white_label_cnpj?: string | null }).white_label_cnpj);
      cnpj = c ? formatCNPJ(c) : null;
    }
  } catch { /* colunas ainda não existem: segue só com a marca */ }

  let site: string | null = null;
  try {
    const { data } = await db.from("profiles").select("white_label_dominio, white_label_dominio_status").eq("id", ctx.masterId).maybeSingle();
    const d = data as { white_label_dominio?: string | null; white_label_dominio_status?: string | null } | null;
    if (d?.white_label_dominio && d.white_label_dominio_status === "ativo") site = d.white_label_dominio;
  } catch { /* sem domínio */ }

  return {
    nome,
    logoUrl: ctx.marca?.logoUrl ?? null,
    logoClaroUrl: ctx.tema?.logo_claro_url ?? null,
    razaoSocial,
    cnpj,
    site,
  };
}
