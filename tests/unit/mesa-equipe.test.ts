// BRIEF docs/briefs/2026-11-26_mesa-operacional-master-enterprise.md
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acessoMesaEquipe, CAMPOS_CARD, cardDaEquipe, colunaDoCard, dataBR, OUTRO_DOCUMENTO, ordenarUsuarios,
  resumoDaMesa, SEM_NOME, valorBR,
} from "../../lib/enterprise/mesa-equipe";
import { SLA_STAGES } from "../../lib/mesa-operacional-sla";

test("colunaDoCard: etapas, encerradas, FINALIZADO e desconhecida", () => {
  for (const e of SLA_STAGES) assert.equal(colunaDoCard(e, "IN_PROGRESS"), e);
  assert.equal(colunaDoCard("REPROVADO", "REJECTED"), "ENCERRADAS");
  assert.equal(colunaDoCard("DECLINADO", "CANCELLED"), "ENCERRADAS");
  assert.equal(colunaDoCard("FINALIZADO", "APPROVED"), "LIBERADO");
  assert.equal(colunaDoCard("FINALIZADO", "REJECTED"), "ENCERRADAS");
  assert.equal(colunaDoCard("FINALIZADO", "CANCELLED"), "ENCERRADAS");
  assert.equal(colunaDoCard("", ""), "RECEBIDO");
  assert.equal(colunaDoCard("QUALQUER", "X"), "RECEBIDO");
});

test("resumoDaMesa: Encerradas fora do total e do valor; nulo soma 0", () => {
  const r = resumoDaMesa([
    { coluna: "RECEBIDO", valor_solicitado: 100 },
    { coluna: "ANALISE", valor_solicitado: null },
    { coluna: "ENCERRADAS", valor_solicitado: 999 },
  ]);
  assert.equal(r.ativas, 2);
  assert.equal(r.encerradas, 1);
  assert.equal(r.valorSolicitadoAtivas, 100);
  assert.equal(r.porColuna.RECEBIDO, 1);
  assert.equal(r.porColuna.ENCERRADAS, 1);
});

test("dataBR: fuso de São Paulo e Não informado", () => {
  assert.equal(dataBR("2026-11-26T23:30:00-03:00"), "26/11/2026");
  assert.equal(dataBR("2026-11-26T23:30:00-03:00", true), "26/11/2026 23:30");
  assert.equal(dataBR(null), "Não informado");
  assert.equal(dataBR("lixo"), "Não informado");
});

test("valorBR: R$ e Não informado", () => {
  assert.equal(valorBR(1234.5), "R$ 1.234,50");
  assert.equal(valorBR(null), "Não informado");
});

test("ordenarUsuarios: Todos, Você, pt-BR, sem nome no fim", () => {
  const r = ordenarUsuarios([
    { id: "m", nome: "Master" }, { id: "b", nome: "Bruno" }, { id: "x", nome: null }, { id: "a", nome: "Álvaro" },
  ], "m");
  assert.deepEqual(r.map((u) => u.rotulo), ["Todos", "Você", "Álvaro", "Bruno", SEM_NOME]);
  assert.equal(r.filter((u) => u.id === "m").length, 1);
});

test("acessoMesaEquipe", () => {
  assert.equal(acessoMesaEquipe(null, null), "login");
  assert.equal(acessoMesaEquipe({ id: "u" }, null), "negado");
  assert.equal(acessoMesaEquipe({ id: "u" }, { ehMaster: false }), "negado");
  assert.equal(acessoMesaEquipe({ id: "u" }, { ehMaster: true }), "master");
});

const linha = {
  id: "p1", code: "CRD-1", referencia_externa: null, partner_id: "u1", credit_line: "Linha Teste",
  current_level: "NIVEL_1", stage: "ANALISE", status: "IN_PROGRESS", requested_value: 500000, approved_value: null,
  client_name: "Cliente X", client_cpf_cnpj: "123.456.789-01",
  documents: [{ doc_id: "rg", file_name: "rg.pdf", uploaded_at: "2026-11-20T10:00:00Z", url: "https://segredo/arquivo-rg" }, { doc_id: "anexo_chat", file_name: "x.pdf" }],
  metadata: { client_type: "PF", prazo: "120", finalidade: "Capital", comissao_pct: 77.77, instituicao: "BANCO-SECRETO-XYZ", mandato: { id: "MAN-SECRETO" } },
  instituicao_encaminhada: "BANCO-SECRETO-XYZ", instituicao_feedback: "FEEDBACK-SECRETO", comissao_partner: 12345.67,
  mesa_comments: [{ texto: "COMENTARIO-INTERNO" }],
  pending_reason: null, pending_responsible: null, pending_at: null, pending_resolved_at: null,
  created_at: "2026-11-19T10:00:00Z", updated_at: "2026-11-21T10:00:00Z",
};
const portfolio = [{
  nome: "Linha Teste",
  documentos_pf: [{ id: "rg", nome: "RG ou CNH", obrigatorio: true }, { id: "comp_renda", nome: "Comprovante de renda", obrigatorio: true }],
  documentos_pj: [],
}] as never;

