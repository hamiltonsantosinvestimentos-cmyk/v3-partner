// Alerta interno "cota estourada" (BRIEF 15/11/2026): tolerante a falta de configuração, sem IP, nunca lança.
import test from "node:test";
import assert from "node:assert/strict";
import { enviarAlertaCota } from "../../lib/creation-alert";

const dados = { nomeUsuario: "Fulano de Teste", via: "ma-deals", janela: "hora" as const, ocorridoEm: new Date("2026-11-16T12:00:00Z") };

test("sem URL ou sem segredo: não envia e não lança", async () => {
  assert.deepEqual(await enviarAlertaCota(dados, { url: undefined, segredo: "s" }), { enviado: false, motivo: "sem_configuracao" });
  assert.deepEqual(await enviarAlertaCota(dados, { url: "https://n8n.exemplo/webhook/x", segredo: undefined }), { enviado: false, motivo: "sem_configuracao" });
});

test("envia o segredo no cabeçalho e um corpo sem IP, sem e-mail e sem contagem", async () => {
  let visto: { url: string; init: RequestInit } | null = null;
  const fetchImpl = (async (url: string, init: RequestInit) => { visto = { url, init }; return new Response("{}", { status: 200 }); }) as unknown as typeof fetch;
  const r = await enviarAlertaCota(dados, { url: "https://n8n.exemplo/webhook/x", segredo: "segredo-de-teste", fetchImpl });
  assert.deepEqual(r, { enviado: true });
  assert.ok(visto);
  const v = visto as { url: string; init: RequestInit };
  assert.equal(v.url, "https://n8n.exemplo/webhook/x");
  assert.equal((v.init.headers as Record<string, string>)["x-v3-secret"], "segredo-de-teste");
  const corpo = JSON.parse(String(v.init.body)) as Record<string, unknown>;
  assert.deepEqual(Object.keys(corpo).sort(), ["janela", "ocorrido_em", "tipo", "usuario", "via"]);
  assert.equal(corpo.tipo, "cota_estourada");
  assert.equal(corpo.ocorrido_em, "2026-11-16T12:00:00.000Z");
  assert.doesNotMatch(String(v.init.body), /\bip\b|@|segredo-de-teste/i);
});

test("usuário sem nome vira texto neutro", async () => {
  let corpo = "";
  const fetchImpl = (async (_u: string, init: RequestInit) => { corpo = String(init.body); return new Response("{}", { status: 200 }); }) as unknown as typeof fetch;
  await enviarAlertaCota({ ...dados, nomeUsuario: null }, { url: "https://x", segredo: "s", fetchImpl });
  assert.equal((JSON.parse(corpo) as { usuario: string }).usuario, "usuário sem nome");
});

test("n8n recusa, rede cai ou demora: devolve o motivo e nunca lança", async () => {
  const recusa = (async () => new Response("no", { status: 403 })) as unknown as typeof fetch;
  assert.deepEqual(await enviarAlertaCota(dados, { url: "https://x", segredo: "s", fetchImpl: recusa }), { enviado: false, motivo: "http", status: 403 });

  const queda = (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
  assert.deepEqual(await enviarAlertaCota(dados, { url: "https://x", segredo: "s", fetchImpl: queda }), { enviado: false, motivo: "falha_de_rede" });

  const lento = ((_u: string, init: RequestInit) => new Promise((_ok, no) => {
    init.signal?.addEventListener("abort", () => { const e = new Error("abortado"); e.name = "AbortError"; no(e); });
  })) as unknown as typeof fetch;
  assert.deepEqual(await enviarAlertaCota(dados, { url: "https://x", segredo: "s", fetchImpl: lento, timeoutMs: 20 }), { enviado: false, motivo: "tempo_esgotado" });
});
