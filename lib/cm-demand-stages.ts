// Etapas do pipeline do lado COMPRADOR da Bolsa de Ativos (Fase 5, sub-entrega
// 5.3, 19/09/2026). Espelha as 7 etapas do lado venda. Fonte unica pra API
// (app/api/cm/investor-demands/[id]/status) e pra UI (buy-side-demands-panel):
// nunca duplicar rotulos nem a lista de proximas acoes em dois lugares.
//
// A validacao real de cada transicao mora no banco (transition_cm_demand_status,
// migrations 20260919h/j). Este arquivo so descreve o que a Mesa PODE pedir de
// cada estagio -- a funcao do banco continua sendo a autoridade final.

export const DEMAND_STATUS_LABELS: Record<string, string> = {
  pendente: "Aguardando Formulário",
  reuniao_validada: "Aguardando Formulário",
  formulario_preenchido: "Formulário Preenchido",
  reuniao_agendada: "Reunião Agendada",
  em_qualificacao: "Em Qualificação",
  nda_assinado: "NDA Assinado",
  em_analise: "Em Análise",
  aprovado_head: "Aprovado pela Diretoria",
  aprovado_com_restricoes: "Aprovado com Restrições",
  ativo: "Ativo no Match",
  em_negociacao: "Em Negociação",
  concluido: "Concluído",
  reprovado: "Reprovado",
  cancelado: "Cancelado",
  expirado: "Expirado",
};

// Etapa do Kanban unificado de 7 etapas (mesma numeracao do lado venda).
export const DEMAND_STATUS_STAGE: Record<string, number> = {
  pendente: 1,
  reuniao_validada: 1,
  formulario_preenchido: 1,
  reuniao_agendada: 2,
  em_qualificacao: 3,
  nda_assinado: 3,
  em_analise: 4,
  aprovado_head: 4,
  aprovado_com_restricoes: 4,
  ativo: 5,
  em_negociacao: 6,
  concluido: 7,
  reprovado: 7,
  cancelado: 7,
  expirado: 7,
};

// Estados que ja passaram pela Mesa e ainda estao vivos no funil (aba "Em pipeline").
export const DEMAND_PIPELINE_STATUSES = [
  "formulario_preenchido",
  "reuniao_agendada",
  "em_qualificacao",
  "nda_assinado",
  "em_analise",
  "aprovado_head",
  "aprovado_com_restricoes",
  "em_negociacao",
] as const;

export const DEMAND_TERMINAL_STATUSES = ["concluido", "reprovado", "cancelado", "expirado"] as const;

// Motivo estruturado de reprovacao de COMPRADOR (a lista de ASSET_DECLINE_REASONS
// e do vendedor e nao serve aqui). PROVISORIA: definida sem lista oficial de Joao,
// com o minimo que o proprio fluxo ja pressupoe (KYC, mandato, desistencia).
// Ajustar aqui e o unico lugar -- API e UI leem desta constante.
export const DEMAND_DECLINE_REASONS = [
  { value: "kyc_reprovado", label: "KYC reprovado" },
  { value: "mandato_inconsistente", label: "Mandato de compra inconsistente" },
  { value: "desistencia_comprador", label: "Desistência do comprador" },
  { value: "outros", label: "Outros" },
] as const;

export const DEMAND_DECLINE_REASON_VALUES: string[] = DEMAND_DECLINE_REASONS.map((r) => r.value);

// Acoes que a Mesa pode pedir a partir de cada estagio. `headOnly` = so ADMIN/GESTAO
// (mesmo criterio do lado venda: aprovar e publicar exigem autoridade de Head,
// reprovar fica aberto a qualquer role da Mesa).
export type DemandAction = {
  to: string;
  label: string;
  headOnly?: boolean;
  needsReason?: boolean; // texto livre obrigatorio
  needsCategory?: boolean; // categoria de DEMAND_DECLINE_REASONS obrigatoria
  danger?: boolean;
};

const CANCEL: DemandAction = { to: "cancelado", label: "Cancelar demanda", danger: true };
const REJECT: DemandAction = { to: "reprovado", label: "Reprovar", needsReason: true, needsCategory: true, danger: true };

export const DEMAND_NEXT_ACTIONS: Record<string, DemandAction[]> = {
  pendente: [CANCEL],
  reuniao_validada: [CANCEL],
  formulario_preenchido: [{ to: "reuniao_agendada", label: "Marcar reunião agendada" }, REJECT, CANCEL],
  reuniao_agendada: [{ to: "em_qualificacao", label: "Reunião realizada: iniciar qualificação" }, REJECT, CANCEL],
  em_qualificacao: [{ to: "nda_assinado", label: "Registrar NDA assinado" }, REJECT, CANCEL],
  nda_assinado: [{ to: "em_analise", label: "Iniciar análise da Mesa" }, REJECT, CANCEL],
  em_analise: [
    { to: "aprovado_head", label: "Aprovar", headOnly: true },
    { to: "aprovado_com_restricoes", label: "Aprovar com restrições", headOnly: true, needsReason: true },
    REJECT,
    CANCEL,
  ],
  aprovado_head: [{ to: "ativo", label: "Liberar para o Match", headOnly: true }, CANCEL],
  aprovado_com_restricoes: [{ to: "ativo", label: "Liberar para o Match", headOnly: true }, CANCEL],
  ativo: [CANCEL],
  em_negociacao: [CANCEL],
  concluido: [],
  reprovado: [],
  cancelado: [],
  expirado: [],
};

// Estados em que KYC aprovado e pre-requisito (decisao 3 do BRIEF da fatia 2:
// nao aprovar comprador sem documento verificado).
export const DEMAND_KYC_REQUIRED_FOR = ["aprovado_head", "aprovado_com_restricoes"];
