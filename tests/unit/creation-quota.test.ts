// Cota de criação de operações (BRIEF 15/11/2026): lógica pura de lib/creation-quota.ts.
// Porta falsa, sem rede e sem criar nenhum deal. A prova da cota em si (atomicidade, janelas, bloqueio, acesso por
// perfil) é o ensaio SQL em transação desfeita registrado no BRIEF; aqui se prova o que a rota faz com o resultado.
import test from "node:test";
import assert from "node:assert/strict";
import {
  reservarVagaDeCriacao, devolverVagaDeCriacao, mensagemDeNegacao, ipDaRequisicao, papelIsentoDeCota,
  camposConfiaveisParaCriacao, portaSupabase, validarConteudoMinimoDoDeal, tamanhoDaDescricaoDoDeal,
  type PortaCota, type ResultadoCota,
} from "../../lib/creation-quota";

function portaFixa(r: ResultadoCota): PortaCota & { chamadas: unknown[]; liberadas: string[] } {
  const chamadas: unknown[] = [];
  const liberadas: string[] = [];
  return { chamadas, liberadas, async reservar(a, v, ip) { chamadas.push([a, v, ip]); return r; }, async liberar(id) { liberadas.push(id); } };
}
const portaQueLanca: PortaCota = { async reservar() { throw new Error("rede caiu"); }, async liberar() { throw new Error("rede caiu"); } };
const h = (m: Record<string, string>) => ({ get: (k: string) => m[k.toLowerCase()] ?? null });

test("ip: usa só os cabeçalhos da Vercel e ignora x-forwarded-for (forjável)", () => {
  assert.equal(ipDaRequisicao(h({ "x-real-ip": "203.0.113.7" })), "203.0.113.7");
  assert.equal(ipDaRequisicao(h({ "x-vercel-forwarded-for": "198.51.100.2" })), "198.51.100.2");
  assert.equal(ipDaRequisicao(h({ "x-forwarded-for": "6.6.6.6, 203.0.113.7" })), null);
  assert.equal(ipDaRequisicao(h({ "x-real-ip": "2001:db8::1" })), "2001:db8::1");
  assert.equal(ipDaRequisicao(h({ "x-real-ip": "nao-e-ip" })), null);
  assert.equal(ipDaRequisicao(h({})), null);
});

test("papéis isentos: só a equipe; papel ausente ou desconhecido sofre a cota (nega por padrão)", () => {
  for (const p of ["ADMIN", "GESTAO", "MESA", "MESA_OPERACIONAL"]) assert.equal(papelIsentoDeCota(p), true, p);
  for (const p of ["PARTNER", "PARTNER_PRO", "STARTER", "ENTERPRISE", "FINANCEIRO", "GOLD", "FUTURO", "", null, undefined]) {
    assert.equal(papelIsentoDeCota(p as string | null | undefined), false, String(p));
  }
});

test("reserva permitida: libera e devolve o id da linha para poder devolver a vaga", async () => {
  const porta = portaFixa({ allowed: true, reason: "ok", log_id: "L1" });
  const d = await reservarVagaDeCriacao(porta, { kind: "user", id: "u1", via: "ma-deals", papel: "PARTNER", ip: "203.0.113.7" });
  assert.deepEqual(d, { liberado: true, logId: "L1", alertaCota: false });
  assert.deepEqual(porta.chamadas[0], [{ kind: "user", id: "u1" }, "ma-deals", "203.0.113.7"]);
});

test("cota da hora: 429 com Retry-After e texto com horário, sem limite numérico nem 'uso indevido'", async () => {
  const agora = new Date("2026-11-15T15:00:00Z"); // 12:00 em São Paulo
  const d = await reservarVagaDeCriacao(portaFixa({ allowed: false, reason: "hora", retry_after_seconds: 1800, alerta_cota: true }),
    { kind: "user", id: "u1", via: "ma-deals", papel: "PARTNER", agora });
  assert.equal(d.liberado, false);
  if (d.liberado) return;
  assert.equal(d.status, 429);
  assert.equal(d.cabecalhos["Retry-After"], "1800");
  assert.equal(d.alertaCota, true);
  assert.match(d.corpo.error, /às 12:30\./);
  assert.match(d.corpo.error, /compliance@v3partners\.com\.br/);
  assert.doesNotMatch(d.corpo.error, /uso indevido/i);
  assert.doesNotMatch(d.corpo.error, /\b(10|20|60)\b/);
});

