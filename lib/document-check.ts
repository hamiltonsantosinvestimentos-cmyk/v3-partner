// Validação de CPF e de CNPJ (numérico legado e alfanumérico), módulo 11.
// CNPJ alfanumérico: cada caractere vale (código ASCII - 48), então letras A-Z valem 17 a 42
// e dígitos 0 a 9 valem 0 a 9. Os dois últimos caracteres são sempre dígitos verificadores.
// Nunca limpar com replace(/\D/g, ""): apagaria as letras do CNPJ novo.

export type DocKind = "cpf" | "cnpj";

/** Mantém só letras e dígitos, em maiúsculas. */
export function cleanDocument(raw: string | null | undefined): string {
  return (raw ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}

export function isValidCpf(digits: string): boolean {
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  const d = digits.split("").map(Number);
  for (const n of [9, 10]) {
    const sum = d.slice(0, n).reduce((acc, v, i) => acc + v * (n + 1 - i), 0);
    if (((sum * 10) % 11) % 10 !== d[n]) return false;
  }
  return true;
}

function cnpjDv(base: string): number {
  // Pesos de 2 a 9, da direita para a esquerda, reiniciando em 2.
  let sum = 0;
  let weight = 2;
  for (let i = base.length - 1; i >= 0; i--) {
    sum += (base.charCodeAt(i) - 48) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCnpj(value: string): boolean {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(value) || /^(.)\1{13}$/.test(value)) return false;
  const dv1 = cnpjDv(value.slice(0, 12));
  const dv2 = cnpjDv(value.slice(0, 12) + dv1);
  return value.endsWith(`${dv1}${dv2}`);
}

/** Detecta o tipo pelo tamanho e valida. Devolve null se não for CPF nem CNPJ válido. */
export function detectDocument(raw: string | null | undefined): { kind: DocKind; value: string } | null {
  const value = cleanDocument(raw);
  if (value.length === 11 && isValidCpf(value)) return { kind: "cpf", value };
  if (value.length === 14 && isValidCnpj(value)) return { kind: "cnpj", value };
  return null;
}
