// Encaminhar proposta para Instituição (BRIEF docs/briefs/2026-11-06_encaminhar-proposta-instituicao.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  contatosPadrao, dividirEmPartes, emailValido, linhasDoCorpo, montarAssunto, montarCorpo, ordenarContatos,
  proximaSituacao, situacaoGeral, ufDaProposta, type Contato,
} from "../../lib/encaminhar-instituicao";
import { assinaturaSvixValida } from "../../lib/encaminhar-instituicao-webhook";
import { executarEnvio, validarPedido } from "../../lib/encaminhar-instituicao-servidor";

const MB = 1024 * 1024;

test("divisão em partes: 5 arquivos de 8 MB com limite de 20 MB dão 3 partes; arquivo de 30 MB fica de fora", () => {
  const docs = [1, 2, 3, 4, 5].map((i) => ({ id: i, bytes: 8 * MB }));
  const r = dividirEmPartes(docs, 20 * MB, 25 * MB);
  assert.deepEqual(r.partes.map((p) => p.map((d) => d.id)), [[1, 2], [3, 4], [5]]);
  const g = dividirEmPartes([{ id: 1, bytes: 30 * MB }, { id: 2, bytes: MB }], 20 * MB, 25 * MB);
  assert.deepEqual(g.fora.map((d) => d.id), [1]);
  assert.equal(g.partes.length, 1);
  assert.equal(dividirEmPartes([]).partes.length, 0);
});

test("e-mail válido", () => {
  assert.equal(emailValido("gerente@banco.com.br"), true);
  assert.equal(emailValido(" gerente@banco.com "), true);
  assert.equal(emailValido("gerente@banco"), false);
  assert.equal(emailValido("ger ente@banco.com"), false);
  assert.equal(emailValido(""), false);
});

const C = (id: string, uf: string | null, nome: string, principal = false): Contato => ({ id, uf, nome, email: `${id}@x.com`, cargo: "Gerente de atendimento", principal });

test("contatos: principal primeiro, depois Nacional e UFs em ordem, nomes em pt-BR", () => {
  const lista = ordenarContatos([C("a", "SP", "Zé"), C("b", null, "Ana"), C("c", "RJ", "Érica"), C("d", "SP", "Álvaro"), C("e", "MG", "Bia", true)]);
  assert.deepEqual(lista.map((c) => c.id), ["e", "b", "c", "d", "a"]);
});

test("contatos padrão: os da UF da proposta e os Nacionais; sem nenhum, o principal", () => {
  const lista = [C("sp", "SP", "A"), C("rj", "RJ", "B"), C("nac", null, "C")];
  assert.deepEqual(contatosPadrao(lista, "SP").sort(), ["nac", "sp"]);
  assert.deepEqual(contatosPadrao([C("rj", "RJ", "B"), C("mg", "MG", "D", true)], "SP"), ["mg"]);
  assert.deepEqual(contatosPadrao([], "SP"), []);
});

test("UF da proposta: imóvel primeiro, endereço do cliente depois", () => {
  assert.equal(ufDaProposta({ imoveis: [{ estado: "sc" }], endereco_uf: "SP" }), "SC");
  assert.equal(ufDaProposta({ imoveis: [], endereco_uf: "RJ" }), "RJ");
  assert.equal(ufDaProposta({}), null);
});

const PROPOSTA = {
  code: "CR-26-000318", credit_line: "Home Equity", requested_value: 350000, client_name: "Maria Souza",
  metadata: {
    client_type: "PF", cpf_cnpj: "529.982.247-25", email: "maria@cliente.com", telefone: "+5511987654321",
    rg: "12.345.678-9", nascimento: "1978-04-22", renda_mensal: 18500, prazo: "120 meses", finalidade: "Capital de giro",
    endereco_cidade: "São Paulo", endereco_uf: "SP", restricao_cliente: "NAO", observacoes: "nota interna da mesa",
    imoveis: [{ cidade: "Campinas", estado: "SP", zona: "URBANO", padrao: "ALTO", valor_medio: 1200000, avaliacao_tecnica: { valores: { valor_mercado: 1100000, valor_liquidez: 880000 } } }],
    partner_nome: "Partner Secreto",
  },
};

