// Tabelas e contas da engenharia de avaliações usadas pela Avaliação Técnica V3 (19/10/2026).
// Tudo aqui é determinístico e com fonte: a IA só descreve o imóvel e os anúncios; quem faz
// a conta é este arquivo, do mesmo jeito que os laudos de referência (Eagle Consult — rural;
// Engebanc — urbano) e os sistemas de mercado (SisDEA, INFER) fazem no tratamento por fatores.

// ── Rural: classes de capacidade de uso × situação (Nota/Índice Agronômico) ────────────────
// Escala de Mendes Sobrinho / Kozma, usada pelo INCRA (Nota Agronômica), pela Eagle Consult
// ("Fator classe e situação") e por laudos de VTN municipal. Classes do Sistema de Capacidade
// de Uso (Lepsch / SBCS).
export const CLASSES = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"] as const;
export type ClasseCapacidade = (typeof CLASSES)[number];
export const INDICE_CLASSE: Record<ClasseCapacidade, number> = {
  I: 1.0, II: 0.95, III: 0.75, IV: 0.55, V: 0.5, VI: 0.4, VII: 0.3, VIII: 0.2,
};
export const DESCRICAO_CLASSE: Record<ClasseCapacidade, string> = {
  I: "culturas anuais sem práticas especiais de conservação",
  II: "culturas anuais com práticas simples de conservação",
  III: "culturas anuais com práticas intensivas de conservação",
  IV: "culturas anuais ocasionais; limitações severas",
  V: "plana, mas imprópria para lavoura (encharcamento); pasto/floresta",
  VI: "pastagem, fruticultura e floresta com práticas simples",
  VII: "pastagem e floresta com práticas complexas",
  VIII: "preservação (APP, mata, relevo excessivo, rocha)",
};

export const SITUACOES = ["OTIMA", "MUITO_BOA", "BOA", "DESFAVORAVEL", "MA", "PESSIMA"] as const;
export type SituacaoAcesso = (typeof SITUACOES)[number];
export const INDICE_SITUACAO: Record<SituacaoAcesso, number> = {
  OTIMA: 1.0, MUITO_BOA: 0.95, BOA: 0.9, DESFAVORAVEL: 0.8, MA: 0.75, PESSIMA: 0.7,
};
export const DESCRICAO_SITUACAO: Record<SituacaoAcesso, string> = {
  OTIMA: "estrada asfaltada, distância limitada, tráfego permanente",
  MUITO_BOA: "estrada de 1ª classe não asfaltada, tráfego permanente",
  BOA: "estrada não pavimentada, tráfego permanente",
  DESFAVORAVEL: "estradas e servidões de passagem; tráfego sem condições na chuva",
  MA: "fechos nas servidões; problemas sérios na estação chuvosa",
  PESSIMA: "fechos e córregos sem ponte; problemas sérios mesmo na seca",
};
export const SITUACAO_LABEL: Record<SituacaoAcesso, string> = {
  OTIMA: "Ótima", MUITO_BOA: "Muito boa", BOA: "Boa", DESFAVORAVEL: "Desfavorável", MA: "Má", PESSIMA: "Péssima",
};

export interface ClasseArea { classe: ClasseCapacidade; pct: number; base?: string | null }

/** Normaliza a distribuição de classes para somar 100% (descarta classe inválida). */
export function normalizarClasses(cs: { classe?: unknown; pct?: unknown; base?: unknown }[] | null | undefined): ClasseArea[] {
  const ok = (cs ?? [])
    .map((c) => ({ classe: String(c.classe ?? "").toUpperCase().trim() as ClasseCapacidade, pct: Number(c.pct), base: c.base ? String(c.base) : null }))
    .filter((c) => (CLASSES as readonly string[]).includes(c.classe) && Number.isFinite(c.pct) && c.pct > 0);
  const soma = ok.reduce((s, c) => s + c.pct, 0);
  if (soma <= 0) return [];
  const junt = new Map<ClasseCapacidade, ClasseArea>();
  for (const c of ok) {
    const prev = junt.get(c.classe);
    junt.set(c.classe, { classe: c.classe, pct: (prev?.pct ?? 0) + (c.pct * 100) / soma, base: prev?.base ?? c.base });
  }
  return CLASSES.filter((k) => junt.has(k)).map((k) => junt.get(k)!);
}

/**
 * Junta a área preservada (Reserva Legal + APP) como classe VIII às classes físicas da área
 * aberta. A MESMA regra vale para o avaliando e para os anúncios — a preservação é o maior entre
 * o informado e a Reserva Legal exigida no bioma — para o fator classe-situação comparar igual.
 */
