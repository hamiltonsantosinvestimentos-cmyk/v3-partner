// Regras puras da recuperação de senha com a marca do Enterprise (sem IO, testáveis).
// BRIEF docs/briefs/2026-11-25_recuperar-senha-marca-enterprise.md

/** E-mail digitado normalizado (trim, minúsculas), ou null se o formato básico não bate. */
export function normalizarEmail(email: unknown): string | null {
  const e = String(email ?? "").trim().toLowerCase();
  if (!e || e.length > 254) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
}

/** O perfil é da equipe do master (o próprio master ou alguém com enterprise_id = master)? */
export function daEquipe(
  p: { id: string; role: string | null; enterprise_id: string | null } | null | undefined,
  masterId: string,
): boolean {
  if (!p || p.role !== "ENTERPRISE") return false;
  return p.id === masterId || p.enterprise_id === masterId;
}

export interface Reserva { id: string; created_at: string }

export const JANELA_MS = 60_000;
export const MAX_ENVIOS_HORA = 5;
export const MAX_RESERVAS_USUARIO_HORA = 10;
export const MAX_RESERVAS_IP_HORA = 20;

/**
 * Envia só se a reserva `minhaId` é a primeira (por created_at, id) entre as reservas dos últimos
 * 60 s e se houve menos de 5 envios efetivos na última hora. Em pedidos simultâneos, só um envia.
 */
export function podeEnviar(reservas: Reserva[], minhaId: string, enviosNaHora: number, agora: number): boolean {
  if (enviosNaHora >= MAX_ENVIOS_HORA) return false;
  const recentes = reservas
    .filter((r) => agora - new Date(r.created_at).getTime() < JANELA_MS)
    .sort((a, b) => (a.created_at === b.created_at ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.created_at < b.created_at ? -1 : 1));
  return recentes.length > 0 && recentes[0].id === minhaId;
}
