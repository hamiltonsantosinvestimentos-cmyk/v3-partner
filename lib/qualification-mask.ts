// Máscara de dados sensíveis da ficha de qualificação (BRIEF 30/09/2026, seção 5.12, Fase 1C passo 1).
// Aplicada no SERVIDOR: o valor real nunca viaja na resposta da ficha, só pela rota de revelação,
// que grava o log antes de devolver o dado.

const NOT_INFORMED = "não informado";

// Normaliza para decidir CPF versus CNPJ. Nunca usar \D: o CNPJ alfanumérico perderia as letras.
function normalizeAlnum(value: string): string {
  return value.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

/** Só os 3 últimos caracteres visíveis; abaixo de 6 caracteres nada fica visível. */
export function maskTail(value: string | null | undefined): string | null {
  if (value == null) return null;
  const v = String(value).trim();
  if (!v) return null;
  if (v.length < 6) return "*".repeat(v.length);
  return "*".repeat(v.length - 3) + v.slice(-3);
}

/**
 * CPF (11 caracteres normalizados, só numéricos): ***.123.456-**.
 * 14 caracteres normalizados é CNPJ (legado ou alfanumérico) e fica intacto, é dado público de empresa.
 * Qualquer outro tamanho recebe a máscara genérica e nunca passa em claro.
 */
export function maskCpfCnpj(value: string | null | undefined): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const n = normalizeAlnum(raw);
  if (n.length === 14) return raw;
  if (n.length === 11 && /^\d{11}$/.test(n)) return `***.${n.slice(3, 6)}.${n.slice(6, 9)}-**`;
  return maskTail(n);
}

/**
 * Identidade. Passaporte ("Passaporte X1234567 (US)"): mascara só o número e mantém o país.
 * RG legado com órgão ("12.345.678-9 SSP/RJ"): mascara o número e mantém o órgão. Qualquer outro formato: máscara genérica.
 */
export function maskIdentity(value: string | null | undefined): string | null {
  if (value == null) return null;
  const v = String(value).trim();
  if (!v) return null;
  const passport = v.match(/^Passaporte\s+(.+?)\s*\(([A-Za-z]{2})\)\s*$/i);
  if (passport) return `Passaporte ${maskTail(passport[1])} (${passport[2].toUpperCase()})`;
  const legacy = v.match(/^(.+?)\s+([A-Za-z]{2,}\/[A-Za-z]{2})$/);
  if (legacy) return `${maskTail(legacy[1])} ${legacy[2]}`;
  return maskTail(v);
}

/** IP na tela: nunca completo. IPv4 só o primeiro bloco, IPv6 só os dois primeiros grupos. */
export function maskIp(ip: string | null | undefined): string {
  if (!ip) return NOT_INFORMED;
  const v = ip.trim();
  if (!v || v.toLowerCase() === "unknown") return NOT_INFORMED;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v)) return `${v.split(".")[0]}.*.*.*`;
  if (v.includes(":")) {
    const groups = v.split(":").filter((g) => g !== "");
    if (groups.length >= 2) return `${groups[0]}:${groups[1]}:*`;
  }
  return NOT_INFORMED;
}

// ---------------------------------------------------------------------------------------------
// Campos revelaveis e formato do campo gravado no log (field_views.field)
// ---------------------------------------------------------------------------------------------

export const PRINCIPAL_REVEAL_FIELDS = ["cpf_cnpj", "rg", "id_number", "pix_key", "dados_bancarios"] as const;
export const NODE_REVEAL_FIELDS = ["cpf_cnpj", "rg", "id_number"] as const;
export type PrincipalRevealField = (typeof PRINCIPAL_REVEAL_FIELDS)[number];
export type NodeRevealField = (typeof NODE_REVEAL_FIELDS)[number];

export type ParsedRevealField =
  | { kind: "principal"; field: PrincipalRevealField }
  | { kind: "node"; index: number; id: string; field: NodeRevealField };

