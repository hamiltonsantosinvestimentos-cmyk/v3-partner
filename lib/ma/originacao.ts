// Aba "Originação" da Mesa M&A (BRIEF 2026-10-17, Etapa 1: Ingestão e diagnóstico).
// Fonte única das regras da Etapa 1 no código. O banco repete as mesmas travas
// (migration 20261017a): a tela nunca é a única barreira.

export const ORIGINACAO_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

export type Rotulo = "VERIFICADO" | "DECLARADO_REUNIAO" | "INFERIDO" | "NAO_ENCONTRADO";

export const ROTULO_LABEL: Record<Rotulo, string> = {
  VERIFICADO: "VERIFICADO",
  DECLARADO_REUNIAO: "DECLARADO NA REUNIÃO",
  INFERIDO: "INFERIDO",
  NAO_ENCONTRADO: "NÃO ENCONTRADO",
};

// Catálogo espelhado de ma_origination_units (multissetor). Ordem alfabética pt-BR
// pelo rótulo, como manda a regra 4.1 do BRIEF.
export const UNIDADES = [
  { code: "conteiner", label: "Contêineres", monetaria: false, teto: 1e5 },
  { code: "ha", label: "Hectares", monetaria: false, teto: 1e6 },
  { code: "pessoa", label: "Pessoas", monetaria: false, teto: 1e5 },
  { code: "projeto", label: "Projetos ou contratos", monetaria: false, teto: 1e5 },
  { code: "t", label: "Toneladas", monetaria: false, teto: 1e6 },
  { code: "unidade", label: "Unidades produzidas", monetaria: false, teto: 1e6 },
  { code: "moeda", label: "Valor monetário", monetaria: true, teto: 1e12 },
].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

const UNIT_ALIASES: Record<string, string> = {
  "contêiner": "conteiner", conteiner: "conteiner", conteineres: "conteiner", "contêineres": "conteiner", container: "conteiner",
  ha: "ha", hectare: "ha", hectares: "ha",
  pessoa: "pessoa", pessoas: "pessoa", funcionarios: "pessoa", "funcionários": "pessoa", empregados: "pessoa",
  projeto: "projeto", projetos: "projeto", contrato: "projeto", contratos: "projeto",
  t: "t", tonelada: "t", toneladas: "t",
  unidade: "unidade", unidades: "unidade",
  moeda: "moeda", dinheiro: "moeda",
};

export function normalizeUnit(u: unknown): string | null {
  if (typeof u !== "string" || !u.trim()) return null;
  return UNIT_ALIASES[u.trim().toLowerCase()] ?? null;
}

export const MOEDAS_ISO = ["BRL", "CHF", "CNY", "EUR", "GBP", "JPY", "USD"] as const;

export type FatoInput = {
  tema: string;
  afirmacao: string;
  quem_disse?: string | null;
  rotulo?: Rotulo;
  fonte?: string | null;
  fonte_data?: string | null; // AAAA-MM-DD
  valor_min?: number | null;
  valor_max?: number | null;
  unidade?: string | null;
  moeda?: string | null;
  ausencia?: boolean;
};

/** Mesmas regras dos CHECKs e do trigger do banco. Devolve lista de erros (vazia = válido). */
export function validarFato(f: FatoInput): string[] {
  const erros: string[] = [];
  if (!f.tema?.trim()) erros.push("tema obrigatório");
  if (!f.afirmacao?.trim()) erros.push("afirmação obrigatória");
  const rot = f.rotulo ?? "DECLARADO_REUNIAO";
  if (!(rot in ROTULO_LABEL)) erros.push("rótulo inválido");
  if (rot === "VERIFICADO" && (!f.fonte?.trim() || !f.fonte_data)) erros.push("VERIFICADO exige fonte e data");

  const temMin = f.valor_min != null, temMax = f.valor_max != null, temU = !!f.unidade;
  if (!temMin && !temMax && !temU) {
    if (f.moeda) erros.push("moeda informada sem unidade monetária");
    return erros;
  }
  if (!(temMin && temMax && temU)) { erros.push("valor numérico incompleto: informe mínimo, máximo e unidade"); return erros; }
  const a = Number(f.valor_min), b = Number(f.valor_max);
  if (!Number.isFinite(a) || !Number.isFinite(b)) { erros.push("valor não numérico"); return erros; }
  if (a < 0) erros.push("abaixo do piso 0");
  if (a > b) erros.push("valor_min > valor_max");
  if (b === 0 && !f.ausencia) erros.push("valor 0 só em declaração de ausência");
  const u = UNIDADES.find(x => x.code === f.unidade);
  if (!u) { erros.push(`unidade fora do catálogo: ${f.unidade}`); return erros; }
  if (u.monetaria && !(MOEDAS_ISO as readonly string[]).includes(String(f.moeda ?? ""))) erros.push("moeda obrigatória (ISO 4217) para valor monetário");
  if (!u.monetaria && f.moeda) erros.push("moeda informada em unidade não monetária");
  if (b > u.teto) erros.push(`acima do teto de sanidade de ${u.label}`);
  return erros;
}

