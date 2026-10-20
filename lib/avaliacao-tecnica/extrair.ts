// Motor da Avaliação Técnica V3 (17/10/2026). Só servidor (usa service role e a API da
// Anthropic). Etapas:
//   1. separa os arquivos de imóvel da proposta (pelo item do checklist e pelo nome) e baixa;
//   2. a IA lê tudo de uma vez — classifica cada arquivo pelo CONTEÚDO (na prática o cliente
//      anexa ITR no campo do IPTU, CNH no da matrícula…) e extrai os parâmetros dos laudos;
//   3. em paralelo: vértices do GEO (rural) → consultas públicas (CAR/SICAR, TI, UC, embargos,
//      DETER, relevo SRTM) → classes de capacidade de uso; pesquisa de mercado com os atributos de
//      cada comparável; CUB do estado; localização;
//   4. regras fixas (analise.ts + normas.ts) homogeneízam por fatores (como os laudos de
//      referência), calculam estatística, graus NBR, valores, alertas e rating;
//   5. a IA escreve o parecer com tudo já calculado.

import type { SupabaseClient } from "@supabase/supabase-js";
import type Anthropic from "@anthropic-ai/sdk";
import { webSearch } from "@/lib/web-search";
import { calcularRating, calcularValores, gerarAlertas, juntarAlertas } from "./analise";
import { deUtm, medirPoligonal, verticesDoKml, verticesValidos } from "./geo";
import { consultarImovelRural } from "./consultas";
import { comPreservacao, estadoDe, indiceAgronomico, normalizarClasses, padraoDetalheDe, situacaoValida } from "./normas";
import type {
  Alerta, ArquivoLido, AvaliacaoTecnica, CaracteristicasRural, CaracteristicasUrbano, Comparavel, Consulta, CubRef, Identificacao,
  LaudoExterno, PadraoNivel, Parecer, PesquisaMercadoTecnica, Poligonal, QuadroAreas, Registro, Relevo, Terras, TipoDocumentoImovel,
  VerticeGeo, VtnMunicipal, ZonaImovel,
} from "./tipos";

const MODELO = "claude-sonnet-4-6";
const DEFAULT_BUCKET = "credit-documents";
const GOVERNED_BUCKET = "v3-docs-publico";
const MAX_PDF_BYTES = 9 * 1024 * 1024;
const MAX_IMG_BYTES = Math.floor(3.7 * 1024 * 1024); // base64 de imagem ≤ 5 MB na API
const MAX_TOTAL_BYTES = 22 * 1024 * 1024;           // request da API ≤ 32 MB (base64 incha 33%)
const MAX_FOTOS = 8;
const MAX_ARQUIVOS = 24;

/** Itens do checklist que são documentos do imóvel (RG/CNH do proprietário ficam de fora). */
const ITEM_DE_IMOVEL = /matr[ií]cula|iptu|foto|fachada|rural|ccir|\bitr\b|\bcar\b|geo|sigef|memorial|laudo|escritura|planta|habite|incra|im[oó]vel/i;
const ITEM_PESSOAL = /\b(rg|cnh|cpf)\b|c[oô]njuge|identidade/i;
/** Arquivo anexado no item errado que claramente não é do imóvel. */
const ARQUIVO_PESSOAL = /\b(cnh|rg|cpf)\b|casamento|nascimento|faturamento|balan[cç]o|\bdre\b|extrato|holerite|irpf|imposto de renda|contrato social|cart[aã]o cnpj|comprovante de (renda|resid)/i;

export type DocEntry = { doc_id: string; file_name: string; storage_path: string; bucket?: string };
export type ItemChecklist = { doc_id: string; label: string };

function resolveBucket(doc: { storage_path?: string; bucket?: string }): string {
  if (doc.bucket) return doc.bucket;
  if (doc.storage_path?.startsWith("Credito/") || doc.storage_path?.startsWith("MA/") || doc.storage_path?.startsWith("Administracao/")) return GOVERNED_BUCKET;
  return DEFAULT_BUCKET;
}

function extensao(nome: string) { return nome.split(".").pop()?.toLowerCase() ?? ""; }
function mimeDe(nome: string): string | null {
  const ext = extensao(nome);
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "pdf") return "application/pdf";
  if (ext === "kml") return "application/vnd.google-earth.kml+xml";
  return null;
}

/** Prioridade de leitura (menor = antes). Fotos por último: se estourar o limite, saem elas. */
function prioridade(label: string, nome: string) {
  const s = `${label} ${nome}`;
  if (/matr[ií]cula|inteiro teor|escritura|\bonus\b|[ôo]nus/i.test(s)) return 0;
  if (/sigef|memorial|geo|kml|incra|ccir|\bitr\b|\bcar\b|cafir|rural/i.test(s)) return 1;
  if (/iptu|espelho|cadastro imob/i.test(s)) return 2;
  if (/laudo|avalia/i.test(s)) return 3;
  if (/foto|fachada|photo|whatsapp image|img_/i.test(s) || /^image\//.test(mimeDe(nome) ?? "")) return 5;
  return 4;
}

export interface ArquivoBaixado { entry: DocEntry; label: string; mime: string; base64?: string; texto?: string; bytes: number }

/** Separa e baixa os arquivos do imóvel. `idsExtras` = anexos feitos direto na aba (avaliacao_imovel_*). */
export async function baixarArquivosDoImovel(db: SupabaseClient, documents: DocEntry[], itens: ItemChecklist[]) {
  const labelDe = new Map(itens.map((i) => [i.doc_id, i.label]));
  const candidatos = documents
    .map((d) => ({ d, label: d.doc_id.startsWith("avaliacao_imovel") ? "Anexado na Avaliação de Imóvel" : labelDe.get(d.doc_id) ?? "" }))
    .filter(({ d, label }) => (d.doc_id.startsWith("avaliacao_imovel") || (ITEM_DE_IMOVEL.test(label) && !ITEM_PESSOAL.test(label))) && mimeDe(d.file_name || d.storage_path))
    .filter(({ d, label }) => label === "Anexado na Avaliação de Imóvel" || !ARQUIVO_PESSOAL.test(d.file_name || ""))
    .sort((a, b) => prioridade(a.label, a.d.file_name) - prioridade(b.label, b.d.file_name));

  const baixados: ArquivoBaixado[] = [];
  const ignorados: string[] = [];
  let total = 0;
  let fotos = 0;
  for (const { d, label } of candidatos) {
    if (baixados.length >= MAX_ARQUIVOS) { ignorados.push(d.file_name); continue; }
    const mime = mimeDe(d.file_name || d.storage_path)!;
    const ehFoto = mime.startsWith("image/");
    if (ehFoto && fotos >= MAX_FOTOS) { ignorados.push(d.file_name); continue; }
    const { data } = await db.storage.from(resolveBucket(d)).download(d.storage_path);
    if (!data) { ignorados.push(d.file_name); continue; }
    const buf = Buffer.from(await data.arrayBuffer());
    if (mime.includes("kml")) {
      baixados.push({ entry: d, label, mime, texto: buf.toString("utf8"), bytes: 0 });
      continue;
    }
    const limite = ehFoto ? MAX_IMG_BYTES : MAX_PDF_BYTES;
    if (buf.byteLength > limite || total + buf.byteLength > MAX_TOTAL_BYTES) { ignorados.push(d.file_name); continue; }
    total += buf.byteLength;
    if (ehFoto) fotos++;
    baixados.push({ entry: d, label, mime, base64: buf.toString("base64"), bytes: buf.byteLength });
  }
  return { baixados, ignorados };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function blocosDosArquivos(arqs: ArquivoBaixado[], indices?: number[]): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: any[] = [];
  arqs.forEach((a, i) => {
    if (indices && !indices.includes(i + 1)) return;
    out.push({ type: "text", text: `ARQUIVO ${i + 1} — item do checklist: "${a.label || "sem item"}" — nome: "${a.entry.file_name}"` });
    if (a.texto !== undefined) out.push({ type: "text", text: `(KML — coordenadas lidas pela V3, conteúdo omitido)` });
    else if (a.mime === "application/pdf") out.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: a.base64 } });
    else out.push({ type: "image", source: { type: "base64", media_type: a.mime, data: a.base64 } });
  });
  return out;
}

