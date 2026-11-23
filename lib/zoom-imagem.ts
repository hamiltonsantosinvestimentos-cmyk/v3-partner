// Zoom do visualizador de documento da conferência: limites. Módulo puro (testável).
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;
export const ZOOM_PASSO = 0.5;

/** Mantém o zoom entre o mínimo e o máximo. */
export function limitarZoom(z: number): number {
  if (!Number.isFinite(z)) return ZOOM_MIN;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));
}
