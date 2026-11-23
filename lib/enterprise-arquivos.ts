/**
 * Conferência de imagens do tema do Enterprise pelos BYTES (não pelo file.type do navegador).
 * Módulo puro. BRIEF docs/briefs/2026-11-21_tema-visual-enterprise-manual-de-marca.md
 */

export type TipoImagem = "png" | "webp" | "ico";

export function tipoPelosBytes(b: Uint8Array): TipoImagem | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  if (b.length >= 6 && b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return "ico";
  return null;
}

/** Largura e altura do PNG (cabeçalho IHDR). */
export function dimensoesPng(b: Uint8Array): { w: number; h: number } | null {
  if (b.length < 24) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { w: dv.getUint32(16), h: dv.getUint32(20) };
}

/** Dimensões de cada imagem de um ICO (byte 0 = 256). */
export function dimensoesIco(b: Uint8Array): { w: number; h: number }[] | null {
  if (b.length < 6) return null;
  const n = b[4] | (b[5] << 8);
  if (n < 1 || b.length < 6 + n * 16) return null;
  const out: { w: number; h: number }[] = [];
  for (let i = 0; i < n; i++) {
    const o = 6 + i * 16;
    out.push({ w: b[o] || 256, h: b[o + 1] || 256 });
  }
  return out;
}

export const LIMITE_LOGO_CLARO = 2 * 1024 * 1024;
export const LIMITE_ICONE = 512 * 1024;

/** Logo para fundo claro: PNG ou WEBP até 2 MB (sem SVG). Devolve a extensão ou a mensagem de erro. */
export function conferirLogoClaro(b: Uint8Array): { ok: true; ext: "png" | "webp"; mime: string } | { ok: false; erro: string } {
  if (b.length > LIMITE_LOGO_CLARO) return { ok: false, erro: "Logo para fundo claro maior que 2 MB." };
  const t = tipoPelosBytes(b);
  if (t === "png") return { ok: true, ext: "png", mime: "image/png" };
  if (t === "webp") return { ok: true, ext: "webp", mime: "image/webp" };
  return { ok: false, erro: "Logo para fundo claro deve ser PNG ou WEBP." };
}

/** Ícone da aba: PNG quadrado de 64 a 1024 px, ou ICO com todas as imagens quadradas de 64 a 256 px; até 512 KB. */
export function conferirIcone(b: Uint8Array): { ok: true; ext: "png" | "ico"; mime: string } | { ok: false; erro: string } {
  if (b.length > LIMITE_ICONE) return { ok: false, erro: "Ícone maior que 512 KB." };
  const t = tipoPelosBytes(b);
  if (t === "png") {
    const d = dimensoesPng(b);
    if (!d || d.w !== d.h || d.w < 64 || d.w > 1024) return { ok: false, erro: "O ícone PNG precisa ser quadrado, de 64 a 1024 px." };
    return { ok: true, ext: "png", mime: "image/png" };
  }
  if (t === "ico") {
    const ds = dimensoesIco(b);
    if (!ds || ds.some((d) => d.w !== d.h || d.w < 64 || d.w > 256)) return { ok: false, erro: "Todas as imagens do ICO precisam ser quadradas, de 64 a 256 px." };
    return { ok: true, ext: "ico", mime: "image/x-icon" };
  }
  return { ok: false, erro: "O ícone deve ser PNG ou ICO." };
}