test("intervalo de 60 s: 429 sem data de bloqueio e sem alerta", async () => {
  const d = await reservarVagaDeCriacao(portaFixa({ allowed: false, reason: "intervalo", retry_after_seconds: 40 }),
    { kind: "user", id: "u1", via: "ma-deals", papel: "PARTNER" });
  assert.equal(d.liberado, false);
  if (d.liberado) return;
  assert.equal(d.status, 429);
  assert.equal(d.alertaCota, false);
  assert.equal(d.cabecalhos["Retry-After"], "40");
  assert.equal(d.corpo.error, "Aguarde alguns instantes antes de criar um novo cadastro.");
});

test("bloqueio: texto com data e hora de São Paulo e canal de contestação", () => {
  const msg = mensagemDeNegacao({ allowed: false, reason: "bloqueio_automatico", blocked_until: "2026-11-16T21:30:00Z", retry_after_seconds: 86400 }, "user");
  assert.match(msg, /suspensa até 16\/11\/2026 às 18:30\./);
  assert.match(msg, /compliance@v3partners\.com\.br/);
  assert.doesNotMatch(msg, /uso indevido/i);
});

test("token (link público): mensagem própria ao cliente externo, sem citar compliance", () => {
  const msg = mensagemDeNegacao({ allowed: false, reason: "hora", retry_after_seconds: 600 }, "token");
  assert.equal(msg, "Limite de envios atingido para este link. Fale com quem enviou o link.");
});

test("erro_interno: partner fica barrado (503 genérico, fail-closed)", async () => {
  const d = await reservarVagaDeCriacao(portaFixa({ allowed: null, reason: "erro_interno" }),
    { kind: "user", id: "u1", via: "ma-deals", papel: "PARTNER_PRO" });
  assert.equal(d.liberado, false);
  if (d.liberado) return;
  assert.equal(d.status, 503);
  assert.doesNotMatch(d.corpo.error, /erro_interno|postgres|supabase/i);
});

test("erro_interno: equipe e a via 'parceria' seguem (defeito da cota não trava a Mesa nem o onboarding)", async () => {
  const porta = portaFixa({ allowed: null, reason: "erro_interno" });
  for (const papel of ["ADMIN", "GESTAO", "MESA", "MESA_OPERACIONAL"]) {
    const d = await reservarVagaDeCriacao(porta, { kind: "user", id: "u1", via: "ma-deals", papel });
    assert.equal(d.liberado, true, papel);
  }
  const p = await reservarVagaDeCriacao(porta, { kind: "user", id: "u1", via: "parceria", papel: "PARTNER" });
  assert.equal(p.liberado, true);
});

test("a chamada que lança (rede, timeout) tem o mesmo tratamento de erro_interno", async () => {
  const partner = await reservarVagaDeCriacao(portaQueLanca, { kind: "user", id: "u1", via: "ma-deals", papel: "PARTNER" });
  assert.equal(partner.liberado, false);
  const admin = await reservarVagaDeCriacao(portaQueLanca, { kind: "user", id: "u1", via: "ma-deals", papel: "ADMIN" });
  assert.equal(admin.liberado, true);
});

test("papel ausente (perfil não encontrado) sofre a cota e, em erro, fica barrado", async () => {
  const d = await reservarVagaDeCriacao(portaFixa({ allowed: null, reason: "erro_interno" }), { kind: "user", id: "u1", via: "ma-deals", papel: null });
  assert.equal(d.liberado, false);
});

test("devolver a vaga: sem id não chama nada; erro da porta é engolido", async () => {
  const porta = portaFixa({ allowed: true, reason: "ok" });
  await devolverVagaDeCriacao(porta, null);
  assert.deepEqual(porta.liberadas, []);
  await devolverVagaDeCriacao(porta, "L9");
  assert.deepEqual(porta.liberadas, ["L9"]);
  await assert.doesNotReject(devolverVagaDeCriacao(portaQueLanca, "L9"));
});