test("corpo do e-mail: tem o que o Robson aprovou e nada que é proibido", () => {
  const html = montarCorpo({ proposta: PROPOSTA, documentos: [{ nome_documento: "RG e CPF", file_name: "rg.pdf" }], mensagem: "Segue a proposta.", parte: 1, total: 1, remetenteNome: "Ana Mesa" });
  for (const deve of ["CR-26-000318", "Home Equity", "350.000,00", "120 meses", "Capital de giro", "Renda mensal", "Imóvel urbano", "avaliação técnica V3", "Segue a proposta.", "rg.pdf", "dados pessoais e informações confidenciais"]) {
    assert.ok(html.includes(deve), `faltou: ${deve}`);
  }
  for (const proibido of ["529.982.247-25", "52998224725", "maria@cliente.com", "5511987654321", "12.345.678-9", "1978-04-22", "nota interna", "Partner Secreto"]) {
    assert.equal(html.includes(proibido), false, `vazou: ${proibido}`);
  }
});

test("corpo: avaliação estimada quando não há avaliação técnica; tipo da garantia sem imóvel", () => {
  const semTec = linhasDoCorpo({ ...PROPOSTA, metadata: { ...PROPOSTA.metadata, imoveis: [{ cidade: "Campinas", estado: "SP", zona: "RURAL", valor_medio: 500000 }] } });
  assert.match(semTec.find(([k]) => k === "Avaliação da garantia")?.[1] ?? "", /estimado/);
  assert.equal(semTec.find(([k]) => k === "Tipo da garantia")?.[1], "Imóvel rural");
  const sem = linhasDoCorpo({ ...PROPOSTA, metadata: { ...PROPOSTA.metadata, imoveis: [] } });
  assert.equal(sem.find(([k]) => k === "Tipo da garantia")?.[1], "Sem imóvel em garantia");
});

test("assunto com valor e parte", () => {
  assert.equal(montarAssunto(PROPOSTA).replace(/\s/g, " "), "Proposta de crédito CR-26-000318: Home Equity, R$ 350.000,00");
  assert.match(montarAssunto(PROPOSTA, 2, 3), /\(parte 2 de 3\)$/);
});

test("situação: nunca rebaixa; devolvido e spam prevalecem", () => {
  assert.equal(proximaSituacao("enviado", "entregue"), "entregue");
  assert.equal(proximaSituacao("aberto", "entregue"), "aberto");
  assert.equal(proximaSituacao("entregue", "atrasado"), "entregue");
  assert.equal(proximaSituacao("enviado", "atrasado"), "atrasado");
  assert.equal(proximaSituacao("aberto", "devolvido"), "devolvido");
  assert.equal(proximaSituacao("devolvido", "aberto"), "devolvido");
  assert.equal(proximaSituacao("devolvido", "spam"), "spam");
  assert.equal(situacaoGeral(["aberto", "entregue", "devolvido"]), "devolvido");
  assert.equal(situacaoGeral(["aberto", "entregue"]), "entregue");
  assert.equal(situacaoGeral([]), null);
});

test("webhook: assinatura Svix válida passa; adulterada, velha ou sem cabeçalho é recusada", () => {
  const segredo = "whsec_" + Buffer.from("segredo-de-teste-123").toString("base64");
  const id = "msg_1", ts = String(Math.floor(Date.now() / 1000)), corpo = JSON.stringify({ type: "email.delivered" });
  const sig = createHmac("sha256", Buffer.from("segredo-de-teste-123")).update(`${id}.${ts}.${corpo}`).digest("base64");
  assert.equal(assinaturaSvixValida({ segredo, id, timestamp: ts, assinatura: `v1,${sig}`, corpo }), true);
  assert.equal(assinaturaSvixValida({ segredo, id, timestamp: ts, assinatura: `v1,${sig}`, corpo: corpo + " " }), false);
  assert.equal(assinaturaSvixValida({ segredo, id, timestamp: String(Number(ts) - 3600), assinatura: `v1,${sig}`, corpo }), false);
  assert.equal(assinaturaSvixValida({ segredo, id: null, timestamp: ts, assinatura: `v1,${sig}`, corpo }), false);
  assert.equal(assinaturaSvixValida({ segredo: "", id, timestamp: ts, assinatura: `v1,${sig}`, corpo }), false);
});

