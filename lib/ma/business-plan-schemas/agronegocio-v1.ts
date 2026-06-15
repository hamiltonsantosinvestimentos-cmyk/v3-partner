import { z } from "zod";
import type { SectorSchemaDefinition } from "./registry";

export interface AgronegocioProjectionYear {
  ano: number;
  receita_total_brl: number;
  ebitda_brl: number;
  margem_ebitda_pct: number;
  fcl_brl: number;
  [key: string]: number;
}

// Envelope de projeção isolada por modelo (Modelo A — MVP Orgânico /
// Modelo B — Expansão Institucional).
export interface AgronegocioModelResult {
  label: string;
  cagr_aplicado_pct: number;
  anos: AgronegocioProjectionYear[];
  receita: Array<{ ano: number; tipo: string; valor: number }>;
}

export interface AgronegocioGiroGado {
  cabecas: number;
  capital_giro_brl: number;
  receita_giro_brl: number;
  resultado_giro_brl: number;
  ano_resultado: number;
  preco_arroba_bgi_brl: number;
}

export interface AgronegocioCapitalStack {
  fase_1: {
    label: string;
    fonte: string;
    capex_brl: number;
    descricao: string;
  };
  fase_2: {
    label: string;
    fonte: string;
    aporte_brl: number;
    instrumento: "divida_estruturada" | "equity_senior" | "nao_definido";
    estrategia: string;
    descricao: string;
    giro_gado?: AgronegocioGiroGado;
  };
}

export interface AgronegocioFinancialProjections {
  schema_id: "agronegocio-v1";
  sub_sector?: string;
  anos: AgronegocioProjectionYear[];
  receita: Array<{ ano: number; tipo: string; valor: number }>;
  scenarios: {
    base:      { label: string; cagr_pct: number; valor_terminal_brl: number };
    expansao:  { label: string; cagr_pct: number; valor_terminal_brl: number };
    pessimista: { label: string; cagr_pct: number; valor_terminal_brl: number };
  };
  indicadores: {
    taxa_prenhez_pct?: number;
    embrioes_produzidos_mes?: number;
    preco_medio_embriao_brl?: number;
    preco_medio_embriao_usd?: number;
    hedge_natural_pct?: number;
    exposicao_residual_usd?: number;
    [key: string]: number | undefined;
  };
  fx_snapshot?: { usd_brl: number; source: string; date: string; fetched_at: string };
  hedge_analysis?: Record<string, unknown> | null;
  viabilidade_bgi?: Record<string, unknown>;
  benchmarks_aplicados?: Record<string, number>;
  // Nós isolados de Capital Stacking — ausentes em projeções geradas antes desta
  // extensão (Zero Breaking Changes: validate() não exige estes campos).
  modelo_a?: AgronegocioModelResult;
  modelo_b?: AgronegocioModelResult;
  capital_stack?: AgronegocioCapitalStack;
}

// ── Zod — Captação de Capital (intake "captacao_capital") ────────────────────
// Validação isolada da seção opcional de Capital Stacking do formulário
// genetica-bovina-v1. Todos os campos opcionais — zero impacto se ausentes.
export const captacaoCapitalSchema = z.object({
  capex_fase1_producao_brl: z.number().nonnegative().optional(),
  aporte_fase2_institucional_brl: z.number().nonnegative().optional(),
  instrumento_fase2: z.enum(["Dívida Estruturada", "Equity Sênior"]).optional(),
  giro_gado_cabecas: z.number().nonnegative().optional(),
  giro_gado_arrobas_compra: z.number().nonnegative().optional(),
  giro_gado_preco_arroba_compra_brl: z.number().nonnegative().optional(),
  giro_gado_arrobas_desmame: z.number().nonnegative().optional(),
  giro_gado_meses_ate_venda: z.number().positive().optional(),
});

export type CaptacaoCapitalInput = z.infer<typeof captacaoCapitalSchema>;

// ── Zod — integridade estrutural de Modelo A / Modelo B / Capital Stack ──────
const agronegocioProjectionYearSchema = z
  .object({
    ano: z.number(),
    receita_total_brl: z.number(),
    ebitda_brl: z.number(),
    margem_ebitda_pct: z.number(),
    fcl_brl: z.number(),
  })
  .passthrough();

const agronegocioModelResultSchema = z.object({
  label: z.string(),
  cagr_aplicado_pct: z.number(),
  anos: z.array(agronegocioProjectionYearSchema).min(1),
  receita: z.array(
    z.object({ ano: z.number(), tipo: z.string(), valor: z.number() })
  ),
});

const agronegocioGiroGadoSchema = z.object({
  cabecas: z.number(),
  capital_giro_brl: z.number(),
  receita_giro_brl: z.number(),
  resultado_giro_brl: z.number(),
  ano_resultado: z.number(),
  preco_arroba_bgi_brl: z.number(),
});

const agronegocioCapitalStackSchema = z.object({
  fase_1: z.object({
    label: z.string(),
    fonte: z.string(),
    capex_brl: z.number(),
    descricao: z.string(),
  }),
  fase_2: z.object({
    label: z.string(),
    fonte: z.string(),
    aporte_brl: z.number(),
    instrumento: z.enum(["divida_estruturada", "equity_senior", "nao_definido"]),
    estrategia: z.string(),
    descricao: z.string(),
    giro_gado: agronegocioGiroGadoSchema.optional(),
  }),
});

const AGRONEGOCIO_REQUIRED_FIELDS = ["anos", "receita", "scenarios", "indicadores"] as const;

export const agronegocioV1Schema: SectorSchemaDefinition<AgronegocioFinancialProjections> = {
  id: "agronegocio-v1",
  version: 1,
  sectorAliases: ["agronegócio", "agronegocio", "agropecuária", "agropecuaria"],
  requiredFields: [...AGRONEGOCIO_REQUIRED_FIELDS],
  panelComponent: "components/ma/business-plan/panels/agronegocio-panel",
  validate: (raw) => {
    if (!raw || typeof raw !== "object") {
      return { valid: false, missingFields: [...AGRONEGOCIO_REQUIRED_FIELDS] };
    }
    const obj = raw as Record<string, unknown>;
    const missing = AGRONEGOCIO_REQUIRED_FIELDS.filter(
      (f) => obj[f] === undefined || obj[f] === null
    );
    if (missing.length > 0) {
      return { valid: false, missingFields: missing };
    }
    if (!Array.isArray(obj.anos) || (obj.anos as unknown[]).length === 0) {
      return { valid: false, missingFields: ["anos (array vazio)"] };
    }

    // Capital Stacking — modelo_a/modelo_b/capital_stack são opcionais
    // (projeções geradas antes desta extensão não os possuem), mas quando
    // presentes devem respeitar a estrutura estrita.
    if (obj.modelo_a !== undefined && !agronegocioModelResultSchema.safeParse(obj.modelo_a).success) {
      return { valid: false, missingFields: ["modelo_a (estrutura inválida)"] };
    }
    if (obj.modelo_b !== undefined && !agronegocioModelResultSchema.safeParse(obj.modelo_b).success) {
      return { valid: false, missingFields: ["modelo_b (estrutura inválida)"] };
    }
    if (obj.capital_stack !== undefined && !agronegocioCapitalStackSchema.safeParse(obj.capital_stack).success) {
      return { valid: false, missingFields: ["capital_stack (estrutura inválida)"] };
    }

    return { valid: true, data: obj as unknown as AgronegocioFinancialProjections };
  },
};
