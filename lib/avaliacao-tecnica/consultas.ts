// Consultas públicas do imóvel rural (19/10/2026) — o que as avaliadoras e as mesas de crédito
// rural conferem antes de aceitar a garantia, feito pela poligonal do GEO:
//   • CAR (SICAR): acha o CAR que cobre a área mesmo sem o documento anexado, e CAR de terceiros
//     sobreposto;
//   • Terra Indígena (FUNAI), Unidade de Conservação (CNUC/MMA);
//   • Embargos ambientais (IBAMA e ICMBio) pela área e pelo CPF/CNPJ do proprietário;
//   • Alertas de desmatamento DETER (INPE, via IBAMA) na Amazônia;
//   • Relevo (SRTM 90 m): altitude e declividade → classes de relevo da Embrapa.
// Só servidor. Cada consulta tem timeout e, se a base estiver fora do ar, volta INDISPONIVEL
// (nunca trava a avaliação nem vira "livre" sem ter consultado).

import https from "node:https";
import tls from "node:tls";
import { pontoNaPoligonal } from "./geo";
import { RELEVO_EMBRAPA } from "./normas";
import type { Consulta, Relevo, VerticeGeo } from "./tipos";

const UA = { "User-Agent": "Mozilla/5.0 (V3Partners avaliacao de imovel em garantia)" };
const TIMEOUT = 25000;

type Anel = [number, number][]; // [lon, lat]

/**
 * O servidor da FUNAI não envia o certificado intermediário (cadeia SSL incompleta) e o Node
 * recusa a conexão. Em vez de desligar a verificação, junta o intermediário público da Sectigo
 * (CA Issuers do próprio certificado da FUNAI; válido até 2036) às raízes padrão, só nessa chamada.
 */
