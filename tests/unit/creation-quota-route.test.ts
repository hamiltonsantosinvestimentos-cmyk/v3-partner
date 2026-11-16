// Cola entre as rotas e a cota (lib/creation-quota-route.ts): resposta pronta quando negado, token guardado só como
// hash, IP só para usuário, vaga devolvida quando a criação falha. Porta falsa, sem rede.
import test from "node:test";
import assert from "node:assert/strict";
import { atorParaLog, reservarVagaOuNegar } from "../../lib/creation-quota-route";
import type { PortaCota, ResultadoCota } from "../../lib/creation-quota";

function portaFixa(r: ResultadoCota) {
  const chamadas: { kind: string; id: string; via: string; ip: string | null }[] = [];
  const liberadas: string[] = [];
  const porta: PortaCota = {
    async reservar(a, via, ip) { chamadas.push({ kind: a.kind, id: a.id, via, ip }); return r; },
    async liberar(id) { liberadas.push(id); },
  };
  return { porta, chamadas, liberadas };
}
const req = (m: Record<string, string> = {}) => ({ headers: { get: (k: string) => m[k.toLowerCase()] ?? null } });
const dbFalso = { rpc: () => Promise.resolve({ data: null, error: null }) };

test("ator no log: usuário passa direto; token vira hash estável e nunca aparece em claro", () => {
  assert.equal(atorParaLog("user", "abc-123"), "abc-123");
  const t = atorParaLog("token", "token-secreto-do-link");
  assert.match(t, /^t:[0-9a-f]{32}$/);
  assert.equal(t, atorParaLog("token", "token-secreto-do-link"));
  assert.notEqual(t, atorParaLog("token", "outro-token"));
  assert.doesNotMatch(t, /token-secreto/);
});

test("liberado: sem resposta de negação, e devolver() devolve a vaga reservada", async () => {
  const { porta, liberadas } = portaFixa({ allowed: true, reason: "ok", log_id: "L7" });
  const v = await reservarVagaOuNegar(req(), dbFalso, { kind: "user", id: "u1", via: "ma-deals", papel: "PARTNER" }, porta);
  assert.equal(v.negado, null);
  await v.devolver();
  assert.deepEqual(liberadas, ["L7"]);
});

test("negado: 429 com Retry-After e corpo com a mensagem; devolver() não faz nada", async () => {
  const { porta, liberadas } = portaFixa({ allowed: false, reason: "hora", retry_after_seconds: 600 });
  const v = await reservarVagaOuNegar(req(), dbFalso, { kind: "user", id: "u1", via: "ma-deals", papel: "PARTNER" }, porta);
  assert.ok(v.negado);
  assert.equal(v.negado.status, 429);
  assert.equal(v.negado.headers.get("Retry-After"), "600");
  const corpo = (await v.negado.json()) as { error: string };
  assert.match(corpo.error, /compliance@v3partners\.com\.br/);
  await v.devolver();
  assert.deepEqual(liberadas, []);
});

test("IP só para usuário: cabeçalho da Vercel vai; x-forwarded-for forjado nunca; token nunca leva IP", async () => {
  const a = portaFixa({ allowed: true, reason: "ok", log_id: "L1" });
  await reservarVagaOuNegar(req({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "6.6.6.6" }), dbFalso, { kind: "user", id: "u1", via: "ma-deals" }, a.porta);
  assert.equal(a.chamadas[0].ip, "203.0.113.7");

  const b = portaFixa({ allowed: true, reason: "ok", log_id: "L2" });
  await reservarVagaOuNegar(req({ "x-forwarded-for": "6.6.6.6" }), dbFalso, { kind: "user", id: "u1", via: "ma-deals" }, b.porta);
  assert.equal(b.chamadas[0].ip, null);

  const c = portaFixa({ allowed: true, reason: "ok", log_id: "L3" });
  await reservarVagaOuNegar(req({ "x-real-ip": "203.0.113.7" }), dbFalso, { kind: "token", id: "tok", via: "cm-intake" }, c.porta);
  assert.equal(c.chamadas[0].ip, null);
  assert.match(c.chamadas[0].id, /^t:/);
});

test("erro_interno: partner barrado com 503; adesão de parceria segue", async () => {
  const erro = portaFixa({ allowed: null, reason: "erro_interno" });
  const partner = await reservarVagaOuNegar(req(), dbFalso, { kind: "user", id: "u1", via: "ma-deals", papel: "PARTNER" }, erro.porta);
  assert.equal(partner.negado?.status, 503);
  const parceria = await reservarVagaOuNegar(req(), dbFalso, { kind: "user", id: "u1", via: "parceria" }, erro.porta);
  assert.equal(parceria.negado, null);
});

test("a negação com alerta não quebra a resposta mesmo sem configuração do n8n (alerta fora do caminho)", async () => {
  const { porta } = portaFixa({ allowed: false, reason: "hora", retry_after_seconds: 60, alerta_cota: true });
  const v = await reservarVagaOuNegar(req(), dbFalso, { kind: "user", id: "u1", via: "ma-deals", papel: "PARTNER", nomeUsuario: "Fulano" }, porta);
  assert.equal(v.negado?.status, 429);
});