function textoDa(msg: Anthropic.Messages.Message) {
  return msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
}
function jsonDe<T>(texto: string): T {
  const ini = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (ini === -1 || fim <= ini) throw new Error("A IA não devolveu o resultado em JSON. Tente novamente.");
  return JSON.parse(texto.slice(ini, fim + 1)) as T;
}
const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/** Decimal escrito pela IA nas linhas de vértice (ponto ou vírgula decimal, sem milhar). */
const dec = (s: string | undefined): number | null => {
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

// ─── 1. Leitura dos documentos ──────────────────────────────────────────────

const TIPOS: TipoDocumentoImovel[] = ["MATRICULA", "ESCRITURA", "IPTU", "CND_IPTU", "FOTO", "CCIR", "ITR", "CAR", "GEO_MEMORIAL", "GEO_MAPA", "GEO_KML", "CAFIR", "CND_ITR", "LAUDO", "PLANTA", "HABITE_SE", "OUTRO", "NAO_RELACIONADO"];

interface LeituraIa {
  arquivos: { indice: number; tipo: string; resumo?: string }[];
  identificacao: Identificacao;
  registro: Registro;
  areas: QuadroAreas;
  urbano?: CaracteristicasUrbano | null;
  rural?: CaracteristicasRural | null;
  laudo_externo?: LaudoExterno | null;
  ambiental?: string | null;
  alertas?: Alerta[];
  coordenadas_imovel?: { lat: number; lon: number } | null;
}

export interface ContextoImovel {
  zona: ZonaImovel;
  cliente_nome?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  area_m2?: number | null;
  outros_imoveis?: number;
}

function promptLeitura(ctx: ContextoImovel, hoje: string) {
  const comum = `"identificacao":{"matricula":"","cartorio":"","comarca":"","data_certidao":"yyyy-mm-dd","proprietarios":[""],"documentos_proprietarios":["CPF/CNPJ dos proprietários atuais, se constarem"],"inscricao_municipal":"","lote_quadra":"","endereco":"","bairro":"","cidade":"","uf":"","cep":"","denominacao":""},
"registro":{"onus":[{"tipo":"hipoteca|alienação fiduciária|penhora|indisponibilidade|usufruto|servidão|...","registro":"R-5","descricao":"","favorecido":"","ativo":true}],"construcao_averbada":"texto da averbação da construção ou null","cadeia_dominial":"última transmissão (quem, quando, como)","observacoes":""},`;
  const urbano = `"areas":{"privativa_m2":0,"terreno_matricula_m2":0,"terreno_iptu_m2":0,"construida_matricula_m2":0,"construida_iptu_m2":0,"construida_estimada_m2":0},
"urbano":{"tipo":"casa|apartamento|sala comercial|galpão|terreno|...","padrao":"BAIXO|MEDIO|ALTO","padrao_detalhe":"BAIXO|MEDIO_BAIXO|MEDIO|MEDIO_ALTO|ALTO","padrao_descricao":"","idade_aparente_anos":0,"conservacao":"novo|entre novo e regular|regular|reparos simples|reparos importantes","pavimentos":0,"dormitorios":0,"suites":0,"vagas":0,"compartimentos":[""],"acabamentos":[{"ambiente":"","descricao":"piso / parede / teto"}],"estrutura":"","cobertura":"","esquadrias":"","lazer":[""],"topografia":"","formato_terreno":"","testada_m":0,"zoneamento":"","situacao":"isolado|condomínio|esquina|...","condominio":{"em_condominio":true,"tipo":"HORIZONTAL|VERTICAL","nome":"","taxa_mensal":0,"infraestrutura":["portaria 24h","segurança","lazer",...]},"ocupacao":"","infraestrutura":["água","esgoto","energia","pavimentação",...],"vizinhanca":"","servicos_proximos":[""],"riscos":[""],"iptu":{"exercicio":0,"valor_venal_terreno":0,"valor_venal_construcao":0,"valor_venal_total":0,"valor_iptu_anual":0,"debitos":""}},
"rural":null,`;
  const rural = `"areas":{"matricula_ha":0,"ccir_ha":0,"itr_ha":0,"car_ha":0,"geo_declarada_ha":0},
"urbano":null,
"rural":{"denominacao":"","codigo_incra":"","ccir":{"numero":"","exercicio":"","situacao":"quitado|pendente|...","area_ha":0,"modulos_fiscais":0,"fracao_minima_ha":0,"classificacao":"minifúndio|pequena|média|grande propriedade"},"itr":{"nirf":"","exercicio":0,"area_ha":0,"vtn_declarado":0,"situacao":""},"car":{"codigo":"","situacao":"ativo|pendente|...","area_ha":0,"reserva_legal_ha":0,"app_ha":0,"vegetacao_nativa_ha":0,"area_consolidada_ha":0},"geo":{"certificado":true,"codigo_parcela":"","data_certificacao":"yyyy-mm-dd","averbado_na_matricula":true,"responsavel_tecnico":"","datum":"SIRGAS 2000","perimetro_m":0},"modulo_fiscal_ha":0,"porte":"","bioma":"","reserva_legal_exigida_pct":20,"aptidao":"","topografia":"plana|suave ondulada|ondulada|forte ondulada|montanhosa (e % se houver)","solos":"tipo de solo se algum documento/laudo informar","uso_solo":[""],"recursos_hidricos":[""],"cercas":"","acesso":"","servidao_passagem":"registrada (R-x) | sem servidão registrada, acesso por ... | não se aplica","edificacoes":[{"nome":"","area_m2":0,"idade_aparente_anos":0,"conservacao":"","estado":"a|b|c|d|e|f|g|h","padrao_cub":"R1-B|R1-N|R1-A|PIS|GI","fator_cub":0.9,"averbada":false,"descricao":""}]},`;

  return `Você é engenheiro avaliador da V3 Partners (NBR 14653-${ctx.zona === "RURAL" ? "3, imóveis rurais" : "2, imóveis urbanos"}), montando a avaliação técnica de um imóvel ${ctx.zona === "RURAL" ? "RURAL" : "URBANO"} dado em garantia de crédito. Hoje é ${hoje}.
Os arquivos acima foram anexados pelo cliente/partner. ATENÇÃO: muitas vezes estão no item errado do checklist (ITR no campo do IPTU, CNH no campo da matrícula). Classifique cada arquivo pelo CONTEÚDO, não pelo item nem pelo nome.
${ctx.outros_imoveis && ctx.outros_imoveis > 0 ? `A proposta tem ${ctx.outros_imoveis + 1} imóveis. Avalie SÓ o imóvel abaixo; arquivos de outro imóvel = "NAO_RELACIONADO".\n` : ""}Dados do imóvel na proposta: ${[ctx.endereco, ctx.cidade && ctx.estado ? `${ctx.cidade}/${ctx.estado}` : ctx.cidade, ctx.cep ? `CEP ${ctx.cep}` : null, ctx.area_m2 ? `${ctx.area_m2} m²` : null].filter(Boolean).join(" · ") || "não informados"}. Cliente: ${ctx.cliente_nome ?? "não informado"}.

O que extrair (parâmetros que os avaliadores usam nos laudos):
- Matrícula: número, cartório/comarca, data de emissão da certidão (a V3 aceita certidão de até 90 dias; não gere alerta de validade), proprietários ATUAIS (só os nomes, após a última transmissão), descrição do imóvel, área, averbação de construção, cadeia dominial recente.
- onus = SÓ gravames (hipoteca, alienação fiduciária, penhora, arresto, indisponibilidade, usufruto, servidão, cláusulas de inalienabilidade/impenhorabilidade, ações reais/reipersecutórias, bem de família), dizendo se estão ativos ou cancelados na própria matrícula. Averbação de casamento, pacto antenupcial, divórcio, óbito, nome, construção ou condomínio NÃO é ônus.
${ctx.zona === "RURAL"
    ? `- CCIR: número, exercício, situação, área total, módulos fiscais, fração mínima, classificação fundiária. ITR: NIRF, exercício, área, VTN declarado. CAR: código, situação, área, Reserva Legal, APP, vegetação nativa, área consolidada.
- GEO/SIGEF: certificação (código da parcela, data), se está averbado na matrícula, responsável técnico, datum, área e perímetro escritos no memorial. NÃO liste os vértices aqui (outra etapa lê).
- Fotos: uso do solo (lavoura, pasto, mata), cercas, água (açude, rio, poço), acesso, edificações (casa sede, galpão, curral…) com área estimada, idade aparente e conservação; marque averbada=false se a matrícula não averba.
- Reserva Legal exigida conforme bioma/região (Amazônia Legal: 80% floresta, 35% cerrado; demais: 20%).
- Edificações (custo de reprodução, como nos laudos): padrao_cub = projeto-padrão do CUB mais parecido (R1-B casa simples, R1-N casa normal/sede, R1-A casa de alto padrão, PIS muito simples, GI galpão/depósito/cobertura); fator_cub = custo do m² dessa construção em relação ao de uma CASA DE PADRÃO NORMAL (R1-N) — casa sede normal 1,0; casa simples/de caseiro 0,8; alojamento 0,8; casa de alto padrão 1,3; galpão fechado 0,45; depósito simples 0,3; cobertura/telheiro aberto 0,15–0,25; curral/brete 0,1–0,2; estado de conservação de Heidecke (a novo … h quase sem valor).`
    : `- Unidade em condomínio (apartamento, sala, casa em condomínio): privativa_m2 = área privativa/útil; construida_matricula_m2 = área total (privativa + comum); terreno_matricula_m2 = fração ideal em m² se houver. A construção de unidade em condomínio instituído já está averbada pela instituição do condomínio (não gere alerta de construção não averbada).
- Condomínio: em_condominio=true se o imóvel é unidade de condomínio (matrícula com instituição/convenção de condomínio, fração ideal ou "unidade autônoma", nome de residencial/condomínio no endereço, boleto de condomínio, fotos com portaria/guarita/muro do condomínio). tipo HORIZONTAL = casas/lotes em condomínio fechado; VERTICAL = edifício. em_condominio=false só se for claramente imóvel de rua; sem base = null.
- IPTU: inscrição, exercício, área do terreno, área construída cadastrada, valores venais (terreno, construção, total), valor do imposto, débitos.
- Fotos: tipo, padrão construtivo (BAIXO/MEDIO/ALTO e o detalhe em 5 níveis), idade aparente, conservação, compartimentos, acabamentos por ambiente (piso/parede/teto), estrutura, cobertura, esquadrias, lazer, vagas. Estime a área construída real (construida_estimada_m2) só se houver base (anúncio, planta, laudo, levantamento); senão null.`}
- Se houver LAUDO de avaliação anexado: empresa, número, responsável, data-base, valor de mercado, valor de garantia/liquidez, graus de fundamentação e precisão, resumo do parecer.
- coordenadas_imovel: só se algum documento trouxer lat/long do imóvel (laudo, CAR, mapa).
- alertas: SÓ problemas (nada positivo; pontos positivos não são alerta) que um analista de crédito precisa saber e que as regras automáticas da V3 NÃO cobrem. Já são verificados automaticamente, NÃO repita: validade da certidão da matrícula, documento faltando (matrícula, IPTU, fotos, CCIR, ITR, CAR, GEO), ônus ativos, proprietário diferente do cliente, divergência de ÁREA entre documentos, GEO não certificado ou não averbado, servidão de passagem, edificação não averbada, débitos de IPTU, riscos listados em urbano.riscos, LTV. Nível CRITICO só para impeditivos reais (penhora, indisponibilidade, ação sobre o imóvel, documento de outro imóvel ou adulterado); o resto é ATENCAO ou INFO. Transmissão recente só se houver menos de 12 meses (INFO). Exemplos do que cabe: CAFIR/CIB pendente, área certificada zerada no CCIR, divergência de perímetro, transmissão recente, documento ilegível, endereço divergente, uso irregular. categoria: Documentação | Registro | Áreas | GEO | Cadastros | Ambiental | Riscos.
- servidao_passagem: se a poligonal/matrícula confronta estrada pública, diga "não se aplica: confronta estrada pública (...)"; só diga "sem servidão registrada" quando o acesso passa por terra de terceiros.
Regras: números puros (sem "R$", sem pontos de milhar, decimal com ponto). Campo sem informação = null (NUNCA invente). Datas em yyyy-mm-dd.

Responda SOMENTE com JSON válido, sem markdown, neste formato:
{"arquivos":[{"indice":1,"tipo":"${TIPOS.join("|")}","resumo":"1 linha"}],
${comum}
${ctx.zona === "RURAL" ? rural : urbano}
"laudo_externo":null,
"ambiental":"resumo ambiental (APP, RL, contaminação, áreas de risco) ou null",
"coordenadas_imovel":null,
"alertas":[{"nivel":"CRITICO|ATENCAO|INFO","categoria":"","titulo":"curto","detalhe":""}]}`;
}

async function lerDocumentos(ai: Anthropic, arqs: ArquivoBaixado[], ctx: ContextoImovel): Promise<LeituraIa> {
  const hoje = new Date().toISOString().slice(0, 10);
  const msg = await ai.messages.create({
    model: MODELO, temperature: 0,
    max_tokens: 10000,
    messages: [{ role: "user", content: [...blocosDosArquivos(arqs), { type: "text", text: promptLeitura(ctx, hoje) }] }],
  });
  return jsonDe<LeituraIa>(textoDa(msg));
}

// ─── 2. Vértices do GEO ─────────────────────────────────────────────────────

/** Lê a tabela de vértices do memorial/mapa SIGEF. Formato compacto pra caber muitos vértices. */
async function lerVertices(ai: Anthropic, arqs: ArquivoBaixado[], indices: number[]): Promise<{ vertices: VerticeGeo[]; area_ha: number | null; fonte: string } | null> {
  // KML anexado: coordenadas exatas, sem IA.
  for (const i of indices) {
    const a = arqs[i - 1];
    if (a?.texto) {
      const v = verticesValidos(verticesDoKml(a.texto));
      if (v.length >= 3) return { vertices: v, area_ha: null, fonte: a.entry.file_name };
    }
  }
  const pdfs = indices.filter((i) => arqs[i - 1] && !arqs[i - 1].texto);
  if (pdfs.length === 0) return null;
  const msg = await ai.messages.create({
    model: MODELO, temperature: 0,
    max_tokens: 16000,
    messages: [{
      role: "user",
      content: [...blocosDosArquivos(arqs, pdfs), {
        type: "text",
        text: `Extraia a tabela de VÉRTICES da poligonal (perímetro) do imóvel, na ordem do memorial, de TODOS os vértices (não resuma, não pule).
Responda SOMENTE em linhas de texto, sem markdown:
- primeira linha: ARQUIVO|<número do arquivo usado>
- se as coordenadas forem geográficas (longitude/latitude): uma linha por vértice "G|<código>|<latitude decimal>|<longitude decimal>" (converta graus/minutos/segundos para decimal; sul e oeste NEGATIVOS).
- se forem UTM (E/N): uma linha "FUSO|<número>|S" e depois "U|<código>|<E>|<N>".
- última linha: AREA|<área em hectares escrita no memorial ou vazio>
Se não houver tabela de vértices, responda só: SEM_VERTICES`,
      }],
    }],
  });
  const linhas = textoDa(msg).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (linhas.some((l) => l.startsWith("SEM_VERTICES"))) return null;
  let fuso = 0;
  let sul = true;
  let arquivo = pdfs[0];
  let area: number | null = null;
  const vertices: VerticeGeo[] = [];
  for (const l of linhas) {
    const p = l.split("|").map((s) => s.trim());
    if (p[0] === "ARQUIVO") arquivo = Number(p[1]) || arquivo;
    else if (p[0] === "FUSO") { fuso = Number(p[1]) || 0; sul = (p[2] ?? "S").toUpperCase() !== "N"; }
    else if (p[0] === "G") { const lat = dec(p[2]); const lon = dec(p[3]); if (lat !== null && lon !== null) vertices.push({ id: p[1] || null, lat, lon }); }
    else if (p[0] === "U" && fuso) { const e = dec(p[2]); const n = dec(p[3]); if (e !== null && n !== null) vertices.push({ id: p[1] || null, ...deUtm(e, n, fuso, sul) }); }
    else if (p[0] === "AREA") area = dec(p[1]);
  }
  const v = verticesValidos(vertices);
  if (v.length < 3) return null;
  return { vertices: v, area_ha: area, fonte: arqs[arquivo - 1]?.entry.file_name ?? "memorial GEO" };
}

// ─── 3. Mercado (internet) ──────────────────────────────────────────────────

const TOOL_BUSCA = [{
  name: "web_search",
  description: "Busca na internet (anúncios de imóveis, CUB do Sinduscon, solos e informações da região).",
  input_schema: { type: "object" as const, properties: { query: { type: "string", description: "Busca em português com cidade/UF" } }, required: ["query"] },
}];

/** Conversa com a IA deixando ela usar web_search; devolve o texto final. */
/**
 * Conversa com a IA deixando ela pesquisar na internet e devolve o texto final.
 * Usa a busca nativa da Anthropic (web_search + web_fetch: lê o anúncio/tabela inteira); se a
 * conta não tiver as ferramentas nativas, cai na busca simples (lib/web-search, só trechos).
 */
export async function comBusca(ai: Anthropic, system: string, pedido: string, buscas = 5, maxTokens = 4000): Promise<string> {
  const sys = `Hoje é ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.\n${system}`;
  try {
    return await comBuscaNativa(ai, sys, pedido, buscas, maxTokens);
  } catch (e) {
    const st = (e as { status?: number }).status;
    if (st !== 400 && st !== 403 && st !== 404) throw e;
    console.error("[avaliacao-tecnica] busca nativa indisponível, usando a simples:", (e as Error).message?.slice(0, 200));
    return comBuscaSimples(ai, sys, pedido, buscas, maxTokens);
  }
}

async function comBuscaNativa(ai: Anthropic, system: string, pedido: string, buscas: number, maxTokens: number): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: any[] = [
    { type: "web_search_20250305", name: "web_search", max_uses: buscas, user_location: { type: "approximate", country: "BR", timezone: "America/Sao_Paulo" } },
    { type: "web_fetch_20250910", name: "web_fetch", max_uses: Math.max(2, Math.ceil(buscas / 2)), max_content_tokens: 8000 },
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let msgs: any[] = [{ role: "user", content: pedido }];
  for (let i = 0; i < 4; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await ai.messages.create({ model: MODELO, temperature: 0, max_tokens: maxTokens, system, messages: msgs, tools } as any) as Anthropic.Messages.Message;
    if (r.stop_reason === "pause_turn") { msgs = [...msgs, { role: "assistant", content: r.content }]; continue; }
    const t = textoDa(r);
    if (t.includes("{")) return t;
    msgs = [...msgs, { role: "assistant", content: r.content }, { role: "user", content: "Responda agora SOMENTE com o JSON final (use null no que não encontrou)." }];
  }
  return "";
}

async function comBuscaSimples(ai: Anthropic, system: string, pedido: string, iteracoes: number, maxTokens: number): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msgs: any[] = [{ role: "user", content: pedido }];
  for (let i = 0; i < iteracoes; i++) {
    const r = await ai.messages.create({ model: MODELO, temperature: 0, max_tokens: maxTokens, system, messages: msgs, tools: TOOL_BUSCA });
    if (r.stop_reason !== "tool_use") {
      const t = textoDa(r);
      if (t.includes("{")) return t;
      msgs.push({ role: "assistant", content: r.content });
      break;
    }
    msgs.push({ role: "assistant", content: r.content });
    const resultados = await Promise.all(r.content.filter((b) => b.type === "tool_use").map(async (b) => {
      const t = b as { id: string; input: { query: string } };
      return { type: "tool_result" as const, tool_use_id: t.id, content: (await webSearch(t.input.query)) || "Sem resultados." };
    }));
    msgs.push({ role: "user", content: resultados });
  }
  const r = await ai.messages.create({
    model: MODELO, temperature: 0, max_tokens: maxTokens, system, tools: TOOL_BUSCA, tool_choice: { type: "none" },
    messages: [...msgs, { role: "user", content: "Responda AGORA só com o JSON final, sem texto antes ou depois." }],
  });
  return textoDa(r);
}

