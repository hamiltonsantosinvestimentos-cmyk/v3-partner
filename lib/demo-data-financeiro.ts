// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface Funcionario {
  id: string;
  nome: string;
  cargo: string;
  departamento: string;
  admissao: string;
  tipoContrato?: "CLT" | "PJ";
  cnpj?: string;
  razaoSocial?: string;
  salarioBruto: number;
  beneficios: { vt: number; vr: number; planoSaude: number; outros: number };
  inss: number;
  fgts: number;
  irrf: number;
  salarioLiquido: number;
  status: "ATIVO" | "FERIAS" | "AFASTADO";
}

export interface DespesaFixaTemplate {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  fornecedor: string;
  diaVencimento: number;
  ativa: boolean;
}

export interface Despesa {
  id: string;
  descricao: string;
  categoria: string;
  tipo: "FIXA" | "VARIAVEL";
  valor: number;
  mes: number;
  ano: number;
  autoReplicada: boolean;
  despesaBaseId: string | null;
  fornecedor: string;
  vencimento: string;
  status: "PENDENTE" | "PAGA" | "VENCIDA";
}

export interface Comissao {
  id: string;
  codigo: string;
  partnerId: string;
  partnerNome: string;
  operacaoTipo: "CREDITO" | "MA" | "CONSORCIO";
  operacaoId: string;
  operacaoCodigo: string;
  operacaoDescricao: string;
  valorOperacao: number;
  percentualComissao: number;
  valorComissao: number;
  mes: number;
  ano: number;
  dataOperacaoFinalizada: string;
  status: "A_PAGAR" | "PAGA" | "CANCELADA";
  dataPagamento: string | null;
  observacoes: string | null;
}

export interface LinhaDRE {
  label: string;
  valor: number;
  destaque?: boolean;
  negativo?: boolean;
  separador?: boolean;
}

export interface DREMes {
  mes: number;
  ano: number;
  receitas: number;
  deducoes: number;
  receitaLiquida: number;
  custosOperacionais: number;
  lucroBruto: number;
  despesasAdmin: number;
  despesasComerciais: number;
  despesasFinanceiras: number;
  ebitda: number;
  irpj: number;
  csll: number;
  lucroLiquido: number;
}

export interface MovimentoCaixa {
  id: string;
  data: string;
  descricao: string;
  tipo: "ENTRADA" | "SAIDA";
  categoria: string;
  valor: number;
  mes: number;
  ano: number;
}

export interface Imposto {
  id: string;
  tipo: string;
  descricao: string;
  mes: number;
  ano: number;
  baseCalculo: number;
  aliquota: number;
  valor: number;
  vencimento: string;
  dataPagamento: string | null;
  guia: string | null;
  status: "PREVISTO" | "A_PAGAR" | "PAGO";
}

// ─── FUNCIONÁRIOS ─────────────────────────────────────────────────────────────

