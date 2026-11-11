/**
 * Constantes de vigência das regras de conferência da qualificação (BRIEF 11/11/2026).
 *
 * Definidas no código e nunca lidas de dado editável: uma data lida do banco poderia ser
 * alterada para criar isenção. Mudar um valor aqui exige commit, PR e revisão.
 */

/**
 * Início de vigência da Q-01 (lista de partes em alíneas), em ISO com fuso. Contratos criados
 * antes desta data ficam isentos (histórico congelado).
 *
 * Fixar no dia em que a entrega das alíneas estiver em produção e conferida (o gerador passou a
 * emitir alíneas no merge do PR #396, em 11/11/2026). Enquanto for null, a Q-01 não barra nada.
 */
export const Q01_DATA_DE_CORTE_ISO: string | null = null;