/** Formatos aceitos: cpf_cnpj | rg | id_number | pix_key | dados_bancarios | representacao[N:ID].campo (N a partir de 1, ID = v3_client_id ou "sem-id"). */
export function parseRevealField(input: unknown): ParsedRevealField | null {
  if (typeof input !== "string") return null;
  if ((PRINCIPAL_REVEAL_FIELDS as readonly string[]).includes(input)) {
    return { kind: "principal", field: input as PrincipalRevealField };
  }
  const m = input.match(/^representacao\[(\d{1,2}):([0-9a-fA-F-]{36}|sem-id)\]\.(cpf_cnpj|rg|id_number)$/);
  if (!m) return null;
  const index = Number(m[1]);
  if (index < 1) return null;
  return { kind: "node", index, id: m[2].toLowerCase(), field: m[3] as NodeRevealField };
}

const FIELD_LABELS: Record<string, string> = {
  cpf_cnpj: "CPF",
  rg: "Identidade",
  id_number: "Número da identidade",
  pix_key: "Chave PIX",
  dados_bancarios: "Dados bancários",
};

/** Rótulo em português do campo gravado no log. Nó sem identificador estável é cadastro antigo. */
export function labelRevealField(logged: string): string {
  const parsed = parseRevealField(logged);
  if (!parsed) return logged;
  if (parsed.kind === "principal") return FIELD_LABELS[parsed.field];
  const base = `${FIELD_LABELS[parsed.field]} do representante`;
  return parsed.id === "sem-id" ? `${base}, posição ${parsed.index} (cadastro antigo)` : `${base}, nível ${parsed.index}`;
}

// ---------------------------------------------------------------------------------------------
// Cadeia de representação
// ---------------------------------------------------------------------------------------------

type ChainNode = {
  v3_client_id?: string | null;
  cpf_cnpj?: string | null;
  rg?: string | null;
  id_number?: string | null;
  representation?: ChainNode | null;
  [k: string]: unknown;
};

/** Achata a cadeia recursiva na ordem em que a ficha a exibe (profundidade 0 primeiro, limite 6 níveis). */
export function flattenChain(rep: ChainNode | null | undefined, depth = 0): ChainNode[] {
  if (!rep || depth > 5) return [];
  return [rep, ...flattenChain(rep.representation, depth + 1)];
}

/** Valor real de um campo de um nó, validando posição (a partir de 1) e identificador. */
export function resolveNodeValue(
  chain: ChainNode | null | undefined,
  index: number,
  id: string,
  field: NodeRevealField,
): string | null {
  const node = flattenChain(chain)[index - 1];
  if (!node) return null;
  const nodeId = node.v3_client_id ? String(node.v3_client_id).toLowerCase() : "sem-id";
  if (nodeId !== id) return null;
  const value = node[field];
  return typeof value === "string" && value.trim() ? value : null;
}

// Campos do nó que NÃO são sensíveis e podem seguir em claro (lista permitida: qualquer chave nova
// do JSON da cadeia fica de fora até ser decidida, nunca passa em claro por omissão).
const NODE_PLAIN_FIELDS = [
  "representative_type", "party_nature", "full_name", "email", "nationality", "marital_status", "profession",
  "phone", "endereco_completo", "company_name", "company_cnpj", "company_address", "company_legal_nature",
  "v3_client_id", "id_type", "endereco_origem",
] as const;

/** Campos do nó para a ficha: só a lista permitida, mais os sensíveis mascarados. Nunca copia o valor original. */
export function maskNode(node: ChainNode): Record<string, unknown> & {
  cpf_cnpj_masked: string | null;
  rg_masked: string | null;
  id_number_masked: string | null;
} {
  const out: Record<string, unknown> = {};
  for (const f of NODE_PLAIN_FIELDS) out[f] = node[f] ?? null;
  return {
    ...out,
    cpf_cnpj_masked: maskCpfCnpj(node.cpf_cnpj ?? null),
    rg_masked: maskIdentity(node.rg ?? null),
    id_number_masked: maskIdentity(node.id_number ?? null),
  };
}

/** Dados bancários: lista permitida de chaves; agência e conta sempre mascaradas, mesmo se vierem como número. */
export function maskBankData(bank: unknown): Record<string, unknown> | null {
  if (!bank || typeof bank !== "object") return null;
  const b = bank as Record<string, unknown>;
  return {
    banco: b.banco ?? null,
    tipo_conta: b.tipo_conta ?? null,
    agencia: b.agencia == null ? null : maskTail(String(b.agencia)),
    conta: b.conta == null ? null : maskTail(String(b.conta)),
  };
}