export const DEMO_FUNCIONARIOS: Funcionario[] = [
  {
    id: "func-001", nome: "Ricardo Almeida Souza", cargo: "Diretor Financeiro",
    departamento: "Financeiro", admissao: "2024-02-01",
    salarioBruto: 18000, beneficios: { vt: 0, vr: 880, planoSaude: 650, outros: 0 },
    inss: 1800, fgts: 1440, irrf: 2856, salarioLiquido: 13344, status: "ATIVO",
  },
  {
    id: "func-002", nome: "Fernanda Costa Lima", cargo: "Analista Financeiro Sr.",
    departamento: "Financeiro", admissao: "2024-04-15",
    salarioBruto: 9500, beneficios: { vt: 220, vr: 660, planoSaude: 420, outros: 0 },
    inss: 1235, fgts: 760, irrf: 1140, salarioLiquido: 6925, status: "ATIVO",
  },
  {
    id: "func-003", nome: "Thiago Mendes Rocha", cargo: "Coordenador de Crédito",
    departamento: "Mesa de Crédito", admissao: "2024-03-10",
    salarioBruto: 11000, beneficios: { vt: 180, vr: 660, planoSaude: 420, outros: 0 },
    inss: 1430, fgts: 880, irrf: 1650, salarioLiquido: 7720, status: "ATIVO",
  },
  {
    id: "func-004", nome: "Juliana Ferreira Nunes", cargo: "Analista de Compliance",
    departamento: "Juridico", admissao: "2024-06-01",
    salarioBruto: 8200, beneficios: { vt: 200, vr: 660, planoSaude: 420, outros: 0 },
    inss: 1066, fgts: 656, irrf: 820, salarioLiquido: 5994, status: "ATIVO",
  },
  {
    id: "func-005", nome: "Bruno Oliveira Santos", cargo: "Assistente Operacional",
    departamento: "Operações", admissao: "2024-08-20",
    salarioBruto: 4800, beneficios: { vt: 200, vr: 550, planoSaude: 350, outros: 0 },
    inss: 432, fgts: 384, irrf: 0, salarioLiquido: 4368, status: "ATIVO",
  },
  {
    id: "func-006", nome: "Patricia Gomes Cardoso", cargo: "Gerente de Parcerias",
    departamento: "Comercial", admissao: "2024-01-15",
    salarioBruto: 13500, beneficios: { vt: 0, vr: 770, planoSaude: 520, outros: 500 },
    inss: 1755, fgts: 1080, irrf: 2295, salarioLiquido: 9450, status: "ATIVO",
  },
  {
    id: "func-007", nome: "Eduardo Lima Barbosa", cargo: "Desenvolvedor Full Stack",
    departamento: "Tecnologia", admissao: "2024-05-03",
    salarioBruto: 12000, beneficios: { vt: 0, vr: 770, planoSaude: 520, outros: 0 },
    inss: 1560, fgts: 960, irrf: 1980, salarioLiquido: 8460, status: "FERIAS",
  },
  {
    id: "func-008", nome: "Camila Ramos Teixeira", cargo: "Assistente Administrativo",
    departamento: "Administrativo", admissao: "2024-09-01",
    salarioBruto: 3800, beneficios: { vt: 220, vr: 440, planoSaude: 280, outros: 0 },
    inss: 285, fgts: 304, irrf: 0, salarioLiquido: 3515, status: "ATIVO",
  },
];

// ─── DESPESAS FIXAS (TEMPLATES) ───────────────────────────────────────────────

export const DESPESAS_FIXAS_TEMPLATES: DespesaFixaTemplate[] = [
  { id: "dft-001", descricao: "Aluguel — Escritório Sede SP", categoria: "ALUGUEL", valor: 12500, fornecedor: "Imobiliária Apex", diaVencimento: 5, ativa: true },
  { id: "dft-002", descricao: "Energia Elétrica", categoria: "UTILITIES", valor: 1800, fornecedor: "Enel SP", diaVencimento: 10, ativa: true },
  { id: "dft-003", descricao: "Internet Fibra + Link Dedicado", categoria: "UTILITIES", valor: 2200, fornecedor: "Vivo Empresas", diaVencimento: 15, ativa: true },
  { id: "dft-004", descricao: "Pacote Adobe Creative Cloud", categoria: "SOFTWARE", valor: 890, fornecedor: "Adobe Inc.", diaVencimento: 8, ativa: true },
  { id: "dft-005", descricao: "Assinatura Vercel (Next.js hosting)", categoria: "SOFTWARE", valor: 1200, fornecedor: "Vercel Inc.", diaVencimento: 1, ativa: true },
  { id: "dft-006", descricao: "Supabase Pro", categoria: "SOFTWARE", valor: 750, fornecedor: "Supabase Inc.", diaVencimento: 1, ativa: true },
  { id: "dft-007", descricao: "Contabilidade — Escritório Contador", categoria: "CONTABIL", valor: 4500, fornecedor: "Contábil Solutions Ltda", diaVencimento: 20, ativa: true },
  { id: "dft-008", descricao: "Assessoria Jurídica Mensal", categoria: "JURIDICO", valor: 6000, fornecedor: "Advocacia Lima & Associados", diaVencimento: 15, ativa: true },
  { id: "dft-009", descricao: "Plano de Saúde Coletivo", categoria: "BENEFICIOS", valor: 3160, fornecedor: "SulAmérica", diaVencimento: 25, ativa: true },
  { id: "dft-010", descricao: "Seguro Empresarial", categoria: "SEGUROS", valor: 980, fornecedor: "Porto Seguro", diaVencimento: 28, ativa: true },
];

// Gera despesas fixas para um mês/ano específico
export function expandirDespesasFixas(mes: number, ano: number): Despesa[] {
  return DESPESAS_FIXAS_TEMPLATES.filter((t) => t.ativa).map((t) => ({
    id: `df-${t.id}-${ano}-${mes}`,
    descricao: t.descricao,
    categoria: t.categoria,
    tipo: "FIXA" as const,
    valor: t.valor,
    mes,
    ano,
    autoReplicada: true,
    despesaBaseId: t.id,
    fornecedor: t.fornecedor,
    vencimento: `${ano}-${String(mes).padStart(2, "0")}-${String(t.diaVencimento).padStart(2, "0")}`,
    status: mes < 3 || (mes === 3 && t.diaVencimento <= 20) ? "PAGA" : "PENDENTE",
  }));
}