/** Custo médio do m² (SINAPI — IBGE/Caixa) do estado, último mês publicado. Oficial e sem IA. */
const UF_IBGE: Record<string, number> = {
  RO: 11, AC: 12, AM: 13, RR: 14, PA: 15, AP: 16, TO: 17, MA: 21, PI: 22, CE: 23, RN: 24, PB: 25, PE: 26, AL: 27, SE: 28, BA: 29,
  MG: 31, ES: 32, RJ: 33, SP: 35, PR: 41, SC: 42, RS: 43, MS: 50, MT: 51, GO: 52, DF: 53,
};
export async function buscarSinapi(uf: string): Promise<{ valor: number; mes: string } | null> {
  const cod = UF_IBGE[uf.toUpperCase()];
  if (!cod) return null;
  try {
    const r = await fetch(`https://apisidra.ibge.gov.br/values/t/2296/n3/${cod}/v/48/p/last%201`, { signal: AbortSignal.timeout(15000) });
    const j = (await r.json()) as { V?: string; D3N?: string }[];
    const v = Number(j?.[1]?.V);
    return v > 0 ? { valor: v, mes: j[1].D3N ?? "" } : null;
  } catch { return null; }
}

const CLASSES_TXT = "I (lavoura sem restrição), II (lavoura com práticas simples), III (lavoura com práticas intensivas), IV (lavoura ocasional), V (plana encharcável: pasto/floresta), VI (pasto/fruticultura/silvicultura), VII (pasto/floresta com restrição forte), VIII (preservação: APP, mata nativa, rocha, relevo excessivo)";
const SITUACOES_TXT = "OTIMA (asfalto, perto), MUITO_BOA (estrada de 1ª classe não asfaltada, tráfego permanente), BOA (estrada de terra com tráfego permanente), DESFAVORAVEL (estradas e servidões; ruim na chuva), MA (fechos/servidões; problemas sérios na chuva), PESSIMA (córregos sem ponte; problemas até na seca)";

