// Quiz "Seja Partner" — definição das perguntas, opções e o modelo de score.
// O score é SEMPRE recalculado no servidor (app/api/public/partner-quiz); o
// client usa só as listas de opções para renderizar.

export type QuizOption = { value: string; label: string; hint?: string };

export const OBJETIVO: QuizOption[] = [
  { value: "renda_extra", label: "Renda Extra Recorrente", hint: "Quero construir um fluxo recorrente sem deixar minha atividade atual" },
  { value: "carreira", label: "Nova Carreira Full-Time", hint: "Quero migrar totalmente para o mercado de intermediação bancária/crédito" },
  { value: "complementar", label: "Agregar ao meu Negócio Atual", hint: "Já atendo empresas/clientes e quero expandir meu portfólio de soluções" },
  { value: "white_label", label: "Empresa White Label", hint: "Quero criar/estruturar uma operação própria de intermediação sob minha marca" },
];

export const OCUPACAO: QuizOption[] = [
  { value: "consultor_financeiro", label: "Autônomo / Consultor", hint: "Consultor financeiro, assessor de investimentos, contador, advogado corporativo" },
  { value: "corretor", label: "Corretor", hint: "Seguros, crédito ou mercado imobiliário" },
  { value: "empresario", label: "Empresário / Sócio", hint: "Dono de empresa com carteira ativa de clientes PJ" },
  { value: "executivo_clt", label: "Executivo CLT", hint: "Profissional corporativo/comercial" },
  { value: "bancario", label: "Ex-bancário / Bancário autônomo / Personal banker" },
  { value: "outro", label: "Outro" },
];

// Renda mensal em faixas (botão). Cada faixa vira o piso em R$ para relatórios.
export const RENDA_FAIXA: QuizOption[] = [
  { value: "ate_5k", label: "Até R$ 5.000 / mês" },
  { value: "5_15k", label: "De R$ 5.000 a R$ 15.000 / mês" },
  { value: "15_30k", label: "De R$ 15.000 a R$ 30.000 / mês" },
  { value: "30k_mais", label: "Acima de R$ 30.000 / mês" },
];

export const RENDA_FAIXA_VALOR: Record<string, number> = {
  ate_5k: 0,
  "5_15k": 5000,
  "15_30k": 15000,
  "30k_mais": 30000,
};

export const EXPERIENCIA_B2B: QuizOption[] = [
  { value: "atua_pj", label: "Sim, atuo ou já atuei diretamente com PJ" },
  { value: "relacionamento", label: "Tenho relacionamento com empresários, mas pouca bagagem técnica B2B" },
  { value: "nenhuma", label: "Não tenho experiência com B2B" },
];

export const PRIORIDADE: QuizOption[] = [
  { value: "alta", label: "Alta: Quero iniciar ainda esta semana" },
  { value: "media", label: "Média: Pretendo definir ainda este mês" },
  { value: "planejamento", label: "Planejamento: Nos próximos 60 dias" },
  { value: "pesquisa", label: "Pesquisa: Apenas conhecendo o modelo no momento" },
];

export const INVESTIMENTO: QuizOption[] = [
  { value: "ate_5k", label: "Até R$ 5.000" },
  { value: "ate_10k", label: "Até R$ 10.000" },
  { value: "ate_30k", label: "Até R$ 30.000" },
  { value: "ate_50k", label: "Até R$ 50.000" },
  { value: "em_breve", label: "Não tenho investimento agora, mas terei em breve" },
];

