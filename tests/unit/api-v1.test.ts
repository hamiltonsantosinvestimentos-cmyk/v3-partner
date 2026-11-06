// API de Propostas para partners (BRIEF docs/briefs/2026-11-06_api-partner-propostas-credito.md).
// Chaves, IPs, validação do corpo, visão do partner (paridade), arquivos, travas e autenticação.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  gerarChave, hashChave, ipPermitido, lerBearer, normalizarFaixa, ordenarChaves, planoTemApi, termoTemLacuna,
} from "../../lib/api-keys";
import { converterProposta, propostaSchema, validarRegras, type PropostaApi } from "../../lib/api-v1/proposta";
import {
  CAMPOS_PERMITIDOS, comentarioPublico, documentosDaLinha, linhasOrdenadas, mascararDocumento, visaoDoPartner,
} from "../../lib/api-v1/visao-partner";
import { assinarUpload, lerUpload, problemaNoPdf, tipoPelosBytes } from "../../lib/api-v1/arquivos";
import { criarPropostaCredito, linhaPermitidaParaPapel } from "../../lib/credit-proposal-create";
import { autenticar } from "../../lib/api-v1/auth";
import { ErroApi } from "../../lib/api-v1/http";
import { propostaDoPartner } from "../../lib/api-v1/rota";
import { trechosEmDestaque } from "../../lib/integracao-api";

process.env.API_V1_UPLOAD_SECRET = "segredo-de-teste";

// ── Chaves ────────────────────────────────────────────────────────────────────────────────
test("gerarChave: prefixo v3_live_, hash SHA-256 e chaves diferentes a cada geração", () => {
  const a = gerarChave(), b = gerarChave();
  assert.match(a.chave, /^v3_live_[A-Za-z0-9]{40}$/);
  assert.equal(a.prefixo, a.chave.slice(0, 12));
  assert.equal(a.hash, hashChave(a.chave));
  assert.match(a.hash, /^[0-9a-f]{64}$/);
  assert.notEqual(a.chave, b.chave);
});

test("lerBearer aceita só Bearer v3_live_ com tamanho plausível", () => {
  const { chave } = gerarChave();
  assert.equal(lerBearer(`Bearer ${chave}`), chave);
  assert.equal(lerBearer(`bearer ${chave}`), chave);
  assert.equal(lerBearer(chave), null);
  assert.equal(lerBearer("Bearer abc"), null);
  assert.equal(lerBearer("Bearer v3_live_curta"), null);
  assert.equal(lerBearer(null), null);
});

test("IPs permitidos: IP único, faixa, IPv6 e IPv4 mapeado; faixa larga demais é recusada", () => {
  assert.equal(normalizarFaixa("200.150.10.20"), "200.150.10.20/32");
  assert.equal(normalizarFaixa("200.150.0.0/16"), "200.150.0.0/16");
  assert.equal(normalizarFaixa("10.0.0.0/8"), null);
  assert.equal(normalizarFaixa("0.0.0.0/0"), null);
  assert.equal(normalizarFaixa("abc"), null);
  assert.equal(normalizarFaixa("2804:14c::/48"), "2804:14c::/48");
  const faixas = ["200.150.10.20/32", "177.10.0.0/16", "2804:14c::/48"];
  assert.equal(ipPermitido("200.150.10.20", faixas), true);
  assert.equal(ipPermitido("::ffff:200.150.10.20", faixas), true);
  assert.equal(ipPermitido("177.10.99.1", faixas), true);
  assert.equal(ipPermitido("200.150.10.21", faixas), false);
  assert.equal(ipPermitido("2804:14c:0:1::5", faixas), true);
  assert.equal(ipPermitido(null, faixas), false);
});

test("planos com API: Partner PRO, Gold, Diamante e Enterprise", () => {
  for (const r of ["PARTNER_PRO", "GOLD", "DIAMANTE", "ENTERPRISE"]) assert.equal(planoTemApi(r), true);
  for (const r of ["STARTER", "PARTNER", "PARTNER_HE", "ADMIN", null]) assert.equal(planoTemApi(r), false);
});

