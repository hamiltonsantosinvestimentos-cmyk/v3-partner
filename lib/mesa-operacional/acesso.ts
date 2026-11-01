// Acesso aos tickets operacionais (BRIEF 01/11/2026, política de sigilo). A decisão fica numa função pura, testada,
// para a página e as rotas nunca assumirem papel de equipe por padrão: sem usuário, sem perfil ou sem papel, o
// resultado é "negado". Antes, a página usava MESA_OPERACIONAL como papel padrão e, com a chave de serviço (que
// ignora a RLS), um perfil que não viesse abriria todos os tickets.

export const PAPEIS_EQUIPE_TICKETS = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AcessoTickets =
  | { tipo: "negado" }
  | { tipo: "equipe"; id: string }
  | { tipo: "comum"; id: string };

/**
 * user: o usuário da sessão (só o id importa). perfil: a linha de profiles lida pelo servidor.
 * - sem usuário válido, sem perfil, perfil de outro usuário ou papel nulo ou vazio: negado;
 * - ADMIN, GESTAO e MESA_OPERACIONAL: equipe (vê todos);
 * - qualquer outro papel não vazio: comum (vê só os tickets em que é solicitante ou responsável).
 * O id é sempre um UUID, então pode ir em filtro de consulta sem risco de injeção.
 */
export function resolverAcessoTickets(
  user: { id?: string | null } | null | undefined,
  perfil: { id?: string | null; role?: string | null } | null | undefined,
): AcessoTickets {
  const uid = user?.id;
  if (typeof uid !== "string" || !UUID_RE.test(uid)) return { tipo: "negado" };
  if (!perfil || perfil.id !== uid) return { tipo: "negado" };
  const papel = typeof perfil.role === "string" ? perfil.role.trim() : "";
  if (!papel) return { tipo: "negado" };
  return (PAPEIS_EQUIPE_TICKETS as readonly string[]).includes(papel)
    ? { tipo: "equipe", id: uid }
    : { tipo: "comum", id: uid };
}
