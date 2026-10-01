function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidCPF(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split("").map(Number);

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += digits[i] * (10 - i);
  let check1 = (sum * 10) % 11;
  if (check1 === 10) check1 = 0;
  if (check1 !== digits[9]) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += digits[i] * (11 - i);
  let check2 = (sum * 10) % 11;
  if (check2 === 10) check2 = 0;
  if (check2 !== digits[10]) return false;

  return true;
}

/**
 * Remove tudo que não é [0-9A-Za-z] e força maiúsculas. Usado só para CNPJ,
 * que desde 31/07/2026 (emissão pela Receita/Serpro) aceita letras nas 12
 * primeiras posições -- nunca usar onlyDigits() aqui, que apaga a letra e
 * corrompe o CNPJ novo (achado real 21/09/2026, v3-governance-qa).
 */
function normalizeCnpjChars(value: string): string {
  return value.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

/**
 * Valor de um caractere de CNPJ para o cálculo do dígito verificador: código
 * ASCII menos 48 (dígito "0"-"9" vale 0-9, "A" vale 17, ..., "Z" vale 42).
 * Regra oficial da Receita/Serpro para o CNPJ alfanumérico, módulo 11. Num
 * CNPJ legado (só dígitos) isso é idêntico a Number(char), então o mesmo
 * algoritmo valida os dois formatos sem ramificação.
 */
function cnpjCharValue(c: string): number {
  return c.charCodeAt(0) - 48;
}

export function isValidCNPJ(value: string): boolean {
  const cnpj = normalizeCnpjChars(value);
  if (cnpj.length !== 14) return false;
  if (/^(.)\1{13}$/.test(cnpj)) return false;
  // Os 2 dígitos verificadores continuam sempre numéricos nos dois formatos.
  if (!/^\d{2}$/.test(cnpj.slice(12))) return false;

  const values = cnpj.split("").map(cnpjCharValue);

  const calcCheck = (base: number[]): number => {
    const weights = base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = base.reduce((acc, d, i) => acc + d * weights[i], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const check1 = calcCheck(values.slice(0, 12));
  if (check1 !== values[12]) return false;

  const check2 = calcCheck(values.slice(0, 13));
  if (check2 !== values[13]) return false;

  return true;
}

export function formatCPF(value: string): string {
  const d = onlyDigits(value);
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function formatCNPJ(value: string): string {
  const d = normalizeCnpjChars(value);
  return d.replace(/(.{2})(.{3})(.{3})(.{4})(.{2})/, "$1.$2.$3/$4-$5");
}
