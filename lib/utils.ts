import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatCpf(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function formatCnpj(cnpj: string): string {
  return cnpj.replace(
    /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
    "$1.$2.$3/$4-$5"
  );
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }
  return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
}

/** Mascara progressiva de CPF enquanto o usuario digita (000.000.000-00). */
export function maskCpfInput(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Mascara progressiva de telefone com DDD (11 digitos: (00) 00000-0000). */
export function maskPhoneInput(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Validacao simples de email para feedback visual em formularios. */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Mascara progressiva para campo hibrido CPF/CNPJ — detecta pelo numero de digitos. */
export function maskCpfCnpjInput(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) return maskCpfInput(d);
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

// Validacao real de digito verificador (10/09/2026). Achado real: nenhuma validacao de
// checksum existia em lugar nenhum do sistema, so mascara de formatacao -- um CPF invalido
// (091.004.234-34) foi salvo sem aviso no cadastro de um cedente real da Bolsa de Ativos,
// e so foi descoberto quando a propria Checktudo recusou a consulta. Helper unico, pensado
// pra ser reaproveitado por qualquer formulario do portal que capture CPF/CNPJ, nao so o
// intake que originou o achado.

/** Confere o digito verificador real de um CPF (algoritmo padrao, modulo 11). Rejeita
 *  sequencias repetidas (000.000.000-00, 111.111.111-11, etc.), que passam no calculo mas
 *  nunca sao CPF valido de verdade. */
export function isValidCPF(value: string): boolean {
  const cpf = value.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split("").map(Number);
  const checkDigit = (slice: number[]) => {
    let sum = 0;
    let factor = slice.length + 1;
    for (const d of slice) sum += d * factor--;
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  if (checkDigit(digits.slice(0, 9)) !== digits[9]) return false;
  if (checkDigit(digits.slice(0, 10)) !== digits[10]) return false;
  return true;
}

/** Confere o digito verificador real de um CNPJ (algoritmo padrao, modulo 11, pesos
 *  6..2/9..2). Rejeita sequencias repetidas pelo mesmo motivo do CPF. */
export function isValidCNPJ(value: string): boolean {
  const cnpj = value.replace(/\D/g, "");
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const checkDigit = (base: string) => {
    const weights = base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += Number(base[i]) * weights[i];
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const base = cnpj.slice(0, 12);
  const d1 = checkDigit(base);
  if (d1 !== Number(cnpj[12])) return false;
  const d2 = checkDigit(base + d1);
  if (d2 !== Number(cnpj[13])) return false;
  return true;
}

/** Entrypoint unico pra campo hibrido CPF/CNPJ -- detecta pelo numero de digitos e valida
 *  o checksum real, nunca so o tamanho. Usar sempre que um formulario aceitar os dois
 *  tipos de documento no mesmo campo (mesmo padrao de deteccao de maskCpfCnpjInput). */
export function isValidCpfCnpj(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) return isValidCPF(digits);
  if (digits.length === 14) return isValidCNPJ(digits);
  return false;
}

/** Mascara monetaria em Reais em tempo real (estilo maquineta: digita da direita pra esquerda). Ex: "1234567" digitado vira "12.345,67". */
export function maskCurrencyBRLInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Converte o valor exibido por maskCurrencyBRLInput de volta para number (reais, nao centavos). */
export function parseCurrencyBRLInput(value: string): number {
  const digits = value.replace(/\D/g, "");
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
}

/**
 * Sanitiza digitacao livre de campo percentual/decimal (ex: Deságio, Fee, TIR):
 * mantem so digitos e um separador decimal (virgula ou ponto), descarta o resto.
 * Usar em onChange de input type="text" para esses campos.
 */
export function sanitizeDecimalInput(value: string): string {
  return value.replace(/[^0-9,.]/g, "");
}

/**
 * Converte texto digitado num campo percentual/decimal para number. Aceita
 * "," ou "." como separador decimal.
 *
 * Existe porque input nativo type="number", sob locale/teclado PT-BR do
 * Chrome, guarda "40" digitado como 0,40 (bug real reportado ao vivo em
 * 06/08/2026 na Calculadora Rapida de Comissionamento, nao era erro de
 * digitacao do usuario). Todo campo percentual/decimal de digitacao livre
 * deve usar type="text" + sanitizeDecimalInput no onChange + parseDecimalInput
 * na leitura, nunca type="number".
 */
export function parseDecimalInput(value: string): number {
  if (!value) return 0;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Formata um number real (vindo do banco, ex: ask_price_floor) no mesmo padrao visual de maskCurrencyBRLInput, para popular campos mascarados ao carregar dado existente. */
export function formatCurrencyBRLFromNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Moedas aceitas na Bolsa de Ativos (Marketplace de Capitais). BRL continua o padrao em todo o resto do portal. */
export type CmCurrency = "BRL" | "USD" | "EUR";

export const CM_CURRENCY_SYMBOL: Record<CmCurrency, string> = { BRL: "R$", USD: "$", EUR: "€" };
const CM_CURRENCY_LOCALE: Record<CmCurrency, string> = { BRL: "pt-BR", USD: "en-US", EUR: "en-US" };

/** Mesma logica de maskCurrencyBRLInput, mas parametrizada por moeda (separador decimal/milhar muda entre BRL e USD/EUR). */
export function maskCurrencyInput(value: string, currency: CmCurrency = "BRL"): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  return (cents / 100).toLocaleString(CM_CURRENCY_LOCALE[currency], { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Formata um number vindo do banco no padrao visual de maskCurrencyInput, para popular campo mascarado ja existente. */
export function formatCurrencyFromNumber(value: number | null | undefined, currency: CmCurrency = "BRL"): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return value.toLocaleString(CM_CURRENCY_LOCALE[currency], { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function abbreviateName(fullName: string): string {
  const parts = fullName.trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function truncate(str: string, length = 50): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export function generateCode(prefix: string): string {
  const year = new Date().getFullYear().toString().slice(-2);
  const random = Math.floor(Math.random() * 900000 + 100000);
  return `${prefix}-${year}-${random}`;
}

export function relativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "agora";
  if (diffMins < 60) return `${diffMins}min atrás`;
  if (diffHours < 24) return `${diffHours}h atrás`;
  if (diffDays < 7) return `${diffDays}d atrás`;
  return formatDate(date);
}
