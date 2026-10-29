import { test } from "node:test";
import assert from "node:assert/strict";
import {
  KYC_MAX_UPLOAD_VIA_FUNCTION_BYTES, fileTooLargeMessage, formatFileSizePtBr, uploadFailureMessage,
} from "../../lib/upload-limits";

test("limite fica abaixo dos 4,5 MB do corpo das funções da Vercel", () => {
  assert.equal(KYC_MAX_UPLOAD_VIA_FUNCTION_BYTES, 4 * 1024 * 1024);
  assert.ok(KYC_MAX_UPLOAD_VIA_FUNCTION_BYTES < 4.5 * 1024 * 1024);
});

test("formata o tamanho em pt-BR com vírgula decimal", () => {
  assert.equal(formatFileSizePtBr(6.2 * 1024 * 1024), "6,2 MB");
  assert.equal(formatFileSizePtBr(4 * 1024 * 1024), "4,0 MB");
  assert.equal(formatFileSizePtBr(722663), "706 KB");
  assert.equal(formatFileSizePtBr(10), "1 KB");
});

test("mensagem de arquivo grande traz tamanho, limite e diz que não foi enviado", () => {
  const m = fileTooLargeMessage(6.2 * 1024 * 1024);
  assert.match(m, /6,2 MB/);
  assert.match(m, /4,0 MB/);
  assert.match(m, /NÃO foi enviado/);
});

test("413 vira mensagem de tamanho, nunca de conexão", () => {
  const m = uploadFailureMessage(413, null);
  assert.match(m, /limite/);
  assert.doesNotMatch(m, /conex/i);
});

test("5xx sem corpo JSON traz o código e diz que não foi enviado", () => {
  const m = uploadFailureMessage(504, null);
  assert.match(m, /504/);
  assert.match(m, /NÃO foi enviado/);
});

test("preserva a mensagem do servidor quando a resposta era JSON", () => {
  assert.match(uploadFailureMessage(422, "Formato não aceito. Envie JPG, PNG ou PDF."), /Formato não aceito/);
});

test("nenhum texto usa travessão", () => {
  const all = [fileTooLargeMessage(5e6), uploadFailureMessage(413), uploadFailureMessage(500), uploadFailureMessage(404)].join(" ");
  assert.doesNotMatch(all, /[–—]/);
});
