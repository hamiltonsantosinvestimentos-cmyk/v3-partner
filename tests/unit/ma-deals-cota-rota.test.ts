// Guarda de regressão da cota na rota POST /api/ma-deals (BRIEF 15/11/2026). Lê o fonte, sem rede e sem criar deal.
// Falha se alguém tirar a reserva, mudar a ordem (a vaga tem de ser reservada ANTES de emitir o código oficial,
// senão tentativa negada queima numeração) ou voltar a devolver detalhe do banco ao cliente.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const fonte = readFileSync(join(__dirname, "..", "..", "app", "api", "ma-deals", "route.ts"), "utf8");
const post = fonte.slice(fonte.indexOf("export async function POST"), fonte.indexOf("export async function PATCH"));

test("POST: a vaga é reservada antes de emitir o código oficial", () => {
  const reserva = post.indexOf("reservarVagaDeCriacao(");
  const emissao = post.indexOf("issueV3Code(");
  assert.ok(reserva > 0, "a rota precisa chamar reservarVagaDeCriacao");
  assert.ok(emissao > 0, "issueV3Code não encontrado (a varredura precisa ser atualizada)");
  assert.ok(reserva < emissao, "reservar a vaga ANTES de issueV3Code, senão a negação queima numeração");
});

test("POST: corpo do partner passa por camposConfiaveisParaCriacao antes de qualquer uso", () => {
  assert.match(post, /const d = camposConfiaveisParaCriacao\(parsed\.data, profile\?\.role\)/);
  assert.doesNotMatch(post, /const d = parsed\.data/);
});

test("POST: a vaga é devolvida em toda saída de erro depois da reserva", () => {
  assert.ok((post.match(/devolverVagaDeCriacao\(/g) ?? []).length >= 3, "erro do insert, retorno vazio e catch final");
});

test("POST: nenhuma resposta devolve detalhe do banco nem a mensagem da exceção", () => {
  assert.doesNotMatch(post, /error\.details/);
  assert.doesNotMatch(post, /error\.message[^\n]*status: 500/);
  assert.doesNotMatch(post, /Exceção interna: \$\{msg\}/);
});