async function pesquisarMercado(ai: Anthropic, zona: ZonaImovel, l: LeituraIa, ctx: ContextoImovel): Promise<PesquisaMercadoTecnica | null> {
  const id = l.identificacao;
  const cidade = id.cidade ?? ctx.cidade;
  const uf = id.uf ?? ctx.estado;
  if (!cidade) return null;
  const rural = zona === "RURAL";
  const cond = l.urbano?.condominio;
  const area = rural ? (l.areas.matricula_ha ?? l.areas.ccir_ha ?? l.areas.car_ha) : (l.areas.privativa_m2 ?? l.areas.construida_estimada_m2 ?? l.areas.construida_iptu_m2 ?? l.areas.construida_matricula_m2 ?? ctx.area_m2);
  const descricao = rural
    ? `imóvel rural de ${area ?? "?"} ha em ${cidade}/${uf ?? ""}${l.rural?.aptidao ? `, aptidão ${l.rural.aptidao}` : ""}${l.rural?.uso_solo?.length ? `, uso: ${l.rural.uso_solo.join(", ")}` : ""}${l.rural?.acesso ? `, acesso: ${l.rural.acesso}` : ""}`
    : `${l.urbano?.tipo ?? "imóvel"} de ${area ?? "?"} m²${l.urbano?.dormitorios ? `, ${l.urbano.dormitorios} dormitórios` : ""}, padrão ${l.urbano?.padrao_detalhe ?? l.urbano?.padrao ?? "não definido"}${l.urbano?.idade_aparente_anos ? `, ~${l.urbano.idade_aparente_anos} anos` : ""}, bairro ${id.bairro ?? "?"}, ${cidade}/${uf ?? ""}${cond?.em_condominio ? `, EM CONDOMÍNIO ${cond.tipo === "VERTICAL" ? "(edifício)" : "FECHADO (horizontal)"}${cond.nome ? ` "${cond.nome}"` : id.denominacao ? ` "${id.denominacao}"` : ""}` : cond?.em_condominio === false ? ", imóvel de rua (fora de condomínio)" : ""}`;
  const regraCondominio = rural ? "" : cond?.em_condominio
    ? `O imóvel fica EM CONDOMÍNIO: busque primeiro anúncios no MESMO condomínio (pelo nome), depois em outros condomínios ${cond.tipo === "VERTICAL" ? "/edifícios" : "fechados"} de padrão parecido no bairro/região. Se der, inclua 1 ou 2 imóveis de rua só como referência.\n`
    : cond?.em_condominio === false ? "O imóvel é de rua (fora de condomínio): prefira anúncios também fora de condomínio.\n" : "";

  const atributos = rural
    ? `"municipio":"","distancia_km":0,"data_anuncio":"yyyy-mm ou null","benfeitorias_descricao":"casa sede, galpões, currais… ou 'terra nua'","benfeitorias_valor":0,"preservacao_pct":null,"classes_area_aberta":[{"classe":"III","pct":70},{"classe":"VI","pct":30}],"situacao":"OTIMA|MUITO_BOA|BOA|DESFAVORAVEL|MA|PESSIMA"`
    : `"area_terreno":0,"padrao_detalhe":"BAIXO|MEDIO_BAIXO|MEDIO|MEDIO_ALTO|ALTO","idade":0,"estado":"a|b|c|d|e|f|g|h","indice_local":100,"local_justificativa":"","em_condominio":true,"mesmo_condominio":false`;
  const regrasAtributos = rural
    ? `Para CADA comparável, como faz o avaliador no tratamento por fatores (NBR 14653-3):
- benfeitorias_valor: valor em reais das benfeitorias citadas no anúncio (custo de reprodução depreciado, conservador; 0 se terra nua). Será DESCONTADO do preço para chegar ao valor da terra nua.
- distancia_km: distância aproximada por estrada entre o município do anúncio e o do avaliando (aceita até ~500 km).
- preservacao_pct: % da área em Reserva Legal/mata preservada SÓ se o anúncio informar (senão null — a V3 aplica a Reserva Legal do bioma). Não some APP.
- classes_area_aberta: classes de capacidade de uso da parte ABERTA/aproveitável (sem a mata/reserva), soma 100, pela descrição (relevo, % plano, lavoura, pasto, brejo, pedras). Classes: ${CLASSES_TXT}.
- situacao: acesso pela descrição (asfalto, distância da cidade/rodovia). Escala: ${SITUACOES_TXT}.
- TAMANHO: só fazendas com a MESMA metragem do avaliando ou MAIORES; menores, no máximo 200 ha a menos (${area ? `ou seja, a partir de ${Math.max(0, Math.round(area - 200)).toLocaleString("pt-BR")} ha` : "tamanho parecido"}). Fazendas maiores valem (o R$/ha entra na média). Busque no próprio município e na região, até ~500 km, começando pelos mais próximos. Faça buscas por tamanho ("fazenda ${area ? Math.round(area / 100) * 100 : 1000} hectares <município ou região>", "fazenda à venda ${area ? Math.round((area * 1.5) / 100) * 100 : 1500} ha <estado>"). Não traga fazendas menores que esse limite.`
    : `Para CADA comparável (fatores do laudo Engebanc, NBR 14653-2):
- padrao_detalhe pelo acabamento descrito/fotos do anúncio; idade aparente em anos; estado de conservação de Heidecke (a novo, b entre novo e regular, c regular, d entre regular e reparos simples, e reparos simples, f entre reparos simples e importantes, g reparos importantes, h entre importantes e sem valor).
- indice_local: localização do anúncio em relação ao AVALIANDO = 100 (ex.: rua mais valorizada, frente para o mar, bairro nobre = 110–140; pior = 70–95). Justifique em 1 frase.
- "area" = área construída (casa) ou privativa (apartamento/sala); area_terreno só para casa/terreno.
- "em_condominio" = em condomínio fechado/edifício (true), de rua (false), não dá pra saber (null); "mesmo_condominio" = true só se for no mesmo condomínio do avaliando.`;

  const system = `Você é pesquisador de mercado imobiliário de uma empresa de avaliação (V3 Partners). Use a tool "web_search" para achar de ${rural ? "6 a 10" : "5 a 10"} anúncios REAIS de VENDA ${rural ? "de fazendas/sítios/áreas rurais no mesmo município ou municípios vizinhos (mesma microrregião), de tamanho e aptidão parecidos" : "de imóveis do mesmo tipo e padrão, no mesmo bairro (ou bairros vizinhos de padrão parecido) da mesma cidade"}. Busque em portais (OLX, ZAP, VivaReal, Imovelweb, Chaves na Mão, MGF Imóveis, Fazenda Aberta, imobiliárias locais). Anote URL e fonte de cada um.
${regraCondominio}Pesquise também, em 1 ou 2 buscas, informações da região: ${rural ? "aptidão agrícola, principais culturas/pecuária, logística (rodovias), valor da terra de referência (INCRA/PPR, VTN da prefeitura)" : "infraestrutura, perfil do bairro, valorização, serviços"}.
${regrasAtributos}
Depois responda SOMENTE com JSON válido, sem markdown:
{"comparaveis":[{"titulo":"","valor":0,"area":0,"fonte_nome":"","fonte_url":"https://...","observacao":"",${atributos}}],"resumo_regiao":"3-4 frases","referencias_oficiais":"VTN/PPR ou índices oficiais encontrados (com fonte) ou null","confianca":"ALTA|MEDIA|BAIXA","observacoes":"qualidade dos comparáveis"}
Regras: "valor" = preço de venda anunciado em reais; "area" = ${rural ? "área total em HECTARES (converta alqueires/tarefas/m² pela unidade da região e diga na observação)" : "área construída/privativa em m²"}. Nunca invente anúncio nem número; se achar poucos, devolva o que achou e confiança BAIXA.`;

  const texto = await comBusca(ai, system, `Pesquise comparáveis para: ${descricao}.`, 7, 8000);
  type Bruto = Record<string, unknown>;
  const j = jsonDe<{ comparaveis?: Bruto[]; resumo_regiao?: string; referencias_oficiais?: string | null; confianca?: string; observacoes?: string }>(texto);
  const comparaveis: Comparavel[] = (j.comparaveis ?? []).map((c) => {
    const valor = num(c.valor) ?? 0;
    const areaC = num(c.area) ?? 0;
    const base: Comparavel = {
      titulo: String(c.titulo ?? "Anúncio"), valor, area: areaC, preco_unitario: areaC > 0 ? valor / areaC : 0,
      fonte_nome: (c.fonte_nome as string) ?? null, fonte_url: (c.fonte_url as string) ?? null, observacao: (c.observacao as string) ?? null,
      municipio: (c.municipio as string) ?? null, data_anuncio: (c.data_anuncio as string) ?? null,
      distancia_km: num(c.distancia_km) !== null && num(c.distancia_km)! >= 0 ? num(c.distancia_km) : null,
    };
    if (rural) {
      // O índice do comparável é montado depois (orquestração), com a mesma reserva do avaliando.
      const abertas = normalizarClasses((c.classes_area_aberta ?? c.classes) as { classe?: unknown; pct?: unknown }[]);
      const pres = num(c.preservacao_pct);
      const benf = num(c.benfeitorias_valor);
      return {
        ...base, classes_area_aberta: abertas, preservacao_pct: pres !== null && pres >= 0 && pres <= 100 ? pres : null,
        situacao: situacaoValida(c.situacao),
        benfeitorias_valor: benf !== null && benf > 0 && benf < valor ? benf : 0,
        benfeitorias_descricao: (c.benfeitorias_descricao as string) ?? null,
      };
    }
    const il = num(c.indice_local);
    return {
      ...base,
      area_terreno: num(c.area_terreno) && num(c.area_terreno)! > 0 ? num(c.area_terreno) : null,
      padrao_detalhe: padraoDetalheDe(c.padrao_detalhe),
      idade: num(c.idade) !== null && num(c.idade)! >= 0 ? num(c.idade) : null,
      estado: estadoDe(c.estado),
      indice_local: il !== null && il >= 50 && il <= 200 ? il : null,
      local_justificativa: (c.local_justificativa as string) ?? null,
      em_condominio: typeof c.em_condominio === "boolean" ? c.em_condominio : null,
      mesmo_condominio: c.mesmo_condominio === true ? true : null,
    };
  }).filter((c) => c.valor > 0 && c.area > 0);
  const confianca = comparaveis.length < 3 ? "BAIXA" : ((["ALTA", "MEDIA", "BAIXA"] as const).find((x) => x === j.confianca) ?? "MEDIA");
  const obs = [j.observacoes, j.referencias_oficiais ? `Referências oficiais: ${j.referencias_oficiais}` : null].filter(Boolean).join(" ");
  return { unidade: rural ? "ha" : "m2", comparaveis, resumo_regiao: j.resumo_regiao ?? null, confianca, observacoes: obs || null };
}

