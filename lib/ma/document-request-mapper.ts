// Mapeamento de campos ausentes (FORJA missing[]) → tipos de documentos a solicitar ao partner

export type DocRequestItem = {
  id: string;
  tipo: DocumentTipo;
  descricao: string;
  campos_ausentes: string[];
  priority: "ALTA" | "MEDIA" | "BAIXA";
  status: "pending" | "received" | "processed" | "rejected";
  received_at: string | null;
  doc_id: string | null;
};

export type DocumentTipo =
  | "DRE"
  | "Balanco"
  | "Certidao"
  | "Contrato Social"
  | "NDA"
  | "Laudo"
  | "Contrato"
  | "Matricula"
  | "Relatorio"
  | "Mandato";

type MissingField = {
  field: string;
  impact: string;
  priority: "ALTA" | "MEDIA" | "BAIXA";
};

// Mapeamento canônico: campo FORJA → documento concreto a solicitar
const FIELD_TO_DOC: Record<string, { tipo: DocumentTipo; descricao: string }> = {
  // Financeiro / DRE
  ebitda_anual:          { tipo: "DRE",           descricao: "DRE dos últimos 3 exercícios com abertura de EBITDA" },
  receita_anual:         { tipo: "DRE",           descricao: "DRE dos últimos 3 exercícios com abertura de EBITDA" },
  lucro_liquido:         { tipo: "DRE",           descricao: "DRE dos últimos 3 exercícios com abertura de EBITDA" },
  despesas_operacionais: { tipo: "DRE",           descricao: "DRE com abertura detalhada de despesas operacionais" },
  multiplo_ebitda:       { tipo: "DRE",           descricao: "Projeções financeiras com múltiplo EBITDA justificado" },
  noi_anual:             { tipo: "Laudo",         descricao: "Laudo de avaliação de renda líquida operacional (NOI)" },
  cap_rate:              { tipo: "Laudo",         descricao: "Laudo de cap rate por avaliador independente" },

  // Balanço
  divida_total:          { tipo: "Balanco",       descricao: "Balanço Patrimonial auditado (último exercício)" },
  ativo_total:           { tipo: "Balanco",       descricao: "Balanço Patrimonial auditado (último exercício)" },
  patrimonio_liquido:    { tipo: "Balanco",       descricao: "Balanço Patrimonial auditado (último exercício)" },

  // Legal / Certidões
  processos_judiciais:   { tipo: "Certidao",      descricao: "Certidão de Distribuição de Ações Cíveis e Trabalhistas (5 anos)" },
  pendencias_declaradas: { tipo: "Certidao",      descricao: "Certidões Negativas Federais, Estaduais e Municipais" },
  regime_tributario:     { tipo: "Certidao",      descricao: "Declaração do regime tributário vigente (DASN ou ECF)" },

  // Contrato Social / Societário
  cnpj:                  { tipo: "Contrato Social", descricao: "Contrato Social consolidado + Cartão CNPJ atualizado" },
  ano_fundacao:          { tipo: "Contrato Social", descricao: "Contrato Social com data de constituição" },

  // NDA
  nda_status:            { tipo: "NDA",           descricao: "NDA bilateral assinado V3 Partners ↔ Empresa" },

  // Valuation / Laudo
  deal_value:            { tipo: "Laudo",         descricao: "Laudo de avaliação patrimonial (metodologia do valor pedido)" },
  metodologia_valuation: { tipo: "Laudo",         descricao: "Laudo de avaliação com metodologia explícita" },
  valor_por_m2:          { tipo: "Laudo",         descricao: "Laudo de avaliação imobiliária (R$/m²) por avaliador credenciado" },

  // Operacional (imóveis / shopping)
  taxa_ocupacao:         { tipo: "Relatorio",     descricao: "Relatório de ocupação por unidade/andar (último trimestre)" },
  numero_locatarios:     { tipo: "Contrato",      descricao: "Lista de contratos de locação vigentes com valores e prazos" },
  contratos_vigencia:    { tipo: "Contrato",      descricao: "Contratos de locação com cláusulas de vigência e reajuste" },
  ancoras:               { tipo: "Contrato",      descricao: "Contratos das âncoras com cláusulas de renovação" },

  // Imóvel
  area_construida:       { tipo: "Matricula",     descricao: "Matrícula do imóvel + certidão de área construída (cartório RI)" },
  localizacao_completa:  { tipo: "Matricula",     descricao: "Certidão de matrícula atualizada (registro de imóveis)" },

  // Operação
  tipo_operacao:         { tipo: "Mandato",       descricao: "Confirmação formal do tipo de operação (M&A, JV, cessão, SLB, etc.)" },
};

const PRIORITY_ORDER: Record<"ALTA" | "MEDIA" | "BAIXA", number> = { ALTA: 0, MEDIA: 1, BAIXA: 2 };

// Agrupa campos ausentes por documento — evita pedir o mesmo doc duas vezes
export function mapMissingToDocRequests(missing: MissingField[]): DocRequestItem[] {
  const grouped = new Map<DocumentTipo, {
    descricao: string;
    campos: string[];
    priority: "ALTA" | "MEDIA" | "BAIXA";
  }>();

  for (const m of missing) {
    const mapping = FIELD_TO_DOC[m.field.toLowerCase()];
    if (!mapping) continue;

    const existing = grouped.get(mapping.tipo);
    if (existing) {
      if (!existing.campos.includes(m.field)) existing.campos.push(m.field);
      if (PRIORITY_ORDER[m.priority] < PRIORITY_ORDER[existing.priority]) {
        existing.priority = m.priority;
      }
    } else {
      grouped.set(mapping.tipo, {
        descricao: mapping.descricao,
        campos: [m.field],
        priority: m.priority,
      });
    }
  }

  return Array.from(grouped.entries()).map(([tipo, data]) => ({
    id: crypto.randomUUID(),
    tipo,
    descricao: data.descricao,
    campos_ausentes: data.campos,
    priority: data.priority,
    status: "pending" as const,
    received_at: null,
    doc_id: null,
  }));
}

// Label legível por tipo de documento (para UI e emails)
export const DOC_TIPO_LABEL: Record<DocumentTipo, string> = {
  DRE:              "DRE — Demonstrativo de Resultados",
  Balanco:          "Balanço Patrimonial",
  Certidao:         "Certidão",
  "Contrato Social":"Contrato Social / Societário",
  NDA:              "NDA — Acordo de Confidencialidade",
  Laudo:            "Laudo de Avaliação",
  Contrato:         "Contrato de Locação",
  Matricula:        "Matrícula / Registro de Imóveis",
  Relatorio:        "Relatório Operacional",
  Mandato:          "Mandato / Confirmação de Operação",
};
