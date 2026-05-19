export interface BadgeDef {
  id: string;
  label: string;
  icon: string;
  description: string;
  rarity: "comum" | "raro" | "épico" | "lendário";
}

export const BADGE_DEFS: BadgeDef[] = [
  { id: "first_video",    label: "Primeira Aula",     icon: "🎬", description: "Assistiu sua primeira videoaula",                         rarity: "comum" },
  { id: "5_videos",       label: "Em Progresso",       icon: "📚", description: "Concluiu 5 videoaulas",                                  rarity: "comum" },
  { id: "10_videos",      label: "Dedicado",           icon: "🔥", description: "Concluiu 10 videoaulas",                                 rarity: "raro" },
  { id: "20_videos",      label: "Maratonista",        icon: "🏃", description: "Concluiu 20 videoaulas",                                 rarity: "raro" },
  { id: "all_videos",     label: "Completo",           icon: "⭐", description: "Concluiu todas as videoaulas da plataforma",             rarity: "lendário" },
  { id: "first_cert",     label: "Primeiro Certificado", icon: "🎓", description: "Obteve seu primeiro certificado de categoria",         rarity: "comum" },
  { id: "all_required",   label: "Base Sólida",        icon: "🏗️", description: "Concluiu todas as aulas obrigatórias",                  rarity: "raro" },
  { id: "5h_watched",     label: "5 Horas",            icon: "⏱️", description: "Assistiu 5 horas de conteúdo",                          rarity: "comum" },
  { id: "10h_watched",    label: "10 Horas",           icon: "🕐", description: "Assistiu 10 horas de conteúdo",                         rarity: "raro" },
  { id: "all_categories", label: "Mestre V3",          icon: "👑", description: "Obteve certificado em todas as categorias",              rarity: "lendário" },
  { id: "quiz_first",     label: "Quiz Expert",        icon: "🧠", description: "Passou em seu primeiro quiz",                           rarity: "comum" },
  { id: "quiz_all",       label: "Quiz Master",        icon: "🏆", description: "Passou em todos os quizzes",                            rarity: "épico" },
  { id: "streak_3",       label: "Sequência",          icon: "⚡", description: "Assistiu aulas 3 dias seguidos",                        rarity: "raro" },
  // Specialty badges — awarded when partner has certificates in N+ courses of same category
  { id: "specialist_credito", label: "Especialista em Crédito", icon: "💳", description: "Completou 2+ trilhas de Crédito",         rarity: "épico" },
  { id: "specialist_ma",      label: "Especialista em M&A",     icon: "🤝", description: "Completou 2+ trilhas de M&A",             rarity: "épico" },
  { id: "specialist_fundos",  label: "Especialista em Fundos",  icon: "📊", description: "Completou 2+ trilhas de Fundos",          rarity: "épico" },
  { id: "all_rounder",        label: "Profissional Completo",   icon: "⭐", description: "Especializou-se em 3+ categorias",        rarity: "lendário" },
];

export interface SpecialtyBadgeDef extends BadgeDef {
  specialty: true;
  category_requirement?: string;
  courses_required?: number;
  specializations_required?: number;
}

export const SPECIALTY_BADGE_DEFS: SpecialtyBadgeDef[] = [
  { id: "specialist_credito", label: "Especialista em Crédito", icon: "💳", description: "Completou 2+ trilhas de Crédito",  rarity: "épico",    specialty: true, category_requirement: "Crédito", courses_required: 2 },
  { id: "specialist_ma",      label: "Especialista em M&A",     icon: "🤝", description: "Completou 2+ trilhas de M&A",    rarity: "épico",    specialty: true, category_requirement: "M&A",     courses_required: 2 },
  { id: "specialist_fundos",  label: "Especialista em Fundos",  icon: "📊", description: "Completou 2+ trilhas de Fundos", rarity: "épico",    specialty: true, category_requirement: "Fundos",  courses_required: 2 },
  { id: "all_rounder",        label: "Profissional Completo",   icon: "⭐", description: "Especializou-se em 3+ categorias", rarity: "lendário", specialty: true, specializations_required: 3 },
];

export function getBadgeDef(id: string): BadgeDef | undefined {
  return BADGE_DEFS.find(b => b.id === id);
}

export const RARITY_COLORS: Record<string, string> = {
  comum:    "from-gray-500/20 to-gray-600/10 border-gray-500/30 text-gray-300",
  raro:     "from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-300",
  épico:    "from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-300",
  lendário: "from-[#C9A84C]/20 to-[#E8C97A]/10 border-[#C9A84C]/40 text-[#C9A84C]",
};