// ─── 3b. CUB do estado (custo de reprodução das construções) ────────────────

/** CUB/m² mais recente do Sinduscon do estado. Nunca inventa: o que não achar fica de fora. */
/** CUB/m² do Sinduscon (busca na internet) + SINAPI do IBGE (sempre). Nunca inventa número. */
/** VTN/ha por aptidão publicado pela Receita (SIPT) para o município — base do piso rural sem ITR. */
export async function buscarVtnMunicipal(ai: Anthropic, municipio: string, uf: string): Promise<VtnMunicipal | null> {
  const system = `Você levanta o VTN (Valor da Terra Nua) por hectare que a Receita Federal publica no SIPT para o município ${municipio}/${uf}, por aptidão agrícola (é a tabela que as prefeituras conveniadas informam para o ITR). Use a tool "web_search" e leia a página/PDF da prefeitura ou da Receita (web_fetch). Prefira o ano mais recente.
Responda SOMENTE com JSON: {"ano":"2026","fonte_nome":"","fonte_url":"https://...","valores":{"lavoura_boa":0,"lavoura_regular":0,"lavoura_restrita":0,"pastagem_plantada":0,"silvicultura_pastagem_natural":0,"preservacao":0}}
Valores em R$/ha. Nunca invente: aptidão não encontrada = null. Se não achar a tabela do município, devolva {"valores":{}}.`;
  let j: { ano?: string; fonte_nome?: string; fonte_url?: string; valores?: Record<string, unknown> } = {};
  try { j = jsonDe(await comBusca(ai, system, `VTN SIPT ${municipio}/${uf} por aptidão agrícola.`, 4, 2500)); } catch { return null; }
  const valores: Record<string, number> = {};
  for (const [k, v] of Object.entries(j.valores ?? {})) {
    const n = num(v);
    if (n !== null && n >= 10 && n <= 300000) valores[k] = n;
  }
  if (Object.keys(valores).length === 0 || !j.fonte_url) return null;
  return { municipio, uf, ano: j.ano ?? null, fonte_nome: j.fonte_nome ?? "SIPT/Receita Federal", fonte_url: j.fonte_url, valores };
}

