// Quiz "White Label" (/white-label) — qualificação de candidatos à operação própria (Enterprise
// white label), ticket de investimento acima de R$ 50 mil. Roteiro do PDF "Sugestão de alteração
// de quiz" (05/10/2026): 5 perguntas e 3 listas de qualificação (Hot / Warm / Cold). A lista é
// SEMPRE recalculada no servidor (app/api/public/white-label-quiz); o client só renderiza.

import type { QuizOption } from "@/lib/quiz-partner";

export const WL_OBJETIVO: QuizOption[] = [
  { value: "empreender", label: "Empreender full-time na minha própria operação ou franquia" },
  { value: "diversificar", label: "Diversificar meus investimentos atuais com uma nova unidade de negócio" },
  { value: "migrar_carreira", label: "Migrar de carreira corporativa/executiva para ter um negócio próprio" },
  { value: "renda_extra", label: "Apenas buscando ideias de renda extra ou trabalho autônomo" },
];

export const WL_CAPITAL: QuizOption[] = [
  { value: "acima_100k", label: "Acima de R$ 100.000", hint: "Pronto para operações de grande porte" },
  { value: "50_100k", label: "Entre R$ 50.000 e R$ 100.000", hint: "Ideal para o modelo principal" },
  { value: "20_50k", label: "Entre R$ 20.000 e R$ 50.000", hint: "Disponibilidade parcial" },
  { value: "abaixo_20k", label: "Abaixo de R$ 20.000 ou preciso de crédito/financiamento total" },
];

export const WL_DEDICACAO: QuizOption[] = [
  { value: "gestao_direta", label: "Gestão direta e diária", hint: "Dono/operador dedicado" },
  { value: "gestao_estrategica", label: "Gestão estratégica e comercial", hint: "Com equipe contratada para a operação" },
  { value: "investidor", label: "Investidor/sócio executivo", hint: "Supervisão periódica" },
  { value: "renda_passiva", label: "Busco renda passiva", hint: "Sem necessidade de atuação direta" },
];

export const WL_EXPERIENCIA: QuizOption[] = [
  { value: "empresa_carteira", label: "Já possuo empresa ou carteira corporativa de clientes ativa" },
  { value: "executivo_vendas", label: "Tenho sólida experiência em cargos executivos, vendas ou liderança comercial" },
  { value: "mercado_financeiro", label: "Já atuei no mercado financeiro/bancário/crédito" },
  { value: "sem_experiencia", label: "Não tenho experiência anterior em vendas ou gestão comercial" },
];

export const WL_PRAZO: QuizOption[] = [
  { value: "imediato", label: "Imediatamente", hint: "Próximos 30 dias" },
  { value: "30_60", label: "Curto prazo", hint: "De 30 a 60 dias" },
  { value: "3_6m", label: "Médio prazo", hint: "De 3 a 6 meses" },
  { value: "pesquisando", label: "Apenas pesquisando para o futuro", hint: "Sem prazo definido" },
];

/** Títulos das perguntas, para o card do lead na Prospecção. */
export const WL_QUIZ_LABELS: Record<string, { titulo: string; opts: QuizOption[] }> = {
  objetivo: { titulo: "Objetivo", opts: WL_OBJETIVO },
  capital: { titulo: "Capital disponível", opts: WL_CAPITAL },
  dedicacao: { titulo: "Dedicação", opts: WL_DEDICACAO },
  experiencia: { titulo: "Experiência", opts: WL_EXPERIENCIA },
  prazo: { titulo: "Prazo para iniciar", opts: WL_PRAZO },
};

// Lead parcial: o contato é pedido depois das 2 primeiras respostas (objetivo e capital). A partir
// daí cada passo alcançado grava/atualiza um lead "incompleto" na Prospecção.
export const WL_PARCIAL_PAROU_EM: Record<string, string> = {
  dedicacao: "Dedicação",
  experiencia: "Experiência",
  prazo: "Prazo",
};

export type WlAnswers = { objetivo: string; capital: string; dedicacao: string; experiencia: string; prazo: string };

export type WlLista = "hot" | "warm" | "cold";

export const WL_LISTA_LABEL: Record<WlLista, string> = {
  hot: "Hot — alta prioridade (MQL/SQL)",
  warm: "Warm — qualificado em nutrição",
  cold: "Cold — abaixo do perfil (downsell)",
};

// Pontos só para ordenar os leads dentro da mesma lista (a lista é que manda na ação).
const W = {
  capital: { acima_100k: 40, "50_100k": 30, "20_50k": 10, abaixo_20k: 0 } as Record<string, number>,
  prazo: { imediato: 25, "30_60": 20, "3_6m": 8, pesquisando: 0 } as Record<string, number>,
  dedicacao: { gestao_direta: 15, gestao_estrategica: 15, investidor: 10, renda_passiva: 3 } as Record<string, number>,
  experiencia: { empresa_carteira: 20, executivo_vendas: 15, mercado_financeiro: 20, sem_experiencia: 0 } as Record<string, number>,
};

export type WlScore = {
  total: number;
  breakdown: Record<string, number>;
  lista: WlLista;
  tier: "A" | "B" | "C";
  etapa: "interessado" | "contatado" | "prospect";
  plano_sugerido: "ENTERPRISE" | "PARTNER";
};

/**
 * Critérios do PDF:
 * - Hot: capital A/B (+R$ 50 mil) e prazo A/B (até 60 dias) → executivo/consultor sênior já.
 * - Warm: capital A/B, mas prazo longo (3 a 6 meses ou sem prazo) ou pouca dedicação (renda passiva) → nutrição.
 * - Cold: capital C/D (abaixo de R$ 50 mil) ou foco em renda extra → ofertas de menor ticket (Partner padrão).
 */
export function classificarWhiteLabel(a: WlAnswers): WlScore {
  const breakdown = {
    capital: W.capital[a.capital] ?? 0,
    prazo: W.prazo[a.prazo] ?? 0,
    dedicacao: W.dedicacao[a.dedicacao] ?? 0,
    experiencia: W.experiencia[a.experiencia] ?? 0,
  };
  const total = Object.values(breakdown).reduce((s, n) => s + n, 0);

  const capitalOk = a.capital === "acima_100k" || a.capital === "50_100k";
  const prazoCurto = a.prazo === "imediato" || a.prazo === "30_60";
  let lista: WlLista;
  if (!capitalOk || a.objetivo === "renda_extra") lista = "cold";
  else if (prazoCurto && a.dedicacao !== "renda_passiva") lista = "hot";
  else lista = "warm";

  const tier = lista === "hot" ? "A" : lista === "warm" ? "B" : "C";
  const etapa = lista === "hot" ? "interessado" : lista === "warm" ? "contatado" : "prospect";
  return { total, breakdown, lista, tier, etapa, plano_sugerido: lista === "cold" ? "PARTNER" : "ENTERPRISE" };
}
