// Papéis isentos da cota de criação de operações (BRIEF 15/11/2026). Arquivo mínimo, sem dependência de Node, para poder
// ser importado tanto pelo servidor quanto pela tela (lib/creation-quota.ts importa node:net e não roda no navegador).
// A função SQL reserve_creation_slot aplica a mesma lista e nega por padrão: papel ausente, desconhecido ou futuro
// SOFRE a cota. Se esta lista mudar, mudar a função do banco na mesma migration.
export const PAPEIS_ISENTOS_COTA = ["ADMIN", "GESTAO", "MESA", "MESA_OPERACIONAL"] as const;

export function papelIsentoDeCota(papel: string | null | undefined): boolean {
  return !!papel && (PAPEIS_ISENTOS_COTA as readonly string[]).includes(papel);
}
