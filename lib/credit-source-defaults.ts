// Defaults do Painel de Configuração de Fontes (Credit Engine), compartilhado entre
// app/api/credit-engine/source-config/route.ts (o que a tela mostra pra um CNPJ nunca
// configurado) e app/api/credit-engine/trigger/route.ts (o que a análise realmente usa
// quando não há configuração salva). Extraído em 01/09/2026 para nunca mais divergir
// entre os dois lugares — mesmo padrão de "nunca duplicar lógica" já reforçado várias
// vezes neste projeto (lib/cora-order-reconcile.ts, v3-numbering-governance.md).
//
// Mudança de 01/09/2026, decisão explícita de João: todas as fontes passam a vir
// LIGADAS por padrão (antes só as gratuitas vinham ligadas). Registrado o custo real
// disso: Serasa não tem UAT configurado neste momento (confirmado ao vivo no node
// "Serasa · PJ/PF" do W-CREDIT: `serasa_ambiente` nem existe em credit_source_configs,
// então o node sempre roda em produção real -- cada relatório emitido gera cobrança
// real pelo contrato, por comentário explícito no próprio código do node). SPC segue
// sem node real no n8n (nenhum node de SPC existe no workflow, confirmado ao vivo em
// 01/09/2026): ligar o default aqui não faz SPC rodar de verdade até o node ser criado.
export const CREDIT_SOURCE_DEFAULTS = {
  receita_federal: true,
  cnj_datajud: true,
  ceis: true,
  registrato_bacen: true,
  serasa: true,
  serasa_modalidade: "simples" as const,
  serasa_cnpj: true,
  serasa_cpf: false,
  serasa_cpf_list: null as string[] | null,
  spc: true,
  escavador: true,
};