test("cardDaEquipe: chaves exatas, sem link, CPF mascarado, originador", () => {
  const c = cardDaEquipe(linha, { portfolio, nomes: new Map([["u1", "Ana"]]) });
  assert.deepEqual(Object.keys(c).sort(), [...CAMPOS_CARD].sort());
  assert.equal("link_analise_credito" in c, false);
  assert.equal(c.cliente.cpf_cnpj, "***.456.789-**");
  assert.equal(c.originador, "Ana");
  assert.equal(c.coluna, "ANALISE");
  assert.equal(cardDaEquipe(linha, { portfolio, nomes: new Map() }).originador, SEM_NOME);
});

test("cardDaEquipe: nada interno vaza", () => {
  const json = JSON.stringify(cardDaEquipe(linha, { portfolio, nomes: new Map([["u1", "Ana"]]) }));
  for (const s of ["BANCO-SECRETO-XYZ", "FEEDBACK-SECRETO", "12345.67", "77.77", "COMENTARIO-INTERNO", "MAN-SECRETO", "https://segredo", "123.456.789-01"]) {
    assert.equal(json.includes(s), false, s);
  }
});

test("cardDaEquipe: nomes de documento no lugar dos ids", () => {
  const c = cardDaEquipe(linha, { portfolio, nomes: new Map() });
  assert.deepEqual(c.documentos_pendentes, ["Comprovante de renda"]);
  assert.deepEqual(c.documentos_recebidos.map((d) => d.tipo_documento).sort(), [OUTRO_DOCUMENTO, "RG ou CNH"].sort());
});

// BRIEF docs/briefs/2026-11-27_mesa-operacional-master-modal-mesa-credito.md
import { propostaDaMesaDeCredito } from "../../app/(platform)/enterprise/mesa-operacional/exibicao";

test("propostaDaMesaDeCredito: mesma conversão da Mesa de Crédito (nivel1-client)", () => {
  const p = propostaDaMesaDeCredito({
    id: "p1", code: "C1", title: "T", client_name: "Cli", client_cpf_cnpj: "123.456.789-01",
    credit_line: "HOME EQUITY", requested_value: 850000, approved_value: null, current_level: "NIVEL_1",
    status: "PENDING", stage: "AVALIACAO_IMOVEL", created_at: "2026-11-27T12:00:00Z",
    partner: { id: "u1", full_name: "Ana", role: "ENTERPRISE" },
    metadata: { client_type: "PF", email: "a@b.c", telefone: "+55", prazo: "180", finalidade: "F" },
    pending_reason: "R", pending_responsible: "Partner", pending_at: "2026-11-27T12:00:00Z",
    level1_notes: "n1",
  });
  assert.deepEqual(Object.keys(p).sort(), [
    "approved_value", "client_name", "client_type", "code", "comissao_instituicao_perc", "comissao_mandato_perc",
    "cpf_cnpj", "created_at", "credit_line", "current_level", "email", "enterprise", "finalidade", "id",
    "level1_at", "level1_notes", "level2_at", "level2_notes", "level3_at", "level3_notes", "metadata",
    "partner_id", "partner_name", "partner_role", "pending_at", "pending_reason", "pending_resolved_at",
    "pending_resolved_by", "pending_responsible", "prazo", "requested_value", "stage", "status", "telefone",
    "title", "valor_credito_atual",
  ].sort());
  assert.equal(p.cpf_cnpj, "123.456.789-01");
  assert.equal(p.client_type, "PF");
  assert.equal(p.prazo, "180");
  assert.equal(p.partner_id, "u1");
  assert.equal(p.partner_name, "Ana");
  assert.equal(p.approved_value, null);
  assert.equal(p.enterprise, null);
  assert.equal(p.pending_reason, "R");
});
