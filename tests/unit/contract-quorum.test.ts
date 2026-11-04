// Quórum da Revisão Jurídica: paridade com a regra que a rota de revisão tinha
// antes (copiada aqui como oráculo), ordenação, edição de texto e aviso de
// rodada reiniciada (notificador injetado, nunca dispara para sócio real).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SOCIOS,
  computeQuorum,
  isBodyEdited,
  normalizeBody,
  notifyRoundRestart,
  roundRestartNotification,
  roundRestartRecipients,
  type QuorumVote,
} from "../../lib/contract-quorum";

const [ROBSON, JOAO, HAMILTON] = SOCIOS.map((s) => s.id);
const FORA = "00000000-0000-0000-0000-000000000000";

const voto = (id: string, decision = "aprovado", type = "compliance_socio"): QuorumVote => ({ reviewer_id: id, reviewer_type: type, decision });

// Regra antiga de app/api/contracts/templates/[id]/review/route.ts (linhas 179-197).
function legado(votos: QuorumVote[], valor: number | null | undefined) {
  const aprovados = votos.filter((r) => r.reviewer_type === "compliance_socio" && r.decision === "aprovado");
  const socioMajority = aprovados.length >= 2;
  const acima = typeof valor === "number" && valor > 50000;
  const unanimidade = aprovados.length >= 3;
  return { met: unanimidade || (socioMajority && !acima), unanimidade, n: aprovados.length };
}

const cenariosVotos: Array<[string, QuorumVote[]]> = [
  ["sem votos", []],
  ["1 aprovou", [voto(HAMILTON)]],
  ["2 aprovaram", [voto(HAMILTON), voto(JOAO)]],
  ["3 aprovaram", [voto(HAMILTON), voto(JOAO), voto(ROBSON)]],
  ["1 aprovou e 1 reprovou", [voto(HAMILTON), voto(JOAO, "reprovado")]],
  ["2 aprovaram e 1 reprovou", [voto(HAMILTON), voto(JOAO), voto(ROBSON, "reprovado")]],
  ["voto legado de jurídico não conta no placar", [voto(HAMILTON), voto(FORA, "aprovado", "juridico")]],
  ["jurídico mais 1 sócio não fecha", [voto(JOAO), voto(FORA, "aprovado", "juridico")]],
];
const valores: Array<number | null | undefined> = [null, undefined, 0, 50000, 50001, 1_000_000];

test("paridade com a regra antiga em todos os cenários e valores", () => {
  for (const [nome, votos] of cenariosVotos) {
    for (const valor of valores) {
      const novo = computeQuorum(votos, valor, 2);
      const antigo = legado(votos, valor);
      assert.equal(novo.met, antigo.met, `${nome} valor=${valor}: met`);
      assert.equal(novo.unanimidade, antigo.unanimidade, `${nome} valor=${valor}: unanimidade`);
      assert.equal(novo.sociosAprovaram, antigo.n, `${nome} valor=${valor}: placar`);
    }
  }
});

test("caso real Roda Gigante: valor null, rodada 2 com 1 voto, falta 1 voto", () => {
  const q = computeQuorum([voto(HAMILTON)], null, 2);
  assert.equal(q.met, false);
  assert.deepEqual(q.aprovaram, ["Hamilton Santos"]);
  assert.deepEqual(q.faltam, ["João Lemos", "Robson Lino"]);
  assert.equal(q.regra, "Fecha com 2 sócios (ou com os 3).");
  assert.equal(computeQuorum([voto(HAMILTON), voto(JOAO)], null, 2).met, true);
});

test("estado vazio: faltam os 3, em ordem alfabética pt-BR por nome completo", () => {
  const q = computeQuorum([], null, 3);
  assert.deepEqual(q.faltam, ["Hamilton Santos", "João Lemos", "Robson Lino"]);
  assert.deepEqual(q.aprovaram, []);
  assert.equal(q.rodada, 3);
});

test("nomes de quem votou e de quem aprovou saem em ordem alfabética", () => {
  const q = computeQuorum([voto(ROBSON), voto(HAMILTON), voto(JOAO, "reprovado")], null, 1);
  assert.deepEqual(q.aprovaram, ["Hamilton Santos", "Robson Lino"]);
  assert.deepEqual(q.votaram, ["Hamilton Santos", "João Lemos", "Robson Lino"]);
  assert.deepEqual(q.faltam, []);
});

test("quem reprovou já votou (não aparece em faltam), como o backend faz", () => {
  const q = computeQuorum([voto(JOAO, "reprovado")], null, 1);
  assert.deepEqual(q.faltam, ["Hamilton Santos", "Robson Lino"]);
  assert.equal(q.sociosAprovaram, 0);
});

test("voto legado de jurídico conta como votou mas não entra no placar nem em faltam de sócio", () => {
  const q = computeQuorum([voto(FORA, "aprovado", "juridico")], null, 1);
  assert.equal(q.sociosAprovaram, 0);
  assert.deepEqual(q.faltam, ["Hamilton Santos", "João Lemos", "Robson Lino"]);
});