// ─── DESPESAS VARIÁVEIS ───────────────────────────────────────────────────────

export const DEMO_DESPESAS_VARIAVEIS: Despesa[] = [
  { id: "dv-001", descricao: "Passagem aérea — visita cliente Brasília", categoria: "VIAGEM", tipo: "VARIAVEL", valor: 1840, mes: 1, ano: 2026, autoReplicada: false, despesaBaseId: null, fornecedor: "LATAM Airlines", vencimento: "2026-01-18", status: "PAGA" },
  { id: "dv-002", descricao: "Hotel 3 noites Brasília", categoria: "VIAGEM", tipo: "VARIAVEL", valor: 2100, mes: 1, ano: 2026, autoReplicada: false, despesaBaseId: null, fornecedor: "Quality Hotel BSB", vencimento: "2026-01-20", status: "PAGA" },
  { id: "dv-003", descricao: "Material de escritório — ressuprimento", categoria: "ADMINISTRATIVO", tipo: "VARIAVEL", valor: 620, mes: 2, ano: 2026, autoReplicada: false, despesaBaseId: null, fornecedor: "Kalunga", vencimento: "2026-02-05", status: "PAGA" },
  { id: "dv-004", descricao: "Manutenção equipamentos TI", categoria: "MANUTENCAO", tipo: "VARIAVEL", valor: 1350, mes: 2, ano: 2026, autoReplicada: false, despesaBaseId: null, fornecedor: "TechSuport Ltda", vencimento: "2026-02-15", status: "PAGA" },
  { id: "dv-005", descricao: "Evento / Workshop parceiros SP", categoria: "MARKETING", tipo: "VARIAVEL", valor: 8500, mes: 2, ano: 2026, autoReplicada: false, despesaBaseId: null, fornecedor: "Espaço de Eventos Centro SP", vencimento: "2026-02-28", status: "PAGA" },
  { id: "dv-006", descricao: "Consultoria estratégica — expansão", categoria: "CONSULTORIA", tipo: "VARIAVEL", valor: 15000, mes: 3, ano: 2026, autoReplicada: false, despesaBaseId: null, fornecedor: "McKinsey & Co.", vencimento: "2026-03-31", status: "PENDENTE" },
  { id: "dv-007", descricao: "Material gráfico — apresentações", categoria: "MARKETING", tipo: "VARIAVEL", valor: 3200, mes: 3, ano: 2026, autoReplicada: false, despesaBaseId: null, fornecedor: "Agência Creative SP", vencimento: "2026-03-15", status: "PAGA" },
  { id: "dv-008", descricao: "Treinamento equipe — Crédito Estruturado", categoria: "TREINAMENTO", tipo: "VARIAVEL", valor: 4800, mes: 3, ano: 2026, autoReplicada: false, despesaBaseId: null, fornecedor: "IBMEC Online", vencimento: "2026-03-20", status: "PENDENTE" },
];

// ─── COMISSÕES ────────────────────────────────────────────────────────────────

