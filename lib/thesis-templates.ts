// Matrizes de tese pre-treinadas — Switcher de Teses Narrativas (Fase 3)
//
// Cada matriz reconfigura o angulo comercial usado tanto na geracao da
// narrativa publica (public_narrative) quanto no Chat IA do ativo
// (/api/cm/assistant), eliminando reescrita manual pela Mesa a cada troca
// de estrategia comercial do mesmo ativo.

export type ThesisTemplateId = "despacho_imediato" | "rendimento_longo_prazo" | "retrofit_incorporacao";

export type ThesisTemplate = {
  id: ThesisTemplateId;
  label: string;
  description: string;
  promptFragment: string;
};

export const THESIS_TEMPLATES: Record<ThesisTemplateId, ThesisTemplate> = {
  despacho_imediato: {
    id: "despacho_imediato",
    label: "Tese de Despacho Imediato",
    description: "Ativo pronto para uso ou revenda rápida, sem pendências relevantes, com foco em liquidez e velocidade de execução.",
    promptFragment:
      "Ângulo comercial: DESPACHO IMEDIATO. Destaque que o ativo está pronto para uso ou revenda sem grandes pendências, " +
      "com baixo risco de execução, documentação regularizada e potencial de fechamento rápido. Fale para um comprador " +
      "que valoriza velocidade e certeza de execução acima de todo o resto, não upside de longo prazo.",
  },
  rendimento_longo_prazo: {
    id: "rendimento_longo_prazo",
    label: "Tese de Rendimento de Longo Prazo",
    description: "Ativo com fluxo de caixa estável e previsível, indicado para investidor institucional buy-and-hold.",
    promptFragment:
      "Ângulo comercial: RENDIMENTO DE LONGO PRAZO. Destaque estabilidade de fluxo de caixa, previsibilidade de renda, " +
      "cap rate e estrutura de contrato de locação ou operação recorrente. Fale para um investidor institucional que " +
      "busca renda estável ao longo do tempo, não ganho de capital rápido.",
  },
  retrofit_incorporacao: {
    id: "retrofit_incorporacao",
    label: "Tese de Retrofit / Incorporação",
    description: "Ativo com potencial de valorização via reforma, expansão ou mudança de uso, indicado para investidor de valor agregado.",
    promptFragment:
      "Ângulo comercial: RETROFIT/INCORPORAÇÃO. Destaque o potencial de transformação do ativo: reforma, expansão, " +
      "mudança de uso ou incorporação. Fale para um investidor ou incorporador disposto a agregar valor através de obra " +
      "ou reposicionamento, com upside de valorização como o principal argumento, não a condição atual do ativo.",
  },
};

export function getThesisTemplate(id: string | null | undefined): ThesisTemplate | null {
  if (!id) return null;
  return THESIS_TEMPLATES[id as ThesisTemplateId] ?? null;
}