// Rótulos de respostas da versão anterior do quiz (até set/2026), só para
// exibir leads antigos na Prospecção. Não são mais perguntados.
export const QUIZ_LEGACY_LABELS: Record<string, Record<string, string>> = {
  objetivo: { renda_extra: "Renda recorrente extra", carreira: "Nova carreira full-time", complementar: "Complementar meu negócio", time_originacao: "Montar time de originação" },
  ocupacao: { contador_advogado: "Contador / advogado" },
  experiencia_b2b: { nenhuma: "Nenhuma", menos_1: "Menos de 1 ano", "1_3": "1 a 3 anos", "3_mais": "3+ anos", atuo_credito_ma: "Já atuo com crédito / M&A" },
  rede: { ate_10: "Até 10", "10_50": "10 a 50", "50_200": "50 a 200", "200_mais": "Mais de 200" },
  porte_rede: { ate_1m: "Até R$ 1 mi", "1_10m": "R$ 1 a 10 mi", "10_50m": "R$ 10 a 50 mi", "50m_mais": "R$ 50 mi+", nao_sei: "Não sei" },
  disponibilidade: { ate_5h: "Até 5h/semana", "5_15h": "5 a 15h/semana", "15_30h": "15 a 30h/semana", full_time: "Full-time" },
  prazo_comeco: { agora: "Agora", "30_dias": "Em 30 dias", "90_dias": "Em 90 dias", pesquisando: "Só pesquisando" },
  renda_faixa: { ate_2k: "Até R$ 2 mil", "2_5k": "R$ 2 a 5 mil", "5_15k": "R$ 5 a 15 mil", "15_30k": "R$ 15 a 30 mil", "30k_mais": "R$ 30 mil+" },
};

// ─── Score (0–100) ─────────────────────────────────────────────────────────
const W = {
  ocupacao:        { consultor_financeiro: 10, empresario: 10, corretor: 8, executivo_clt: 5, bancario: 10, outro: 0 } as Record<string, number>,
  renda_faixa:     { ate_5k: 0, "5_15k": 8, "15_30k": 14, "30k_mais": 20 } as Record<string, number>,
  experiencia_b2b: { atua_pj: 25, relacionamento: 12, nenhuma: 0 } as Record<string, number>,
  prioridade:      { alta: 20, media: 14, planejamento: 6, pesquisa: 0 } as Record<string, number>,
  investimento:    { ate_5k: 5, ate_10k: 12, ate_30k: 20, ate_50k: 25, em_breve: 0 } as Record<string, number>,
};

export type QuizAnswers = {
  objetivo: string;
  ocupacao: string;
  renda_faixa: string;
  experiencia_b2b: string;
  prioridade: string;
  investimento: string;
};

export type QuizScore = {
  total: number;
  breakdown: Record<string, number>;
  tier: "A" | "B" | "C";
  plano_sugerido: "PARTNER_HE" | "PARTNER" | "PARTNER_PRO" | "ENTERPRISE";
  etapa: "interessado" | "contatado" | "prospect";
};

export function scoreQuizPartner(a: QuizAnswers): QuizScore {
  const breakdown = {
    ocupacao:        W.ocupacao[a.ocupacao] ?? 0,
    renda_faixa:     W.renda_faixa[a.renda_faixa] ?? 0,
    experiencia_b2b: W.experiencia_b2b[a.experiencia_b2b] ?? 0,
    prioridade:      W.prioridade[a.prioridade] ?? 0,
    investimento:    W.investimento[a.investimento] ?? 0,
  };
  const total = Object.values(breakdown).reduce((s, n) => s + n, 0);

  // Regra dura: quem só está pesquisando ou ainda não tem o investimento nunca é faixa A
  let tier: QuizScore["tier"];
  if (total >= 60 && a.prioridade !== "pesquisa" && a.investimento !== "em_breve") tier = "A";
  else if (total >= 35) tier = "B";
  else tier = "C";

  const etapa = tier === "A" ? "interessado" : tier === "B" ? "contatado" : "prospect";

  // Plano sugerido pela capacidade de investimento (anuidades: Partner ~R$ 10,9 mil,
  // PRO ~R$ 15,9 mil, Enterprise ~R$ 49,9 mil; Partner HE é R$ 97/mês).
  let plano_sugerido: QuizScore["plano_sugerido"];
  if (a.investimento === "ate_50k" || (a.objetivo === "white_label" && a.investimento === "ate_30k")) plano_sugerido = "ENTERPRISE";
  else if (a.investimento === "ate_30k") plano_sugerido = "PARTNER_PRO";
  else if (a.investimento === "ate_10k") plano_sugerido = "PARTNER";
  else plano_sugerido = "PARTNER_HE";

  return { total, breakdown, tier, plano_sugerido, etapa };
}

export const PLANO_LABEL: Record<string, string> = {
  PARTNER_HE: "Partner HE",
  STARTER: "V3 Starter",
  PARTNER: "V3 Partner",
  PARTNER_PRO: "V3 Partner PRO",
  ENTERPRISE: "V3 Enterprise",
};