export const DEMO_COMISSOES: Comissao[] = [
  {
    id: "com-001", codigo: "COM-26-001",
    partnerId: "demo-partner-001", partnerNome: "João Partner Silva",
    operacaoTipo: "CREDITO", operacaoId: "prop-001", operacaoCodigo: "CRED-26-300001",
    operacaoDescricao: "Home Equity — Cliente Marcos Vieira", valorOperacao: 320000,
    percentualComissao: 1.2, valorComissao: 3840,
    mes: 2, ano: 2026, dataOperacaoFinalizada: "2026-02-14",
    status: "PAGA", dataPagamento: "2026-02-28", observacoes: null,
  },
  {
    id: "com-002", codigo: "COM-26-002",
    partnerId: "demo-partner-001", partnerNome: "João Partner Silva",
    operacaoTipo: "MA", operacaoId: "deal-004", operacaoCodigo: "MA-26-200004",
    operacaoDescricao: "M&A — Corretora Norte DTVM", valorOperacao: 18000000,
    percentualComissao: 2.0, valorComissao: 360000,
    mes: 3, ano: 2026, dataOperacaoFinalizada: "2026-03-05",
    status: "A_PAGAR", dataPagamento: null, observacoes: "Pagamento em 2 parcelas",
  },
  {
    id: "com-003", codigo: "COM-26-003",
    partnerId: "demo-partner-001", partnerNome: "João Partner Silva",
    operacaoTipo: "CREDITO", operacaoId: "prop-004", operacaoCodigo: "CRED-26-300004",
    operacaoDescricao: "FIDC — TechVenture Capital", valorOperacao: 4500000,
    percentualComissao: 0.8, valorComissao: 36000,
    mes: 3, ano: 2026, dataOperacaoFinalizada: "2026-03-18",
    status: "A_PAGAR", dataPagamento: null, observacoes: null,
  },
  {
    id: "com-004", codigo: "COM-26-004",
    partnerId: "demo-partner-002", partnerNome: "Rafael Partner Cardoso",
    operacaoTipo: "CONSORCIO", operacaoId: "cons-001", operacaoCodigo: "CONS-26-400001",
    operacaoDescricao: "Consórcio Imóvel — Cliente Sandro F.", valorOperacao: 280000,
    percentualComissao: 3.0, valorComissao: 8400,
    mes: 2, ano: 2026, dataOperacaoFinalizada: "2026-02-22",
    status: "PAGA", dataPagamento: "2026-03-05", observacoes: null,
  },
  {
    id: "com-005", codigo: "COM-26-005",
    partnerId: "demo-partner-002", partnerNome: "Rafael Partner Cardoso",
    operacaoTipo: "MA", operacaoId: "deal-005", operacaoCodigo: "MA-26-200005",
    operacaoDescricao: "M&A — Finança Digital Assessoria", valorOperacao: 65000000,
    percentualComissao: 1.5, valorComissao: 975000,
    mes: 3, ano: 2026, dataOperacaoFinalizada: "2026-03-25",
    status: "A_PAGAR", dataPagamento: null, observacoes: "Deal em fase de closing",
  },
  {
    id: "com-006", codigo: "COM-26-006",
    partnerId: "demo-partner-003", partnerNome: "Luciana Partner Rocha",
    operacaoTipo: "CREDITO", operacaoId: "prop-007", operacaoCodigo: "CRED-26-300007",
    operacaoDescricao: "High Ticket — Holding Capital 3", valorOperacao: 140000000,
    percentualComissao: 0.3, valorComissao: 420000,
    mes: 3, ano: 2026, dataOperacaoFinalizada: "2026-03-28",
    status: "A_PAGAR", dataPagamento: null, observacoes: "Alta prioridade — prazo 15 dias",
  },
];

// ─── DRE ──────────────────────────────────────────────────────────────────────

export const DEMO_DRE: DREMes[] = [
  { mes: 10, ano: 2025, receitas: 380000, deducoes: 38000, receitaLiquida: 342000, custosOperacionais: 95000, lucroBruto: 247000, despesasAdmin: 55000, despesasComerciais: 48000, despesasFinanceiras: 8000, ebitda: 136000, irpj: 21760, csll: 12240, lucroLiquido: 102000 },
  { mes: 11, ano: 2025, receitas: 510000, deducoes: 51000, receitaLiquida: 459000, custosOperacionais: 102000, lucroBruto: 357000, despesasAdmin: 58000, despesasComerciais: 62000, despesasFinanceiras: 9500, ebitda: 227500, irpj: 36400, csll: 20475, lucroLiquido: 170625 },
  { mes: 12, ano: 2025, receitas: 680000, deducoes: 68000, receitaLiquida: 612000, custosOperacionais: 118000, lucroBruto: 494000, despesasAdmin: 72000, despesasComerciais: 85000, despesasFinanceiras: 12000, ebitda: 325000, irpj: 52000, csll: 29250, lucroLiquido: 243750 },
  { mes: 1, ano: 2026, receitas: 520000, deducoes: 52000, receitaLiquida: 468000, custosOperacionais: 108000, lucroBruto: 360000, despesasAdmin: 60000, despesasComerciais: 55000, despesasFinanceiras: 9000, ebitda: 236000, irpj: 37760, csll: 21240, lucroLiquido: 177000 },
  { mes: 2, ano: 2026, receitas: 780000, deducoes: 78000, receitaLiquida: 702000, custosOperacionais: 125000, lucroBruto: 577000, despesasAdmin: 65000, despesasComerciais: 95000, despesasFinanceiras: 11000, ebitda: 406000, irpj: 64960, csll: 36540, lucroLiquido: 304500 },
  { mes: 3, ano: 2026, receitas: 1420000, deducoes: 142000, receitaLiquida: 1278000, custosOperacionais: 148000, lucroBruto: 1130000, despesasAdmin: 75000, despesasComerciais: 182000, despesasFinanceiras: 14000, ebitda: 859000, irpj: 137440, csll: 77310, lucroLiquido: 644250 },
];

