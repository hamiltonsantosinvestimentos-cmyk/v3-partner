// Ajustes de segurança da API (BRIEF docs/briefs/2026-11-06_api-v1-ajustes-seguranca.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";
import { analisarArquivo, analisarPdf, assinarUpload, docxComMacro, tipoPelaExtensao } from "../../lib/api-v1/arquivos";
import { reservarIdempotencia, RESERVA_ABANDONADA_MS } from "../../lib/api-v1/idempotencia";
import { reservarAlerta } from "../../lib/api-v1/alertas";

async function pdfLimpo(): Promise<PDFDocument> {
  const d = await PDFDocument.create();
  d.addPage([200, 200]).drawText("Extrato bancário");
  return d;
}

test("PDF comum passa; PDF com OpenAction só de página passa", async () => {
  const d = await pdfLimpo();
  assert.equal(await analisarPdf(await d.save()), null);
  const d2 = await pdfLimpo();
  const pag = d2.getPage(0).ref;
  d2.catalog.set(PDFName.of("OpenAction"), d2.context.obj({ S: "GoTo", D: [pag, "Fit"] }));
  assert.equal(await analisarPdf(await d2.save()), null);
});

test("PDF com JavaScript em parte compactada (object stream) é recusado", async () => {
  const d = await pdfLimpo();
  const acao = d.context.obj({ S: "JavaScript", JS: PDFString.of("app.alert(1)") });
  d.catalog.set(PDFName.of("OpenAction"), d.context.register(acao));
  const bytes = await d.save({ useObjectStreams: true });
  // A busca simples no texto não enxerga dentro do stream compactado; a análise por objeto, sim.
  assert.equal(Buffer.from(bytes).toString("latin1").includes("/JavaScript"), false);
  assert.match((await analisarPdf(bytes)) ?? "", /conteúdo ativo/);
});

test("PDF com arquivo anexado dentro é recusado", async () => {
  const d = await pdfLimpo();
  await d.attach(Buffer.from("MZ executavel"), "programa.exe", { mimeType: "application/octet-stream" });
  assert.match((await analisarPdf(await d.save())) ?? "", /conteúdo ativo/);
});

test("PDF com senha e PDF corrompido são recusados", async () => {
  assert.match((await analisarPdf(Buffer.from("%PDF-1.4\ntrailer << /Encrypt 5 0 R >>"))) ?? "", /senha/);
  assert.notEqual(await analisarPdf(Buffer.from("%PDF-1.7 lixo sem estrutura")), null);
});