test("termo com lacuna não publica; caixas de aceite '[ ]' não contam como lacuna", () => {
  assert.equal(termoTemLacuna("Texto.\n[ ] Li e aceito."), false);
  assert.equal(termoTemLacuna("Com sede em [ENDEREÇO DA SEDE]."), true);
  assert.equal(termoTemLacuna("multa de [VALOR: sugestão]"), true);
});

test("ordem das chaves: ativas, vencidas, revogadas; mais recente primeiro dentro do grupo", () => {
  const agora = Date.parse("2026-11-06T12:00:00Z");
  const k = (id: string, created: string, expira: string, rev: string | null = null) => ({ id, created_at: created, expira_em: expira, revogada_em: rev });
  const lista = ordenarChaves([
    k("rev", "2026-11-05", "2027-11-05", "2026-11-05"),
    k("venc", "2025-01-01", "2026-01-01"),
    k("ativa-velha", "2026-01-01", "2027-01-01"),
    k("ativa-nova", "2026-10-01", "2027-10-01"),
  ], agora);
  assert.deepEqual(lista.map((x) => x.id), ["ativa-nova", "ativa-velha", "venc", "rev"]);
});

test("cláusulas em destaque são recortadas do texto do termo", () => {
  const texto = "4.7. Corrige.\n4.8. Autorização para consultas de crédito.\n- colherá autorização\n4.9. Proibição de cobrança.\n- vedado\n4.10. Outra.";
  const d = trechosEmDestaque(texto);
  assert.equal(d[0].clausula, "4.8");
  assert.match(d[0].texto, /colherá autorização/);
  assert.doesNotMatch(d[0].texto, /4\.9/);
  assert.equal(d[1].clausula, "4.9");
});

// ── Corpo da proposta ─────────────────────────────────────────────────────────────────────
const AGORA = Date.parse("2026-11-06T15:00:00Z");
function corpo(over: Partial<Record<string, unknown>> = {}): PropostaApi {
  const base = {
    referencia_externa: "CRM-1",
    cliente: { tipo: "PF", nome: "Maria Souza", cpf_cnpj: "529.982.247-25", email: "Maria@Exemplo.com.br", telefone: "+5511987654321", nascimento: "1978-04-22", estado_civil: "CASADO", renda_mensal: 18500 },
    operacao: { linha: "Home Equity", valor_solicitado: 350000, prazo_meses: 120, restricao: "NAO" },
    imoveis: [{ cep: "04538132", zona: "URBANO", valor_estimado: 1200000 }],
    declaracoes: { autorizacao_consultas: { obtida: true, data: "2026-11-01" } },
    ...over,
  };
  const r = propostaSchema.safeParse(base);
  if (!r.success) throw new Error(JSON.stringify(r.error.issues));
  return r.data;
}

test("schema: E.164, teto, 2 casas decimais, campo desconhecido e autorização obrigatória", () => {
  const ok = (b: unknown) => propostaSchema.safeParse(b).success;
  const base = JSON.parse(JSON.stringify(corpo()));
  assert.equal(ok(base), true);
  assert.equal(ok({ ...base, cliente: { ...base.cliente, telefone: "(11) 98765-4321" } }), false);
  assert.equal(ok({ ...base, operacao: { ...base.operacao, valor_solicitado: 5_000_000_001 } }), false);
  assert.equal(ok({ ...base, operacao: { ...base.operacao, valor_solicitado: 100.123 } }), false);
  assert.equal(ok({ ...base, operacao: { ...base.operacao, valor_solicitado: "350.000,00" } }), false);
  assert.equal(ok({ ...base, extra: 1 }), false);
  assert.equal(ok({ ...base, declaracoes: { autorizacao_consultas: { obtida: false, data: "2026-11-01" } } }), false);
  const { declaracoes: _d, ...semDeclaracao } = base; void _d;
  assert.equal(ok(semDeclaracao), false);
});

