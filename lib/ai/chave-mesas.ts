// Chave da Anthropic usada pela IA da Mesa de Crédito, Mesa Operacional e CRM
// (análise de proposta, OCR, avaliação de imóvel, chat da proposta, Análise
// Estruturada, leitura de documento no cadastro e próxima ação do CRM).
// O resto da plataforma (M&A, Agentes, SDR, Bolsa...) segue em ANTHROPIC_API_KEY.
// Sem ANTHROPIC_API_KEY_MESAS configurada, cai na chave geral.
export function chaveIaMesas(): string | undefined {
  return process.env.ANTHROPIC_API_KEY_MESAS?.trim() || process.env.ANTHROPIC_API_KEY;
}