// ─── FLUXO DE CAIXA ───────────────────────────────────────────────────────────

export const DEMO_MOVIMENTOS: MovimentoCaixa[] = [
  { id: "mc-001", data: "2026-03-03", descricao: "Recebimento comissão COM-26-001", tipo: "ENTRADA", categoria: "RECEITA", valor: 3840, mes: 3, ano: 2026 },
  { id: "mc-002", data: "2026-03-05", descricao: "Aluguel março", tipo: "SAIDA", categoria: "DESPESA_FIXA", valor: 12500, mes: 3, ano: 2026 },
  { id: "mc-003", data: "2026-03-08", descricao: "Adobe Creative Cloud", tipo: "SAIDA", categoria: "DESPESA_FIXA", valor: 890, mes: 3, ano: 2026 },
  { id: "mc-004", data: "2026-03-10", descricao: "Recebimento honorários M&A Deal-002", tipo: "ENTRADA", categoria: "RECEITA", valor: 540000, mes: 3, ano: 2026 },
  { id: "mc-005", data: "2026-03-10", descricao: "Energia elétrica", tipo: "SAIDA", categoria: "DESPESA_FIXA", valor: 1800, mes: 3, ano: 2026 },
  { id: "mc-006", data: "2026-03-15", descricao: "Assessoria jurídica", tipo: "SAIDA", categoria: "DESPESA_FIXA", valor: 6000, mes: 3, ano: 2026 },
  { id: "mc-007", data: "2026-03-15", descricao: "Material gráfico agência", tipo: "SAIDA", categoria: "DESPESA_VARIAVEL", valor: 3200, mes: 3, ano: 2026 },
  { id: "mc-008", data: "2026-03-18", descricao: "Recebimento consultoria Split Fiscal", tipo: "ENTRADA", categoria: "RECEITA", valor: 38000, mes: 3, ano: 2026 },
  { id: "mc-009", data: "2026-03-20", descricao: "Folha de pagamento março", tipo: "SAIDA", categoria: "FOLHA", valor: 81776, mes: 3, ano: 2026 },
  { id: "mc-010", data: "2026-03-20", descricao: "FGTS março", tipo: "SAIDA", categoria: "IMPOSTO", valor: 5804, mes: 3, ano: 2026 },
  { id: "mc-011", data: "2026-03-25", descricao: "Recebimento comissão crédito N2", tipo: "ENTRADA", categoria: "RECEITA", valor: 36000, mes: 3, ano: 2026 },
  { id: "mc-012", data: "2026-03-28", descricao: "Seguro empresarial", tipo: "SAIDA", categoria: "DESPESA_FIXA", valor: 980, mes: 3, ano: 2026 },
  { id: "mc-013", data: "2026-03-31", descricao: "ISS março", tipo: "SAIDA", categoria: "IMPOSTO", valor: 28400, mes: 3, ano: 2026 },
];

export const SALDO_INICIAL_MARCO = 892000;

// ─── IMPOSTOS ─────────────────────────────────────────────────────────────────

