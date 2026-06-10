import type { IntakeSchema } from "../engine/schema-registry";

export const baseSchema: IntakeSchema = {
  id: "_base",
  label: "Identificação e Dados Básicos",
  sector: "_all",
  tags: [],
  sections: [
    {
      id: "identificacao",
      title: "Identificação do Responsável",
      description: "Dados de quem está preenchendo este formulário.",
      fields: [
        {
          key: "responsavel_nome",
          label: "Nome completo",
          type: "text",
          required: true,
          placeholder: "Ex.: Carlos Mendes",
        },
        {
          key: "responsavel_email",
          label: "E-mail",
          type: "text",
          required: true,
          placeholder: "contador@empresa.com.br",
          hint: "Usado apenas para envio do comprovante de recebimento.",
        },
        {
          key: "responsavel_cargo",
          label: "Cargo / função",
          type: "text",
          required: false,
          placeholder: "Ex.: Contador, Diretor Financeiro",
        },
      ],
    },
    {
      id: "empresa",
      title: "Dados da Empresa",
      fields: [
        {
          key: "razao_social",
          label: "Razão social",
          type: "text",
          required: false,
          placeholder: "Nelblue da Império Genética Ltda",
        },
        {
          key: "ano_fundacao",
          label: "Ano de fundação",
          type: "number",
          required: false,
          min: 1900,
          max: 2026,
          placeholder: "Ex.: 2018",
        },
        {
          key: "num_funcionarios",
          label: "Número de colaboradores",
          type: "number",
          required: false,
          min: 0,
          placeholder: "Ex.: 12",
        },
      ],
    },
    {
      id: "observacoes",
      title: "Observações Livres",
      description: "Qualquer informação adicional relevante para a análise.",
      fields: [
        {
          key: "observacoes",
          label: "Observações",
          type: "text",
          required: false,
          placeholder: "Contexto, particularidades, contratos em negociação...",
        },
      ],
    },
  ],
};
