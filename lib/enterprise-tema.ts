/**
 * Tema visual do Enterprise white label: validação, tons derivados (OKLCH), contraste WCAG e as
 * variáveis CSS --wl-*. Módulo PURO (sem banco, sem rede): usável no servidor e no navegador.
 * BRIEF docs/briefs/2026-11-21_tema-visual-enterprise-manual-de-marca.md
 */
import cores from "./tema-enterprise-cores.json";

export interface TemaEnterprise {
  cor_principal: string;
  cor_acento: string;
  logo_claro_url?: string | null;
  icone_url?: string | null;
}

export type PapelCor = keyof typeof cores.papeis;
export const PAPEIS = Object.keys(cores.papeis) as PapelCor[];
/** Cor V3 de cada papel (a primeira da lista): padrão das variáveis --wl-*. */
export const COR_V3: Record<PapelCor, string> = Object.fromEntries(
  PAPEIS.map((p) => [p, cores.papeis[p][0]]),
) as Record<PapelCor, string>;

const HEX = /^#[0-9a-fA-F]{6}$/;

// ─── Conversões ─────────────────────────────────────────────────────────────
type RGB = [number, number, number]; // 0..1, sRGB com gama

export function hexParaRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as RGB;
}

export function rgbParaHex([r, g, b]: RGB): string {
  const c = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

const paraLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const paraGama = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

/** sRGB → OKLCH ([L 0..1, C, H graus]). */
export function rgbParaOklch(rgb: RGB): [number, number, number] {
  const [r, g, b] = rgb.map(paraLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.sqrt(A * A + B * B);
  const H = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return [L, C, H];
}

/** OKLCH → sRGB sem cortar (pode sair de 0..1). */
function oklchParaRgbBruto(L: number, C: number, H: number): RGB {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return [paraGama(r), paraGama(g), paraGama(bb)];
}

/** OKLCH → hex, reduzindo o croma até caber no sRGB. */
export function oklchParaHex(L: number, C: number, H: number): string {
  let c = C;
  for (let i = 0; i < 40; i++) {
    const rgb = oklchParaRgbBruto(L, c, H);
    if (rgb.every((v) => v >= -0.0005 && v <= 1.0005)) return rgbParaHex(rgb);
    c *= 0.9;
  }
  return rgbParaHex(oklchParaRgbBruto(L, 0, H));
}

// ─── Contraste WCAG ─────────────────────────────────────────────────────────
export function luminancia(hex: string): number {
  const [r, g, b] = hexParaRgb(hex).map(paraLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// ─── Tons derivados ─────────────────────────────────────────────────────────
/**
 * Fórmula do BRIEF, em OKLCH a partir da principal P e do acento A: fundo = L×0,55; fundo-2 =
 * L×0,62; base = L×0,72; cartão = L×0,86; cartão-2 = L×0,93; médio = L×1,10 (máx. 0,45);
 * acento e acento-2 = A; texto = branco; texto-2 = L 0,72 e croma×0,35; texto-3 = L 0,86 e croma×0,2.
 */
export function tonsDerivados(tema: Pick<TemaEnterprise, "cor_principal" | "cor_acento">): Record<PapelCor, string> {
  const [L, C, H] = rgbParaOklch(hexParaRgb(tema.cor_principal));
  const acento = tema.cor_acento.toUpperCase();
  return {
    fundo: oklchParaHex(L * 0.55, C, H),
    "fundo-2": oklchParaHex(L * 0.62, C, H),
    base: oklchParaHex(L * 0.72, C, H),
    cartao: oklchParaHex(L * 0.86, C, H),
    "cartao-2": oklchParaHex(L * 0.93, C, H),
    medio: oklchParaHex(Math.min(L * 1.1, 0.45), C, H),
    acento,
    "acento-2": acento,
    texto: "#FFFFFF",
    "texto-2": oklchParaHex(0.72, C * 0.35, H),
    "texto-3": oklchParaHex(0.86, C * 0.2, H),
  };
}

export interface FalhaContraste { descricao: string; razao: number }

/** Pares que precisam de 4,5:1 (WCAG AA). Lista vazia = cores aprovadas. */
export function verificarContraste(tema: Pick<TemaEnterprise, "cor_principal" | "cor_acento">): FalhaContraste[] {
  const t = tonsDerivados(tema);
  const pares: [string, string, string][] = [
    ["texto branco sobre a cor principal", t.texto, tema.cor_principal],
    ["texto branco sobre os cartões", t.texto, t.cartao],
    ["texto branco sobre o tom médio", t.texto, t.medio],
    ["texto secundário sobre os cartões", t["texto-2"], t.cartao],
    ["cor principal sobre o acento", tema.cor_principal, t.acento],
    ["acento como texto sobre o fundo", t.acento, t.fundo],
    ["acento como texto sobre a base", t.acento, t.base],
    ["acento como texto sobre os cartões", t.acento, t.cartao],
  ];
  return pares
    .map(([descricao, a, b]) => ({ descricao, razao: Math.round(contraste(a, b) * 100) / 100 }))
    .filter((p) => p.razao < 4.5);
}

// ─── Validação ──────────────────────────────────────────────────────────────
/**
 * Valida o jsonb do banco (na gravação e de novo na leitura). Inválido = null (sem tema).
 * `prefixoBucket` = URL pública do bucket white-label; sem ele, URLs são descartadas.
 */
export function validarTema(bruto: unknown, prefixoBucket?: string): TemaEnterprise | null {
  if (!bruto || typeof bruto !== "object") return null;
  const o = bruto as Record<string, unknown>;
  if (typeof o.cor_principal !== "string" || !HEX.test(o.cor_principal)) return null;
  if (typeof o.cor_acento !== "string" || !HEX.test(o.cor_acento)) return null;
  const url = (v: unknown) =>
    typeof v === "string" && !!prefixoBucket && v.startsWith(prefixoBucket) && !/[\s"'<>()]/.test(v) ? v : null;
  return {
    cor_principal: o.cor_principal.toUpperCase(),
    cor_acento: o.cor_acento.toUpperCase(),
    logo_claro_url: url(o.logo_claro_url),
    icone_url: url(o.icone_url),
  };
}

/** Prefixo público do bucket white-label do Supabase do projeto. */
export function prefixoBucketWhiteLabel(supabaseUrl: string | undefined): string | undefined {
  if (!supabaseUrl) return undefined;
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/white-label/`;
}

/** Bloco `:root{...}` com as variáveis --wl-* do tema (só para Enterprise com tema válido). */
export function cssVariaveis(tema: TemaEnterprise): string {
  const t = tonsDerivados(tema);
  return `:root{--wl-principal:${tema.cor_principal};${PAPEIS.map((p) => `--wl-${p}:${t[p]};`).join("")}}`;
}