export async function buscarCub(ai: Anthropic, uf: string): Promise<CubRef | null> {
  const system = `Você levanta o CUB/m² (Custo Unitário Básico, NBR 12721) mais recente publicado pelo Sinduscon do estado ${uf} (ou pelo cub.org.br). Use a tool "web_search". Quero os projetos-padrão residenciais R1-B, R1-N, R1-A (casa), R8-B, R8-N, R8-A (edifício), PIS (projeto de interesse social) e GI (galpão industrial), em R$/m², do mês mais recente que encontrar.
Responda SOMENTE com JSON: {"mes_ref":"MM/AAAA","fonte_nome":"","fonte_url":"https://...","valores":{"R1-B":0,"R1-N":0,"R1-A":0,"R8-B":0,"R8-N":0,"R8-A":0,"PIS":0,"GI":0}}
Nunca invente número: valor não encontrado = null. Se não achar o CUB de ${uf}, devolva {"valores":{}}.`;
  const [sinapi, texto] = await Promise.all([buscarSinapi(uf), comBusca(ai, system, `CUB/m² mais recente do estado ${uf}.`, 4, 3000).catch(() => "")]);
  let j: { mes_ref?: string; fonte_nome?: string; fonte_url?: string; valores?: Record<string, unknown> } = {};
  try { j = jsonDe(texto); } catch { /* CUB não achado: fica só o SINAPI */ }
  const valores: Record<string, number> = {};
  for (const [k, v] of Object.entries(j.valores ?? {})) {
    const n = num(v);
    if (n !== null && n >= 500 && n <= 8000) valores[k.toUpperCase().replace(/ /g, "")] = Math.round(n * 100) / 100;
  }
  if (Object.keys(valores).length === 0 && !sinapi) return null;
  return {
    uf, mes_ref: Object.keys(valores).length ? j.mes_ref ?? null : null, fonte_nome: Object.keys(valores).length ? j.fonte_nome ?? "Sinduscon" : null, fonte_url: j.fonte_url ?? null, valores,
    sinapi_m2: sinapi?.valor ?? null, sinapi_mes: sinapi?.mes ?? null,
  };
}

// ─── 3c. Classes de capacidade de uso do avaliando (rural) ──────────────────

/** Reserva Legal exigida (%) do imóvel — lida dos documentos; sem informação, 20% (regra geral do Código Florestal). */
function reservaExigida(l: LeituraIa): number {
  const v = Number(l.rural?.reserva_legal_exigida_pct);
  return v > 0 && v <= 80 ? v : 20;
}

/** Índice agronômico de cada anúncio com a MESMA reserva do avaliando (o maior entre o informado e a exigida). */
function indicesDosComparaveis(m: PesquisaMercadoTecnica | null, l: LeituraIa): PesquisaMercadoTecnica | null {
  if (!m || m.unidade !== "ha") return m;
  const rl = reservaExigida(l);
  return {
    ...m,
    comparaveis: m.comparaveis.map((c) => {
      const abertas = c.classes_area_aberta ?? [];
      if (abertas.length === 0) return { ...c, classes: [], indice_agronomico: null };
      const classes = comPreservacao(abertas, Math.max(rl, c.preservacao_pct ?? 0));
      return { ...c, classes, indice_agronomico: indiceAgronomico(classes, c.situacao ?? "BOA") };
    }),
  };
}

async function classificarTerras(ai: Anthropic, l: LeituraIa, extra: { relevo: Relevo | null; area_ha: number | null; car: { area_ha: number | null; codigo: string } | null; cidade: string | null; uf: string | null }): Promise<Terras | null> {
  const r = l.rural ?? {};
  const dados = {
    area_ha: extra.area_ha, municipio: `${extra.cidade ?? ""}/${extra.uf ?? ""}`,
    aptidao: r.aptidao, uso_solo: r.uso_solo, topografia: r.topografia, solos: r.solos, recursos_hidricos: r.recursos_hidricos,
    acesso: r.acesso, servidao: r.servidao_passagem, bioma: r.bioma,
    car: { ...r.car, sicar: extra.car },
    relevo_srtm: extra.relevo,
    benfeitorias: (r.edificacoes ?? []).map((e) => e.nome),
  };
  const system = `Você é engenheiro agrônomo avaliador (NBR 14653-3). Classifique as terras do imóvel rural pelo Sistema de Capacidade de Uso (Lepsch) e a situação/acesso (escala de Mendes Sobrinho), como no cálculo da Nota Agronômica do INCRA. Se faltar informação de solo, use a tool "web_search" (1 ou 2 buscas: solos predominantes e aptidão agrícola do município).
Classes: ${CLASSES_TXT}.
Situação: ${SITUACOES_TXT}.
Classifique SÓ a área fora da Reserva Legal: a V3 soma depois a Reserva Legal como classe VIII, com a mesma regra usada nos anúncios comparáveis. A APP NÃO é descontada à parte (critério V3; o Código Florestal permite computá-la na Reserva Legal): classifique-a pela capacidade física da terra. Relevo forte ondulado/montanhoso (SRTM) puxa para VI–VII; áreas planas mecanizáveis em solo bom = I–III; pastagem em relevo suave = III–IV; várzea encharcável = V; afloramento rochoso/relevo excessivo fora da APP = VIII. Use o relevo do SRTM como base objetiva. A soma das classes da área aberta deve dar 100.
Responda SOMENTE com JSON: {"classes_area_aberta":[{"classe":"III","pct":70,"base":"lavoura em relevo suave (SRTM 70% plano/suave)"},{"classe":"IV","pct":30,"base":"pasto em baixada com drenagem imperfeita"}],"situacao":"BOA","situacao_descricao":"","justificativa":"2-3 frases"}`;
  const j = jsonDe<{ classes_area_aberta?: { classe?: unknown; pct?: unknown; base?: unknown }[]; classes?: { classe?: unknown; pct?: unknown; base?: unknown }[]; situacao?: unknown; situacao_descricao?: string; justificativa?: string }>(
    await comBusca(ai, system, `Dados do imóvel: ${JSON.stringify(dados)}`, 3, 2000),
  );
  const abertas = normalizarClasses(j.classes_area_aberta ?? j.classes);
  if (abertas.length === 0) return null;
  const situacao = situacaoValida(j.situacao) ?? "BOA";
  // Preservação = maior entre a Reserva Legal do CAR e a exigida no bioma. A APP não entra
  // (critério V3 de 19/10/2026: área de APP não é obrigatória no cálculo).
  const rlExigida = reservaExigida(l);
  const areaCar = r.car?.area_ha ?? extra.car?.area_ha ?? extra.area_ha;
  const doCar = areaCar && r.car?.reserva_legal_ha ? (r.car.reserva_legal_ha / areaCar) * 100 : null;
  const pres = Math.max(rlExigida, doCar ?? 0);
  const base = doCar !== null && doCar >= rlExigida ? `CAR: Reserva Legal = ${doCar.toFixed(1)}%` : `Reserva Legal exigida no bioma (${rlExigida}%)${doCar !== null ? `; CAR declara ${doCar.toFixed(1)}%` : ""}`;
  const classes = comPreservacao(abertas, pres);
  return {
    classes, preservacao_pct: pres, preservacao_base: base, situacao, situacao_descricao: j.situacao_descricao ?? null,
    indice_agronomico: indiceAgronomico(classes, situacao), justificativa: j.justificativa ?? null, relevo: extra.relevo,
  };
}

