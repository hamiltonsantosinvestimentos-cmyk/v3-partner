// Motor da Avaliação Técnica V3 (17/10/2026). Só servidor (usa service role e a API da
// Anthropic). Etapas:
//   1. separa os arquivos de imóvel da proposta (pelo item do checklist e pelo nome) e baixa;
//   2. a IA lê tudo de uma vez — classifica cada arquivo pelo CONTEÚDO (na prática o cliente
//      anexa ITR no campo do IPTU, CNH no da matrícula…) e extrai os parâmetros dos laudos;
//   3. em paralelo: vértices do GEO (rural), pesquisa de mercado na internet e localização;
//   4. regras fixas (analise.ts) calculam valores, alertas e rating;
//   5. a IA escreve o parecer com tudo já calculado.

import type { SupabaseClient } from "@supabase/supabase-js";
import type Anthropic from "@anthropic-ai/sdk";
import { webSearch } from "@/lib/web-search";
import { calcularRating, calcularValores, gerarAlertas, juntarAlertas } from "./analise";
import { deUtm, medirPoligonal, verticesDoKml, verticesValidos } from "./geo";
import type {
  Alerta, ArquivoLido, AvaliacaoTecnica, CaracteristicasRural, CaracteristicasUrbano, Comparavel, Identificacao,
  LaudoExterno, PadraoNivel, Parecer, PesquisaMercadoTecnica, Poligonal, QuadroAreas, Registro, TipoDocumentoImovel,
  VerticeGeo, ZonaImovel,
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
  const comum = `"identificacao":{"matricula":"","cartorio":"","comarca":"","data_certidao":"yyyy-mm-dd","proprietarios":[""],"inscricao_municipal":"","lote_quadra":"","endereco":"","bairro":"","cidade":"","uf":"","cep":"","denominacao":""},
"registro":{"onus":[{"tipo":"hipoteca|alienação fiduciária|penhora|indisponibilidade|usufruto|servidão|...","registro":"R-5","descricao":"","favorecido":"","ativo":true}],"construcao_averbada":"texto da averbação da construção ou null","cadeia_dominial":"última transmissão (quem, quando, como)","observacoes":""},`;
  const urbano = `"areas":{"privativa_m2":0,"terreno_matricula_m2":0,"terreno_iptu_m2":0,"construida_matricula_m2":0,"construida_iptu_m2":0,"construida_estimada_m2":0},
"urbano":{"tipo":"casa|apartamento|sala comercial|galpão|terreno|...","padrao":"BAIXO|MEDIO|ALTO","padrao_descricao":"","idade_aparente_anos":0,"conservacao":"novo|entre novo e regular|regular|reparos simples|reparos importantes","pavimentos":0,"dormitorios":0,"suites":0,"vagas":0,"compartimentos":[""],"acabamentos":[{"ambiente":"","descricao":"piso / parede / teto"}],"estrutura":"","cobertura":"","esquadrias":"","lazer":[""],"topografia":"","formato_terreno":"","testada_m":0,"zoneamento":"","situacao":"isolado|condomínio|esquina|...","ocupacao":"","infraestrutura":["água","esgoto","energia","pavimentação",...],"vizinhanca":"","servicos_proximos":[""],"riscos":[""],"iptu":{"exercicio":0,"valor_venal_terreno":0,"valor_venal_construcao":0,"valor_venal_total":0,"valor_iptu_anual":0,"debitos":""}},
"rural":null,`;
  const rural = `"areas":{"matricula_ha":0,"ccir_ha":0,"itr_ha":0,"car_ha":0,"geo_declarada_ha":0},
"urbano":null,
"rural":{"denominacao":"","codigo_incra":"","ccir":{"numero":"","exercicio":"","situacao":"quitado|pendente|...","area_ha":0,"modulos_fiscais":0,"fracao_minima_ha":0,"classificacao":"minifúndio|pequena|média|grande propriedade"},"itr":{"nirf":"","exercicio":0,"area_ha":0,"vtn_declarado":0,"situacao":""},"car":{"codigo":"","situacao":"ativo|pendente|...","area_ha":0,"reserva_legal_ha":0,"app_ha":0,"vegetacao_nativa_ha":0,"area_consolidada_ha":0},"geo":{"certificado":true,"codigo_parcela":"","data_certificacao":"yyyy-mm-dd","averbado_na_matricula":true,"responsavel_tecnico":"","datum":"SIRGAS 2000","perimetro_m":0},"modulo_fiscal_ha":0,"porte":"","bioma":"","reserva_legal_exigida_pct":20,"aptidao":"","uso_solo":[""],"recursos_hidricos":[""],"cercas":"","acesso":"","servidao_passagem":"registrada (R-x) | sem servidão registrada, acesso por ... | não se aplica","edificacoes":[{"nome":"","area_m2":0,"idade_aparente_anos":0,"conservacao":"","averbada":false,"descricao":""}]},`;

  return `Você é engenheiro avaliador da V3 Partners (NBR 14653-${ctx.zona === "RURAL" ? "3, imóveis rurais" : "2, imóveis urbanos"}), montando a avaliação técnica de um imóvel ${ctx.zona === "RURAL" ? "RURAL" : "URBANO"} dado em garantia de crédito. Hoje é ${hoje}.
Os arquivos acima foram anexados pelo cliente/partner. ATENÇÃO: muitas vezes estão no item errado do checklist (ITR no campo do IPTU, CNH no campo da matrícula). Classifique cada arquivo pelo CONTEÚDO, não pelo item nem pelo nome.
${ctx.outros_imoveis && ctx.outros_imoveis > 0 ? `A proposta tem ${ctx.outros_imoveis + 1} imóveis. Avalie SÓ o imóvel abaixo; arquivos de outro imóvel = "NAO_RELACIONADO".\n` : ""}Dados do imóvel na proposta: ${[ctx.endereco, ctx.cidade && ctx.estado ? `${ctx.cidade}/${ctx.estado}` : ctx.cidade, ctx.cep ? `CEP ${ctx.cep}` : null, ctx.area_m2 ? `${ctx.area_m2} m²` : null].filter(Boolean).join(" · ") || "não informados"}. Cliente: ${ctx.cliente_nome ?? "não informado"}.

O que extrair (parâmetros que os avaliadores usam nos laudos):
- Matrícula: número, cartório/comarca, data de emissão da certidão, proprietários ATUAIS (só os nomes, após a última transmissão), descrição do imóvel, área, averbação de construção, cadeia dominial recente.
- onus = SÓ gravames (hipoteca, alienação fiduciária, penhora, arresto, indisponibilidade, usufruto, servidão, cláusulas de inalienabilidade/impenhorabilidade, ações reais/reipersecutórias, bem de família), dizendo se estão ativos ou cancelados na própria matrícula. Averbação de casamento, pacto antenupcial, divórcio, óbito, nome, construção ou condomínio NÃO é ônus.
${ctx.zona === "RURAL"
    ? `- CCIR: número, exercício, situação, área total, módulos fiscais, fração mínima, classificação fundiária. ITR: NIRF, exercício, área, VTN declarado. CAR: código, situação, área, Reserva Legal, APP, vegetação nativa, área consolidada.
- GEO/SIGEF: certificação (código da parcela, data), se está averbado na matrícula, responsável técnico, datum, área e perímetro escritos no memorial. NÃO liste os vértices aqui (outra etapa lê).
- Fotos: uso do solo (lavoura, pasto, mata), cercas, água (açude, rio, poço), acesso, edificações (casa sede, galpão, curral…) com área estimada, idade aparente e conservação; marque averbada=false se a matrícula não averba.
- Reserva Legal exigida conforme bioma/região (Amazônia Legal: 80% floresta, 35% cerrado; demais: 20%).`
    : `- Unidade em condomínio (apartamento, sala, casa em condomínio): privativa_m2 = área privativa/útil; construida_matricula_m2 = área total (privativa + comum); terreno_matricula_m2 = fração ideal em m² se houver. A construção de unidade em condomínio instituído já está averbada pela instituição do condomínio (não gere alerta de construção não averbada).
- IPTU: inscrição, exercício, área do terreno, área construída cadastrada, valores venais (terreno, construção, total), valor do imposto, débitos.
- Fotos: tipo, padrão construtivo (BAIXO/MEDIO/ALTO), idade aparente, conservação, compartimentos, acabamentos por ambiente (piso/parede/teto), estrutura, cobertura, esquadrias, lazer, vagas. Estime a área construída real (construida_estimada_m2) só se houver base (anúncio, planta, laudo, levantamento); senão null.`}
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
    model: MODELO,
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
    model: MODELO,
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

async function pesquisarMercado(ai: Anthropic, zona: ZonaImovel, l: LeituraIa, ctx: ContextoImovel): Promise<PesquisaMercadoTecnica | null> {
  const id = l.identificacao;
  const cidade = id.cidade ?? ctx.cidade;
  const uf = id.uf ?? ctx.estado;
  if (!cidade) return null;
  const rural = zona === "RURAL";
  const area = rural ? (l.areas.matricula_ha ?? l.areas.ccir_ha ?? l.areas.car_ha) : (l.areas.construida_estimada_m2 ?? l.areas.construida_iptu_m2 ?? l.areas.construida_matricula_m2 ?? ctx.area_m2);
  const descricao = rural
    ? `imóvel rural de ${area ?? "?"} ha em ${cidade}/${uf ?? ""}${l.rural?.aptidao ? `, aptidão ${l.rural.aptidao}` : ""}${l.rural?.uso_solo?.length ? `, uso: ${l.rural.uso_solo.join(", ")}` : ""}`
    : `${l.urbano?.tipo ?? "imóvel"} de ${area ?? "?"} m² construídos${l.urbano?.dormitorios ? `, ${l.urbano.dormitorios} dormitórios` : ""}, padrão ${l.urbano?.padrao ?? "não definido"}, bairro ${id.bairro ?? "?"}, ${cidade}/${uf ?? ""}`;

  const system = `Você é pesquisador de mercado imobiliário da V3 Partners. Use a tool "web_search" para achar de 4 a 8 anúncios REAIS de VENDA ${rural ? "de fazendas/sítios/áreas rurais no mesmo município ou municípios vizinhos (mesma microrregião), de tamanho e aptidão parecidos" : "de imóveis do mesmo tipo e padrão, no mesmo bairro (ou bairros vizinhos de padrão parecido) da mesma cidade"}. Priorize anúncios recentes (ZAP, VivaReal, OLX, Imovelweb, Chaves na Mão, MGF Imóveis, imobiliárias locais).
Pesquise também, em 1 ou 2 buscas, informações da região: ${rural ? "aptidão agrícola, principais culturas/pecuária, logística (rodovias), valor da terra nua de referência" : "infraestrutura, perfil do bairro, valorização, serviços"}.
Depois responda SOMENTE com JSON válido, sem markdown:
{"comparaveis":[{"titulo":"","valor":0,"area":0,"fonte_nome":"","fonte_url":"https://...","observacao":"${rural ? "benfeitorias, distância, aptidão" : "padrão, conservação, diferenças"}"}],"resumo_regiao":"3-4 frases","confianca":"ALTA|MEDIA|BAIXA","observacoes":"qualidade dos comparáveis"}
Regras: "valor" = preço de venda anunciado em reais; "area" = ${rural ? "área total em HECTARES (converta alqueires/tarefas/m² pela unidade da região e diga na observação)" : "área construída/privativa em m²"}. Nunca invente anúncio nem número; se achar poucos, devolva o que achou e confiança BAIXA.`;

  const tools = [{
    name: "web_search",
    description: "Busca na internet (anúncios de imóveis e informações da região).",
    input_schema: { type: "object" as const, properties: { query: { type: "string", description: "Busca em português com cidade/UF" } }, required: ["query"] },
  }];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msgs: any[] = [{ role: "user", content: `Pesquise comparáveis para: ${descricao}.` }];
  let texto = "";
  for (let i = 0; i < 5; i++) {
    const r = await ai.messages.create({ model: MODELO, max_tokens: 3000, system, messages: msgs, tools });
    if (r.stop_reason !== "tool_use") { texto = textoDa(r); break; }
    msgs.push({ role: "assistant", content: r.content });
    const resultados = await Promise.all(r.content.filter((b) => b.type === "tool_use").map(async (b) => {
      const t = b as { id: string; input: { query: string } };
      return { type: "tool_result" as const, tool_use_id: t.id, content: (await webSearch(t.input.query)) || "Sem resultados." };
    }));
    msgs.push({ role: "user", content: resultados });
  }
  if (!texto) {
    const r = await ai.messages.create({ model: MODELO, max_tokens: 3000, system, messages: [...msgs, { role: "user", content: "Responda AGORA só com o JSON final." }] });
    texto = textoDa(r);
  }
  const j = jsonDe<{ comparaveis?: { titulo?: string; valor?: unknown; area?: unknown; fonte_nome?: string; fonte_url?: string; observacao?: string }[]; resumo_regiao?: string; confianca?: string; observacoes?: string }>(texto);
  const comparaveis: Comparavel[] = (j.comparaveis ?? []).map((c) => {
    const valor = num(c.valor) ?? 0;
    const area = num(c.area) ?? 0;
    return { titulo: String(c.titulo ?? "Anúncio"), valor, area, preco_unitario: area > 0 ? valor / area : 0, fonte_nome: c.fonte_nome ?? null, fonte_url: c.fonte_url ?? null, observacao: c.observacao ?? null };
  }).filter((c) => c.valor > 0 && c.area > 0);
  const confianca = comparaveis.length < 3 ? "BAIXA" : ((["ALTA", "MEDIA", "BAIXA"] as const).find((x) => x === j.confianca) ?? "MEDIA");
  return { unidade: rural ? "ha" : "m2", comparaveis, resumo_regiao: j.resumo_regiao ?? null, confianca, observacoes: j.observacoes ?? null };
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
    model: MODELO,
    max_tokens: 5000,
    messages: [{
      role: "user",
      content: `Você é o engenheiro avaliador responsável da V3 Partners. Com base na avaliação técnica abaixo (já calculada — NÃO recalcule valores), escreva o parecer técnico do imóvel em garantia, no tom dos laudos profissionais: objetivo e enxuto, citando matrícula, áreas, divergências e o que precisa ser regularizado. Cada item das listas = 1 frase curta (até 25 palavras), no máximo 5 itens por lista, os mais importantes primeiro. Português do Brasil, sem travessão.
${JSON.stringify(resumo)}

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
  /** Progresso para a tela (grava a etapa no job). */
  onEtapa?: (etapa: string) => Promise<unknown>;
}): Promise<AvaliacaoTecnica> {
  const { ai, arquivos, contexto } = opts;
  const zona = contexto.zona;
  const etapa = (e: string) => opts.onEtapa?.(e).catch(() => {});
  await etapa(`Lendo ${arquivos.length} documento(s) do imóvel`);
  const leitura = await lerDocumentos(ai, arquivos, contexto);
  await etapa(zona === "RURAL" ? "Lendo os vértices do GEO e pesquisando o mercado" : "Pesquisando o mercado e a região na internet");

  const arquivosLidos: ArquivoLido[] = arquivos.map((a, i) => {
    const info = leitura.arquivos?.find((x) => Number(x.indice) === i + 1);
    const tipo = a.texto !== undefined ? "GEO_KML" : ((TIPOS as string[]).includes(String(info?.tipo)) ? info!.tipo as TipoDocumentoImovel : "OUTRO");
    return { doc_id: a.entry.doc_id, file_name: a.entry.file_name, storage_path: a.entry.storage_path, tipo, resumo: info?.resumo ?? null };
  });
  const relevantes = arquivosLidos.filter((a) => a.tipo !== "NAO_RELACIONADO");
  const indicesGeo = arquivosLidos.map((a, i) => (["GEO_MEMORIAL", "GEO_MAPA", "GEO_KML"].includes(a.tipo) ? i + 1 : 0)).filter(Boolean);

  const ident = leitura.identificacao ?? {};
  const [geo, mercado, pontoEndereco] = await Promise.all([
    zona === "RURAL" && indicesGeo.length > 0 ? lerVertices(ai, arquivos, indicesGeo).catch(() => null) : Promise.resolve(null),
    pesquisarMercado(ai, zona, leitura, contexto).catch(() => null),
    zona === "URBANO" && !leitura.coordenadas_imovel
      ? geocodificar([ident.endereco ?? contexto.endereco, ident.bairro, ident.cidade ?? contexto.cidade, ident.uf ?? contexto.estado].filter(Boolean).join(", "))
        .then((p) => p ?? (ident.cep ?? contexto.cep ? geocodificar(`${ident.cep ?? contexto.cep}, Brasil`) : null))
      : Promise.resolve(null),
  ]);

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
  const rural = zona === "RURAL" ? (leitura.rural ?? {}) : null;
  const padrao = urbano?.padrao ?? opts.padraoFotos ?? null;
  const coordDoc = leitura.coordenadas_imovel && Number.isFinite(leitura.coordenadas_imovel.lat) && Number.isFinite(leitura.coordenadas_imovel.lon)
    ? { lat: leitura.coordenadas_imovel.lat, lon: leitura.coordenadas_imovel.lon } : null;
  const localizacao = poligonal ? { ...poligonal.centroide, fonte: "centro da poligonal do GEO" }
    : coordDoc ? { ...coordDoc, fonte: "coordenadas dos documentos" }
    : pontoEndereco ? { ...pontoEndereco, fonte: "endereço (OpenStreetMap)" } : null;

  const tiposPresentes = new Set(relevantes.map((a) => a.tipo));
  const documentos_faltantes = FALTANTES[zona].filter(([ts]) => !ts.some((t) => tiposPresentes.has(t))).map(([, nome]) => nome);

  const base = {
    versao: 1 as const,
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
    mercado,
    laudo_externo: leitura.laudo_externo && (leitura.laudo_externo.valor_mercado || leitura.laudo_externo.empresa) ? leitura.laudo_externo : null,
    ambiental: leitura.ambiental ?? null,
    valor_solicitado: opts.valorSolicitado ?? null,
  };
  await etapa("Calculando valores, alertas e rating");
  const valores = calcularValores(base, padrao);
  const semAlertas = { ...base, valores, arquivos: relevantes };
  const iaAlertas = (Array.isArray(leitura.alertas) ? leitura.alertas : [])
    .filter((x) => x && x.titulo)
    .map((x) => ({ ...x, nivel: (["CRITICO", "ATENCAO", "INFO"] as const).find((n) => n === x.nivel) ?? "ATENCAO" }));
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