const SECTIGO_OV_R36 = `-----BEGIN CERTIFICATE-----
MIIGTDCCBDSgAwIBAgIQLBo8dulD3d3/GRsxiQrtcTANBgkqhkiG9w0BAQwFADBf
MQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTYwNAYDVQQD
Ey1TZWN0aWdvIFB1YmxpYyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gUm9vdCBSNDYw
HhcNMjEwMzIyMDAwMDAwWhcNMzYwMzIxMjM1OTU5WjBgMQswCQYDVQQGEwJHQjEY
MBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTcwNQYDVQQDEy5TZWN0aWdvIFB1Ymxp
YyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gQ0EgT1YgUjM2MIIBojANBgkqhkiG9w0B
AQEFAAOCAY8AMIIBigKCAYEApkMtJ3R06jo0fceI0M52B7K+TyMeGcv2BQ5AVc3j
lYt76TvHIu/nNe22W/RJXX9rWUD/2GE6GF5x0V4bsY7K3IeJ8E7+KzG/TGboySfD
u+F52jqQBbY62ofhYjMeiAbLI02+FqwHeM8uIrUtcX8b2RCxF358TB0NHVccAXZc
FYgZndZCeXxjuca7pJJ20LLUnXtgXcjAE1vY4WvbReW0W6mkeZyNGdmpTcFs5Y+s
yy6LtE5Zocji9J9NlNnReox2RWVyEXpA1ChZ4gqN+ZpVSIQ0HBorVFbBKyhdZyEX
gZgNSNtBRwxqwIzJePJhYd4ZUhO1vk+/uP3nwDk0p95q/j7naXNCSvESnrHPypaB
WRK066nKfPRPi9m9kIOhMdYfS8giFRTcdgL24Ycilj7ecAK9Trh0VbjwouJ4WH+x
bt47u68ZFCD/ac55I0DNHkCpaPruj6e9Rmr7K46wZDAYXuEAqB7tGG/jd6JAA+H2
O44CV98NRsU213f1kScIZntNAgMBAAGjggGBMIIBfTAfBgNVHSMEGDAWgBRWc1hk
lfmSGrASKgRieaFAFYghSTAdBgNVHQ4EFgQU42Z0u3BojSxdTg6mSo+bNyKcgpIw
DgYDVR0PAQH/BAQDAgGGMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0lBBYwFAYI
KwYBBQUHAwEGCCsGAQUFBwMCMBsGA1UdIAQUMBIwBgYEVR0gADAIBgZngQwBAgIw
VAYDVR0fBE0wSzBJoEegRYZDaHR0cDovL2NybC5zZWN0aWdvLmNvbS9TZWN0aWdv
UHVibGljU2VydmVyQXV0aGVudGljYXRpb25Sb290UjQ2LmNybDCBhAYIKwYBBQUH
AQEEeDB2ME8GCCsGAQUFBzAChkNodHRwOi8vY3J0LnNlY3RpZ28uY29tL1NlY3Rp
Z29QdWJsaWNTZXJ2ZXJBdXRoZW50aWNhdGlvblJvb3RSNDYucDdjMCMGCCsGAQUF
BzABhhdodHRwOi8vb2NzcC5zZWN0aWdvLmNvbTANBgkqhkiG9w0BAQwFAAOCAgEA
BZXWDHWC3cubb/e1I1kzi8lPFiK/ZUoH09ufmVOrc5ObYH/XKkWUexSPqRkwKFKr
7r8OuG+p7VNB8rifX6uopqKAgsvZtZsq7iAFw04To6vNcxeBt1Eush3cQ4b8nbQR
MQLChgEAqwhuXp9P48T4QEBSksYav7+aFjNySsLYlPzNqVM3RNwvBdvp6vgDtGwc
xlKQZVuuNVIaoYyls8swhxDeSHKpRdxRauTLZ+pl+wGvy0pnrLEJGSz9mOEmfbod
e/XopR2NGqaHJ6bIjyxPu6UtyQGI26En7UAEozACrHz06Nx2jTAY9E6NeB6XuobE
wLK025ZRmvglcURG1BrV24tGHHTgxCe8M3oGlpUSMTKQ2dkgljZVYt+gKdFtWELZ
MuRdi+X3XsrR8LFz+aLUiDRfQqhmw3RxjIyVKvvu9UPYY1nsvxYmFnUSeM+2q1z/
iPUry+xDY9MC6+IhleKT094VKdFVp7LXH42+wvU+17lRolQ2mK2N/nBLVBwaIhib
QXw4VYKwB86Bc6eS6iqsc94KEgD/U4VsjmgfhK+Xp4NM+VYzTTa3QeV3p8xOM0cw
q1p8oZFA+OBcz3FYWpDIe5j0NWKlw9hXsTyPY/HeZUV59akskSOSRSmDfe8wJDPX
58uB9/7lud0G3x0pxQAcffP0ayKavNwDTw4UfJ34cEw=
-----END CERTIFICATE-----`;

function getJsonComCadeia(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: UA, ca: [...tls.rootCertificates, SECTIGO_OV_R36], timeout: TIMEOUT }, (res) => {
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`HTTP ${res.statusCode}`)); return; }
      let dados = "";
      res.setEncoding("utf8");
      res.on("data", (c) => { dados += c; });
      res.on("end", () => { try { resolve(JSON.parse(dados)); } catch (e) { reject(e); } });
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