// ─── 4. Localização (OpenStreetMap/Nominatim) ───────────────────────────────

const UA = { "User-Agent": "V3Partners-Plataforma/1.0 (avaliacao de imovel em garantia)", "Accept-Language": "pt-BR" };

async function geocodificar(q: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`, { headers: UA, signal: AbortSignal.timeout(8000) });
    const j = (await r.json()) as { lat: string; lon: string }[];
    return j[0] ? { lat: Number(j[0].lat), lon: Number(j[0].lon) } : null;
  } catch { return null; }
}

async function municipioDe(lat: number, lon: number): Promise<{ municipio: string | null; uf: string | null }> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&lat=${lat}&lon=${lon}`, { headers: UA, signal: AbortSignal.timeout(8000) });
    const j = (await r.json()) as { address?: Record<string, string> };
    const a = j.address ?? {};
    const uf = (a["ISO3166-2-lvl4"] ?? "").replace("BR-", "") || null;
    return { municipio: a.city ?? a.town ?? a.municipality ?? a.village ?? null, uf };
  } catch { return { municipio: null, uf: null }; }
}

// ─── 5. Parecer ─────────────────────────────────────────────────────────────

export async function escreverParecer(ai: Anthropic, av: Omit<AvaliacaoTecnica, "parecer">): Promise<Parecer> {
  const resumo = { ...av, poligonal: av.poligonal ? { ...av.poligonal, vertices: `${av.poligonal.vertices.length} vértices` } : null, arquivos: av.arquivos.map((a) => `${a.tipo}: ${a.file_name}`) };
  const msg = await ai.messages.create({
    model: MODELO, temperature: 0,
    max_tokens: 5000,
    messages: [{
      role: "user",
      content: `Você é o engenheiro avaliador responsável da V3 Partners. Com base na avaliação técnica abaixo (já calculada — NÃO recalcule valores), escreva o parecer técnico do imóvel em garantia, no tom dos laudos profissionais: objetivo e enxuto, citando matrícula, áreas, divergências e o que precisa ser regularizado. Cada item das listas = 1 frase curta (até 25 palavras), no máximo 5 itens por lista, os mais importantes primeiro. Português do Brasil, sem travessão.
${JSON.stringify(resumo)}

Se o valor de mercado foi elevado ao valor venal (valores.piso_venal_aplicado), diga isso no resumo. A certidão da matrícula vale até 90 dias (critério V3): não trate certidão com menos de 90 dias como vencida ou desatualizada. Nos imóveis rurais o valor por hectare aplicado é a média dos anúncios aceitos com a mesma metragem ou maiores, até 200 ha a menos, num raio de até 500 km (critério V3), e a APP não é descontada.

O proprietário do imóvel pode ser diferente do proponente (terceiro garantidor): isso é permitido e NÃO é ressalva nem motivo para rebaixar o aceite — no máximo recomende a assinatura do proprietário como interveniente garantidor.

Responda SOMENTE com JSON válido:
{"resumo":"parágrafo de 3-5 frases","pontos_fortes":[""],"ressalvas":[""],"recomendacoes":["ações concretas antes de aceitar a garantia"],"aceite":"ACEITAR|ACEITAR_COM_RESSALVAS|NAO_RECOMENDADO"}`,
    }],
  });
  if (msg.stop_reason === "max_tokens") throw new Error("Parecer cortado (max_tokens).");
  const p = jsonDe<Partial<Parecer>>(textoDa(msg));
  return {
    resumo: String(p.resumo ?? ""),
    pontos_fortes: Array.isArray(p.pontos_fortes) ? p.pontos_fortes.map(String) : [],
    ressalvas: Array.isArray(p.ressalvas) ? p.ressalvas.map(String) : [],
    recomendacoes: Array.isArray(p.recomendacoes) ? p.recomendacoes.map(String) : [],
    aceite: (["ACEITAR", "ACEITAR_COM_RESSALVAS", "NAO_RECOMENDADO"] as const).find((x) => x === p.aceite) ?? "ACEITAR_COM_RESSALVAS",
  };
}

// ─── Orquestração ───────────────────────────────────────────────────────────

const FALTANTES: Record<ZonaImovel, [TipoDocumentoImovel[], string][]> = {
  URBANO: [[["MATRICULA", "ESCRITURA"], "Matrícula atualizada"], [["IPTU", "CND_IPTU"], "IPTU"], [["FOTO"], "Fotos internas e externas"]],
  RURAL: [[["MATRICULA", "ESCRITURA"], "Matrícula atualizada"], [["GEO_MEMORIAL", "GEO_MAPA", "GEO_KML"], "GEO / memorial SIGEF"], [["CCIR"], "CCIR"], [["ITR", "CND_ITR"], "ITR"], [["CAR"], "CAR"], [["FOTO"], "Fotos da área e benfeitorias"]],
};

