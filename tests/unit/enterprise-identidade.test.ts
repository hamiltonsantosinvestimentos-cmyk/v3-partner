// Identidade do Enterprise, fase 1 (BRIEF docs/briefs/2026-11-23_enterprise-identidade-fase1-chat-operacoes-simuladores.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { cnpjCanonico, linhaJuridica, normalizarCnpj, normalizarRazaoSocial, type IdentidadeEnterprise } from "../../lib/enterprise-identidade";
import { cabecalhoEnterprise, rodapeEnterprise, linhaTecnicaV3, tituloSimulacao, LINHA_TECNICA_V3 } from "../../components/simulador/identidade-pdf";
import { nomeDaMesaParaExibir } from "../../components/chat/chat-partes";

const ags: IdentidadeEnterprise = {
  nome: "AGS Finance", logoUrl: null, logoClaroUrl: null,
  razaoSocial: "AGS Finance Ltda", cnpj: "14.219.287/0001-50", site: null,
};

test("CNPJ: formato canônico, alfanumérico e inválidos", () => {
  assert.equal(normalizarCnpj("14.219.287/0001-50"), "14219287000150");
  assert.equal(cnpjCanonico("14.219.287/0001-50"), "14219287000150");
  assert.equal(cnpjCanonico("12.abc.345/01de-35"), "12ABC34501DE35");
  assert.equal(cnpjCanonico("14.219.287/0001-51"), null);
  assert.equal(cnpjCanonico("11111111111111"), null);
  assert.equal(cnpjCanonico("123"), null);
  assert.equal(cnpjCanonico(null), null);
});

test("razão social e linha jurídica", () => {
  assert.equal(normalizarRazaoSocial("  AGS   Finance  Ltda "), "AGS Finance Ltda");
  assert.equal(normalizarRazaoSocial("   "), null);
  assert.equal(linhaJuridica(ags), "AGS Finance Ltda · CNPJ 14.219.287/0001-50");
  assert.equal(linhaJuridica({ ...ags, site: "ags.com.br" }), "AGS Finance Ltda · CNPJ 14.219.287/0001-50 · ags.com.br");
  assert.equal(linhaJuridica({ ...ags, razaoSocial: null, cnpj: null }), "AGS Finance");
});

test("PDF do simulador: dados do Enterprise escapados, linha técnica da V3 só no fim", () => {
  const malicioso = { ...ags, nome: "<script>x</script>", razaoSocial: "A&B <b>" };
  const topo = cabecalhoEnterprise(malicioso);
  assert.ok(!topo.includes("<script>"));
  assert.ok(topo.includes("&lt;script&gt;"));
  assert.ok(topo.includes("A&amp;B &lt;b&gt;"));
  assert.ok(!rodapeEnterprise(malicioso).includes("<script>"));
  assert.ok(!tituloSimulacao("Cash", malicioso).includes("<script>"));
  assert.ok(!topo.includes("V3") && !rodapeEnterprise(ags).includes("V3"));
  assert.ok(linhaTecnicaV3().includes(LINHA_TECNICA_V3));
  assert.equal(LINHA_TECNICA_V3, "Simulação técnica fornecida pela V3 Partners.");
  const comLogo = cabecalhoEnterprise({ ...ags, logoClaroUrl: "https://x.supabase.co/storage/v1/object/public/white-label/a\"b.png" });
  assert.ok(comLogo.includes("a&quot;b.png"));
});

test("chat: nome da Mesa para o partner do Enterprise", () => {
  assert.equal(nomeDaMesaParaExibir("Mesa V3 · aviso automático", "AGS Finance"), "Mesa AGS Finance · aviso automático");
  assert.equal(nomeDaMesaParaExibir("Mesa V3 Partners", "AGS Finance"), "Mesa AGS Finance");
  assert.equal(nomeDaMesaParaExibir("Mesa V3 · aviso automático", null), "Mesa V3 · aviso automático");
  assert.equal(nomeDaMesaParaExibir("Fernanda Souza", "AGS Finance"), "Fernanda Souza");
});
