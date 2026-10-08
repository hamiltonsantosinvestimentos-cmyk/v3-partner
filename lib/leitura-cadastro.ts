import { chaveIaMesas } from "@/lib/ai/chave-mesas";
import { MODELO_EXTRACAO } from "@/lib/analise-estruturada/extracao";

// Leitura de documento de cadastro (CNH/RG, cartão CNPJ, contrato social) para
// preencher a aba "Dados do Cliente" do modal de nova proposta. Só sugere
// valores: o modal preenche apenas campos vazios e o usuário confere.

export type TipoCliente = "PF" | "PJ";

export interface DadosCadastro {
  tipo_documento: "cnh" | "rg" | "cartao_cnpj" | "contrato_social" | "outro";
  nome?: string;
  cpf?: string;
  rg?: string;
  nascimento?: string;      // AAAA-MM-DD
  estado_civil?: string;
  razao_social?: string;
  nome_fantasia?: string;
  cnpj?: string;
  socio_responsavel?: string;
  cep?: string;
  endereco?: string;        // rua, número, bairro
  cidade?: string;
  uf?: string;
}

const MIME: Record<string, string> = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
};

export function mimeSuportado(arquivo: string): string | null {
  return MIME[arquivo.split(".").pop()?.toLowerCase() ?? ""] ?? null;
}

const PROMPT: Record<TipoCliente, string> = {
  PF: `O documento deve ser de pessoa física (CNH ou RG). Extraia: nome, cpf, rg (número do RG; na CNH é o campo "Doc. Identidade", sem o órgão emissor), nascimento, estado_civil (se constar), e endereço se constar.`,
  PJ: `O documento deve ser de empresa (cartão CNPJ ou contrato social / alteração contratual). Extraia: razao_social, nome_fantasia, cnpj, socio_responsavel (no contrato social: o sócio administrador; se houver mais de um, o primeiro citado na administração), e o endereço da sede.`,
};

const SYSTEM = `Você lê documentos brasileiros de cadastro e devolve SOMENTE um JSON, sem texto em volta.
Formato:
{"tipo_documento":"cnh|rg|cartao_cnpj|contrato_social|outro","nome":"","cpf":"","rg":"","nascimento":"AAAA-MM-DD","estado_civil":"","razao_social":"","nome_fantasia":"","cnpj":"","socio_responsavel":"","cep":"","endereco":"","cidade":"","uf":""}
Regras: omita a chave quando o dado não estiver legível no documento — nunca invente. CPF como 000.000.000-00, CNPJ como 00.000.000/0000-00, CEP como 00000-000, UF com 2 letras maiúsculas. "endereco" = logradouro, número e bairro. estado_civil só um destes: Solteiro(a), Casado(a), Divorciado(a), Viúvo(a), União Estável. Nomes como estão no documento, com maiúsculas e minúsculas normais (não tudo em caixa alta).`;

const CHAVES: (keyof DadosCadastro)[] = [
  "nome", "cpf", "rg", "nascimento", "estado_civil", "razao_social", "nome_fantasia",
  "cnpj", "socio_responsavel", "cep", "endereco", "cidade", "uf",
];

function limpar(bruto: Record<string, unknown>): DadosCadastro {
  const tipos = ["cnh", "rg", "cartao_cnpj", "contrato_social"];
  const out: DadosCadastro = {
    tipo_documento: tipos.includes(String(bruto.tipo_documento)) ? bruto.tipo_documento as DadosCadastro["tipo_documento"] : "outro",
  };
  for (const k of CHAVES) {
    const v = typeof bruto[k] === "string" ? (bruto[k] as string).trim() : "";
    if (v) (out as unknown as Record<string, string>)[k] = v;
  }
  if (out.nascimento && !/^\d{4}-\d{2}-\d{2}$/.test(out.nascimento)) delete out.nascimento;
  if (out.uf) out.uf = out.uf.toUpperCase().slice(0, 2);
  return out;
}

export async function lerDocumentoCadastro(buffer: Buffer, mime: string, tipoCliente: TipoCliente): Promise<DadosCadastro> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const anthropic = new Anthropic({ apiKey: chaveIaMesas() });
  const data = buffer.toString("base64");
  const fonte = mime === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: mime, data } }
    : { type: "image", source: { type: "base64", media_type: mime, data } };
  const resp = await anthropic.messages.create({
    model: MODELO_EXTRACAO,
    max_tokens: 2000,
    system: SYSTEM,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: [{ role: "user", content: [fonte, { type: "text", text: PROMPT[tipoCliente] }] as any }],
  });
  const texto = resp.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
  const ini = texto.indexOf("{"), fim = texto.lastIndexOf("}");
  if (ini < 0 || fim <= ini) throw new Error("Não foi possível ler o documento.");
  const dados = limpar(JSON.parse(texto.slice(ini, fim + 1)) as Record<string, unknown>);
  if (tipoCliente === "PJ" && dados.cnpj) await completarPelaReceita(dados);
  return dados;
}

/** Cartão CNPJ / contrato social: completa o que faltou com a Receita (BrasilAPI). Falha silenciosa. */
async function completarPelaReceita(d: DadosCadastro) {
  const cnpj = d.cnpj!.replace(/\D/g, "");
  if (cnpj.length !== 14) return;
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return;
    const r = await res.json() as Record<string, string | null>;
    d.razao_social ||= r.razao_social || undefined;
    d.nome_fantasia ||= r.nome_fantasia || undefined;
    if (!d.endereco && r.logradouro) {
      d.endereco = [[r.descricao_tipo_de_logradouro, r.logradouro].filter(Boolean).join(" "), r.numero, r.bairro].filter(Boolean).join(", ");
    }
    d.cidade ||= r.municipio || undefined;
    d.uf ||= r.uf || undefined;
    if (!d.cep && r.cep) { const c = String(r.cep).replace(/\D/g, ""); if (c.length === 8) d.cep = `${c.slice(0, 5)}-${c.slice(5)}`; }
  } catch { /* segue só com o que a leitura trouxe */ }
}