export async function gerarAvaliacaoTecnica(opts: {
  ai: Anthropic;
  arquivos: ArquivoBaixado[];
  contexto: ContextoImovel;
  valorSolicitado?: number | null;
  padraoFotos?: PadraoNivel | null;
  geradoPor?: string | null;
  /** Reavaliação: reaproveita os anúncios da avaliação anterior (mesmo valor se os documentos não mudarem). */
  mercadoAnterior?: PesquisaMercadoTecnica | null;
  /** Progresso para a tela (grava a etapa no job). */
  onEtapa?: (etapa: string) => Promise<unknown>;
}): Promise<AvaliacaoTecnica> {
  const { ai, arquivos, contexto } = opts;
  const inicio = Date.now();
  const zona = contexto.zona;
  const etapa = (e: string) => opts.onEtapa?.(e).catch(() => {});
  await etapa(`Lendo ${arquivos.length} documento(s) do imóvel`);
  const leitura = await lerDocumentos(ai, arquivos, contexto);
  await etapa(zona === "RURAL" ? "GEO, consultas públicas (CAR, TI, UC, embargos), terras e mercado" : "Pesquisando o mercado, o CUB e a região na internet");

  const arquivosLidos: ArquivoLido[] = arquivos.map((a, i) => {
    const info = leitura.arquivos?.find((x) => Number(x.indice) === i + 1);
    const tipo = a.texto !== undefined ? "GEO_KML" : ((TIPOS as string[]).includes(String(info?.tipo)) ? info!.tipo as TipoDocumentoImovel : "OUTRO");
    return { doc_id: a.entry.doc_id, file_name: a.entry.file_name, storage_path: a.entry.storage_path, tipo, resumo: info?.resumo ?? null };
  });
  const relevantes = arquivosLidos.filter((a) => a.tipo !== "NAO_RELACIONADO");
  const indicesGeo = arquivosLidos.map((a, i) => (["GEO_MEMORIAL", "GEO_MAPA", "GEO_KML"].includes(a.tipo) ? i + 1 : 0)).filter(Boolean);

  const ident = leitura.identificacao ?? {};
  const ufImovel = (ident.uf ?? contexto.estado ?? "").toUpperCase().slice(0, 2) || null;
  const areaRef = leitura.areas?.matricula_ha ?? leitura.areas?.ccir_ha ?? leitura.areas?.car_ha ?? null;
  // Rural: GEO → consultas pela poligonal (+ relevo) → classes de capacidade de uso.
  const cadeiaRural = async () => {
    let g = indicesGeo.length > 0 ? await lerVertices(ai, arquivos, indicesGeo).catch(() => null) : null;
    // A leitura de tabela longa às vezes pula vértices: se a área calculada fugir mais de 1% da
    // escrita no memorial, lê de novo e fica com a mais próxima.
    const desvio = (x: typeof g) => {
      const mm = x ? medirPoligonal(x.vertices) : null;
      const ref = x?.area_ha ?? leitura.areas?.geo_declarada_ha ?? leitura.areas?.matricula_ha ?? null;
      return mm && ref ? Math.abs(mm.area_ha - ref) / ref : null;
    };
    const d1 = desvio(g);
    // (só se ainda houver folga de tempo: a função tem 300 s no total)
    if (g && d1 !== null && d1 > 0.01 && Date.now() - inicio < 140000) {
      const g2 = await lerVertices(ai, arquivos, indicesGeo).catch(() => null);
      const d2 = desvio(g2);
      if (g2 && d2 !== null && d2 < d1) g = g2;
    }
    const m = g ? medirPoligonal(g.vertices) : null;
    const cons = g && m
      ? await consultarImovelRural(g.vertices, ufImovel, ident.documentos_proprietarios ?? []).catch((e) => { console.error("[avaliacao-tecnica] consultas:", e); return null; })
      : null;
    const terras = await classificarTerras(ai, leitura, {
      relevo: cons?.relevo ?? null, area_ha: m?.area_ha ?? areaRef,
      car: cons?.carPrincipal ? { area_ha: cons.carPrincipal.area_ha, codigo: cons.carPrincipal.codigo } : null,
      cidade: ident.cidade ?? contexto.cidade ?? null, uf: ufImovel,
    }).catch((e) => { console.error("[avaliacao-tecnica] terras:", e); return null; });
    return { geo: g, cons, terras };
  };
  const municipioImovel = ident.cidade ?? contexto.cidade ?? null;
  const [rur, mercado, cub, pontoEndereco, vtnMunicipal] = await Promise.all([
    zona === "RURAL" ? cadeiaRural() : Promise.resolve(null),
    opts.mercadoAnterior?.comparaveis?.length
      ? Promise.resolve(opts.mercadoAnterior)
      : pesquisarMercado(ai, zona, leitura, contexto).catch((e) => { console.error("[avaliacao-tecnica] mercado:", e); return null; }),
    ufImovel ? buscarCub(ai, ufImovel).catch((e) => { console.error("[avaliacao-tecnica] cub:", e); return null; }) : Promise.resolve(null),
    zona === "URBANO" && !leitura.coordenadas_imovel
      ? geocodificar([ident.endereco ?? contexto.endereco, ident.bairro, ident.cidade ?? contexto.cidade, ident.uf ?? contexto.estado].filter(Boolean).join(", "))
        .then((p) => p ?? (ident.cep ?? contexto.cep ? geocodificar(`${ident.cep ?? contexto.cep}, Brasil`) : null))
      : Promise.resolve(null),
    // Rural sem VTN declarado no ITR: VTN municipal (SIPT) para o piso do valor venal.
    zona === "RURAL" && municipioImovel && ufImovel && !(Number(leitura.rural?.itr?.vtn_declarado) > 0)
      ? buscarVtnMunicipal(ai, municipioImovel, ufImovel).catch((e) => { console.error("[avaliacao-tecnica] vtn:", e); return null; })
      : Promise.resolve(null),
  ]);

  const mercadoFinal = zona === "RURAL" ? indicesDosComparaveis(mercado, leitura) : mercado;
  const geo = rur?.geo ?? null;
  const consultas: Consulta[] = rur?.cons?.consultas ?? [];
  const terras: Terras | null = rur?.terras ?? null;
  let poligonal: Poligonal | null = null;
  if (geo) {
    const m = medirPoligonal(geo.vertices);
    if (m) {
      const loc = await municipioDe(m.centroide.lat, m.centroide.lon);
      poligonal = { vertices: geo.vertices, fonte: geo.fonte, area_ha: m.area_ha, perimetro_m: m.perimetro_m, centroide: m.centroide, municipio_centroide: loc.municipio, uf_centroide: loc.uf };
    }
  }

  const areas: QuadroAreas = {
    ...(leitura.areas ?? {}),
    geo_declarada_ha: leitura.areas?.geo_declarada_ha ?? geo?.area_ha ?? null,
    geo_calculada_ha: poligonal?.area_ha ?? null,
  };
  // Zera os 0 que a IA devolve no lugar de null.
  for (const k of Object.keys(areas) as (keyof QuadroAreas)[]) if (!(Number(areas[k]) > 0)) areas[k] = null;

  const urbano = zona === "URBANO" ? (leitura.urbano ?? {}) : null;
  const rural = zona === "RURAL" ? { ...(leitura.rural ?? {}) } : null;
  // CAR não anexado mas achado no SICAR pela poligonal: usa os dados públicos.
  const carSicar = rur?.cons?.carPrincipal;
  if (rural && carSicar && !rural.car?.codigo) {
    rural.car = { ...(rural.car ?? {}), codigo: carSicar.codigo, area_ha: rural.car?.area_ha ?? carSicar.area_ha, situacao: rural.car?.situacao ?? [carSicar.status === "AT" ? "ativo" : carSicar.status, carSicar.condicao].filter(Boolean).join(" · ") + " (SICAR)" };
    if (!areas.car_ha && carSicar.area_ha) areas.car_ha = carSicar.area_ha;
  }
  if (rural?.edificacoes) rural.edificacoes = rural.edificacoes.map((e) => ({ ...e, estado: estadoDe(e.estado) ?? estadoDe(e.conservacao) }));
  if (urbano) urbano.padrao_detalhe = padraoDetalheDe(urbano.padrao_detalhe) ?? padraoDetalheDe(urbano.padrao);
  const padrao = urbano?.padrao ?? opts.padraoFotos ?? null;
  const coordDoc = leitura.coordenadas_imovel && Number.isFinite(leitura.coordenadas_imovel.lat) && Number.isFinite(leitura.coordenadas_imovel.lon)
    ? { lat: leitura.coordenadas_imovel.lat, lon: leitura.coordenadas_imovel.lon } : null;
  const localizacao = poligonal ? { ...poligonal.centroide, fonte: "centro da poligonal do GEO" }
    : coordDoc ? { ...coordDoc, fonte: "coordenadas dos documentos" }
    : pontoEndereco ? { ...pontoEndereco, fonte: "endereço (OpenStreetMap)" } : null;

  const tiposPresentes = new Set(relevantes.map((a) => a.tipo));
  const documentos_faltantes = FALTANTES[zona].filter(([ts]) => !ts.some((t) => tiposPresentes.has(t))).map(([, nome]) => nome);

  const base = {
    versao: 2 as const,
    zona,
    gerado_em: new Date().toISOString(),
    gerado_por: opts.geradoPor ?? null,
    arquivos: arquivosLidos,
    documentos_faltantes,
    identificacao: ident,
    registro: { onus: Array.isArray(leitura.registro?.onus) ? leitura.registro.onus : [], construcao_averbada: leitura.registro?.construcao_averbada ?? null, cadeia_dominial: leitura.registro?.cadeia_dominial ?? null, observacoes: leitura.registro?.observacoes ?? null },
    areas,
    urbano,
    rural,
    poligonal,
    localizacao,
    mercado: mercadoFinal,
    laudo_externo: leitura.laudo_externo && (leitura.laudo_externo.valor_mercado || leitura.laudo_externo.empresa) ? leitura.laudo_externo : null,
    ambiental: leitura.ambiental ?? null,
    terras,
    consultas,
    vtn_municipal: vtnMunicipal,
    valor_solicitado: opts.valorSolicitado ?? null,
  };
  await etapa("Calculando valores, alertas e rating");
  const valores = calcularValores(base, padrao, { cub });
  const semAlertas = { ...base, valores, arquivos: relevantes };
  const iaAlertas = (Array.isArray(leitura.alertas) ? leitura.alertas : [])
    .filter((x) => x && x.titulo)
    .map((x) => ({ ...x, origem: "IA" as const, nivel: (["CRITICO", "ATENCAO", "INFO"] as const).find((n) => n === x.nivel) ?? "ATENCAO" }));
  const alertas = juntarAlertas(gerarAlertas(semAlertas, contexto.cliente_nome), iaAlertas);
  const rating = calcularRating(alertas);
  const semParecer = { ...base, valores, alertas, rating };
  await etapa("Escrevendo o parecer técnico");
  const parecer = await escreverParecer(ai, semParecer).catch((e) => { console.error("[avaliacao-tecnica] parecer:", e); return {
    resumo: "Parecer não gerado (falha na IA). Os dados, valores e alertas acima continuam válidos.",
    pontos_fortes: [], ressalvas: [], recomendacoes: [], aceite: "ACEITAR_COM_RESSALVAS" as const,
  }; });
  return { ...semParecer, parecer };
}