export function comPreservacao(fisicas: ClasseArea[], pctPreservacao: number): ClasseArea[] {
  const p = Math.min(100, Math.max(0, pctPreservacao));
  if (fisicas.length === 0) return p > 0 ? [{ classe: "VIII", pct: 100, base: "preservação" }] : [];
  const out = fisicas.map((c) => ({ ...c, pct: (c.pct * (100 - p)) / 100 }));
  if (p > 0) {
    const viii = out.find((c) => c.classe === "VIII");
    if (viii) viii.pct += p;
    else out.push({ classe: "VIII", pct: p, base: "Reserva Legal + APP" });
  }
  return normalizarClasses(out);
}

/** Índice agronômico = Σ (% da classe × índice da classe) × índice da situação. */
export function indiceAgronomico(classes: ClasseArea[], situacao: SituacaoAcesso): number | null {
  if (classes.length === 0) return null;
  const ic = classes.reduce((s, c) => s + (c.pct / 100) * INDICE_CLASSE[c.classe], 0);
  return Math.round(ic * INDICE_SITUACAO[situacao] * 1000) / 1000;
}

export function situacaoValida(s: unknown): SituacaoAcesso | null {
  const t = String(s ?? "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_");
  return (SITUACOES as readonly string[]).includes(t) ? (t as SituacaoAcesso) : null;
}

// ── Relevo (Embrapa, classes de declividade) ─────────────────────────────────────────────
export const RELEVO_EMBRAPA: { classe: string; ate: number }[] = [
  { classe: "Plano (0–3%)", ate: 3 },
  { classe: "Suave ondulado (3–8%)", ate: 8 },
  { classe: "Ondulado (8–20%)", ate: 20 },
  { classe: "Forte ondulado (20–45%)", ate: 45 },
  { classe: "Montanhoso (45–75%)", ate: 75 },
  { classe: "Escarpado (>75%)", ate: Infinity },
];

// ── Depreciação: Ross-Heidecke ──────────────────────────────────────────────────────────
// Estado de conservação (Heidecke): % de depreciação física. Mesmos valores dos laudos
// (Eagle: casa 30/70 anos estado "f" → 0,46; casa sede 20/70 "d" → 0,75).
export const ESTADOS = ["a", "b", "c", "d", "e", "f", "g", "h", "i"] as const;
export type EstadoConservacao = (typeof ESTADOS)[number];
export const HEIDECKE: Record<EstadoConservacao, number> = {
  a: 0, b: 0.0032, c: 0.0252, d: 0.0809, e: 0.181, f: 0.332, g: 0.526, h: 0.752, i: 1,
};
export const ESTADO_LABEL: Record<EstadoConservacao, string> = {
  a: "novo", b: "entre novo e regular", c: "regular", d: "entre regular e reparos simples", e: "reparos simples",
  f: "entre reparos simples e importantes", g: "reparos importantes", h: "entre reparos importantes e sem valor", i: "sem valor",
};

