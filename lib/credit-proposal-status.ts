// Reabrir proposta (15/10/2026): reprovar/declinar grava status REJECTED/CANCELLED junto
// com a etapa. Quando a Mesa devolve a proposta para uma etapa ativa, só a etapa mudava e o
// status ficava REJECTED — o modal escondia Reprovar/Declinar/Aprovar. Ao sair de etapa
// terminal para etapa ativa, o status volta a ser de proposta em andamento.

export const ETAPAS_TERMINAIS = ["LIBERADO", "REPROVADO", "DECLINADO", "FINALIZADO"] as const;

export function etapaTerminal(stage: string | null | undefined): boolean {
  return (ETAPAS_TERMINAIS as readonly string[]).includes(stage ?? "");
}

/** Novo status ao mover para `novaEtapa`, ou undefined se o status atual continua valendo. */
export function statusAoReabrir(novaEtapa: string, statusAtual: string | null | undefined): string | undefined {
  if (etapaTerminal(novaEtapa)) return undefined;
  if (statusAtual !== "REJECTED" && statusAtual !== "CANCELLED") return undefined;
  return novaEtapa === "RECEBIDO" ? "PENDING" : "IN_REVIEW";
}
