/**
 * Redução de foto no navegador antes do envio da qualificação.
 *
 * A Vercel recusa corpo de requisição acima de 4,5 MB, e foto de celular costuma ter de 4 a 12 MB.
 * Em vez de pedir ao cliente que reduza a foto, a tela reduz sozinha: lado maior até 2.500 px, JPG,
 * qualidade baixando aos poucos até caber. PDF não é tocado. Só roda no navegador (canvas).
 */

/** Alvo de tamanho: abaixo do limite de 4 MB da função, com folga para os campos do formulário. */
export const ALVO_REDUCAO_BYTES = 3.5 * 1024 * 1024;
export const LADO_MAXIMO_PX = 2500;
const QUALIDADES = [0.85, 0.75, 0.65, 0.55];
const PASSO_ESCALA = 0.8;
const TENTATIVAS_DE_ESCALA = 3;

/** Decide se a imagem precisa ser reduzida. Módulo puro (testável). */
export function precisaReduzir(tipo: string, bytes: number): boolean {
  return (tipo === "image/jpeg" || tipo === "image/png") && bytes > ALVO_REDUCAO_BYTES;
}

/** Dimensões finais mantendo a proporção, com o lado maior limitado a `maxLado`. Nunca amplia. */
export function dimensoesReduzidas(largura: number, altura: number, maxLado: number = LADO_MAXIMO_PX): { w: number; h: number } {
  const maior = Math.max(largura, altura);
  if (maior <= maxLado) return { w: largura, h: altura };
  const f = maxLado / maior;
  return { w: Math.max(1, Math.round(largura * f)), h: Math.max(1, Math.round(altura * f)) };
}

/** "foto.png" vira "foto.jpg". */
export function nomeComoJpg(nome: string): string {
  const base = nome.replace(/\.[^./\\]+$/, "");
  return `${base || "foto"}.jpg`;
}

function paraBlob(canvas: HTMLCanvasElement, qualidade: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", qualidade));
}

/**
 * Devolve o arquivo original se não precisa reduzir, um JPG reduzido se precisa, ou `null` se não foi
 * possível reduzir (navegador sem suporte, imagem corrompida): quem chama mostra a mensagem de tamanho.
 */
export async function reduzirImagem(file: File): Promise<File | null> {
  if (!precisaReduzir(file.type, file.size)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    let { w, h } = dimensoesReduzidas(bitmap.width, bitmap.height);
    for (let escala = 0; escala <= TENTATIVAS_DE_ESCALA; escala++) {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      // JPG não tem transparência: fundo branco evita PNG transparente virar preto.
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bitmap, 0, 0, w, h);
      for (const q of QUALIDADES) {
        const blob = await paraBlob(canvas, q);
        if (blob && blob.size <= ALVO_REDUCAO_BYTES) {
          bitmap.close();
          return new File([blob], nomeComoJpg(file.name), { type: "image/jpeg", lastModified: Date.now() });
        }
      }
      w = Math.max(1, Math.round(w * PASSO_ESCALA));
      h = Math.max(1, Math.round(h * PASSO_ESCALA));
    }
    bitmap.close();
    return null;
  } catch {
    return null;
  }
}
