// Alerta de crédito da API de IA (camada 1). Telefones e nomes de teste são inventados: o repositório é público.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  destinatariosAlerta,
  dispararAlertaCreditoIa,
  montarMensagemCreditoIa,
  origemSegura,
  type RepoAlerta,
} from "@/lib/infra-alert";

const raiz = path.resolve(__dirname, "..", "..");
const ler = (rel: string) => fs.readFileSync(path.join(raiz, rel), "utf8");

function repoFalso(opts: { recente?: boolean; inserirFalha?: boolean; vencedor?: string | null | "eu" } = {}) {
  const chamadas: string[] = [];
  const repo: RepoAlerta = {
    async existeMarcadorRecente() { chamadas.push("existe"); return !!opts.recente; },
    async inserirMarcador() { chamadas.push("inserir"); return opts.inserirFalha ? null : "id-eu"; },
    async marcadorMaisAntigo() { chamadas.push("antigo"); return opts.vencedor === undefined || opts.vencedor === "eu" ? "id-eu" : opts.vencedor; },
    async atualizarMarcador() { chamadas.push("atualizar"); },
  };
  return { repo, chamadas };
}

const ligada = async () => true;
const TELS = ["+5521999990001", "+5551999990002"];

test("destinatários: normaliza, ignora inválido e repetido, aceita vírgula e ponto e vírgula", () => {
  assert.deepEqual(destinatariosAlerta("+55 21 99999-0001, 51 99999-0002;+5521999990001"), ["+5521999990001", "+5551999990002"]);
  assert.deepEqual(destinatariosAlerta("abc, ,12"), []);
  assert.deepEqual(destinatariosAlerta(undefined), []);
  assert.deepEqual(destinatariosAlerta(""), []);
});

test("origem: só caracteres simples, até 80, vazio vira null, nunca texto de erro com símbolos", () => {
  assert.equal(origemSegura("W3 — Ingestao de Docs V3"), "W3 Ingestao de Docs V3");
  assert.equal(origemSegura("  W3\n\n<script>alert(1)</script> "), "W3 scriptalert(1)script");
  assert.equal(origemSegura("x".repeat(200))?.length, 80);
  assert.equal(origemSegura(""), null);
  assert.equal(origemSegura(123), null);
  assert.equal(origemSegura(null), null);
});

test("mensagem: sem travessão nem emoji, cita a origem e a ação, sem dado de documento", () => {
  const m = montarMensagemCreditoIa("W3 Ingestao de Docs V3");
  for (const t of [m.whatsapp, m.assunto, m.texto]) {
    assert.ok(!/[—–]/.test(t), "travessão");
    assert.ok(!/\p{Extended_Pictographic}/u.test(t), "emoji");
    assert.ok(!/bloxs/i.test(t));
  }
  assert.match(m.whatsapp, /Origem: W3 Ingestao de Docs V3/);
  assert.match(m.whatsapp, /console\.anthropic\.com/);
  assert.match(montarMensagemCreditoIa(null).whatsapp, /ficou sem crédito\. Recarregue/);
});

test("chave desligada: não lê nem grava nada e não envia", async () => {
  const { repo, chamadas } = repoFalso();
  let enviados = 0;
  const r = await dispararAlertaCreditoIa("W3", { repo, flagLigada: async () => false, telefones: TELS, enviar: async () => { enviados++; return true; } });
  assert.equal(r.resultado, "desligado");
  assert.equal(r.email, false);
  assert.deepEqual(chamadas, []);
  assert.equal(enviados, 0);
});

test("primeiro alerta do dia: WhatsApp aos dois e e-mail liberado, com o registro atualizado", async () => {
  const { repo, chamadas } = repoFalso();
  const enviados: string[] = [];
  const r = await dispararAlertaCreditoIa("W3 Ingestao", { repo, flagLigada: ligada, telefones: TELS, enviar: async (t) => { enviados.push(t); return true; } });
  assert.equal(r.resultado, "enviado");
  assert.equal(r.whatsapp_enviados, 2);
  assert.equal(r.whatsapp_total, 2);
  assert.equal(r.email, true);
  assert.match(r.assunto ?? "", /ALERTA V3/);
  assert.deepEqual(enviados.sort(), [...TELS].sort());
  assert.deepEqual(chamadas, ["existe", "inserir", "antigo", "atualizar"]);
});

