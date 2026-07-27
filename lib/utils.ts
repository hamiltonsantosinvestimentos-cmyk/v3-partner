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
