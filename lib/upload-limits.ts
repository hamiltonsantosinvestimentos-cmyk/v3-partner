/**
 * Limite de envio de arquivo pelo formulário público de qualificação.
 *
 * O corpo de uma requisição para função da Vercel não passa de 4,5 MB. Acima disso a plataforma
 * responde HTTP 413 em texto puro (FUNCTION_PAYLOAD_TOO_LARGE) antes de a rota rodar, e a tela
 * recebia isso como "Erro de conexão". Enquanto o arquivo passar pela função, o limite prático é
 * 4 MB (sobra margem para os campos do formulário). Módulo puro: usado pela tela e pela rota.
 */
export const KYC_MAX_UPLOAD_VIA_FUNCTION_BYTES = 4 * 1024 * 1024;

/** Tamanho em pt-BR, com vírgula decimal ("6,2 MB"). */
export function formatFileSizePtBr(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export function fileTooLargeMessage(bytes: number): string {
  return `O arquivo tem ${formatFileSizePtBr(bytes)} e o limite é ${formatFileSizePtBr(KYC_MAX_UPLOAD_VIA_FUNCTION_BYTES)}. O arquivo NÃO foi enviado. Reduza a resolução da foto ou salve o PDF em tamanho menor e envie de novo.`;
}

/**
 * Mensagem para uma resposta de upload que não deu certo. `serverMessage` é o texto do JSON da
 * rota, quando a resposta era JSON. Resposta que não é JSON (413 da plataforma, 5xx de gateway)
 * chega aqui com `serverMessage` vazio e vira uma mensagem pelo código HTTP.
 */
export function uploadFailureMessage(status: number, serverMessage?: string | null): string {
  if (status === 413) {
    return `O arquivo é grande demais para o envio (limite de ${formatFileSizePtBr(KYC_MAX_UPLOAD_VIA_FUNCTION_BYTES)}). O arquivo NÃO foi enviado. Reduza a resolução da foto ou salve o PDF em tamanho menor e envie de novo.`;
  }
  if (serverMessage) return `${serverMessage} O arquivo NÃO foi enviado.`;
  if (status >= 500) return `O servidor não conseguiu receber o arquivo (código ${status}). O arquivo NÃO foi enviado. Tente de novo em instantes.`;
  return `Não foi possível enviar o arquivo (código ${status}). O arquivo NÃO foi enviado. Tente de novo.`;
}

export const UPLOAD_NETWORK_ERROR_MESSAGE =
  "Sem resposta do servidor, provavelmente por falha de conexão com a internet. O arquivo NÃO foi enviado. Confira a conexão e tente de novo.";
