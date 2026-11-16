// Descarte do log de criação de operações (BRIEF 15/11/2026, item 1.13). A contagem e o apagamento moram na função
// SQL creation_log_retention (atômica, com simulação); aqui fica só a orquestração testável: contar, auditar o início
// ANTES de apagar, apagar só se for execução real e auditar o fim. Auditoria com contagens apenas, sem dado pessoal.
// Mesmo padrão de lib/chat-retention.ts.

export interface ContagemDescarte {
  real: boolean;
  ip_vencidos: number;
  ip_de_conta_excluida: number;
  linhas_vencidas: number;
}

export interface PortaDescarte {
  /** Chama creation_log_retention(p_real). Devolve null em falha. */
  executar(real: boolean): Promise<ContagemDescarte | null>;
  /** Grava em audit_logs. Devolve false se falhar. */
  auditar(action: string, dados: Record<string, unknown>): Promise<boolean>;
}

export type ResultadoDescarte =
  | { ok: true; simulacao: boolean; contagem: ContagemDescarte }
  | { ok: false; erro: "falha_ao_contar" | "falha_ao_auditar" | "falha_ao_apagar" };

export async function executarDescarteDoLog(porta: PortaDescarte, opcoes: { real: boolean }): Promise<ResultadoDescarte> {
  // Sempre conta primeiro em simulação: o início é auditado com o que VAI acontecer, antes de qualquer apagamento.
  const previa = await porta.executar(false);
  if (!previa) return { ok: false, erro: "falha_ao_contar" };

  const iniciou = await porta.auditar("creation_log_retention_inicio", { ...previa, real: opcoes.real });
  if (!iniciou) return { ok: false, erro: "falha_ao_auditar" };

  if (!opcoes.real) return { ok: true, simulacao: true, contagem: previa };

  const feito = await porta.executar(true);
  if (!feito) return { ok: false, erro: "falha_ao_apagar" };
  const terminou = await porta.auditar("creation_log_retention_fim", { ...feito });
  if (!terminou) return { ok: false, erro: "falha_ao_auditar" };
  return { ok: true, simulacao: false, contagem: feito };
}