test("DOC é recusado; DOCX com macro é recusado; DOCX comum passa", async () => {
  assert.equal(tipoPelaExtensao("contrato.doc"), null);
  assert.equal(tipoPelaExtensao("contrato.docx"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.match((await analisarArquivo(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]), "application/msword")) ?? "", /\.doc/);
  const docxMacro = Buffer.from("PK\x03\x04 word/document.xml word/vbaProject.bin", "latin1");
  assert.equal(docxComMacro(docxMacro), true);
  assert.match((await analisarArquivo(docxMacro, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")) ?? "", /macro/);
  assert.equal(await analisarArquivo(Buffer.from("PK\x03\x04 word/document.xml", "latin1"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), null);
  assert.equal(await analisarArquivo(Buffer.from([0xff, 0xd8, 0xff]), "image/jpeg"), null);
});

test("sem API_V1_UPLOAD_SECRET (ou curto), nenhum envio é assinado", () => {
  const antes = process.env.API_V1_UPLOAD_SECRET;
  const dados = { p: "p", k: "k", d: "d", n: "n", c: "application/pdf", path: "x", t: 1, exp: Date.now() };
  try {
    delete process.env.API_V1_UPLOAD_SECRET;
    assert.throws(() => assinarUpload(dados), /API_V1_UPLOAD_SECRET/);
    process.env.API_V1_UPLOAD_SECRET = "curto";
    assert.throws(() => assinarUpload(dados), /API_V1_UPLOAD_SECRET/);
  } finally {
    if (antes === undefined) delete process.env.API_V1_UPLOAD_SECRET; else process.env.API_V1_UPLOAD_SECRET = antes;
  }
});

// ── Banco falso com chave única ───────────────────────────────────────────────────────────
type Row = Record<string, unknown>;
function fakeDb(unicos: Record<string, string[]> = {}) {
  const tabelas: Record<string, Row[]> = {};
  const db = {
    from(t: string) {
      const filtros: Array<(r: Row) => boolean> = [];
      let op = "select"; let payload: Row | null = null; let limite: number | null = null;
      const run = () => {
        const rows = (tabelas[t] ??= []);
        if (op === "insert") {
          const chaves = unicos[t];
          if (chaves && rows.some((r) => chaves.every((c) => r[c] === (payload as Row)[c]))) return { data: null, error: { code: "23505", message: "duplicate key" } };
          rows.push({ criado_em: new Date().toISOString(), enviado_em: new Date().toISOString(), ...(payload as Row) });
          return { data: null, error: null };
        }
        let m = rows.filter((r) => filtros.every((f) => f(r)));
        if (op === "update") { for (const r of m) Object.assign(r, payload); return { data: m.map((r) => ({ key_id: r.key_id })), error: null }; }
        if (limite !== null) m = m.slice(0, limite);
        return { data: structuredClone(m), error: null };
      };
      const q = {
        select() { return q; },
        insert(p: Row) { op = "insert"; payload = p; return q; },
        update(p: Row) { op = "update"; payload = p; return q; },
        eq(c: string, v: unknown) { filtros.push((r) => r[c] === v); return q; },
        gte(c: string, v: string) { filtros.push((r) => String(r[c]) >= v); return q; },
        limit(n: number) { limite = n; return q; },
        maybeSingle() { const r = run(); return Promise.resolve({ data: Array.isArray(r.data) ? (r.data[0] ?? null) : null, error: r.error }); },
        then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) { return Promise.resolve(run()).then(res, rej); },
      };
      return q;
    },
  };
  return { db: db as unknown as SupabaseClient, tabelas };
}

test("idempotência: a segunda chamada igual nunca cria outra proposta", async () => {
  const { db, tabelas } = fakeDb({ partner_api_idempotencia: ["key_id", "idempotency_key"] });
  assert.deepEqual(await reservarIdempotencia(db, "k1", "abc"), { tipo: "nova" });
  // Simultânea, com a primeira ainda criando:
  assert.deepEqual(await reservarIdempotencia(db, "k1", "abc"), { tipo: "em_andamento" });
  // Primeira concluiu:
  Object.assign(tabelas.partner_api_idempotencia[0], { status: "concluida", proposal_id: "prop-1" });
  assert.deepEqual(await reservarIdempotencia(db, "k1", "abc"), { tipo: "concluida", proposalId: "prop-1" });
  // Outra chave (de outro partner) com o mesmo valor é independente:
  assert.deepEqual(await reservarIdempotencia(db, "k2", "abc"), { tipo: "nova" });
});

test("idempotência: reserva abandonada há mais de 2 minutos é retomada uma vez só", async () => {
  const { db, tabelas } = fakeDb({ partner_api_idempotencia: ["key_id", "idempotency_key"] });
  await reservarIdempotencia(db, "k1", "abc");
  const velho = new Date(Date.now() - RESERVA_ABANDONADA_MS - 1000).toISOString();
  tabelas.partner_api_idempotencia[0].criado_em = velho;
  assert.deepEqual(await reservarIdempotencia(db, "k1", "abc"), { tipo: "nova" });
  assert.deepEqual(await reservarIdempotencia(db, "k1", "abc"), { tipo: "em_andamento" });
});

test("alerta não se repete dentro de 1 hora para a mesma referência", async () => {
  const { db, tabelas } = fakeDb();
  assert.equal(await reservarAlerta(db, "ip_bloqueado", "9.9.9.9"), true);
  assert.equal(await reservarAlerta(db, "ip_bloqueado", "9.9.9.9"), false);
  assert.equal(await reservarAlerta(db, "ip_bloqueado", "8.8.8.8"), true);
  assert.equal(await reservarAlerta(db, "ip_nao_autorizado", "9.9.9.9"), true);
  tabelas.partner_api_alertas[0].enviado_em = new Date(Date.now() - 2 * 3600_000).toISOString();
  assert.equal(await reservarAlerta(db, "ip_bloqueado", "9.9.9.9"), true);
});