test("tempestade: já existe marcador nas últimas 24 h, suprime sem gravar nem enviar", async () => {
  const { repo, chamadas } = repoFalso({ recente: true });
  let enviados = 0;
  const r = await dispararAlertaCreditoIa("W3", { repo, flagLigada: ligada, telefones: TELS, enviar: async () => { enviados++; return true; } });
  assert.equal(r.resultado, "suprimido");
  assert.equal(r.email, false);
  assert.equal(enviados, 0);
  assert.deepEqual(chamadas, ["existe"], "só lê, nunca grava");
});

test("chamadas simultâneas: se outro marcador é o mais antigo, suprime e não envia", async () => {
  const { repo } = repoFalso({ vencedor: "id-de-outro" });
  let enviados = 0;
  const r = await dispararAlertaCreditoIa("W3", { repo, flagLigada: ligada, telefones: TELS, enviar: async () => { enviados++; return true; } });
  assert.equal(r.resultado, "suprimido");
  assert.equal(r.email, false);
  assert.equal(enviados, 0);
});

test("sem marcador gravado não envia (melhor calar do que repetir sem limite)", async () => {
  const { repo } = repoFalso({ inserirFalha: true });
  let enviados = 0;
  const r = await dispararAlertaCreditoIa("W3", { repo, flagLigada: ligada, telefones: TELS, enviar: async () => { enviados++; return true; } });
  assert.equal(r.resultado, "falhou");
  assert.equal(r.email, false);
  assert.equal(enviados, 0);
});

test("WhatsApp que falha ou lança: o alerta continua, o e-mail sai e nada estoura", async () => {
  const { repo } = repoFalso();
  const r = await dispararAlertaCreditoIa("W3", {
    repo, flagLigada: ligada, telefones: TELS,
    enviar: async (t) => { if (t === TELS[0]) throw new Error("gateway fora"); return false; },
  });
  assert.equal(r.resultado, "falhou");
  assert.equal(r.whatsapp_enviados, 0);
  assert.equal(r.email, true);
});

test("sem destinatários configurados: e-mail sai, resultado 'falhou' avisa que o WhatsApp não foi", async () => {
  const { repo } = repoFalso();
  const r = await dispararAlertaCreditoIa("W3", { repo, flagLigada: ligada, telefones: [], enviar: async () => true });
  assert.equal(r.whatsapp_total, 0);
  assert.equal(r.resultado, "falhou");
  assert.equal(r.email, true);
});

test("nunca lança: erro no banco devolve 'falhou' sem e-mail", async () => {
  const repo: RepoAlerta = {
    async existeMarcadorRecente() { throw new Error("banco fora"); },
    async inserirMarcador() { return null; }, async marcadorMaisAntigo() { return null; }, async atualizarMarcador() {},
  };
  const r = await dispararAlertaCreditoIa("W3", { repo, flagLigada: ligada, telefones: TELS });
  assert.equal(r.resultado, "falhou");
  assert.equal(r.email, false);
});

test("repositório público: nenhum telefone escrito no helper nem na rota", () => {
  for (const rel of ["lib/infra-alert.ts", "app/api/cron/alerta-credito-ia/route.ts"]) {
    const src = ler(rel).replace(/\/\/.*$/gm, "");
    assert.ok(!/\b\d{10,13}\b/.test(src), `${rel} tem telefone no código`);
  }
  assert.match(ler("lib/infra-alert.ts"), /ALERTA_INFRA_WHATSAPP/);
});

test("rota: exige Bearer CRON_SECRET em tempo constante e o tipo do alerta, antes de qualquer efeito", () => {
  const src = ler("app/api/cron/alerta-credito-ia/route.ts");
  assert.match(src, /timingSafeEqual/);
  assert.match(src, /Bearer \$\{esperado\}/);
  assert.match(src, /status: 401/);
  assert.match(src, /status: 422/);
  assert.ok(src.indexOf("segredoValido(") < src.indexOf("dispararAlertaCreditoIa("), "segredo depois do disparo");
  assert.ok(src.indexOf('corpo.tipo !== "credito_ia"') < src.indexOf("dispararAlertaCreditoIa("));
  assert.match(src, /export async function POST/);
  assert.ok(!/export async function GET/.test(src), "alerta só por POST");
});