/** DD/MM/AAAA -> AAAA-MM-DD sem passar por fuso (regra 1.5). null se inválida. */
export function parseDataBR(s: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const d = +m[1], mo = +m[2], y = +m[3];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** AAAA-MM-DD (coluna date) -> DD/MM/AAAA. Nunca new Date(iso). */
export function fmtDataBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export type NomeRow = { status: "A_CONFIRMAR" | "CONFIRMADO" };
export type FatoRow = { rotulo: Rotulo | null };

/** Trava da Etapa 1: nenhum nome A_CONFIRMAR, ao menos 1 fato e todos rotulados. */
export function gateEtapa1(nomes: NomeRow[], fatos: FatoRow[]): { ok: boolean; motivos: string[] } {
  const motivos: string[] = [];
  const pend = nomes.filter(n => n.status === "A_CONFIRMAR").length;
  if (pend) motivos.push(`${pend} nome(s) A CONFIRMAR`);
  if (!fatos.length) motivos.push("nenhum fato extraído");
  if (fatos.some(f => !f.rotulo)) motivos.push("fato sem rótulo");
  return { ok: motivos.length === 0, motivos };
}

// ---------------------------------------------------------------- Prompt E1
// Texto do BRIEF (página 5), com o formato de saída fixado para a plataforma.
export function promptE1(): string {
  return [
    "Você é analista sênior de M&A da V3 Partners, boutique de estruturação financeira e M&A. Entrada: transcrição da reunião, participantes, data da reunião e glossário de nomes confirmados.",
    "Tarefa 1. Liste todos os nomes de pessoas e empresas com as grafias encontradas. Para cada divergência, proponha a grafia provável, mas marque 'A CONFIRMAR'. Nunca decida sozinho quem é quem. Nome que já está no glossário de confirmados sai como CONFIRMADO.",
    "Tarefa 2. Extraia os fatos: tema, afirmação literal, quem disse, rótulo. Todo fato da reunião recebe o rótulo DECLARADO NA REUNIÃO. Nunca promova um fato a VERIFICADO. Quando o fato for numérico, preencha valor_min e valor_max (números; iguais se for valor único), unidade (um de: conteiner, ha, moeda, pessoa, projeto, t, unidade) e moeda (ISO 4217, só quando unidade = moeda; senão null). Faixa dita pelo interlocutor vira mínimo e máximo, nunca um valor médio. Declaração de ausência ('sem dívidas', 'nenhum empréstimo') vira valor 0 com ausencia = true, na unidade correspondente (moeda BRL, salvo outra dita). Números de terceiros ou da região ficam em fatos separados dos da empresa.",
    "Tarefa 3. Registre a dor declarada, a tese preliminar em uma frase e os gargalos financeiros ou operacionais citados, sem inferir números que não foram ditos.",
    "Tarefa 4. Liste os próximos passos com responsável e prazo (DD/MM/AAAA ou null), e a decisão da reunião (sim, nao ou em_conversa).",
    "Regras. Use só as entradas: nome de arquivo, pasta ou conhecimento externo nunca justificam grafia nem fato. Não inclua dado pessoal além do que foi dito. Não invente contato. Texto em português do Brasil, sem travessão e sem emoji.",
    'Saída: SOMENTE um objeto JSON, sem texto antes ou depois, no formato {"nomes":[{"tipo":"pessoa|empresa","grafias":["..."],"grafia_provavel":"...","status":"A CONFIRMAR|CONFIRMADO"}],"fatos":[{"tema":"...","afirmacao":"...","quem_disse":"...","valor_min":null,"valor_max":null,"unidade":null,"moeda":null,"ausencia":false}],"dor":"...","tese":"...","gargalos":["..."],"proximos_passos":[{"acao":"...","responsavel":"...","prazo":null}],"decisao":"sim|nao|em_conversa"}',
  ].join("\n\n");
}

export type SaidaE1 = {
  nomes: { tipo: string; grafias: string[]; grafia_provavel?: string; status?: string }[];
  fatos: (Omit<FatoInput, "rotulo"> & { unidade?: string | null })[];
  dor?: string; tese?: string; gargalos?: string[];
  proximos_passos?: { acao: string; responsavel?: string; prazo?: string | null }[];
  decisao?: string;
};

/** Extrai o JSON da resposta do modelo e normaliza. Fatos inválidos não são descartados em silêncio: vão para `rejeitados`. */
export function parseSaidaE1(texto: string, confirmados: string[] = []) {
  const ini = texto.indexOf("{"), fim = texto.lastIndexOf("}");
  if (ini < 0 || fim <= ini) throw new Error("resposta do modelo sem JSON");
  const o = JSON.parse(texto.slice(ini, fim + 1)) as SaidaE1;
  const conf = new Set(confirmados.map(c => c.trim().toLowerCase()));

  const nomes = (o.nomes ?? [])
    .filter(n => Array.isArray(n.grafias) && n.grafias.length)
    .map(n => {
      const tipo = n.tipo === "empresa" ? "empresa" : "pessoa";
      const jaConf = n.grafias.some(g => conf.has(g.trim().toLowerCase()));
      return { tipo, grafias: n.grafias.map(g => g.trim()).filter(Boolean), grafia_provavel: n.grafia_provavel?.trim() || null, status: jaConf ? "CONFIRMADO_GLOSSARIO" : "A_CONFIRMAR" };
    });

  const aceitos: FatoInput[] = [], rejeitados: { fato: unknown; erros: string[] }[] = [];
  for (const f of o.fatos ?? []) {
    const unidade = normalizeUnit(f.unidade);
    const fato: FatoInput = {
      tema: String(f.tema ?? "").trim(),
      afirmacao: String(f.afirmacao ?? "").trim(),
      quem_disse: f.quem_disse ? String(f.quem_disse).trim() : null,
      rotulo: "DECLARADO_REUNIAO", // nunca aceita outro rótulo vindo do modelo
      valor_min: f.valor_min == null ? null : Number(f.valor_min),
      valor_max: f.valor_max == null ? (f.valor_min == null ? null : Number(f.valor_min)) : Number(f.valor_max),
      unidade: f.valor_min == null && f.valor_max == null ? null : unidade,
      moeda: f.moeda ? String(f.moeda).trim().toUpperCase() : null,
      ausencia: !!f.ausencia,
    };
    if (fato.unidade && !UNIDADES.find(u => u.code === fato.unidade)?.monetaria) fato.moeda = null;
    let erros = validarFato(fato);
    // Número sem unidade do catálogo (ex.: "64 anos"): o fato dito na reunião não pode sumir.
    // Guarda como texto, sem os campos numéricos, e registra o motivo em rejeitados.
    if (erros.length && fato.tema && fato.afirmacao && (fato.valor_min != null || fato.valor_max != null) && !fato.unidade) {
      rejeitados.push({ fato: f, erros: [...erros, "guardado como texto, sem valor estruturado"] });
      const texto = { ...fato, valor_min: null, valor_max: null, unidade: null, moeda: null, ausencia: false };
      erros = validarFato(texto);
      if (!erros.length) { aceitos.push(texto); continue; }
    }
    if (erros.length) rejeitados.push({ fato: f, erros }); else aceitos.push(fato);
  }
  const decisao = ["sim", "nao", "em_conversa"].includes(String(o.decisao)) ? String(o.decisao) : "em_conversa";
  return { nomes, fatos: aceitos, rejeitados, dor: o.dor ?? "", tese: o.tese ?? "", gargalos: o.gargalos ?? [], proximos_passos: o.proximos_passos ?? [], decisao };
}