test("regras: CPF válido passa; PF com CNPJ e CPF inválido falham", () => {
  assert.deepEqual(validarRegras(corpo(), AGORA).campos, {});
  const comCnpj = corpo({ cliente: { ...corpo().cliente, cpf_cnpj: "11.222.333/0001-81" } });
  assert.ok(validarRegras(comCnpj, AGORA).campos["cliente.cpf_cnpj"]);
  const cpfRuim = corpo({ cliente: { ...corpo().cliente, cpf_cnpj: "111.111.111-11" } });
  assert.equal(validarRegras(cpfRuim, AGORA).campos["cliente.cpf_cnpj"], "CPF inválido.");
});

test("regras: CNPJ alfanumérico é aceito e gravado com máscara, sem perder as letras", () => {
  const pj = corpo({ cliente: { tipo: "PJ", razao_social: "Exemplo Ltda", cpf_cnpj: "12.abc.345/01de-35", email: "a@b.com", telefone: "+5511987654321" } });
  assert.deepEqual(validarRegras(pj, AGORA).campos, {});
  assert.equal(converterProposta(pj).documento, "12.ABC.345/01DE-35");
});

test("regras: documento estrangeiro é identificado", () => {
  const est = corpo({ cliente: { ...corpo().cliente, cpf_cnpj: "X1234567890ZZ9" .slice(0, 12) } });
  assert.equal(validarRegras(est, AGORA).estrangeiro, true);
});

test("regras: nascimento fora de 18 a 120 anos e data inexistente", () => {
  const novo = corpo({ cliente: { ...corpo().cliente, nascimento: "2010-01-01" } });
  assert.ok(validarRegras(novo, AGORA).campos["cliente.nascimento"]);
  const inexistente = corpo({ cliente: { ...corpo().cliente, nascimento: "1980-02-30" } });
  assert.ok(validarRegras(inexistente, AGORA).campos["cliente.nascimento"]);
});

test("regras: autorização de consulta não pode ser futura nem ter mais de 180 dias", () => {
  const futura = corpo({ declaracoes: { autorizacao_consultas: { obtida: true, data: "2026-11-07" } } });
  assert.ok(validarRegras(futura, AGORA).campos["declaracoes.autorizacao_consultas.data"]);
  const velha = corpo({ declaracoes: { autorizacao_consultas: { obtida: true, data: "2026-04-01" } } });
  assert.ok(validarRegras(velha, AGORA).campos["declaracoes.autorizacao_consultas.data"]);
  const hoje = corpo({ declaracoes: { autorizacao_consultas: { obtida: true, data: "2026-11-06" } } });
  assert.equal(validarRegras(hoje, AGORA).campos["declaracoes.autorizacao_consultas.data"], undefined);
});

test("regras: linha inexistente e beneficiário final em PF", () => {
  const linha = corpo({ operacao: { ...corpo().operacao, linha: "Crédito Pessoal" } });
  assert.ok(validarRegras(linha, AGORA).campos["operacao.linha"]);
  const bf = corpo({ pld: { pep: "NAO", beneficiario_final: { nome: "Fulano", cpf: "529.982.247-25" } } });
  assert.ok(validarRegras(bf, AGORA).campos["pld.beneficiario_final"]);
});

