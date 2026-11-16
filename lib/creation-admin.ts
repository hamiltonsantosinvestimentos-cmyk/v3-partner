// Painel do ADMIN para a cota de criação (BRIEF 15/11/2026): validação e cálculo da suspensão, da liberação e da
// alteração de limites. Lógica pura, sem rede, testada em tests/unit/creation-admin.test.ts. As rotas
// (app/api/admin/creation-*) só validam o papel ADMIN no servidor, chamam isto e gravam a auditoria com await.
import { z } from "zod";
import { papelIsentoDeCota } from "@/lib/creation-quota";

export const MOTIVO_MIN = 5;
export const MOTIVO_MAX = 500;
export const SUSPENSAO_PADRAO_HORAS = 24;
export const SUSPENSAO_MAX_HORAS = 720;

const motivo = z
  .string({ message: "Informe o motivo." })
  .trim()
  .min(MOTIVO_MIN, `O motivo precisa ter pelo menos ${MOTIVO_MIN} caracteres.`)
  .max(MOTIVO_MAX, `O motivo pode ter no máximo ${MOTIVO_MAX} caracteres.`);

export const schemaControle = z.object({
  user_id: z.string({ message: "Usuário inválido." }).uuid("Usuário inválido."),
  acao: z.enum(["suspender", "liberar"], { message: "Ação inválida." }),
  motivo,
  horas: z.number().int("Informe um número inteiro de horas.").min(1, "Mínimo de 1 hora.")
    .max(SUSPENSAO_MAX_HORAS, `Máximo de ${SUSPENSAO_MAX_HORAS} horas.`).optional(),
});
export type PedidoControle = z.infer<typeof schemaControle>;

export interface EstadoControle {
  blocked_until: string | null;
  block_reason: string | null;
  blocked_by: string | null;
}

/** Estado novo da linha em partner_creation_controls. Suspensão manual e bloqueio automático usam o mesmo campo. */
export function estadoDoControle(p: Pick<PedidoControle, "acao" | "horas">, adminId: string, agora: Date = new Date()): EstadoControle {
  if (p.acao === "liberar") return { blocked_until: null, block_reason: null, blocked_by: null };
  const horas = p.horas ?? SUSPENSAO_PADRAO_HORAS;
  return {
    blocked_until: new Date(agora.getTime() + horas * 3600 * 1000).toISOString(),
    block_reason: "suspensao_manual",
    blocked_by: adminId,
  };
}

/** Suspender equipe não faz sentido (a função do banco nunca aplica cota a ela): recusa com mensagem clara. */
export function alvoPodeSerSuspenso(papelDoAlvo: string | null | undefined): { ok: true } | { ok: false; erro: string } {
  if (!papelDoAlvo) return { ok: false, erro: "Usuário não encontrado." };
  if (papelIsentoDeCota(papelDoAlvo)) {
    return { ok: false, erro: "A equipe interna é isenta da cota de criação e não pode ser suspensa por aqui." };
  }
  return { ok: true };
}

const inteiro = (min: number, max: number) => z.number().int().min(min).max(max);

export const schemaConfig = z.object({
  motivo,
  hora: inteiro(1, 1000).optional(),
  dia: inteiro(1, 10000).optional(),
  intervalo_s: inteiro(0, 3600).optional(),
  token_hora: inteiro(1, 1000).optional(),
  token_dia: inteiro(1, 10000).optional(),
  token_intervalo_s: inteiro(0, 3600).optional(),
  ip_retencao_dias: inteiro(1, 3650).optional(),
  log_retencao_meses: inteiro(1, 120).optional(),
  // As duas chaves de compliance. Ligar exige a resposta escrita do Robson (decisão registrada no BRIEF); a rota
  // só confere o papel ADMIN e registra quem ligou e por quê.
  ip_registro_ativo: z.boolean().optional(),
  bloqueio_automatico_ativo: z.boolean().optional(),
}).refine((c) => Object.keys(c).some((k) => k !== "motivo"), { message: "Informe pelo menos um valor para alterar." });
export type PedidoConfig = z.infer<typeof schemaConfig>;

export const CAMPOS_CONFIG = [
  "hora", "dia", "intervalo_s", "token_hora", "token_dia", "token_intervalo_s",
  "ip_retencao_dias", "log_retencao_meses", "ip_registro_ativo", "bloqueio_automatico_ativo",
] as const;
export type CampoConfig = (typeof CAMPOS_CONFIG)[number];

/** Só os campos que realmente mudam, com valor anterior e novo (vai para a auditoria). */
export function diferencaDeConfig(atual: Record<string, unknown>, pedido: PedidoConfig): { campo: CampoConfig; antes: unknown; depois: unknown }[] {
  const mudou: { campo: CampoConfig; antes: unknown; depois: unknown }[] = [];
  for (const campo of CAMPOS_CONFIG) {
    const novo = pedido[campo];
    if (novo !== undefined && atual[campo] !== novo) mudou.push({ campo, antes: atual[campo], depois: novo });
  }
  return mudou;
}

/** O IP só sai da API do ADMIN quando a chave de gravação está ligada; desligada, nunca existiu dado para mostrar. */
export function linhaDoLogParaAdmin<T extends { ip?: string | null }>(linha: T, ipAtivo: boolean): T {
  return ipAtivo ? linha : { ...linha, ip: null };
}
