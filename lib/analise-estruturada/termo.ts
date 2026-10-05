// Termo de responsabilidade do parecer da Análise Estruturada V3 (entrega 4).
//
// MINUTA redigida em 04/10/2026 e VALIDADA pelo Robson (jurídico/compliance) em 05/10/2026,
// sem ajustes no texto.
// Enquanto TERMO_VALIDADO_JURIDICO for false:
//   - o PDF sai com a tarja "MINUTA — pendente de validação jurídica";
//   - a ENTREGA ao cliente fica bloqueada (gerar e assinar continuam liberados para teste).
// Depois da validação: ajustar o texto se o Robson pedir, trocar a flag para true e
// atualizar TERMO_VERSAO.

export const TERMO_VALIDADO_JURIDICO = true;
export const TERMO_VERSAO = "v1-validado-2026-10-05";

export const TERMO_TITULO = "Termo de responsabilidade e limites de uso do parecer";

export const TERMO_CLAUSULAS: Array<{ titulo: string; texto: string }> = [
  {
    titulo: "Natureza do parecer",
    texto:
      "Este parecer é uma opinião técnica da V3 Partners Soluções Ltda sobre a situação econômico-financeira e de crédito do cliente na data de emissão. " +
      "Não é oferta, promessa ou garantia de concessão de crédito, nem recomendação de investimento. " +
      "A decisão de conceder crédito é exclusiva de cada instituição financeira, fundo ou securitizadora, segundo os próprios critérios.",
  },
  {
    titulo: "Base de informações",
    texto:
      "A análise usa os documentos e as informações fornecidos pelo cliente e consultas a bureaus de crédito, ao Sistema de Informações de Crédito do Banco Central (SCR) e a fontes públicas, feitas com autorização. " +
      "A V3 não audita os documentos recebidos. O cliente responde pela veracidade, integridade e atualidade do que enviou, e informações incorretas, incompletas ou alteradas comprometem as conclusões.",
  },
  {
    titulo: "Metodologia e estimativas",
    texto:
      "Indicadores, capacidade de pagamento, crédito máximo, testes de estresse e economias de custos são estimativas calculadas pela metodologia descrita neste documento, sobre premissas que podem não se confirmar. " +
      "Taxas, prazos e valores são indicativos.",
  },
  {
    titulo: "Validade",
    texto:
      "O parecer retrata a situação na data de emissão e vale por 30 dias. Fatos posteriores, como novas dívidas, protestos, processos ou mudança de faturamento, podem alterar as conclusões.",
  },
  {
    titulo: "Uso e confidencialidade",
    texto:
      "Documento de uso do cliente e do partner V3 responsável, para estruturação e captação de crédito. O cliente pode compartilhá-lo com instituições financeiras do seu interesse. " +
      "É proibido alterar o conteúdo.",
  },
  {
    titulo: "Limite de responsabilidade",
    texto:
      "A responsabilidade da V3 se limita à aplicação correta da metodologia descrita sobre as informações recebidas. " +
      "A V3 não responde por decisões de terceiros tomadas com base neste parecer nem por perdas decorrentes de informações fornecidas pelo cliente.",
  },
  {
    titulo: "Custos bancários",
    texto:
      "As indicações sobre tarifas, seguros e encargos são orientativas. Antes de cancelar qualquer produto, o cliente deve verificar contratos vinculados, como seguros exigidos em financiamentos ou garantias. " +
      "A V3 não presta assessoria jurídica.",
  },
  {
    titulo: "Proteção de dados",
    texto:
      "Os dados pessoais foram tratados com base no consentimento do titular e dos sócios (LGPD, art. 7º, incisos I e V), exclusivamente para esta análise, e ficam armazenados com controle de acesso. " +
      "Para exercer seus direitos de titular: juridico@v3partners.com.br.",
  },
];