test("conversão grava o mesmo metadata do modal e separa o PLD", () => {
  const c = converterProposta(corpo({ pld: { pep: "SIM", circunstancia_atipica: "Origem dos recursos a confirmar" } }), "2026-11-06T15:00:00.000Z");
  assert.equal(c.nivel, "NIVEL_1");
  assert.equal(c.documento, "529.982.247-25");
  assert.equal(c.metadata.client_type, "PF");
  assert.equal(c.metadata.email, "maria@exemplo.com.br");
  assert.equal(c.metadata.telefone, "+5511987654321");
  assert.equal(c.metadata.estado_civil, "Casado(a)");
  assert.equal(c.metadata.prazo, "120 meses");
  assert.equal(c.metadata.restricao_cliente, "NAO");
  assert.equal(c.metadata.imovel_garantia, "urbano");
  assert.equal(c.metadata.origem_api, true);
  assert.equal((c.metadata.imoveis as { cep: string }[])[0].cep, "04538-132");
  assert.equal("pld" in c.metadata, false);
  assert.equal(JSON.stringify(c.metadata).includes("Origem dos recursos"), false);
  assert.deepEqual(c.pld, { pep: "SIM", beneficiario_final: null, circunstancia_atipica: "Origem dos recursos a confirmar" });
});

// ── Visão do partner ──────────────────────────────────────────────────────────────────────
const PROPOSTA_COMPLETA = {
  id: "8a3f0e52-1c7d-4f9b-b1e2-5d6c7a8b9c0d", code: "CR-26-000318", referencia_externa: "CRM-1", partner_id: "p-a",
  credit_line: "Home Equity", current_level: "NIVEL_1", stage: "PENDENCIA", status: "PENDING",
  requested_value: "350000.00", approved_value: null, client_name: "Maria Souza", client_cpf_cnpj: "529.982.247-25",
  documents: [{ doc_id: "he_pf_1", file_name: "rg.pdf", storage_path: "p-a/x/he_pf_1_rg.pdf", uploaded_at: "2026-11-06T13:00:00Z", uploaded_by: "p-a" }],
  pending_reason: "Matrícula vencida", pending_responsible: "Partner", pending_at: "2026-11-06T14:00:00Z", pending_resolved_at: null,
  created_at: "2026-11-06T12:00:00Z", updated_at: "2026-11-06T14:00:00Z",
  // Campos internos que nunca podem sair pela API:
  instituicao_encaminhada: "BANCO SECRETO", instituicao_feedback: "nota interna", level1_notes: "analista disse X",
  comissao_mandato_perc: 3, comissao_instituicao_perc: 2, valor_credito_atual: 999, ma_deal_id: "deal-1",
  metadata: {
    client_type: "PF", prazo: "120 meses", finalidade: "Giro", rg: "12.345.678-9", renda_mensal: 18500,
    analise_gate_override: { by: "admin" }, transferencia: { de: "M&A" }, stage_history: [{ stage: "RECEBIDO", by: "mesa" }],
    recursos_liberados: [{ valor: 1 }], pendencias_ocr: { he_pf_4: { doc_label: "Matrícula", motivo: "Emitida há 45 dias", created_at: "2026-11-06T13:30:00Z", status: "pendente" } },
  },
};

test("paridade: a visão do partner só tem campos permitidos e nenhum dado interno da mesa", () => {
  const v = visaoDoPartner(PROPOSTA_COMPLETA, { portfolio: [], access: false });
  assert.deepEqual(Object.keys(v).sort(), [...CAMPOS_PERMITIDOS].sort());
  const json = JSON.stringify(v);
  for (const proibido of ["BANCO SECRETO", "nota interna", "analista disse", "deal-1", "M&A", "admin", "12.345.678-9", "18500", "529.982.247-25", "recursos", "comissao", "instituicao"]) {
    assert.equal(json.includes(proibido), false, `vazou: ${proibido}`);
  }
  assert.equal(v.cliente.cpf_cnpj, "***.982.247-**");
  assert.equal(v.valor_solicitado, 350000);
  assert.equal(v.pendencia?.motivo, "Matrícula vencida");
  assert.equal(v.pendencias_documentos[0].tipo_documento, "he_pf_4");
  assert.ok(v.documentos_pendentes.includes("he_pf_4"));
  assert.equal(v.documentos_pendentes.includes("he_pf_1"), false);
  assert.equal(v.criada_em, "2026-11-06T09:00:00-03:00");
  assert.match(v.link_analise_credito ?? "", /analise-v2\?prop=CR-26-000318&ref=p-a/);
});

