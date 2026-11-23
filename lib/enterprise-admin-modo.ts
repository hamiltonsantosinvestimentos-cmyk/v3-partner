// Modo ADMIN do painel /enterprise (BRIEF 2026-11-19_admin-configura-white-label-enterprise.md):
// o ADMIN abre /enterprise?master=<id> e configura marca e domínio em nome do master.
// Regra pura (sem I/O), usada por lib/enterprise-server.ts e pelos testes.

export type DecisaoModoAdmin = { ok: true } | { ok: false; status: 400 | 403 | 404; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ehUuid(v: string | null | undefined): boolean {
  return !!v && UUID.test(v);
}

/**
 * Decide se quem chamou pode agir em nome do master informado em `?master=`.
 * Ordem: rota sem modo ADMIN (403) → papel lido do banco diferente de ADMIN (403) →
 * id inválido (400) → alvo inexistente, não Enterprise ou usuário filho (404).
 */
export function decidirModoAdmin(p: {
  permitirAdmin: boolean;
  callerRole: string | null | undefined;
  masterParam: string;
  alvo: { role: string | null; enterprise_id: string | null } | null;
}): DecisaoModoAdmin {
  if (!p.permitirAdmin) return { ok: false, status: 403, error: "Ação disponível só para o master" };
  if (p.callerRole !== "ADMIN") return { ok: false, status: 403, error: "Acesso restrito a administradores" };
  if (!ehUuid(p.masterParam)) return { ok: false, status: 400, error: "Master inválido" };
  if (!p.alvo || p.alvo.role !== "ENTERPRISE" || p.alvo.enterprise_id) {
    return { ok: false, status: 404, error: "Master Enterprise não encontrado" };
  }
  return { ok: true };
}

/** Lê `?master=` de uma URL; null quando não veio. */
export function masterDaUrl(url: string): string | null {
  try {
    return new URL(url).searchParams.get("master");
  } catch {
    return null;
  }
}

export const ERRO_LOG_ADMIN = "Não foi possível registrar a alteração no log. Nada foi alterado.";
