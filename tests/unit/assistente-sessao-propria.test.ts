import { test } from "node:test";
import assert from "node:assert/strict";

process.env.OPENWA_SESSION_ID = "sessao-do-sdr";
process.env.OPENWA_API_KEY = "x";

test("funções de sessão própria nunca chamam o gateway com vazio ou com a sessão padrão", async () => {
  const m = await import("../../lib/whatsapp/openwa-client");
  const fetchOriginal = globalThis.fetch;
  let chamadas = 0;
  globalThis.fetch = (async () => { chamadas += 1; return new Response("{}"); }) as typeof fetch;
  try {
    const acoes: ((s: string) => Promise<unknown>)[] = [
      (s) => m.statusSessaoPropria(s),
      (s) => m.qrSessaoPropria(s),
      (s) => m.whatsappIdSessaoPropria(s, "5511987654321"),
      (s) => m.enviarTextoSessaoPropria(s, "1@c.us", "oi"),
      (s) => m.garantirWebhookSessaoPropria(s, "https://x", "s"),
      (s) => m.pararSessaoPropria(s),
      (s) => m.apagarMensagensGuardadas(s, new Date().toISOString()),
      (s) => m.apagarMapeamentosLid(s, ["1"]),
      (s) => m.apagarSessaoPropria(s),
    ];
    for (const acao of acoes) {
      for (const sessao of ["", "  ", "sessao-do-sdr"]) {
        await assert.rejects(acao(sessao), /sessão própria/);
      }
    }
    assert.equal(chamadas, 0);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

test("exclusão no gateway: 404 conta como apagada, 409 é repetir", async () => {
  const m = await import("../../lib/whatsapp/openwa-client");
  const fetchOriginal = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response(null, { status: 404 })) as typeof fetch;
    await m.apagarSessaoPropria("propria");
    await m.pararSessaoPropria("propria");
    globalThis.fetch = (async () => new Response(null, { status: 409 })) as typeof fetch;
    await assert.rejects(m.apagarSessaoPropria("propria"));
    await assert.rejects(m.pararSessaoPropria("propria"));
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});