async function getJson(url: string, init?: RequestInit) {
  const r = await fetch(url, { ...init, headers: { ...UA, ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(TIMEOUT) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function bbox(vs: VerticeGeo[]) {
  const lons = vs.map((v) => v.lon), lats = vs.map((v) => v.lat);
  return { minLon: Math.min(...lons), maxLon: Math.max(...lons), minLat: Math.min(...lats), maxLat: Math.max(...lats) };
}

/** Pontos de uma grade regular dentro da poligonal (para relevo e para medir sobreposição). */
export function gradeInterna(vs: VerticeGeo[], alvo = 90): { lat: number; lon: number; i: number; j: number }[] {
  const b = bbox(vs);
  const lado = Math.max(3, Math.round(Math.sqrt(alvo * 1.6)));
  const out: { lat: number; lon: number; i: number; j: number }[] = [];
  for (let i = 0; i < lado; i++) {
    for (let j = 0; j < lado; j++) {
      const lat = b.minLat + ((i + 0.5) / lado) * (b.maxLat - b.minLat);
      const lon = b.minLon + ((j + 0.5) / lado) * (b.maxLon - b.minLon);
      if (pontoNaPoligonal(lat, lon, vs)) out.push({ lat, lon, i, j });
    }
  }
  return out.slice(0, 100);
}

/** Ponto dentro do anel [lon, lat] (ray casting). */
function dentroAnel(lon: number, lat: number, anel: Anel) {
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const [xi, yi] = anel[i], [xj, yj] = anel[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

function segCruza(a: [number, number], b: [number, number], c: [number, number], d: [number, number]) {
  const o = (p: [number, number], q: [number, number], r: [number, number]) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
}

/** Polígonos se tocam: vértice de um dentro do outro ou arestas se cruzando. */
function intersecta(nosso: Anel, outro: Anel) {
  if (nosso.some(([x, y]) => dentroAnel(x, y, outro)) || outro.some(([x, y]) => dentroAnel(x, y, nosso))) return true;
  // Só as arestas do outro polígono que passam pela caixa da nossa área (TI/UC têm milhares).
  const xs = nosso.map((p) => p[0]), ys = nosso.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  for (let k = 0; k < outro.length; k++) {
    const c = outro[k], d = outro[(k + 1) % outro.length];
    if (Math.max(c[0], d[0]) < x0 || Math.min(c[0], d[0]) > x1 || Math.max(c[1], d[1]) < y0 || Math.min(c[1], d[1]) > y1) continue;
    for (let i = 0; i < nosso.length; i++) {
      if (segCruza(nosso[i], nosso[(i + 1) % nosso.length], c, d)) return true;
    }
  }
  return false;
}

/** Anéis externos de um GeoJSON Polygon/MultiPolygon. */
function aneis(geom: { type?: string; coordinates?: unknown } | null | undefined): Anel[] {
  if (!geom?.coordinates) return [];
  if (geom.type === "Polygon") return [((geom.coordinates as Anel[])[0] ?? [])];
  if (geom.type === "MultiPolygon") return (geom.coordinates as Anel[][]).map((p) => p[0] ?? []);
  return [];
}

/** Fração da grade interna da nossa área que cai dentro do polígono (≈ % de sobreposição). */
function fracaoDentro(grade: { lat: number; lon: number }[], polis: Anel[]) {
  if (grade.length === 0) return 0;
  return grade.filter((p) => polis.some((a) => dentroAnel(p.lon, p.lat, a))).length / grade.length;
}

async function wfs(base: string, tipo: string, b: ReturnType<typeof bbox>, max = 200, cadeiaPropria = false) {
  const u = `${base}?service=WFS&version=1.0.0&request=GetFeature&typeName=${encodeURIComponent(tipo)}&outputFormat=application/json&maxFeatures=${max}&BBOX=${b.minLon},${b.minLat},${b.maxLon},${b.maxLat}`;
  const j = (await (cadeiaPropria ? getJsonComCadeia(u) : getJson(u))) as { features?: { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } }[] };
  return j.features ?? [];
}

/** Consulta de feição em serviço ArcGIS do IBAMA que intersecta a poligonal (servidor faz o teste). */
async function arcgis(servico: string, anel: Anel, campos: string, where = "1=1") {
  const body = new URLSearchParams({
    geometry: JSON.stringify({ rings: [[...anel, anel[0]]], spatialReference: { wkid: 4674 } }),
    geometryType: "esriGeometryPolygon", inSR: "4674", spatialRel: "esriSpatialRelIntersects",
    where, outFields: campos, returnGeometry: "false", resultRecordCount: "50", f: "json",
  });
  const j = (await getJson(`https://pamgia.ibama.gov.br/server/rest/services/${servico}/FeatureServer/0/query`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
  })) as { features?: { attributes: Record<string, unknown> }[]; error?: { message?: string } };
  if (j.error) throw new Error(j.error.message ?? "erro ArcGIS");
  return (j.features ?? []).map((f) => f.attributes);
}

async function arcgisWhere(servico: string, where: string, campos: string) {
  const u = `https://pamgia.ibama.gov.br/server/rest/services/${servico}/FeatureServer/0/query?where=${encodeURIComponent(where)}&outFields=${encodeURIComponent(campos)}&returnGeometry=false&resultRecordCount=20&f=json`;
  const j = (await getJson(u)) as { features?: { attributes: Record<string, unknown> }[]; error?: { message?: string } };
  if (j.error) throw new Error(j.error.message ?? "erro ArcGIS");
  return (j.features ?? []).map((f) => f.attributes);
}

const dataBR = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const d = new Date(typeof v === "number" ? v : String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
};

// ── Cada consulta ───────────────────────────────────────────────────────────────────────

function medirArea(vs: VerticeGeo[]): number | null {
  // Área aproximada (ha) pela fórmula do polígono em metros locais — só para comparar tamanhos.
  if (vs.length < 3) return null;
  const lat0 = (vs.reduce((s, v) => s + v.lat, 0) / vs.length) * (Math.PI / 180);
  let a = 0;
  for (let i = 0; i < vs.length; i++) {
    const p = vs[i], q = vs[(i + 1) % vs.length];
    a += (p.lon * Math.cos(lat0)) * q.lat - (q.lon * Math.cos(lat0)) * p.lat;
  }
  return (Math.abs(a) / 2) * 111320 * 111320 / 10000;
}

export interface CarEncontrado { codigo: string; area_ha: number | null; status: string | null; condicao: string | null; municipio: string | null; sobreposicao_pct: number }

async function consultarCar(vs: VerticeGeo[], uf: string | null, grade: { lat: number; lon: number }[]): Promise<{ consulta: Consulta; principal: CarEncontrado | null }> {
  const base: Omit<Consulta, "status" | "detalhe"> = { id: "CAR", nome: "CAR (SICAR)", fonte: "SICAR — geoserver.car.gov.br", consultado_em: new Date().toISOString() };
  if (!uf) return { consulta: { ...base, status: "INDISPONIVEL", detalhe: "UF do imóvel não identificada." }, principal: null };
  const nosso: Anel = vs.map((v) => [v.lon, v.lat]);
  const feats = await wfs("https://geoserver.car.gov.br/geoserver/sicar/wfs", `sicar:sicar_imoveis_${uf.toLowerCase()}`, bbox(vs), 300);
  const cars: CarEncontrado[] = feats
    .map((f) => ({ f, polis: aneis(f.geometry) }))
    .filter(({ polis }) => polis.some((a) => intersecta(nosso, a)))
    .map(({ f, polis }) => ({
      codigo: String(f.properties.cod_imovel ?? ""),
      area_ha: Number(f.properties.area) || null,
      status: f.properties.status_imovel ? String(f.properties.status_imovel) : null,
      condicao: f.properties.condicao ? String(f.properties.condicao) : null,
      municipio: f.properties.municipio ? String(f.properties.municipio) : null,
      sobreposicao_pct: Math.round(fracaoDentro(grade, polis) * 100),
    }))
    .filter((c) => c.codigo);
  // CAR cancelado não conta. Principal = o que mais cobre a área com tamanho parecido
  // (CARs enormes que englobam a região — glebas antigas, assentamentos — não são "o" CAR).
  const ativos = cars.filter((c) => c.status !== "CA" && c.sobreposicao_pct >= 5);
  const nossaArea = medirArea(vs);
  const nota = (c: CarEncontrado) => {
    const r = c.area_ha && nossaArea ? Math.min(c.area_ha, nossaArea) / Math.max(c.area_ha, nossaArea) : 0.5;
    return c.sobreposicao_pct * (0.3 + 0.7 * r);
  };
  const relevantes = [...ativos].sort((a, b) => nota(b) - nota(a));
  const principal = relevantes[0] ?? null;
  const cancelados = cars.filter((c) => c.status === "CA" && c.sobreposicao_pct >= 5).length;
  const status = { AT: "ativo", PE: "pendente", SU: "suspenso", CA: "cancelado" } as Record<string, string>;
  const itens = relevantes.slice(0, 8).map((c) => `${c.codigo} · ${c.area_ha ? `${c.area_ha.toLocaleString("pt-BR")} ha` : "—"} · ${status[c.status ?? ""] ?? c.status ?? "—"}${c.condicao ? ` · ${c.condicao}` : ""} · cobre ~${c.sobreposicao_pct}% da área`);
  const obsCancel = cancelados ? ` ${cancelados} CAR(s) cancelado(s) também cobrem a área (desconsiderados).` : "";
  if (!principal) return { consulta: { ...base, status: "LIVRE", detalhe: `Nenhum CAR ativo cobrindo a poligonal foi encontrado no SICAR.${obsCancel}`, itens: [] }, principal: null };
  return { consulta: { ...base, status: "ENCONTRADO", detalhe: `${relevantes.length} CAR(s) ativo(s) sobre a área. Principal: ${principal.codigo}.${obsCancel}`, itens }, principal };
}

async function consultarTi(vs: VerticeGeo[]): Promise<Consulta> {
  const base = { id: "TI" as const, nome: "Terra Indígena (FUNAI)", fonte: "FUNAI — geoserver.funai.gov.br", consultado_em: new Date().toISOString() };
  const nosso: Anel = vs.map((v) => [v.lon, v.lat]);
  const feats = (await wfs("https://geoserver.funai.gov.br/geoserver/Funai/ows", "Funai:tis_poligonais", bbox(vs), 20, true))
    .filter((f) => aneis(f.geometry).some((a) => intersecta(nosso, a)));
  if (feats.length === 0) return { ...base, status: "LIVRE", detalhe: "Sem sobreposição com Terra Indígena." };
  return { ...base, status: "ENCONTRADO", detalhe: `Sobrepõe ${feats.length} Terra(s) Indígena(s).`, itens: feats.map((f) => `${f.properties.terrai_nome ?? "TI"} (${f.properties.etnia_nome ?? "—"}) · fase ${f.properties.fase_ti ?? "—"}`) };
}

async function consultarUc(vs: VerticeGeo[]): Promise<Consulta> {
  const base = { id: "UC" as const, nome: "Unidade de Conservação (CNUC/MMA)", fonte: "MMA — geoservicos.inde.gov.br (CNUC)", consultado_em: new Date().toISOString() };
  const nosso: Anel = vs.map((v) => [v.lon, v.lat]);
  const feats = (await wfs("https://geoservicos.inde.gov.br/geoserver/MMA/ows", "MMA:cnuc_2026_03_atualizado", bbox(vs), 30))
    .filter((f) => aneis(f.geometry).some((a) => intersecta(nosso, a)));
  if (feats.length === 0) return { ...base, status: "LIVRE", detalhe: "Sem sobreposição com Unidade de Conservação." };
  // n6 = nome, n21 = grupo (Proteção Integral / Uso Sustentável), n22 = categoria, n17 = esfera.
  const itens = feats.map((f) => `${f.properties.n6 ?? "UC"} · ${f.properties.n22 ?? "—"} · ${f.properties.n21 ?? "—"} · ${f.properties.n17 ?? ""}`.trim());
  const integral = feats.some((f) => /integral/i.test(String(f.properties.n21 ?? "")));
  return { ...base, status: "ENCONTRADO", detalhe: `Sobrepõe ${feats.length} UC(s)${integral ? ", incluindo Proteção Integral" : " de Uso Sustentável"}.`, itens, gravidade: integral ? "CRITICO" : "ATENCAO" };
}

const so = (s: string) => s.replace(/\D/g, "");

async function consultarEmbargos(vs: VerticeGeo[], documentos: string[]): Promise<Consulta> {
  const base = { id: "EMBARGO" as const, nome: "Embargos ambientais (IBAMA e ICMBio)", fonte: "IBAMA — pamgia.ibama.gov.br (embargos IBAMA e ICMBio)", consultado_em: new Date().toISOString() };
  const anel: Anel = vs.map((v) => [v.lon, v.lat]);
  const [ibama, icmbio] = await Promise.all([
    arcgis("01_Publicacoes_Bases/adm_embargos_ibama_a", anel, "num_tad,nome_imovel,nome_embargado,dat_embargo,qtd_area_embargada,des_infracao,municipio"),
    arcgis("01_Publicacoes_Bases/adm_embargo_icmbio_a", anel, "numero_ai,autuado,nome_uc,data_auto,desc_infra,municipio").catch(() => []),
  ]);
  // Pelo CPF/CNPJ do proprietário (a base guarda o número formatado ou só dígitos).
  const porDoc: Record<string, unknown>[] = [];
  for (const d of documentos.map(so).filter((x) => x.length === 11 || x.length === 14).slice(0, 3)) {
    const fmt = d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    const r = await arcgisWhere("01_Publicacoes_Bases/adm_embargos_ibama_a", `cpf_cnpj_embargado IN ('${d}','${fmt}')`, "num_tad,nome_imovel,nome_embargado,dat_embargo,municipio,uf").catch(() => []);
    porDoc.push(...r);
  }
  const itens = [
    ...ibama.map((a) => `IBAMA TAD ${a.num_tad ?? "—"} · ${a.nome_imovel ?? "imóvel"} · ${a.nome_embargado ?? ""} · ${dataBR(a.dat_embargo) ?? "—"}${a.qtd_area_embargada ? ` · ${a.qtd_area_embargada} ha embargados` : ""}`),
    ...icmbio.map((a) => `ICMBio AI ${a.numero_ai ?? "—"} · ${a.autuado ?? ""} · ${a.nome_uc ?? ""} · ${dataBR(a.data_auto) ?? "—"}`),
    ...porDoc.map((a) => `Proprietário embargado: IBAMA TAD ${a.num_tad ?? "—"} · ${a.nome_imovel ?? "outro imóvel"} · ${a.municipio ?? ""}/${a.uf ?? ""} · ${dataBR(a.dat_embargo) ?? "—"}`),
  ];
  if (itens.length === 0) return { ...base, status: "LIVRE", detalhe: `Sem embargo na área${documentos.length ? " nem em nome do(s) proprietário(s)" : ""}.` };
  const naArea = ibama.length + icmbio.length;
  return { ...base, status: "ENCONTRADO", detalhe: naArea > 0 ? `${naArea} embargo(s) sobre a área.` : "Proprietário com embargo em outro imóvel.", itens, gravidade: naArea > 0 ? "CRITICO" : "ATENCAO" };
}

async function consultarDeter(vs: VerticeGeo[]): Promise<Consulta> {
  const base = { id: "DETER" as const, nome: "Alertas de desmatamento (DETER/INPE)", fonte: "INPE DETER Amazônia — via IBAMA", consultado_em: new Date().toISOString() };
  const anel: Anel = vs.map((v) => [v.lon, v.lat]);
  const desde = new Date(Date.now() - 5 * 365 * 86400000).toISOString().slice(0, 10);
  const r = await arcgis("lim_deter_amz_public_a", anel, "classname,view_date,areauckm,municipali", `view_date >= DATE '${desde}'`);
  if (r.length === 0) return { ...base, status: "LIVRE", detalhe: "Sem alerta DETER nos últimos 5 anos (cobertura: Amazônia Legal)." };
  return { ...base, status: "ENCONTRADO", detalhe: `${r.length} alerta(s) DETER nos últimos 5 anos.`, itens: r.slice(0, 10).map((a) => `${a.classname ?? "alerta"} · ${dataBR(a.view_date) ?? "—"} · ${a.municipali ?? ""}`), gravidade: "ATENCAO" };
}

/** Relevo pela grade interna: SRTM 90 m (OpenTopoData). Declividade entre vizinhos da grade. */
export async function consultarRelevo(vs: VerticeGeo[], grade: { lat: number; lon: number; i: number; j: number }[]): Promise<Relevo | null> {
  if (grade.length < 4) return null;
  const locs = grade.map((p) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`).join("|");
  const j = (await getJson(`https://api.opentopodata.org/v1/srtm90m?locations=${locs}`)) as { status?: string; results?: { elevation: number | null }[] };
  if (j.status !== "OK" || !j.results) return null;
  const alt = new Map<string, number>();
  grade.forEach((p, k) => { const e = j.results![k]?.elevation; if (typeof e === "number") alt.set(`${p.i},${p.j}`, e); });
  const hs = [...alt.values()];
  if (hs.length < 4) return null;
  const b = bbox(vs);
  const lado = Math.max(3, Math.round(Math.sqrt(90 * 1.6)));
  const dLat = ((b.maxLat - b.minLat) / lado) * 111320;
  const dLon = ((b.maxLon - b.minLon) / lado) * 111320 * Math.cos((((b.minLat + b.maxLat) / 2) * Math.PI) / 180);
  const decl: number[] = [];
  for (const p of grade) {
    const h = alt.get(`${p.i},${p.j}`);
    if (h === undefined) continue;
    const n = alt.get(`${p.i + 1},${p.j}`), e = alt.get(`${p.i},${p.j + 1}`);
    if (n !== undefined && dLat > 0) decl.push((Math.abs(n - h) / dLat) * 100);
    if (e !== undefined && dLon > 0) decl.push((Math.abs(e - h) / dLon) * 100);
  }
  const classes = RELEVO_EMBRAPA.map((c, k) => {
    const de = k === 0 ? -1 : RELEVO_EMBRAPA[k - 1].ate;
    const qtd = decl.filter((d) => d > de && d <= c.ate).length;
    return { classe: c.classe, pct: decl.length ? Math.round((qtd / decl.length) * 100) : 0 };
  }).filter((c) => c.pct > 0);
  return {
    pontos: hs.length,
    altitude_min: Math.min(...hs), altitude_max: Math.max(...hs),
    altitude_media: Math.round(hs.reduce((s, x) => s + x, 0) / hs.length),
    declividade_media_pct: decl.length ? Math.round((decl.reduce((s, x) => s + x, 0) / decl.length) * 10) / 10 : 0,
    espacamento_m: Math.round(Math.min(dLat, dLon)),
    classes,
    fonte: "SRTM 90 m (OpenTopoData) — grade dentro da poligonal",
  };
}

const indisponivel = (id: Consulta["id"], nome: string, fonte: string, e: unknown): Consulta => ({
  id, nome, fonte, consultado_em: new Date().toISOString(), status: "INDISPONIVEL",
  detalhe: `Base fora do ar ou sem resposta (${(e as Error)?.message ?? "erro"}). Consultar manualmente.`,
});

/** Roda todas as consultas em paralelo. Sem poligonal não há como consultar com segurança. */
export async function consultarImovelRural(vs: VerticeGeo[], uf: string | null, documentosProprietarios: string[]) {
  const grade = gradeInterna(vs);
  const [car, ti, uc, emb, deter, relevo] = await Promise.all([
    consultarCar(vs, uf, grade).catch((e) => ({ consulta: indisponivel("CAR", "CAR (SICAR)", "SICAR", e), principal: null })),
    consultarTi(vs).catch((e) => indisponivel("TI", "Terra Indígena (FUNAI)", "FUNAI", e)),
    consultarUc(vs).catch((e) => indisponivel("UC", "Unidade de Conservação (CNUC/MMA)", "MMA", e)),
    consultarEmbargos(vs, documentosProprietarios).catch((e) => indisponivel("EMBARGO", "Embargos ambientais (IBAMA e ICMBio)", "IBAMA", e)),
    consultarDeter(vs).catch((e) => indisponivel("DETER", "Alertas de desmatamento (DETER/INPE)", "INPE/IBAMA", e)),
    consultarRelevo(vs, grade).catch(() => null),
  ]);
  return { consultas: [car.consulta, ti, uc, emb, deter], carPrincipal: car.principal, relevo };
}
