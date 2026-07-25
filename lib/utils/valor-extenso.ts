const UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const DEZ_A_DEZENOVE = ["dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function tresDigitosPorExtenso(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";

  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];

  if (c > 0) partes.push(CENTENAS[c]);

  if (resto > 0) {
    if (resto < 10) {
      partes.push(UNIDADES[resto]);
    } else if (resto < 20) {
      partes.push(DEZ_A_DEZENOVE[resto - 10]);
    } else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u > 0 ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d]);
    }
  }

  return partes.join(" e ");
}

function inteiroPorExtenso(n: number): { texto: string; terminaEmMilhao: boolean } {
  if (n === 0) return { texto: "zero", terminaEmMilhao: false };

  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const centenas = n % 1000;

  const partes: string[] = [];

  if (milhoes > 0) {
    partes.push(milhoes === 1 ? "um milhão" : `${tresDigitosPorExtenso(milhoes)} milhões`);
  }
  if (milhares > 0) {
    partes.push(milhares === 1 ? "mil" : `${tresDigitosPorExtenso(milhares)} mil`);
  }
  if (centenas > 0) {
    partes.push(tresDigitosPorExtenso(centenas));
  }

  // "de" é obrigatório logo após milhão/milhões quando não há mil/centenas
  // em seguida (ex: "um milhão de reais", nunca "um milhão reais").
  const terminaEmMilhao = milhoes > 0 && milhares === 0 && centenas === 0;

  if (partes.length <= 1) return { texto: partes[0] ?? "zero", terminaEmMilhao };

  const ultimo = partes[partes.length - 1];
  const resto = partes.slice(0, -1);
  return { texto: `${resto.join(", ")} e ${ultimo}`, terminaEmMilhao };
}

// Converte um valor em reais (ex: 2475200.00) para texto por extenso em pt-BR,
// no padrão usado em instrumentos contratuais V3 (ex: contratos, LOI).
export function valorEmReaisPorExtenso(valor: number): string {
  const inteiro = Math.floor(valor);
  const centavos = Math.round((valor - inteiro) * 100);

  const { texto: reaisTexto, terminaEmMilhao } = inteiroPorExtenso(inteiro);
  const reaisLabel = inteiro === 1 ? "real" : "reais";
  const conector = terminaEmMilhao ? "de" : "";

  if (centavos === 0) {
    return [reaisTexto, conector, reaisLabel].filter(Boolean).join(" ");
  }

  const centavosTexto = tresDigitosPorExtenso(centavos);
  const centavosLabel = centavos === 1 ? "centavo" : "centavos";

  return [reaisTexto, conector, reaisLabel, "e", centavosTexto, centavosLabel].filter(Boolean).join(" ");
}