/** Converte o texto de conservação ("regular", "reparos simples"…) ou a letra para o estado de Heidecke. */
export function estadoDe(v: unknown): EstadoConservacao | null {
  const s = String(v ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  if (!s) return null;
  if ((ESTADOS as readonly string[]).includes(s)) return s as EstadoConservacao;
  if (/sem valor/.test(s)) return /entre/.test(s) ? "h" : "i";
  if (/importante/.test(s)) return /entre/.test(s) && /simples/.test(s) ? "f" : /entre/.test(s) ? "h" : "g";
  if (/simples/.test(s)) return /entre/.test(s) ? "d" : "e";
  if (/novo/.test(s)) return /regular/.test(s) ? "b" : "a";
  if (/regular/.test(s)) return "c";
  if (/otim|excelent|muito bom/.test(s)) return "b";
  if (/\bbom\b|boa/.test(s)) return "c";
  if (/ruim|precari/.test(s)) return "g";
  return null;
}

/** Coeficiente de depreciação Ross-Heidecke: 1 − [α + (1 − α)·c], α = ½(x + x²), x = idade/vida útil. */
export function rossHeidecke(idade: number | null | undefined, vidaUtil: number, estado: EstadoConservacao | null | undefined): number {
  const x = Math.min(1, Math.max(0, (idade ?? 0) / Math.max(1, vidaUtil)));
  const alfa = 0.5 * (x + x * x);
  const c = HEIDECKE[estado ?? "c"];
  return Math.max(0, Math.round((1 - (alfa + (1 - alfa) * c)) * 1000) / 1000);
}

/** Vida útil referencial (anos). Eagle: edificações 70, coberturas/telheiros 30; Engebanc usa 80 em casa de padrão médio-alto. */
export function vidaUtil(tipo: string | null | undefined): number {
  const t = String(tipo ?? "").toLowerCase();
  if (/cobertura|telheiro|alpendre|curral|cerca|barrac|estabul|pocilga|aviario|aviário|brete|mangueir/.test(t)) return 30;
  if (/galp[aã]o|dep[oó]sito|armaz|silo|garagem|oficina/.test(t)) return 50;
  if (/apartament|sala|loja|comercial|escrit/.test(t)) return 60;
  return 70;
}

// ── Fator área (Abunahman) ──────────────────────────────────────────────────────────────
// (Área do comparável / área do avaliando)^(1/4) se a diferença ≤ 30%, senão ^(1/8).
// Conferido no laudo Engebanc 847/2026 (300 × 700 m² → 0,90; 598 × 700 m² → 0,96).
export function fatorAreaAbunahman(areaComparavel: number, areaAvaliando: number): number {
  if (!(areaComparavel > 0) || !(areaAvaliando > 0)) return 1;
  const r = areaComparavel / areaAvaliando;
  const exp = Math.abs(areaComparavel - areaAvaliando) / areaAvaliando <= 0.3 ? 0.25 : 0.125;
  return Math.round(Math.pow(r, exp) * 1000) / 1000;
}

// ── Padrão construtivo (urbano) pelo CUB ────────────────────────────────────────────────
export const PADROES = ["BAIXO", "MEDIO_BAIXO", "MEDIO", "MEDIO_ALTO", "ALTO"] as const;
export type PadraoDetalhe = (typeof PADROES)[number];
export const PADRAO_LABEL: Record<PadraoDetalhe, string> = {
  BAIXO: "Baixo", MEDIO_BAIXO: "Médio-baixo", MEDIO: "Médio", MEDIO_ALTO: "Médio-alto", ALTO: "Alto",
};
export function padraoDetalheDe(v: unknown): PadraoDetalhe | null {
  const s = String(v ?? "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\s-]+/g, "_");
  if ((PADROES as readonly string[]).includes(s)) return s as PadraoDetalhe;
  if (/LUXO|ALTO_PADRAO|SUPERIOR|FINO/.test(s)) return "ALTO";
  if (/ECONOM|POPULAR|SIMPLES|PROLET/.test(s)) return "BAIXO";
  return null;
}

/** CUB (R$/m²) do padrão pelo projeto-padrão R1 (casa) ou R8 (edifício); intermediários = média. */
export function cubDoPadrao(cub: Record<string, number> | null | undefined, padrao: PadraoDetalhe, edificio: boolean): number | null {
  if (!cub) return null;
  const p = edificio ? "R8" : "R1";
  const g = (s: string) => (cub[`${p}-${s}`] > 0 ? cub[`${p}-${s}`] : null);
  const B = g("B"), N = g("N"), A = g("A");
  const media = (a: number | null, b: number | null) => (a && b ? (a + b) / 2 : null);
  return padrao === "BAIXO" ? B : padrao === "MEDIO" ? N : padrao === "ALTO" ? A : padrao === "MEDIO_BAIXO" ? media(B, N) : media(N, A);
}

// ── Estatística da amostra (intervalo de confiança de 80%, t de Student) ─────────────────
/** t de Student bicaudal 80% (t0,90) por graus de liberdade. Eagle: n = 5 → 1,533. */
const T80: Record<number, number> = {
  1: 3.078, 2: 1.886, 3: 1.638, 4: 1.533, 5: 1.476, 6: 1.44, 7: 1.415, 8: 1.397, 9: 1.383, 10: 1.372,
  11: 1.363, 12: 1.356, 13: 1.35, 14: 1.345, 15: 1.341, 16: 1.337, 17: 1.333, 18: 1.33, 19: 1.328, 20: 1.325,
  25: 1.316, 30: 1.31, 40: 1.303, 60: 1.296,
};
export function tStudent80(gl: number): number {
  if (gl < 1) return T80[1];
  if (T80[gl]) return T80[gl];
  const ks = Object.keys(T80).map(Number).sort((a, b) => a - b);
  const maior = ks.find((k) => k >= gl);
  return maior ? T80[maior] : 1.282;
}

export interface Estatistica {
  n: number;
  media: number;
  desvio: number;
  cv_pct: number;
  t: number;
  ic_inferior: number;
  ic_superior: number;
  /** Amplitude do IC de 80% em % da média (critério do grau de precisão). */
  amplitude_pct: number;
  hipotese_rejeicao_pct: number;
}

export function estatistica(valores: number[], hipotese = 30): Estatistica | null {
  const v = valores.filter((x) => Number.isFinite(x) && x > 0);
  const n = v.length;
  if (n === 0) return null;
  const media = v.reduce((s, x) => s + x, 0) / n;
  const desvio = n > 1 ? Math.sqrt(v.reduce((s, x) => s + (x - media) ** 2, 0) / (n - 1)) : 0;
  const t = tStudent80(n - 1);
  const meia = n > 1 ? (t * desvio) / Math.sqrt(n) : 0;
  return {
    n, media, desvio, cv_pct: media > 0 ? (desvio / media) * 100 : 0, t,
    ic_inferior: media - meia, ic_superior: media + meia,
    amplitude_pct: media > 0 ? ((2 * meia) / media) * 100 : 0,
    hipotese_rejeicao_pct: hipotese,
  };
}

// ── Graus de fundamentação e precisão (NBR 14653, tratamento por fatores) ────────────────
export type Grau = "III" | "II" | "I" | "FORA";

/** Grau de precisão: amplitude do IC 80% ≤ 30% → III, ≤ 40% → II, ≤ 50% → I. */
export function grauPrecisao(amplitudePct: number | null | undefined): Grau | null {
  if (amplitudePct === null || amplitudePct === undefined || !Number.isFinite(amplitudePct)) return null;
  return amplitudePct <= 30 ? "III" : amplitudePct <= 40 ? "II" : amplitudePct <= 50 ? "I" : "FORA";
}

export interface ItemFundamentacao { item: string; atendido: string; grau: Grau; pontos: number }
export interface GrauFundamentacao { grau: Grau; pontos: number; itens: ItemFundamentacao[] }

/**
 * Enquadramento pela tabela de tratamento por fatores (a mesma do laudo Engebanc, Tabelas 3 e 4):
 *  1 caracterização do avaliando · 2 quantidade de dados (12/5/3) · 3 identificação dos dados ·
 *  4 intervalo admissível do conjunto de fatores (0,80–1,25 / 0,50–2,00 / 0,40–2,50).
 * Sem vistoria presencial a V3 não atinge o grau III nos itens 1 e 3.
 */
export function grauFundamentacao(o: {
  n: number; caracterizacaoCompleta: boolean; dadosIdentificados: boolean; fatorMin: number | null; fatorMax: number | null;
}): GrauFundamentacao {
  const pt = (g: Grau) => (g === "III" ? 3 : g === "II" ? 2 : g === "I" ? 1 : 0);
  const i1: Grau = o.caracterizacaoCompleta ? "II" : "I";
  const i2: Grau = o.n >= 12 ? "III" : o.n >= 5 ? "II" : o.n >= 3 ? "I" : "FORA";
  const i3: Grau = o.dadosIdentificados ? "II" : "I";
  let i4: Grau = "FORA";
  if (o.fatorMin !== null && o.fatorMax !== null) {
    const dentro = (a: number, b: number) => o.fatorMin! >= a && o.fatorMax! <= b;
    i4 = dentro(0.8, 1.25) ? "III" : dentro(0.5, 2) ? "II" : dentro(0.4, 2.5) ? "I" : "FORA";
    if (o.n < 5 && i4 !== "III") i4 = "FORA"; // com menos de 5 dados, o conjunto deve ficar em 0,80–1,25
  }
  const itens: ItemFundamentacao[] = [
    { item: "Caracterização do imóvel avaliando", atendido: o.caracterizacaoCompleta ? "completa quanto aos fatores utilizados (sem vistoria presencial)" : "situação paradigma", grau: i1, pontos: pt(i1) },
    { item: "Quantidade de dados de mercado utilizados", atendido: `${o.n} dado(s)`, grau: i2, pontos: pt(i2) },
    { item: "Identificação dos dados de mercado", atendido: o.dadosIdentificados ? "características e fonte de todos os dados (sem fotos/vistoria do avaliador)" : "dados parcialmente identificados", grau: i3, pontos: pt(i3) },
    { item: "Intervalo do conjunto de fatores", atendido: o.fatorMin !== null && o.fatorMax !== null ? `${o.fatorMin.toFixed(2)} a ${o.fatorMax.toFixed(2)}` : "—", grau: i4, pontos: pt(i4) },
  ];
  const pontos = itens.reduce((s, i) => s + i.pontos, 0);
  const g = (k: number) => itens[k].grau;
  const min = (gr: Grau, alvo: Grau) => pt(gr) >= pt(alvo);
  let grau: Grau = "FORA";
  if (pontos >= 10 && g(1) === "III" && g(3) === "III" && min(g(0), "II") && min(g(2), "II")) grau = "III";
  else if (pontos >= 6 && min(g(1), "II") && min(g(3), "II") && min(g(0), "I") && min(g(2), "I")) grau = "II";
  else if (pontos >= 4 && itens.every((i) => i.grau !== "FORA")) grau = "I";
  return { grau, pontos, itens };
}

/** Faixa em que um fator isolado é aceito (NBR: conjunto até 0,40–2,50 no grau I). */
export const FATOR_TOTAL_MIN = 0.5;
export const FATOR_TOTAL_MAX = 2.0;
