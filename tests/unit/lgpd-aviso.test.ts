// Aviso de Privacidade da Qualificação, versão 2 (KYC): estrutura, versão e isolamento da versão 1.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LGPD_AVISO_QUALIFICACAO, LGPD_AVISO_QUALIFICACAO_V1, LGPD_AVISO_QUALIFICACAO_VERSION, LGPD_AVISO_QUALIFICACAO_VERSION_V1,
} from "../../lib/lgpd-aviso-qualificacao";

type Item = { title: string; text: string };
const byNumber = (list: Item[], n: number) => list.find((i) => i.title.startsWith(`${n}. `))!;

test("versões: v2 vigente e v1 preservada", () => {
  assert.equal(LGPD_AVISO_QUALIFICACAO_VERSION, "2026-10-08-v2");
  assert.equal(LGPD_AVISO_QUALIFICACAO_VERSION_V1, "2026-10-05-v1");
});

test("v1 continua com 10 itens e sem KYC (página de comissão)", () => {
  assert.equal(LGPD_AVISO_QUALIFICACAO_V1.length, 10);
  assert.ok(!LGPD_AVISO_QUALIFICACAO_V1.some((i) => /KYC/.test(i.text)));
});

test("v2 tem 11 itens, mesma numeração da v1 e o item 11 novo", () => {
  assert.equal(LGPD_AVISO_QUALIFICACAO.length, 11);
  assert.deepEqual(LGPD_AVISO_QUALIFICACAO.slice(0, 10).map((i) => i.title), LGPD_AVISO_QUALIFICACAO_V1.map((i) => i.title));
  assert.equal(LGPD_AVISO_QUALIFICACAO[10].title, "11. Análise de KYC e de due diligence");
  assert.match(LGPD_AVISO_QUALIFICACAO[10].text, /intermediação e de fusões e aquisições/);
  assert.match(LGPD_AVISO_QUALIFICACAO[10].text, /cedentes e dos mandatários/);
  assert.match(LGPD_AVISO_QUALIFICACAO[10].text, /geração dos contratos/);
});

test("v2: itens alterados mudam, itens iguais ficam idênticos e a v1 permanece como prefixo nos acréscimos", () => {
  for (const n of [2, 3, 4, 5, 6, 9]) {
    assert.notEqual(byNumber(LGPD_AVISO_QUALIFICACAO, n).text, byNumber(LGPD_AVISO_QUALIFICACAO_V1, n).text, `item ${n} deve mudar`);
  }
  for (const n of [1, 7, 8, 10]) {
    assert.equal(byNumber(LGPD_AVISO_QUALIFICACAO, n).text, byNumber(LGPD_AVISO_QUALIFICACAO_V1, n).text, `item ${n} deve ficar igual`);
  }
  for (const n of [2, 4, 6, 9]) {
    assert.ok(byNumber(LGPD_AVISO_QUALIFICACAO, n).text.startsWith(byNumber(LGPD_AVISO_QUALIFICACAO_V1, n).text), `item ${n}`);
  }
  assert.match(byNumber(LGPD_AVISO_QUALIFICACAO, 3).text, /\(e\) realizar a análise de conhecimento do cliente \(KYC\)/);
  assert.match(byNumber(LGPD_AVISO_QUALIFICACAO, 4).text, /art\. 7º, X/);
  assert.match(byNumber(LGPD_AVISO_QUALIFICACAO, 4).text, /art\. 7º, IX/);
  assert.match(byNumber(LGPD_AVISO_QUALIFICACAO, 6).text, /36 \(trinta e seis\) meses/);
  assert.match(byNumber(LGPD_AVISO_QUALIFICACAO, 6).text, /12 \(doze\) meses/);
});

test("higiene: sem travessão, sem emoji e sem citar o parceiro tecnológico", () => {
  const all = LGPD_AVISO_QUALIFICACAO.map((i) => `${i.title} ${i.text}`).join(" ");
  assert.ok(!all.includes("—"));
  assert.ok(!/\p{Extended_Pictographic}/u.test(all));
  assert.ok(!/bloxs/i.test(all));
});
