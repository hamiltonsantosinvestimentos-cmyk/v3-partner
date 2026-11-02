import { test } from "node:test";
import assert from "node:assert/strict";
import { chaveAnthropicAssistente, interpretarMensagem } from "../../lib/assistente/interpretar";

function comAmbiente(propria: string | undefined, fn: () => Promise<void> | void) {
  const antes = { p: process.env.ASSISTENTE_ANTHROPIC_API_KEY, e: process.env.ANTHROPIC_API_KEY };
  if (propria === undefined) delete process.env.ASSISTENTE_ANTHROPIC_API_KEY;
  else process.env.ASSISTENTE_ANTHROPIC_API_KEY = propria;
  process.env.ANTHROPIC_API_KEY = "chave-da-empresa";
  return Promise.resolve(fn()).finally(() => {
    if (antes.p === undefined) delete process.env.ASSISTENTE_ANTHROPIC_API_KEY;
    else process.env.ASSISTENTE_ANTHROPIC_API_KEY = antes.p;
    if (antes.e === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = antes.e;
  });
}

test("usa a chave própria do assistente", () =>
  comAmbiente("chave-pessoal", () => {
    assert.equal(chaveAnthropicAssistente(), "chave-pessoal");
  }));

test("sem chave própria recusa, sem cair na chave da empresa", () =>
  comAmbiente(undefined, () => {
    assert.throws(() => chaveAnthropicAssistente(), /ASSISTENTE_ANTHROPIC_API_KEY/);
  }));

test("chave em branco conta como ausente", () =>
  comAmbiente("   ", () => {
    assert.throws(() => chaveAnthropicAssistente(), /ASSISTENTE_ANTHROPIC_API_KEY/);
  }));

test("sem chave própria nenhuma chamada sai para a Anthropic", () =>
  comAmbiente(undefined, async () => {
    const original = globalThis.fetch;
    let chamadas = 0;
    globalThis.fetch = (async () => { chamadas += 1; return new Response("{}"); }) as typeof fetch;
    try {
      await assert.rejects(interpretarMensagem({ texto: "paguei 85", agoraLocal: "2026-11-02T10:00" }, 1000), /ASSISTENTE_ANTHROPIC_API_KEY/);
      assert.equal(chamadas, 0);
    } finally {
      globalThis.fetch = original;
    }
  }));
