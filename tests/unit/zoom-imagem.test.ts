// Zoom do visualizador de documento: limites. Dado só inventado.
import test from "node:test";
import assert from "node:assert/strict";
import { ZOOM_MAX, ZOOM_MIN, limitarZoom } from "../../lib/zoom-imagem";

test("zoom nunca sai do intervalo", () => {
  assert.equal(limitarZoom(0.2), ZOOM_MIN);
  assert.equal(limitarZoom(99), ZOOM_MAX);
  assert.equal(limitarZoom(2), 2);
  assert.equal(limitarZoom(Number.NaN), ZOOM_MIN);
});
