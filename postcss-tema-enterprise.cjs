/**
 * Plugin PostCSS do tema do Enterprise white label.
 * BRIEF docs/briefs/2026-11-21_tema-visual-enterprise-manual-de-marca.md (QA LIBERADO rodada 4).
 *
 * Roda DEPOIS do @tailwindcss/postcss (cru no `next dev`, minificado pelo Lightning CSS no `next
 * build`) e troca cada cor da V3 (lib/tema-enterprise-cores.json) por `var(--wl-<papel>, <cor V3>)`.
 * Sem tema, a variável não existe e vale a cor de hoje: a V3 não muda.
 *
 * Regras:
 * - Nunca cria regra, bloco ou declaração: só reescreve valores, no lugar onde estão.
 * - Compara cor por VALOR (hex 3/6/8 sem diferenciar maiúsculas, rgb/rgba com vírgula ou espaço,
 *   oklab/lab/oklch), não por texto.
 * - Cor opaca: `var(--wl-x, <literal original>)`.
 * - Cor translúcida que é a RESERVA de um par `@supports (color: color-mix(...))` do Tailwind (mesmo
 *   seletor e propriedade, com o @supports irmão no mesmo pai, aninhado no dev ou desaninhado no
 *   build): fica intacta (navegador sem color-mix vê a V3 de hoje).
 * - Cor translúcida sem par: `color-mix(in srgb, var(--wl-x, #RRGGBB) N%, transparent)`.
 */
const cores = require("./lib/tema-enterprise-cores.json");

const TOLERANCIA = 2.5 / 255;

// ── tabela: papel → rgb (0..1) ──────────────────────────────────────────────
const TABELA = [];
for (const [papel, lista] of Object.entries(cores.papeis)) {
  for (const hex of lista) TABELA.push({ papel, hex: hex.toUpperCase(), rgb: hexRgb(hex) });
}

function hexRgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}

const gama = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

