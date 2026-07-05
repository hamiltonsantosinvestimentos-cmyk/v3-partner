// Fonte única da data de vencimento efetiva de um partner: trial_expires_at,
// ou created_at + 30 dias quando ainda não foi definido explicitamente.
// Usado pela tela (coluna Vencimento), pelo cron de cobrança e pela geração manual
// de cobrança Cora, para que os três nunca divirjam sobre "quando esse partner vence".
export function efetivoVencimento(p: { trial_expires_at?: string | null; created_at: string }): Date {
  return p.trial_expires_at
    ? new Date(p.trial_expires_at)
    : new Date(new Date(p.created_at).getTime() + 30 * 86400000);
}