test("mensagens iguais às que a rota devolvia", () => {
  assert.equal(computeQuorum([voto(JOAO), voto(HAMILTON), voto(ROBSON)], 900000, 1).mensagem,
    "Quórum atingido por unanimidade dos 3 sócios. Minuta aprovada, liberada para gerar contrato.");
  assert.equal(computeQuorum([voto(JOAO), voto(HAMILTON)], 40000, 1).mensagem,
    "Quórum atingido por maioria de sócios (2/3). Minuta aprovada, liberada para gerar contrato.");
  assert.match(computeQuorum([voto(JOAO), voto(HAMILTON)], 60000, 1).mensagem, /passa de R\$50\.000: precisa da unanimidade dos 3 sócios\. Aguardando\.$/);
  assert.equal(computeQuorum([voto(JOAO)], null, 1).mensagem, "Aprovação de sócio diretor registrada (1/3 sócios). Aguardando 2 sócios.");
  assert.equal(computeQuorum([voto(JOAO)], 60000, 1).mensagem,
    "Aprovação de sócio diretor registrada (1/3 sócios). Aguardando 2 sócios (ou os 3 sócios, dado o valor acima de R$50 mil).");
});

test("nenhum texto da regra menciona jurídico", () => {
  for (const [, votos] of cenariosVotos) {
    for (const valor of valores) {
      const q = computeQuorum(votos, valor, 1);
      assert.doesNotMatch(`${q.regra} ${q.mensagem}`, /jur[ií]dico/i);
    }
  }
});

test("edição de texto: CRLF, espaço no fim e linha em branco extra não contam como edição", () => {
  const atual = "<h1>Título</h1>\n\n<p>Cláusula 1.</p>";
  assert.equal(isBodyEdited(atual, atual), false);
  assert.equal(isBodyEdited("<h1>Título</h1>\r\n\r\n<p>Cláusula 1.</p>\r\n", atual), false);
  assert.equal(isBodyEdited(atual + "   \n\n", atual), false);
  assert.equal(isBodyEdited("  " + atual, atual), false);
});

test("edição de texto: mudança real de conteúdo conta, corpo vazio ou ausente não", () => {
  const atual = "<p>Cláusula 1.</p>";
  assert.equal(isBodyEdited("<p>Cláusula 1 alterada.</p>", atual), true);
  assert.equal(isBodyEdited("", atual), false);
  assert.equal(isBodyEdited("   ", atual), false);
  assert.equal(isBodyEdited(undefined, atual), false);
  assert.equal(isBodyEdited(null, atual), false);
  assert.equal(normalizeBody("a\r\nb "), "a\nb");
});

test("destinatários do aviso: só sócios que aprovaram, nunca o editor, nunca fora dos 3, sem repetir", () => {
  const anteriores = [voto(JOAO), voto(ROBSON), voto(HAMILTON, "reprovado"), voto(FORA), voto(JOAO)];
  assert.deepEqual(roundRestartRecipients(anteriores, ROBSON).sort(), [JOAO]);
  assert.deepEqual(roundRestartRecipients(anteriores, null).sort(), [JOAO, ROBSON].sort());
  assert.deepEqual(roundRestartRecipients([voto(JOAO, "aprovado", "juridico")], null), []);
  assert.deepEqual(roundRestartRecipients([], JOAO), []);
});

test("aviso de rodada reiniciada é genérico: sem nome de minuta, cliente ou valor", () => {
  const n = roundRestartNotification("11111111-2222-3333-4444-555555555555");
  assert.equal(n.title, "Minuta alterada durante a revisão");
  assert.equal(n.message, "O texto mudou e a votação desta minuta recomeçou. Abra no link e vote de novo.");
  assert.match(n.actionUrl, /template_id=11111111-2222-3333-4444-555555555555$/);
  assert.doesNotMatch(`${n.title} ${n.message}`, /—|–|Roda|NCNDA|R\$/);
});

test("notificador stub: só chama sócios que aprovaram, exceto o editor, e espera todos os envios", async () => {
  const chamadas: string[] = [];
  const notify = async (p: { userId: string }) => { await new Promise((r) => setTimeout(r, 5)); chamadas.push(p.userId); };
  const enviados = await notifyRoundRestart({
    templateId: "t1",
    votosRodadaAnterior: [voto(JOAO), voto(ROBSON), voto(FORA), voto(HAMILTON, "reprovado")],
    editorId: ROBSON,
    notify,
  });
  assert.deepEqual(enviados, [JOAO]);
  assert.deepEqual(chamadas, [JOAO]); // já terminou antes de retornar (await real)
  for (const id of chamadas) assert.ok(SOCIOS.some((s) => s.id === id));
});

test("falha de um aviso não derruba os demais", async () => {
  const chamadas: string[] = [];
  const notify = async (p: { userId: string }) => {
    if (p.userId === JOAO) throw new Error("falha simulada");
    chamadas.push(p.userId);
  };
  const orig = console.error;
  console.error = () => {};
  try {
    await notifyRoundRestart({ templateId: "t1", votosRodadaAnterior: [voto(JOAO), voto(ROBSON)], editorId: HAMILTON, notify });
  } finally { console.error = orig; }
  assert.deepEqual(chamadas, [ROBSON]);
});