test("pedido: sem instituição, sem destinatário ou com e-mail inválido é recusado", () => {
  assert.ok(validarPedido({ instituicoes: [], documentos: [] }));
  assert.ok(validarPedido({ instituicoes: [{ instituicao_id: "i", destinatarios: [] }], documentos: [] }));
  assert.match(validarPedido({ instituicoes: [{ instituicao_id: "i", destinatarios: [{ email: "x@y" }] }], documentos: [] }) ?? "", /inválido/);
  assert.equal(validarPedido({ instituicoes: [{ instituicao_id: "i", destinatarios: [{ email: "a@b.com" }] }], documentos: [] }), null);
});

// ── Envio completo com banco e e-mail falsos ────────────────────────────────────────────────
type Row = Record<string, unknown>;
function fakeDb(t: Record<string, Row[]>, arquivos: Record<string, number>) {
  let seq = 0;
  const db = {
    from(nome: string) {
      const filtros: Array<(r: Row) => boolean> = []; let op = "select"; let payload: Row | null = null;
      const run = () => {
        const rows = (t[nome] ??= []);
        if (op === "insert") { const r = { id: `${nome}-${++seq}`, ...(payload as Row) }; rows.push(r); return { data: r, error: null }; }
        const m = rows.filter((r) => filtros.every((f) => f(r)));
        if (op === "update") { m.forEach((r) => Object.assign(r, payload)); return { data: m, error: null }; }
        return { data: structuredClone(m), error: null };
      };
      const q = {
        select() { return q; }, insert(p: Row) { op = "insert"; payload = p; return q; }, update(p: Row) { op = "update"; payload = p; return q; },
        eq(c: string, v: unknown) { filtros.push((r) => r[c] === v); return q; },
        is(c: string, v: unknown) { filtros.push((r) => (r[c] ?? null) === v); return q; },
        in(c: string, vs: unknown[]) { filtros.push((r) => vs.includes(r[c])); return q; },
        order() { return q; },
        single() { const r = run(); return Promise.resolve({ data: Array.isArray(r.data) ? r.data[0] : r.data, error: null }); },
        maybeSingle() { return q.single(); },
        then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) { return Promise.resolve(run()).then(res, rej); },
      };
      return q;
    },
    storage: {
      from() {
        return {
          list: async (pasta: string) => ({ data: Object.entries(arquivos).filter(([p]) => p.startsWith(pasta + "/")).map(([p, b]) => ({ name: p.slice(pasta.length + 1), metadata: { size: b } })), error: null }),
          download: async (p: string) => ({ data: new Blob([new Uint8Array(arquivos[p] ? 10 : 0)]), error: null }),
        };
      },
    },
  };
  return db as unknown as SupabaseClient;
}

