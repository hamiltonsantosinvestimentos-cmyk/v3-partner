// Payload do e-mail ao partner originador (BRIEF Mesa M&A bloco C, segunda entrega, 01/11/2026).
// O que sai da V3 é decidido só por montarPayloadAviso: nunca código do deal (nos três formatos em uso),
// nome da empresa, valor ou documento.
import { test } from "node:test";
import assert from "node:assert/strict";
import { montarPayloadAviso, primeiroNome } from "../../lib/ma/aviso-originador";

const DEAL = "2f1c7a52-3f0e-4c7f-9d6a-0b1d4c9e8a11";
const base = { email: "partner@exemplo.com.br", nomeCompleto: "Maria Souza Lima", dealId: DEAL, appUrl: "https://app.v3partners.com.br/" };

test("etapa comum: etapa pelo rótulo, primeiro nome e link do deal, sem mensagem neutra", () => {
  const p = montarPayloadAviso({ ...base, etapaDb: "QUALIFICATION" });
  assert.equal(p.etapa, "NCNDA / Qualificação");
  assert.equal(p.primeiro_nome, "Maria");
  assert.equal(p.link, `https://app.v3partners.com.br/ma/${DEAL}`);
  assert.equal(p.neutro, false);
  assert.equal(p.mensagem, null);
});

test("Ganho e Perdido: mensagem neutra, sem etapa nem resultado", () => {
  for (const etapaDb of ["CLOSED_WON", "CLOSED_LOST"]) {
    const p = montarPayloadAviso({ ...base, etapaDb });
    assert.equal(p.neutro, true);
    assert.equal(p.etapa, "");
    assert.equal(p.mensagem, "Um deal que você originou foi atualizado. Veja os detalhes na plataforma.");
    assert.doesNotMatch(JSON.stringify(p), /ganho|perdido|won|lost/i);
  }
});

test("o payload só tem as chaves aprovadas", () => {
  const p = montarPayloadAviso({ ...base, etapaDb: "MANDATE" });
  assert.deepEqual(Object.keys(p).sort(), ["destinatario", "etapa", "link", "mensagem", "neutro", "primeiro_nome"]);
});

test("código do deal nos três formatos nunca aparece no payload", () => {
  const codigos = ["V3-2026-07-IND-002", "V3-MA-2026-11-AGR-001", "MA-26-00042", "MTNG-26-0007"];
  for (const etapaDb of ["PROSPECTING", "ROADSHOW", "CLOSING", "CLOSED_WON", "CLOSED_LOST"]) {
    const texto = JSON.stringify(montarPayloadAviso({ ...base, etapaDb }));
    for (const c of codigos) assert.ok(!texto.includes(c), `${c} vazou em ${etapaDb}`);
    assert.doesNotMatch(texto, /V3-(MA-)?\d{4}|MTNG|MA-\d{2}-/);
  }
});

test("primeiro nome tolera vazio e espaços", () => {
  assert.equal(primeiroNome("  João   Lemos "), "João");
  assert.equal(primeiroNome(""), "");
  assert.equal(primeiroNome(null), "");
});