test("mascaramento de CPF e CNPJ (inclusive alfanumérico)", () => {
  assert.equal(mascararDocumento("529.982.247-25"), "***.982.247-**");
  assert.equal(mascararDocumento("12.ABC.345/01DE-35"), "12.ABC.345/****-**");
  assert.equal(mascararDocumento(null), null);
});

test("comentário público: sem link nem caminho do anexo", () => {
  const c = comentarioPublico({ created_at: "2026-11-06T13:00:00Z", sender_name: "Mesa V3", content: "Falta a matrícula", sender_id: "u1", anexos: [{ path: "segredo/arquivo.pdf", nome: "modelo.pdf" }] });
  assert.deepEqual(c, { em: "2026-11-06T10:00:00-03:00", autor: "Mesa V3", texto: "Falta a matrícula", anexos: ["modelo.pdf"] });
  assert.equal(JSON.stringify(c).includes("segredo"), false);
});

test("linhas: 28, ordenadas por nível e por nome em pt-BR, com documentos", () => {
  const l = linhasOrdenadas();
  assert.equal(l.length, 28);
  assert.deepEqual([...new Set(l.map((x) => x.nivel))], ["NIVEL_1", "NIVEL_2", "NIVEL_3"]);
  const n1 = l.filter((x) => x.nivel === "NIVEL_1").map((x) => x.nome);
  assert.deepEqual(n1, [...n1].sort((a, b) => a.localeCompare(b, "pt-BR")));
  const docs = documentosDaLinha("Home Equity", "PF", []);
  assert.equal(docs[0].id, "he_pf_1");
  assert.equal(docs[0].obrigatorio, true);
});

test("trava do PARTNER_HE vale também para a API", () => {
  assert.equal(linhaPermitidaParaPapel("GOLD", "CPR Agro"), true);
  assert.equal(linhaPermitidaParaPapel("PARTNER_HE", "CPR Agro"), false);
});

