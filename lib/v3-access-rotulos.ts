// Partes puras de lib/v3-access.ts (sem banco), que também rodam no navegador.

/** Lançamento do V3 Access (PR #220): cadastro STARTER antes disso é do antigo V3 Starter. */
export const ACCESS_LANCAMENTO = "2026-10-03T00:00:00Z";

/** Cadastro de plano STARTER feito antes do lançamento do Access = antigo V3 Starter. */
export const cadastroStarterAntigo = (plano: string | null | undefined, createdAt: string | null | undefined) =>
  plano === "STARTER" && !!createdAt && createdAt < ACCESS_LANCAMENTO;

/** Nome do plano de um perfil STARTER: Access ou o antigo Starter. */
export const rotuloStarter = (antigo: boolean) => (antigo ? "V3 Starter" : "V3 Access");
