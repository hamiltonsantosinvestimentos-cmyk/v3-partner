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

// ─── DADOS (vazios — preenchidos pelos usuários) ──────────────────────────────

export const DEMO_FUNCIONARIOS: Funcionario[] = [];

export const DESPESAS_FIXAS_TEMPLATES: DespesaFixaTemplate[] = [];

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
    status: "PENDENTE" as const,
  }));
}

export const DEMO_DESPESAS_VARIAVEIS: Despesa[] = [];

export const DEMO_COMISSOES: Comissao[] = [];

export const DEMO_DRE: DREMes[] = [];

export const DEMO_MOVIMENTOS: MovimentoCaixa[] = [];

export const SALDO_INICIAL_MARCO = 0;

export const DEMO_IMPOSTOS: Imposto[] = [];

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
