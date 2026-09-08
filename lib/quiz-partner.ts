// Quiz "Seja Partner" — definição das perguntas, opções e o modelo de score.
// O score é SEMPRE recalculado no servidor (app/api/public/partner-quiz); o
// client usa só as listas de opções para renderizar.

export type QuizOption = { value: string; label: string; hint?: string };

export const OBJETIVO: QuizOption[] = [
  { value: "renda_extra", label: "Renda recorrente extra" },
  { value: "carreira", label: "Nova carreira full-time" },
  { value: "complementar", label: "Complementar meu negócio", hint: "consultoria, contabilidade, corretagem" },
  { value: "time_originacao", label: "Montar time de originação" },
];

export const OCUPACAO: QuizOption[] = [
  { value: "consultor_financeiro", label: "Consultor / autônomo financeiro" },
  { value: "corretor", label: "Corretor", hint: "seguros, imóveis, crédito" },
  { value: "empresario", label: "Empresário" },
  { value: "executivo_clt", label: "Executivo CLT" },
  { value: "contador_advogado", label: "Contador / advogado" },
  { value: "outro", label: "Outro" },
];

export const EXPERIENCIA_B2B: QuizOption[] = [
  { value: "nenhuma", label: "Nenhuma" },
  { value: "menos_1", label: "Menos de 1 ano" },
  { value: "1_3", label: "1 a 3 anos" },
  { value: "3_mais", label: "3+ anos" },
  { value: "atuo_credito_ma", label: "Já atuo com crédito / M&A" },
];

export const REDE: QuizOption[] = [
  { value: "ate_10", label: "Até 10" },
  { value: "10_50", label: "10 a 50" },
  { value: "50_200", label: "50 a 200" },
  { value: "200_mais", label: "Mais de 200" },
];

export const PORTE_REDE: QuizOption[] = [
  { value: "ate_1m", label: "Até R$ 1 mi" },
  { value: "1_10m", label: "R$ 1 a 10 mi" },
  { value: "10_50m", label: "R$ 10 a 50 mi" },
  { value: "50m_mais", label: "R$ 50 mi+" },
  { value: "nao_sei", label: "Não sei" },
];

export const DISPONIBILIDADE: QuizOption[] = [
  { value: "ate_5h", label: "Até 5h/semana" },
  { value: "5_15h", label: "5 a 15h/semana" },
  { value: "15_30h", label: "15 a 30h/semana" },
  { value: "full_time", label: "Full-time" },
];

export const INTENCAO_INVESTIR: QuizOption[] = [
  { value: "sim_sem_hesitar", label: "Sim, sem hesitar" },
  { value: "sim_se_fechar", label: "Sim, se os números fecharem" },
  { value: "talvez", label: "Talvez — precisaria analisar melhor" },
  { value: "nao_agora", label: "Não neste momento" },
];

export const PRAZO_COMECO: QuizOption[] = [
  { value: "agora", label: "Agora" },
  { value: "30_dias", label: "Em 30 dias" },
  { value: "90_dias", label: "Em 90 dias" },
  { value: "pesquisando", label: "Só pesquisando" },
];

// ─── Score (0–110) ─────────────────────────────────────────────────────────
const W = {
  rede:              { ate_10: 0, "10_50": 10, "50_200": 20, "200_mais": 30 } as Record<string, number>,
  porte_rede:        { ate_1m: 0, "1_10m": 8, "10_50m": 15, "50m_mais": 20, nao_sei: 5 } as Record<string, number>,
  experiencia_b2b:   { nenhuma: 0, menos_1: 5, "1_3": 10, "3_mais": 15, atuo_credito_ma: 20 } as Record<string, number>,
  disponibilidade:   { ate_5h: 0, "5_15h": 5, "15_30h": 10, full_time: 15 } as Record<string, number>,
  intencao_investir: { nao_agora: 0, talvez: 4, sim_se_fechar: 10, sim_sem_hesitar: 15 } as Record<string, number>,
  prazo_comeco:      { pesquisando: 0, "90_dias": 2, "30_dias": 6, agora: 10 } as Record<string, number>,
};

export type QuizAnswers = {
  objetivo: string;
  ocupacao: string;
  experiencia_b2b: string;
  rede: string;
  porte_rede: string;
  renda_mensal: number;
  disponibilidade: string;
  intencao_investir: string;
  prazo_comeco: string;
};

export type QuizScore = {
  total: number;
  breakdown: Record<string, number>;
  tier: "A" | "B" | "C";
  plano_sugerido: "STARTER" | "PARTNER" | "PARTNER_PRO" | "ENTERPRISE";
  etapa: "interessado" | "contatado" | "prospect";
};

export function scoreQuizPartner(a: QuizAnswers): QuizScore {
  const breakdown = {
    rede:              W.rede[a.rede] ?? 0,
    porte_rede:        W.porte_rede[a.porte_rede] ?? 0,
    experiencia_b2b:   W.experiencia_b2b[a.experiencia_b2b] ?? 0,
    disponibilidade:   W.disponibilidade[a.disponibilidade] ?? 0,
    intencao_investir: W.intencao_investir[a.intencao_investir] ?? 0,
    prazo_comeco:      W.prazo_comeco[a.prazo_comeco] ?? 0,
  };
  const total = Object.values(breakdown).reduce((s, n) => s + n, 0);

  // Regra dura: sem intenção de investir + só pesquisando → sempre C
  const forcaC = a.intencao_investir === "nao_agora" && a.prazo_comeco === "pesquisando";
  let tier: QuizScore["tier"];
  if (forcaC) tier = "C";
  else if (total >= 70) tier = "A";
  else if (total >= 40) tier = "B";
  else tier = "C";

  const etapa = tier === "A" ? "interessado" : tier === "B" ? "contatado" : "prospect";

  // Plano sugerido: renda mensal atual × porte da rede
  let plano_sugerido: QuizScore["plano_sugerido"];
  const redeBoa = a.rede === "50_200" || a.rede === "200_mais";
  if (a.porte_rede === "50m_mais" || a.renda_mensal >= 30000) plano_sugerido = "ENTERPRISE";
  else if (a.renda_mensal >= 15000 && redeBoa) plano_sugerido = "PARTNER_PRO";
  else if (a.renda_mensal >= 5000) plano_sugerido = "PARTNER";
  else plano_sugerido = "STARTER";

  return { total, breakdown, tier, plano_sugerido, etapa };
}

export const PLANO_LABEL: Record<string, string> = {
  STARTER: "V3 Starter",
  PARTNER: "V3 Partner",
  PARTNER_PRO: "V3 Partner PRO",
  ENTERPRISE: "V3 Enterprise",
};