// ── Arquivos ──────────────────────────────────────────────────────────────────────────────
test("tipo real pelos bytes e PDF inseguro", () => {
  const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n");
  assert.equal(tipoPelosBytes(pdf), "application/pdf");
  assert.equal(tipoPelosBytes(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(tipoPelosBytes(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(tipoPelosBytes(Buffer.from("MZ executável")), null);
  assert.equal(problemaNoPdf(pdf), null);
  assert.match(problemaNoPdf(Buffer.from("%PDF-1.4 trailer << /Encrypt 5 0 R >>")) ?? "", /senha/);
  assert.match(problemaNoPdf(Buffer.from("%PDF-1.4 << /S /JavaScript /JS (app.alert(1)) >>")) ?? "", /script/);
});

test("upload_id assinado: adulteração e vencimento são recusados", () => {
  const agora = Date.now();
  const id = assinarUpload({ p: "prop", k: "key", d: "he_pf_1", n: "rg.pdf", c: "application/pdf", path: "p/prop/x", t: 10, exp: agora + 7_200_000 });
  assert.equal(lerUpload(id, agora)?.path, "p/prop/x");
  const [corpoB64, mac] = id.slice(3).split(".");
  const adulterado = JSON.parse(Buffer.from(corpoB64, "base64url").toString());
  adulterado.path = "outro-partner/prop/x";
  assert.equal(lerUpload(`up_${Buffer.from(JSON.stringify(adulterado)).toString("base64url")}.${mac}`, agora), null);
  assert.equal(lerUpload(id, agora + 25 * 3600_000), null);
  assert.equal(lerUpload("qualquer", agora), null);
});

// ── Banco falso para criação e autenticação ───────────────────────────────────────────────
type Row = Record<string, unknown>;
function fakeDb(tables: Record<string, Row[]>) {
  const log: Array<{ table: string; op: string; payload?: unknown }> = [];
  const db = {
    from(table: string) {
      const filters: Array<(r: Row) => boolean> = [];
      let op = "select"; let payload: Row | null = null; let headCount = false; let limitN: number | null = null;
      const run = () => {
        log.push({ table, op, payload });
        const rows = (tables[table] ??= []);
        if (op === "insert") { rows.push({ id: `id-${rows.length + 1}`, created_at: new Date().toISOString(), ...(payload as Row) }); return { data: rows[rows.length - 1], error: null, count: null }; }
        let m = rows.filter((r) => filters.every((f) => f(r)));
        if (op === "update") { for (const r of m) Object.assign(r, payload); return { data: m, error: null, count: null }; }
        if (headCount) return { data: null, error: null, count: m.length };
        if (limitN !== null) m = m.slice(0, limitN);
        return { data: structuredClone(m), error: null, count: m.length };
      };
      const q = {
        select(_c?: string, o?: { head?: boolean }) { if (o?.head) headCount = true; return q; },
        insert(p: Row) { op = "insert"; payload = p; return q; },
        update(p: Row) { op = "update"; payload = p; return q; },
        eq(c: string, v: unknown) { filters.push((r) => r[c] === v); return q; },
        is(c: string, v: unknown) { filters.push((r) => (r[c] ?? null) === v); return q; },
        gt(c: string, v: string) { filters.push((r) => String(r[c]) > v); return q; },
        gte(c: string, v: string) { filters.push((r) => String(r[c]) >= v); return q; },
        lte(c: string, v: string) { filters.push((r) => String(r[c]) <= v); return q; },
        order() { return q; },
        limit(n: number) { limitN = n; return q; },
        maybeSingle() { const r = run(); return Promise.resolve({ data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data, error: null }); },
        single() { return q.maybeSingle(); },
        then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) { return Promise.resolve(run()).then(res, rej); },
      };
      return q;
    },
  };
  return { db: db as unknown as SupabaseClient, log, tables };
}

test("criação: N3 abaixo de R$ 5 milhões e PARTNER_HE fora de HE são barrados antes de gravar", async () => {
  const { db, log } = fakeDb({});
  const base = { title: "t", client_name: "c", credit_line: "CRI Cash Collateral", requested_value: 1_000_000, current_level: "NIVEL_3" as const, partnerId: "p", createdBy: "p", creatorRole: "GOLD", creatorName: "P" };
  const r1 = await criarPropostaCredito(db, base);
  assert.equal(r1.ok, false);
  assert.equal(!r1.ok && r1.codigo, "regra_de_credito");
  const r2 = await criarPropostaCredito(db, { ...base, credit_line: "CPR Agro", current_level: "NIVEL_2", creatorRole: "PARTNER_HE" });
  assert.equal(!r2.ok && r2.status, 403);
  assert.equal(log.some((l) => l.table === "credit_desk_proposals"), false);
});

function req(headers: Record<string, string>, method = "GET"): NextRequest {
  const h = new Headers(headers);
  return { method, headers: h } as unknown as NextRequest;
}

function cenarioAuth(over: { revogada?: boolean; vencida?: boolean; role?: string; aceito?: boolean; escopos?: string[] } = {}) {
  const { chave, hash } = gerarChave();
  const tabelas: Record<string, Row[]> = {
    partner_api_keys: [{
      id: "k1", partner_id: "p-a", key_hash: hash, escopos: over.escopos ?? ["propostas:criar", "propostas:ler"],
      ips_permitidos: ["200.150.10.20/32"], expira_em: over.vencida ? "2020-01-01T00:00:00Z" : "2099-01-01T00:00:00Z",
      revogada_em: over.revogada ? "2026-11-01T00:00:00Z" : null, limite_por_minuto: 60, limite_propostas_dia: 200,
    }],
    profiles: [{ id: "p-a", full_name: "Partner A", role: over.role ?? "GOLD" }],
    partner_api_termos: [{ versao: "2.1", texto: "t", hash: "h", vigencia_inicio: "2026-11-01T00:00:00Z" }],
    partner_api_termo_aceites: over.aceito === false ? [] : [{ id: "a1", partner_id: "p-a", versao: "2.1" }],
    partner_api_requests: [], partner_api_bloqueios: [],
  };
  return { chave, ...fakeDb(tabelas) };
}

async function codigoDoErro(p: Promise<unknown>): Promise<string> {
  try { await p; return "ok"; } catch (e) { return e instanceof ErroApi ? `${e.status} ${e.codigo}` : String(e); }
}

test("autenticação: caminho feliz devolve o partner da chave e registra último uso", async () => {
  const { chave, db, tables } = cenarioAuth();
  const ctx = await autenticar(db, req({ authorization: `Bearer ${chave}`, "x-forwarded-for": "200.150.10.20" }), "propostas:criar", "POST /propostas");
  assert.equal(ctx.partnerId, "p-a");
  assert.equal(tables.partner_api_keys[0].ultimo_ip, "200.150.10.20");
});

test("autenticação: cada recusa tem o código certo e fica no log", async () => {
  const casos: Array<[Parameters<typeof cenarioAuth>[0], Record<string, string> | null, string]> = [
    [{}, { authorization: "" }, "401 chave_invalida"],
    [{ revogada: true }, null, "401 chave_invalida"],
    [{ vencida: true }, null, "401 chave_vencida"],
    [{}, { "x-forwarded-for": "8.8.8.8" }, "403 ip_nao_permitido"],
    [{ role: "PARTNER" }, null, "403 sem_acesso"],
    [{ aceito: false }, null, "403 termo_pendente"],
    [{ escopos: ["propostas:ler"] }, null, "403 sem_permissao"],
  ];
  for (const [over, hdr, esperado] of casos) {
    const { chave, db, tables } = cenarioAuth(over);
    const headers = { authorization: `Bearer ${chave}`, "x-forwarded-for": "200.150.10.20", ...(hdr ?? {}) };
    assert.equal(await codigoDoErro(autenticar(db, req(headers), "propostas:criar", "POST /propostas")), esperado, JSON.stringify(over));
    assert.equal(tables.partner_api_requests.length, 1, `sem log: ${esperado}`);
  }
});

test("autenticação: 10 chamadas com chave inválida bloqueiam o IP", async () => {
  const { db, tables } = cenarioAuth();
  for (let i = 0; i < 10; i++) {
    await codigoDoErro(autenticar(db, req({ authorization: "Bearer v3_live_chaveerradaerradaerradaerrada", "x-forwarded-for": "9.9.9.9" }), "propostas:ler", "GET /propostas"));
  }
  assert.ok(tables.partner_api_bloqueios.length >= 1);
  assert.equal(await codigoDoErro(autenticar(db, req({ authorization: "Bearer v3_live_qualquerqualquerqualquerqualquer", "x-forwarded-for": "9.9.9.9" }), "propostas:ler", "GET /propostas")), "429 ip_bloqueado");
});

test("proposta de outro partner responde 404, sem revelar que existe", async () => {
  const { db } = fakeDb({ credit_desk_proposals: [{ id: "8a3f0e52-1c7d-4f9b-b1e2-5d6c7a8b9c0d", partner_id: "p-b", deleted_at: null }] });
  const ctxA = { keyId: "k1", partnerId: "p-a", partnerNome: null, role: "GOLD", limitePropostasDia: 200, ip: null };
  assert.equal(await codigoDoErro(propostaDoPartner(db, ctxA, "8a3f0e52-1c7d-4f9b-b1e2-5d6c7a8b9c0d", "id")), "404 nao_encontrada");
  const ctxB = { ...ctxA, partnerId: "p-b" };
  assert.equal(await codigoDoErro(propostaDoPartner(db, ctxB, "8a3f0e52-1c7d-4f9b-b1e2-5d6c7a8b9c0d", "id")), "ok");
});
