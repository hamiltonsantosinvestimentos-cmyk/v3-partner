// Geometria da poligonal do GEO/SIGEF (17/10/2026). Os memoriais trazem os vértices em
// coordenadas geográficas (SIRGAS 2000) ou em UTM; aqui convertemos tudo para lat/long,
// calculamos área e perímetro pela própria poligonal (para conferir com a matrícula, o CCIR
// e o CAR) e geramos o KML para abrir no Google Earth. SIRGAS 2000 usa o elipsoide GRS80,
// praticamente igual ao WGS84 — diferença irrelevante para esta conferência.

import type { VerticeGeo } from "./tipos";

const A = 6378137.0;
const F = 1 / 298.257222101;
const K0 = 0.9996;
const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);

const rad = (g: number) => (g * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function fusoUtm(lon: number) {
  return Math.floor((lon + 180) / 6) + 1;
}

/** lat/long (graus) → UTM no fuso informado (hemisfério sul com falso norte de 10.000 km). */
export function paraUtm(lat: number, lon: number, fuso: number) {
  const phi = rad(lat);
  const lam0 = rad((fuso - 1) * 6 - 180 + 3);
  const n = A / Math.sqrt(1 - E2 * Math.sin(phi) ** 2);
  const t = Math.tan(phi) ** 2;
  const c = EP2 * Math.cos(phi) ** 2;
  const a = Math.cos(phi) * (rad(lon) - lam0);
  const m = A * ((1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256) * phi
    - ((3 * E2) / 8 + (3 * E2 ** 2) / 32 + (45 * E2 ** 3) / 1024) * Math.sin(2 * phi)
    + ((15 * E2 ** 2) / 256 + (45 * E2 ** 3) / 1024) * Math.sin(4 * phi)
    - ((35 * E2 ** 3) / 3072) * Math.sin(6 * phi));
  const e = K0 * n * (a + ((1 - t + c) * a ** 3) / 6 + ((5 - 18 * t + t ** 2 + 72 * c - 58 * EP2) * a ** 5) / 120) + 500000;
  let nn = K0 * (m + n * Math.tan(phi) * (a ** 2 / 2 + ((5 - t + 9 * c + 4 * c ** 2) * a ** 4) / 24
    + ((61 - 58 * t + t ** 2 + 600 * c - 330 * EP2) * a ** 6) / 720));
  if (lat < 0) nn += 10000000;
  return { e, n: nn };
}

/** UTM → lat/long. `sul` = hemisfério sul (todo o Brasil abaixo do Equador). */
export function deUtm(e: number, n: number, fuso: number, sul = true) {
  const x = e - 500000;
  const y = sul ? n - 10000000 : n;
  const m = y / K0;
  const mu = m / (A * (1 - E2 / 4 - (3 * E2 ** 2) / 64 - (5 * E2 ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const phi1 = mu + ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu)
    + ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu)
    + ((151 * e1 ** 3) / 96) * Math.sin(6 * mu);
  const n1 = A / Math.sqrt(1 - E2 * Math.sin(phi1) ** 2);
  const t1 = Math.tan(phi1) ** 2;
  const c1 = EP2 * Math.cos(phi1) ** 2;
  const r1 = (A * (1 - E2)) / (1 - E2 * Math.sin(phi1) ** 2) ** 1.5;
  const d = x / (n1 * K0);
  const lat = phi1 - ((n1 * Math.tan(phi1)) / r1) * (d ** 2 / 2 - ((5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * EP2) * d ** 4) / 24
    + ((61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * EP2 - 3 * c1 ** 2) * d ** 6) / 720);
  const lam0 = rad((fuso - 1) * 6 - 180 + 3);
  const lon = lam0 + (d - ((1 + 2 * t1 + c1) * d ** 3) / 6 + ((5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * EP2 + 24 * t1 ** 2) * d ** 5) / 120) / Math.cos(phi1);
  return { lat: deg(lat), lon: deg(lon) };
}

/** Só vértices plausíveis em território brasileiro (descarta lixo de leitura). */
export function verticesValidos(vs: VerticeGeo[]): VerticeGeo[] {
  return vs.filter((v) => Number.isFinite(v.lat) && Number.isFinite(v.lon) && v.lat > -34.5 && v.lat < 6 && v.lon > -74.5 && v.lon < -28.5);
}

export interface MedidasPoligonal { area_ha: number; perimetro_m: number; centroide: { lat: number; lon: number } }

/** Área (shoelace em UTM do fuso do centroide), perímetro e centroide da poligonal. */
export function medirPoligonal(vs: VerticeGeo[]): MedidasPoligonal | null {
  const pts = verticesValidos(vs);
  if (pts.length < 3) return null;
  const latM = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const lonM = pts.reduce((s, p) => s + p.lon, 0) / pts.length;
  const fuso = fusoUtm(lonM);
  const xy = pts.map((p) => paraUtm(p.lat, p.lon, fuso));
  let area2 = 0;
  let per = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < xy.length; i++) {
    const p = xy[i];
    const q = xy[(i + 1) % xy.length];
    const cr = p.e * q.n - q.e * p.n;
    area2 += cr;
    cx += (p.e + q.e) * cr;
    cy += (p.n + q.n) * cr;
    per += Math.hypot(q.e - p.e, q.n - p.n);
  }
  const area = Math.abs(area2) / 2;
  const centro = area2 !== 0 ? deUtm(cx / (3 * area2), cy / (3 * area2), fuso, latM < 0) : { lat: latM, lon: lonM };
  return { area_ha: area / 10000, perimetro_m: per, centroide: centro };
}

/** Ponto dentro do polígono (ray casting em lat/long — suficiente para áreas de fazenda). */
export function pontoNaPoligonal(lat: number, lon: number, vs: VerticeGeo[]) {
  let dentro = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const a = vs[i];
    const b = vs[j];
    if ((a.lat > lat) !== (b.lat > lat) && lon < ((b.lon - a.lon) * (lat - a.lat)) / (b.lat - a.lat) + a.lon) dentro = !dentro;
  }
  return dentro;
}

/** Lê as coordenadas de um KML (texto). KMZ é zip: não tratado aqui. */
export function verticesDoKml(kml: string): VerticeGeo[] {
  const bloco = kml.match(/<coordinates>([\s\S]*?)<\/coordinates>/i)?.[1] ?? "";
  return bloco.trim().split(/\s+/).map((t) => {
    const [lon, lat] = t.split(",").map(Number);
    return { lat, lon };
  }).filter((v) => Number.isFinite(v.lat) && Number.isFinite(v.lon));
}

export function gerarKml(nome: string, vs: VerticeGeo[]) {
  const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);
  const anel = [...vs, vs[0]].map((v) => `${v.lon.toFixed(8)},${v.lat.toFixed(8)},0`).join(" ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(nome)}</name>
<Style id="v3"><LineStyle><color>ff4ca8c9</color><width>3</width></LineStyle><PolyStyle><color>404ca8c9</color></PolyStyle></Style>
<Placemark><name>${esc(nome)}</name><styleUrl>#v3</styleUrl><Polygon><outerBoundaryIs><LinearRing><coordinates>${anel}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
</Document></kml>`;
}
