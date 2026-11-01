// Motivo de exclusão e de outras ações com texto livre obrigatório (BRIEF Mesa M&A G1, 01/11/2026).
// Mesma regra no modal (navegador) e na rota (servidor): sem espaços nas pontas, no mínimo 5 e no máximo 500 caracteres.

export const MOTIVO_MIN = 5;
export const MOTIVO_MAX = 500;

/** Devolve o texto já sem espaços nas pontas se estiver dentro do limite; senão, null. */
export function motivoValido(texto: unknown, minimo: number = MOTIVO_MIN, maximo: number = MOTIVO_MAX): string | null {
  if (typeof texto !== "string") return null;
  const t = texto.trim();
  return t.length >= minimo && t.length <= maximo ? t : null;
}