test("corpo confiável: partner perde assigned_to, originator_profile_id e code; equipe mantém", () => {
  const corpo = { company: "X", assigned_to: "outro", originator_profile_id: "outro", code: "V3-FALSO-001" };
  for (const papel of ["PARTNER", "PARTNER_PRO", "FINANCEIRO", null]) {
    const r = camposConfiaveisParaCriacao(corpo, papel) as Record<string, unknown>;
    assert.equal(r.company, "X");
    assert.equal("assigned_to" in r, false, String(papel));
    assert.equal("originator_profile_id" in r, false, String(papel));
    assert.equal("code" in r, false, String(papel));
  }
  for (const papel of ["ADMIN", "GESTAO", "MESA", "MESA_OPERACIONAL"]) {
    assert.deepEqual(camposConfiaveisParaCriacao(corpo, papel), corpo, papel);
  }
});

test("conteúdo mínimo: partner precisa de 30 caracteres em notes ou em asset_data.descricao_ptbr; equipe é isenta", () => {
  const trinta = "a".repeat(30);
  const vinteENove = "a".repeat(29);
  for (const papel of ["PARTNER", "PARTNER_PRO", "FINANCEIRO", null]) {
    assert.match(String(validarConteudoMinimoDoDeal(papel, { notes: "" })), /pelo menos 30 caracteres/, String(papel));
    assert.match(String(validarConteudoMinimoDoDeal(papel, { notes: vinteENove })), /pelo menos 30/);
    assert.equal(validarConteudoMinimoDoDeal(papel, { notes: trinta }), null, "30 em notes (CRM e cadastro rápido)");
    assert.equal(validarConteudoMinimoDoDeal(papel, { notes: "", asset_data: { descricao_ptbr: trinta } }), null, "30 em descricao_ptbr (formulário completo)");
  }
  for (const papel of ["ADMIN", "GESTAO", "MESA", "MESA_OPERACIONAL"]) {
    assert.equal(validarConteudoMinimoDoDeal(papel, { notes: "" }), null, papel);
  }
});

test("conteúdo mínimo: espaços não contam e tipo errado em descricao_ptbr é ignorado", () => {
  assert.equal(tamanhoDaDescricaoDoDeal({ notes: "   abc   " }), 3);
  assert.equal(tamanhoDaDescricaoDoDeal({ notes: null, asset_data: { descricao_ptbr: 123 } }), 0);
  assert.equal(tamanhoDaDescricaoDoDeal({ notes: "ab", asset_data: { descricao_ptbr: "abcde" } }), 5);
  assert.match(String(validarConteudoMinimoDoDeal("PARTNER", { notes: " ".repeat(40) })), /pelo menos 30/, "só espaços não vale");
});

test("portaSupabase: repassa os parâmetros, devolve o jsonb e trata erro como erro_interno", async () => {
  const visto: { nome: string; args: Record<string, unknown> }[] = [];
  const ok = portaSupabase({ rpc: (nome, args) => { visto.push({ nome, args }); return Promise.resolve({ data: { allowed: true, reason: "ok", log_id: "L1" }, error: null }); } });
  assert.deepEqual(await ok.reservar({ kind: "token", id: "tok" }, "intake", null), { allowed: true, reason: "ok", log_id: "L1" });
  assert.deepEqual(visto[0], { nome: "reserve_creation_slot", args: { p_actor_kind: "token", p_actor_id: "tok", p_via: "intake", p_ip: null } });
  await ok.liberar("L1");
  assert.deepEqual(visto[1], { nome: "release_creation_slot", args: { p_log_id: "L1" } });

  const falha = portaSupabase({ rpc: () => Promise.resolve({ data: null, error: { code: "42501" } }) });
  assert.equal((await falha.reservar({ kind: "user", id: "u" }, "ma-deals", null)).reason, "erro_interno");
});
