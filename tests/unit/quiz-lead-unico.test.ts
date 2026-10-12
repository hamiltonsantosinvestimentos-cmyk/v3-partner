// Testes de lógica pura dos quizzes públicos: casar o WhatsApp em formatos diferentes e a
// espera de 1 minuto do lead incompleto antes de aparecer no Kanban. Sem banco, sem rede. Rodar com:
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { telefoneChave, incompletoAguardando, ATRASO_INCOMPLETO_MS } from "../../lib/quiz-lead-unico";

test("telefoneChave casa o mesmo WhatsApp com e sem +55 e máscara", () => {
  assert.equal(telefoneChave("+55 (51) 99746-6001"), telefoneChave("51997466001"));
  assert.equal(telefoneChave("5551997466001"), telefoneChave("(51) 99746-6001"));
  assert.notEqual(telefoneChave("51997466001"), telefoneChave("51997466002"));
  assert.equal(telefoneChave(null), "");
});

const agora = () => new Date().toISOString();
const ha = (ms: number) => new Date(Date.now() - ms).toISOString();

test("incompleto recém-criado fica escondido no 1º minuto", () => {
  assert.equal(incompletoAguardando({ etapa: "incompleto", metadata: { quiz_incompleto: true, parcial_criado_em: agora() } }), true);
  assert.equal(incompletoAguardando({ etapa: "incompleto", metadata: { quiz_incompleto: true, parcial_criado_em: ha(ATRASO_INCOMPLETO_MS - 5_000) } }), true);
});

test("incompleto aparece depois de 1 minuto", () => {
  assert.equal(incompletoAguardando({ etapa: "incompleto", metadata: { quiz_incompleto: true, parcial_criado_em: ha(ATRASO_INCOMPLETO_MS + 1_000) } }), false);
});

test("lead concluído ou movido pelo time nunca é escondido", () => {
  assert.equal(incompletoAguardando({ etapa: "prospect", metadata: { quiz_incompleto: false, parcial_criado_em: agora() } }), false);
  assert.equal(incompletoAguardando({ etapa: "contatado", metadata: { quiz_incompleto: true, parcial_criado_em: agora() } }), false);
  assert.equal(incompletoAguardando({ etapa: "prospect", created_at: agora(), metadata: null }), false);
});

test("sem parcial_criado_em usa created_at", () => {
  assert.equal(incompletoAguardando({ etapa: "incompleto", created_at: agora(), metadata: { quiz_incompleto: true } }), true);
  assert.equal(incompletoAguardando({ etapa: "incompleto", created_at: ha(5 * 60_000), metadata: { quiz_incompleto: true } }), false);
});
