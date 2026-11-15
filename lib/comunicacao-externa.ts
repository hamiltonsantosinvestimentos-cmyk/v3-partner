// Catálogo de nomes externos de documentos e de motivos padronizados (BRIEF "Catálogo de nomes externos de
// documentos e motivos", 15/11/2026). Toda comunicação a titular, cliente ou parceiro (e-mail e WhatsApp) usa SÓ
// este arquivo para falar de documento e de motivo: nunca o nome interno do modelo de aprovação, nunca nome de
// parceiro, nunca texto livre digitado pela equipe. Lista fechada, em um único lugar; mudar um nome ou uma frase é
// alteração de código com aprovação do João e validação do Robson.
//
// Falha fechada: tipo ou código fora do catálogo devolve null (ou ok:false) e quem chama NÃO envia.

export type OpcaoMotivo = {
  /** Código estável gravado no log e enviado pelo modal. */
  codigo: string;
  /** Texto do dropdown (equipe V3). */
  rotulo: string;
  /** Frase enviada ao titular. null = sem linha de motivo no e-mail ("Outro motivo"). */
  frase: string | null;
};

// Ordem alfabética pt-BR, "Outro motivo" por último (regra de dropdown do portal).
export const MOTIVOS_EXCLUSAO: readonly OpcaoMotivo[] = [
  { codigo: "arquivo_nao_abre", rotulo: "Arquivo não abre", frase: "Não foi possível abrir o arquivo enviado." },
  { codigo: "documento_cortado", rotulo: "Documento cortado ou incompleto", frase: "O documento está cortado ou incompleto." },
  { codigo: "documento_divergente", rotulo: "Documento divergente do informado", frase: "As informações do documento são diferentes das informadas no cadastro." },
  { codigo: "documento_ilegivel", rotulo: "Documento ilegível ou sem nitidez", frase: "O documento está ilegível ou sem nitidez." },
  { codigo: "documento_vencido", rotulo: "Documento vencido ou sem validade", frase: "O documento está com a validade vencida." },
  { codigo: "tipo_incorreto", rotulo: "Tipo de documento incorreto", frase: "O tipo de documento enviado não é o solicitado." },
  { codigo: "outro", rotulo: "Outro motivo", frase: null },
];

export const MOTIVOS_DEVOLUCAO: readonly OpcaoMotivo[] = [
  { codigo: "dados_divergentes", rotulo: "Dados divergentes dos documentos", frase: "Alguns dados informados são diferentes dos que constam nos documentos." },
  { codigo: "dados_pessoais_incompletos", rotulo: "Dados pessoais incompletos", frase: "Há dados pessoais que não foram preenchidos por completo." },
  { codigo: "endereco_incompleto", rotulo: "Endereço incompleto ou divergente", frase: "O endereço está incompleto ou diferente do comprovante." },
  { codigo: "outro", rotulo: "Outro motivo", frase: null },
];

export type ResultadoMotivo = { ok: true; frase: string | null } | { ok: false };

/** Valida o código contra a lista da rota e devolve a frase pronta. Código ausente ou inválido: ok:false (a rota responde 422). */
export function fraseMotivo(lista: readonly OpcaoMotivo[], codigo: unknown): ResultadoMotivo {
  if (typeof codigo !== "string") return { ok: false };
  const achada = lista.find((o) => o.codigo === codigo);
  return achada ? { ok: true, frase: achada.frase } : { ok: false };
}

// Documentos de CADASTRO (os dois tipos que a exclusão da ficha trata: DOC_KINDS em qualification-conferencia-server).
const NOME_EXTERNO_CADASTRO: Readonly<Record<string, string>> = {
  identificacao_foto: "Documento de identificação com foto",
  contrato_social: "Contrato social",
};

// Tipos de CONTRATO (document_type do lote). Sem uso no aviso ao titular; valem para o convite inicial e comunicações
// futuras. contrato_parceria fica sem nome externo (não pertence a um deal).
const NOME_EXTERNO_CONTRATO: Readonly<Record<string, string>> = {
  nda_quadripartite: "Acordo de Confidencialidade",
  ncnda_ma: "Acordo de Confidencialidade",
  fpa_compra: "Acordo de Participação na Operação (lado comprador)",
  fpa_venda: "Acordo de Participação na Operação (lado vendedor)",
  mandato: "Instrumento de Representação",
  contrato_final: "Contrato da Operação",
};

function buscar(mapa: Readonly<Record<string, string>>, chave: unknown): string | null {
  if (typeof chave !== "string" || !Object.prototype.hasOwnProperty.call(mapa, chave)) return null;
  return mapa[chave];
}

/** Nome externo de um documento de cadastro (kind). Tipo de contrato ou desconhecido: null. */
export function nomeExternoDocumentoCadastro(kind: unknown): string | null {
  return buscar(NOME_EXTERNO_CADASTRO, kind);
}

/** Nome externo de um tipo de contrato. Kind de cadastro, contrato_parceria ou desconhecido: null. */
export function nomeExternoTipoContrato(tipo: unknown): string | null {
  return buscar(NOME_EXTERNO_CONTRATO, tipo);
}