export const DEMO_IMPOSTOS: Imposto[] = [
  { id: "imp-001", tipo: "ISS", descricao: "ISS — Imposto sobre Serviços (2%)", mes: 1, ano: 2026, baseCalculo: 520000, aliquota: 2.0, valor: 10400, vencimento: "2026-02-15", dataPagamento: "2026-02-14", guia: "ISS-SP-2601-4412", status: "PAGO" },
  { id: "imp-002", tipo: "PIS", descricao: "PIS (0,65%)", mes: 1, ano: 2026, baseCalculo: 520000, aliquota: 0.65, valor: 3380, vencimento: "2026-02-25", dataPagamento: "2026-02-24", guia: "DARF-PIS-2601-9921", status: "PAGO" },
  { id: "imp-003", tipo: "COFINS", descricao: "COFINS (3%)", mes: 1, ano: 2026, baseCalculo: 520000, aliquota: 3.0, valor: 15600, vencimento: "2026-02-25", dataPagamento: "2026-02-24", guia: "DARF-COF-2601-9922", status: "PAGO" },
  { id: "imp-004", tipo: "IRPJ", descricao: "IRPJ Estimativa (15%)", mes: 1, ano: 2026, baseCalculo: 177000, aliquota: 15.0, valor: 26550, vencimento: "2026-02-28", dataPagamento: "2026-02-27", guia: "DARF-IRPJ-2601-0220", status: "PAGO" },
  { id: "imp-005", tipo: "CSLL", descricao: "CSLL Estimativa (9%)", mes: 1, ano: 2026, baseCalculo: 177000, aliquota: 9.0, valor: 15930, vencimento: "2026-02-28", dataPagamento: "2026-02-27", guia: "DARF-CSLL-2601-0221", status: "PAGO" },
  { id: "imp-006", tipo: "ISS", descricao: "ISS — Imposto sobre Serviços (2%)", mes: 2, ano: 2026, baseCalculo: 780000, aliquota: 2.0, valor: 15600, vencimento: "2026-03-15", dataPagamento: "2026-03-14", guia: "ISS-SP-2602-5891", status: "PAGO" },
  { id: "imp-007", tipo: "PIS", descricao: "PIS (0,65%)", mes: 2, ano: 2026, baseCalculo: 780000, aliquota: 0.65, valor: 5070, vencimento: "2026-03-25", dataPagamento: "2026-03-24", guia: "DARF-PIS-2602-1183", status: "PAGO" },
  { id: "imp-008", tipo: "COFINS", descricao: "COFINS (3%)", mes: 2, ano: 2026, baseCalculo: 780000, aliquota: 3.0, valor: 23400, vencimento: "2026-03-25", dataPagamento: "2026-03-24", guia: "DARF-COF-2602-1184", status: "PAGO" },
  { id: "imp-009", tipo: "IRPJ", descricao: "IRPJ Estimativa (15%)", mes: 2, ano: 2026, baseCalculo: 304500, aliquota: 15.0, valor: 45675, vencimento: "2026-03-31", dataPagamento: null, guia: null, status: "A_PAGAR" },
  { id: "imp-010", tipo: "CSLL", descricao: "CSLL Estimativa (9%)", mes: 2, ano: 2026, baseCalculo: 304500, aliquota: 9.0, valor: 27405, vencimento: "2026-03-31", dataPagamento: null, guia: null, status: "A_PAGAR" },
  { id: "imp-011", tipo: "ISS", descricao: "ISS — Imposto sobre Serviços (2%)", mes: 3, ano: 2026, baseCalculo: 1420000, aliquota: 2.0, valor: 28400, vencimento: "2026-04-15", dataPagamento: null, guia: null, status: "PREVISTO" },
  { id: "imp-012", tipo: "PIS", descricao: "PIS (0,65%)", mes: 3, ano: 2026, baseCalculo: 1420000, aliquota: 0.65, valor: 9230, vencimento: "2026-04-25", dataPagamento: null, guia: null, status: "PREVISTO" },
  { id: "imp-013", tipo: "COFINS", descricao: "COFINS (3%)", mes: 3, ano: 2026, baseCalculo: 1420000, aliquota: 3.0, valor: 42600, vencimento: "2026-04-25", dataPagamento: null, guia: null, status: "PREVISTO" },
  { id: "imp-014", tipo: "IRPJ", descricao: "IRPJ Estimativa (15%)", mes: 3, ano: 2026, baseCalculo: 644250, aliquota: 15.0, valor: 96637, vencimento: "2026-04-30", dataPagamento: null, guia: null, status: "PREVISTO" },
  { id: "imp-015", tipo: "CSLL", descricao: "CSLL Estimativa (9%)", mes: 3, ano: 2026, baseCalculo: 644250, aliquota: 9.0, valor: 57982, vencimento: "2026-04-30", dataPagamento: null, guia: null, status: "PREVISTO" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const MESES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function formatMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

export function totalFolha(): { bruto: number; inss: number; fgts: number; irrf: number; beneficios: number; liquido: number } {
  return DEMO_FUNCIONARIOS.reduce((acc, f) => ({
    bruto: acc.bruto + f.salarioBruto,
    inss: acc.inss + f.inss,
    fgts: acc.fgts + f.fgts,
    irrf: acc.irrf + f.irrf,
    beneficios: acc.beneficios + Object.values(f.beneficios).reduce((a, b) => a + b, 0),
    liquido: acc.liquido + f.salarioLiquido,
  }), { bruto: 0, inss: 0, fgts: 0, irrf: 0, beneficios: 0, liquido: 0 });
}