test("envio: um e-mail por destinatário, falha parcial vira 'parcial', avulso marcado como fora do cadastro", async () => {
  const tabelas: Record<string, Row[]> = {
    credit_desk_proposals: [{ id: "p1", code: "CR-1", credit_line: "Home Equity", requested_value: 100000, client_name: "Cli", deleted_at: null, instituicao_encaminhada: null,
      metadata: { client_type: "PF" }, documents: [{ doc_id: "he_pf_1", file_name: "rg.pdf", storage_path: "u/p1/rg.pdf", uploaded_at: "2026-11-06" }] }],
    portfolio_linhas: [],
    instituicoes: [{ id: "i1", nome: "Banco A ", status: "ativo" }],
    instituicao_contatos: [{ instituicao_id: "i1", email: "gerente@banco.com" }],
  };
  const db = fakeDb(tabelas, { "u/p1/rg.pdf": MB });
  const enviados: string[] = [];
  const mailer = async (o: { to: string }) => { if (o.to === "erro@banco.com") throw new Error("caixa inexistente"); enviados.push(o.to); return `re_${enviados.length}`; };
  const r = await executarEnvio({ db, mailer, pausa: async () => {} }, "p1", {
    instituicoes: [{ instituicao_id: "i1", destinatarios: [{ email: "Gerente@Banco.com" }, { email: "erro@banco.com" }] }],
    documentos: ["u/p1/rg.pdf"], mensagem: "Olá",
  }, { id: "u1", nome: "Ana", email: "ana@v3partners.com.br" });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(enviados, ["gerente@banco.com"]);
  assert.equal(r.resultados[0].status, "parcial");
  const dest = tabelas.credit_proposal_envio_destinatarios;
  assert.equal(dest.find((d) => d.email === "gerente@banco.com")?.fora_do_cadastro, false);
  assert.equal(dest.find((d) => d.email === "erro@banco.com")?.fora_do_cadastro, true);
  assert.equal(dest.find((d) => d.email === "erro@banco.com")?.status, "falha");
  assert.equal(tabelas.credit_proposal_envios[0].status, "parcial");
  assert.equal(tabelas.credit_desk_proposals[0].instituicao_encaminhada, JSON.stringify(["Banco A"]));
});

test("envio: documento que não é da proposta é recusado", async () => {
  const tabelas: Record<string, Row[]> = {
    credit_desk_proposals: [{ id: "p1", code: "CR-1", credit_line: "Home Equity", requested_value: 1, client_name: "C", deleted_at: null, metadata: {}, documents: [] }],
    portfolio_linhas: [], instituicoes: [{ id: "i1", nome: "A", status: "ativo" }],
  };
  const r = await executarEnvio({ db: fakeDb(tabelas, {}), mailer: async () => "x", pausa: async () => {} }, "p1",
    { instituicoes: [{ instituicao_id: "i1", destinatarios: [{ email: "a@b.com" }] }], documentos: ["outro/p9/x.pdf"] }, { id: "u", nome: null, email: null });
  assert.equal(r.ok, false);
});

test("cadastro: campo com vários e-mails ou texto junto vira lista limpa", async () => {
  const { extrairEmails } = await import("../../lib/encaminhar-instituicao-servidor");
  assert.deepEqual(extrairEmails("Ana.Silva@Oxy.com.br/  joao.souza@oxy.com.br"), ["ana.silva@oxy.com.br", "joao.souza@oxy.com.br"]);
  assert.deepEqual(extrairEmails("gerente@red.com.br JOSE"), ["gerente@red.com.br"]);
  assert.deepEqual(extrairEmails("Maria Souza"), []);
  assert.deepEqual(extrairEmails(null), []);
  assert.deepEqual(extrairEmails("a@b.com; a@b.com, c@d.com"), ["a@b.com", "c@d.com"]);
});

test("cadastro: nova instituição leva os e-mails para a lista, primeiro como principal, sem repetir", async () => {
  const { sincronizarContatosDoCadastro } = await import("../../lib/encaminhar-instituicao-servidor");
  const tabelas: Record<string, Row[]> = { instituicao_contatos: [] };
  const db = fakeDb(tabelas, {});
  const n = await sincronizarContatosDoCadastro(db, "i9", { contato_nome: "Ana", contato_email: "ana@x.com/ bia@x.com", email: "geral@x.com" });
  assert.equal(n, 3);
  const c = tabelas.instituicao_contatos;
  assert.deepEqual(c.map((x) => [x.email, x.principal, x.nome]), [["ana@x.com", true, "Ana"], ["bia@x.com", false, null], ["geral@x.com", false, null]]);
  // Editar de novo com os mesmos e-mails não duplica.
  assert.equal(await sincronizarContatosDoCadastro(db, "i9", { contato_email: "ana@x.com", email: "geral@x.com" }), 0);
  assert.equal(c.length, 3);
});
