import { isValidCNPJ, isValidCPF } from "@/lib/validators/cpf-cnpj";
import { ROLE_LABELS } from "@/lib/qualification-roles";

// Exclusão justificada de documento de qualificação (BRIEF Trava de Liberação, seção 3).

/**
 * O motivo é texto livre e fica em log: não pode conter CPF nem CNPJ (nem o alfanumérico). Reutiliza os
 * validadores do projeto: normaliza removendo tudo que não é letra ou dígito, em maiúsculas, e testa os
 * formatos de CPF (11 dígitos) e de CNPJ (14 caracteres, módulo 11), com e sem máscara. Nunca conta dígitos.
 * Procura em cada "palavra" do texto e também no texto inteiro colado (o usuário pode digitar com espaços).
 */
export function motivoTemDocumento(texto: string): boolean {
  const candidatos = new Set<string>();
  // sequências "contínuas" de letras, dígitos e pontuação de documento
  for (const m of texto.matchAll(/[0-9A-Za-z][0-9A-Za-z.\-\/]{9,}[0-9A-Za-z]/g)) candidatos.add(m[0]);
  // sequências de dígitos separados por espaço, ponto, traço ou barra (ex.: "123 456 789 09")
  for (const m of texto.matchAll(/(?:[0-9A-Za-z][ .\-\/]?){11,18}/g)) candidatos.add(m[0]);
  for (const bruto of candidatos) {
    const norm = bruto.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
    // janelas deslizantes: o documento pode estar colado a outras letras ou dígitos
    for (const tam of [11, 14]) {
      for (let i = 0; i + tam <= norm.length; i++) {
        const jan = norm.slice(i, i + tam);
        if (tam === 11 && /^\d{11}$/.test(jan) && isValidCPF(jan)) return true;
        if (tam === 14 && isValidCNPJ(jan)) return true;
      }
    }
  }
  return false;
}

export type BloqueioExclusao = "lote_em_contrato" | "envio_anterior" | null;

export type LinhaImpacto = {
  qualification_id: string;
  role_in_document: string;
  status: string;
  contract_code: string | null;
  contract_status: string | null;
  bloqueio: BloqueioExclusao;
};

/** Mensagem ao operador quando alguma qualificação que usa o documento está em estado bloqueado. */
export function mensagemBloqueio(linhas: LinhaImpacto[]): string | null {
  const emContrato = linhas.filter((l) => l.bloqueio === "lote_em_contrato");
  if (emContrato.length > 0) {
    const cod = emContrato.find((l) => l.contract_code)?.contract_code;
    const assinado = emContrato.some((l) => l.contract_status === "assinado");
    if (assinado) return `Este documento é usado em contrato já assinado${cod ? ` (${cod})` : ""}. Não pode ser excluído.`;
    return `Este documento é usado em contrato${cod ? ` (${cod})` : ""}. Cancele o rascunho em Contratos ("Cancelar rascunho e requalificar") e tente de novo. Se o contrato já foi enviado para assinatura, a exclusão exige a liberação de um sócio.`;
  }
  if (linhas.some((l) => l.bloqueio === "envio_anterior")) {
    return "Este documento é usado em contrato que já foi enviado para assinatura e depois cancelado. Para excluí-lo, um sócio precisa liberar.";
  }
  return null;
}

export function papelRotulo(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

/** Quantos titulares distintos (por e-mail) serão avisados, dado o impacto. Só as fichas preenchidas são reabertas. */
export function resumoImpacto(linhas: LinhaImpacto[]): { reabertas: number } {
  return { reabertas: linhas.filter((l) => l.status === "preenchido").length };
}
