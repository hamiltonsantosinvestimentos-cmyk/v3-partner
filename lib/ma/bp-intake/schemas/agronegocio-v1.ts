import type { IntakeSchema } from "../engine/schema-registry";

export const agronegocioV1Schema: IntakeSchema = {
  id: "agronegocio-v1",
  label: "Agronegócio",
  sector: "agronegocio",
  tags: [],
  sections: [
    {
      id: "producao",
      title: "Dados de Produção",
      fields: [
        {
          key: "area_hectares",
          label: "Área total (hectares)",
          type: "number",
          required: true,
          min: 0,
          placeholder: "Ex.: 850",
        },
        {
          key: "cultura_principal",
          label: "Cultura / atividade principal",
          type: "text",
          required: true,
          placeholder: "Ex.: Soja, Pecuária de corte, Genética bovina",
        },
        {
          key: "produtividade_unidade",
          label: "Unidade de produtividade",
          type: "select",
          required: false,
          options: ["ton/ha", "arroba/ha", "cabeças/ha", "unidades/mês", "embriões/mês", "outro"],
        },
        {
          key: "produtividade_valor",
          label: "Produtividade atual (na unidade acima)",
          type: "number",
          required: false,
          min: 0,
          placeholder: "Ex.: 3.8",
        },
      ],
    },
    {
      id: "financeiro_agro",
      title: "Financeiro Agronegócio",
      fields: [
        {
          key: "receita_anual_brl",
          label: "Receita bruta anual (R$)",
          type: "currency",
          required: false,
          placeholder: "Ex.: 2.500.000",
        },
        {
          key: "custo_operacional_anual_brl",
          label: "Custo operacional anual (R$)",
          type: "currency",
          required: false,
          placeholder: "Ex.: 1.200.000",
        },
        {
          key: "ebitda_pct",
          label: "Margem EBITDA estimada (%)",
          type: "percentage",
          required: false,
          min: 0,
          max: 100,
          placeholder: "Ex.: 42",
        },
      ],
    },
  ],
};