function oklabRgb(L, A, B) {
  const l = Math.pow(L + 0.3963377774 * A + 0.2158037573 * B, 3);
  const m = Math.pow(L - 0.1055613458 * A - 0.0638541728 * B, 3);
  const s = Math.pow(L - 0.0894841775 * A - 1.291485548 * B, 3);
  return {
    r: gama(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: gama(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: gama(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

// CIE Lab (D50) → sRGB
function labRgb(L, a, b) {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const inv = (t) => (t > 6 / 29 ? t * t * t : 3 * (6 / 29) * (6 / 29) * (t - 4 / 29));
  const X = 0.96422 * inv(fx), Y = inv(fy), Z = 0.82521 * inv(fz);
  // D50 → D65 (Bradford) e XYZ → sRGB linear
  const x = 0.9555766 * X - 0.0230393 * Y + 0.0631636 * Z;
  const y = -0.0282895 * X + 1.0099416 * Y + 0.0210077 * Z;
  const z = 0.0122982 * X - 0.020483 * Y + 1.3299098 * Z;
  return {
    r: gama(3.2404542 * x - 1.5371385 * y - 0.4985314 * z),
    g: gama(-0.969266 * x + 1.8760108 * y + 0.041556 * z),
    b: gama(0.0556434 * x - 0.2040259 * y + 1.0572252 * z),
  };
}

function num(s, escala100) {
  s = String(s).trim();
  if (s.endsWith("%")) return parseFloat(s) / 100 * (escala100 ?? 1);
  return parseFloat(s);
}

function alfa(s) {
  if (s === undefined) return 1;
  s = String(s).trim();
  return s.endsWith("%") ? parseFloat(s) / 100 : parseFloat(s);
}

/** Interpreta uma cor CSS (texto exato encontrado) → {r,g,b,a} ou null. */
function interpretar(txt) {
  const t = txt.trim().toLowerCase();
  if (t.startsWith("#")) return /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(t) ? hexRgb(t) : null;
  const m = /^(rgba?|oklab|oklch|lab)\((.*)\)$/.exec(t);
  if (!m) return null;
  const [corpo, a] = m[2].split("/");
  const partes = corpo.replace(/,/g, " ").trim().split(/\s+/);
  const extraA = partes.length === 4 ? partes.pop() : undefined; // rgba(r,g,b,a)
  const alpha = alfa(a ?? extraA);
  if (partes.length !== 3 || partes.some((p) => p === "none" || p.startsWith("var"))) return null;
  if (m[1] === "rgb" || m[1] === "rgba") {
    const c = partes.map((p) => (p.endsWith("%") ? parseFloat(p) / 100 : parseFloat(p) / 255));
    return { r: c[0], g: c[1], b: c[2], a: alpha };
  }
  if (m[1] === "oklab") {
    return { ...oklabRgb(num(partes[0]), num(partes[1], 0.4), num(partes[2], 0.4)), a: alpha };
  }
  if (m[1] === "oklch") {
    const L = num(partes[0]), C = num(partes[1], 0.4), H = (parseFloat(partes[2]) * Math.PI) / 180;
    return { ...oklabRgb(L, C * Math.cos(H), C * Math.sin(H)), a: alpha };
  }
  return { ...labRgb(num(partes[0], 100), num(partes[1], 125), num(partes[2], 125)), a: alpha };
}

function papelDa(cor) {
  for (const e of TABELA) {
    if (Math.abs(e.rgb.r - cor.r) <= TOLERANCIA && Math.abs(e.rgb.g - cor.g) <= TOLERANCIA && Math.abs(e.rgb.b - cor.b) <= TOLERANCIA) return e;
  }
  return null;
}

// Cores: hex e funções de cor (sem aninhamento de parênteses dentro).
const RE_COR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|oklab|oklch|lab)\([^()]*\)/g;

function ehSupportsColorMix(no) {
  return no && no.type === "atrule" && no.name === "supports" && /color-mix/.test(no.params);
}

/** A declaração é a reserva de um par @supports(color-mix) do Tailwind? */
function ehReservaDePar(decl) {
  const regra = decl.parent;
  if (!regra) return false;
  // Forma aninhada (next dev): o @supports é filho da própria regra e redeclara a propriedade.
  if (regra.nodes && regra.nodes.some((n) => ehSupportsColorMix(n) && n.nodes && n.nodes.some((d) => d.type === "decl" && d.prop === decl.prop))) {
    return true;
  }
  // Forma desaninhada (next build): @supports irmão da regra, no mesmo pai, com o mesmo seletor.
  if (regra.type === "rule" && regra.parent && regra.parent.nodes) {
    const irmaos = regra.parent.nodes;
    const i = irmaos.indexOf(regra);
    for (let j = i + 1; j < irmaos.length && j <= i + 3; j++) {
      const n = irmaos[j];
      if (!ehSupportsColorMix(n) || !n.nodes) continue;
      if (n.nodes.some((r) => r.type === "rule" && r.selector === regra.selector && r.nodes && r.nodes.some((d) => d.type === "decl" && d.prop === decl.prop))) {
        return true;
      }
    }
  }
  return false;
}

function reescrever(valor, ehReserva, contagem) {
  return valor.replace(RE_COR, (txt, offset, inteiro) => {
    // Já protegido (padrão de um var(--wl-...)): não mexe de novo.
    if (inteiro.slice(Math.max(0, offset - 40), offset).includes("var(--wl-")) return txt;
    const cor = interpretar(txt);
    if (!cor) return txt;
    const e = papelDa(cor);
    if (!e) return txt;
    if (cor.a >= 0.999) {
      contagem.n++;
      return `var(--wl-${e.papel}, ${txt})`;
    }
    if (ehReserva) return txt;
    contagem.n++;
    const pct = Math.round(cor.a * 1000) / 10;
    return `color-mix(in srgb, var(--wl-${e.papel}, ${e.hex}) ${pct}%, transparent)`;
  });
}

const plugin = () => ({
  postcssPlugin: "postcss-tema-enterprise",
  OnceExit(root) {
    const contagem = { n: 0 };
    root.walkDecls((decl) => {
      if (!decl.value || decl.prop.startsWith("--wl-")) return;
      if (!RE_COR.test(decl.value)) { RE_COR.lastIndex = 0; return; }
      RE_COR.lastIndex = 0;
      const novo = reescrever(decl.value, ehReservaDePar(decl), contagem);
      if (novo !== decl.value) decl.value = novo;
    });
    if (contagem.n > 0 && process.env.TEMA_ENTERPRISE_LOG !== "0") {
      const origem = (root.source && root.source.input && root.source.input.file) || "css";
      if (/globals\.css$/.test(origem)) console.log(`[tema-enterprise] ${contagem.n} cores trocadas em ${origem.split(/[\\/]/).pop()}`);
    }
  },
});
plugin.postcss = true;

module.exports = plugin;
module.exports._interno = { interpretar, papelDa, reescrever, ehReservaDePar };
