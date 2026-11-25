// Pasta Pública (BRIEF 2026-11-24): caminho seguro, validade, dono, subpastas ocultas, raiz e pasta-mãe filtradas.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  caminhoSeguro, concessoesEfetivas, podeAcessarCaminho, filtrarListagem, ordenarItens, AVISO_SUBPASTAS, type Concessao,
} from "../../lib/governance/acesso-pasta";

const AGORA = "2026-11-25T12:00:00.000Z";
const MA: Concessao = { full_path: "MA/V3-MA-2099-01-TST-001_Cliente_A", vertical: "MA", expires_at: null, dono: true };
const CR: Concessao = { full_path: "Credito/V3-CR-2099-01-TST-001_Cliente_B", vertical: "Credito", expires_at: null, dono: true };
const CONS_SEM_DONO: Concessao = { full_path: "Consorcios/CON-2026-001_Cliente_C", vertical: "Consorcios", expires_at: null, dono: false };
const VENCIDA: Concessao = { ...MA, full_path: "MA/V3-MA-2099-01-TST-009_Cliente_D", expires_at: "2026-11-01T00:00:00.000Z" };

test("caminho seguro: recusa .., barra inicial, final e dupla", () => {
  assert.equal(caminhoSeguro(""), true);
  assert.equal(caminhoSeguro("MA/x/01_NDA/a.pdf"), true);
  for (const c of ["/MA", "MA/", "MA//x", "MA/../Credito", "MA/./x", "MA\\x"]) assert.equal(caminhoSeguro(c), false, c);
});

test("efetivas: vencida sai; externo sem dono sai; equipe não exige dono", () => {
  const todas = [MA, CR, CONS_SEM_DONO, VENCIDA];
  assert.deepEqual(concessoesEfetivas("PARTNER_PRO", todas, AGORA).map(c => c.vertical), ["MA", "Credito"]);
  assert.deepEqual(concessoesEfetivas("GESTAO", todas, AGORA).map(c => c.vertical), ["MA", "Credito", "Consorcios"]);
});

test("acesso: igual ou dentro; irmã de nome parecido não; subpastas ocultas para externo", () => {
  const ef = [MA, CR];
  assert.equal(podeAcessarCaminho("PARTNER_PRO", ef, MA.full_path), true);
  assert.equal(podeAcessarCaminho("PARTNER_PRO", ef, `${MA.full_path}/04_Due_Diligence/doc.pdf`), true);
  assert.equal(podeAcessarCaminho("PARTNER_PRO", ef, `${MA.full_path}X/01_NDA/doc.pdf`), false);
  assert.equal(podeAcessarCaminho("PARTNER_PRO", ef, `${MA.full_path}/06_Contrato/x.pdf`), false);
  assert.equal(podeAcessarCaminho("PARTNER_PRO", ef, `${MA.full_path}/06_Contrato`), false);
  assert.equal(podeAcessarCaminho("PARTNER_PRO", ef, `${CR.full_path}/04_Contrato/x.pdf`), false);
  assert.equal(podeAcessarCaminho("PARTNER_PRO", ef, `${CR.full_path}/01_Analise/x.pdf`), true);
  assert.equal(podeAcessarCaminho("PARTNER_PRO", ef, `${MA.full_path}/../outro/x.pdf`), false);
  assert.equal(podeAcessarCaminho("MESA_OPERACIONAL", ef, `${MA.full_path}/06_Contrato/x.pdf`), true);
  assert.equal(podeAcessarCaminho("ADMIN", [], "MA/qualquer/coisa.pdf"), true);
  assert.equal(podeAcessarCaminho("STARTER", [], "MA/qualquer/coisa.pdf"), false);
});

test("vertical sem regra: externo não vê subpasta", () => {
  const cons = { ...CONS_SEM_DONO, dono: true };
  assert.equal(podeAcessarCaminho("PARTNER", [cons], `${cons.full_path}/01_Documentos/x.pdf`), false);
  assert.equal(podeAcessarCaminho("PARTNER", [cons], cons.full_path), true);
});

test("listagem: raiz e pasta-mãe só mostram o caminho até as pastas concedidas", () => {
  const ef = [MA];
  const raiz = filtrarListagem("PARTNER_PRO", ef, "", [
    { name: "MA", is_folder: true }, { name: "Credito", is_folder: true }, { name: "solto.pdf", is_folder: false },
  ]);
  assert.ok(raiz.ok);
  if (raiz.ok) assert.deepEqual(raiz.itens.map(i => i.name), ["MA"]);
  const mae = filtrarListagem("PARTNER_PRO", ef, "MA", [
    { name: "V3-MA-2099-01-TST-001_Cliente_A", is_folder: true }, { name: "V3-MA-2099-01-TST-002_Outro", is_folder: true },
  ]);
  assert.ok(mae.ok);
  if (mae.ok) assert.deepEqual(mae.itens.map(i => i.name), ["V3-MA-2099-01-TST-001_Cliente_A"]);
  assert.equal(filtrarListagem("PARTNER_PRO", ef, "Credito", []).ok, false);
});

test("listagem: na pasta do deal, externo não vê subpastas ocultas e recebe aviso; equipe vê tudo", () => {
  const itens = ["01_NDA", "04_Due_Diligence", "05_Propostas", "06_Contrato", "07_Closing"].map(n => ({ name: n, is_folder: true }));
  const ext = filtrarListagem("PARTNER_PRO", [MA], MA.full_path, itens);
  assert.ok(ext.ok);
  if (ext.ok) { assert.deepEqual(ext.itens.map(i => i.name), ["01_NDA", "04_Due_Diligence"]); assert.equal(ext.aviso, AVISO_SUBPASTAS); }
  assert.equal(filtrarListagem("PARTNER_PRO", [MA], `${MA.full_path}/06_Contrato`, []).ok, false);
  const eq = filtrarListagem("MESA_OPERACIONAL", [MA], MA.full_path, itens);
  assert.ok(eq.ok);
  if (eq.ok) { assert.equal(eq.itens.length, 5); assert.equal(eq.aviso, null); }
});

test("listagem: sem concessão, a raiz responde vazia; pasta-mãe nega", () => {
  const r = filtrarListagem("STARTER", [], "", [{ name: "MA", is_folder: true }]);
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.itens.length, 0);
  assert.equal(filtrarListagem("STARTER", [], "MA", []).ok, false);
});

test("ordem: pastas antes de arquivos, alfabética pt-BR", () => {
  const o = ordenarItens([
    { name: "zeta.pdf", is_folder: false }, { name: "Ágil", is_folder: true }, { name: "beta", is_folder: true }, { name: "alfa.pdf", is_folder: false },
  ]);
  assert.deepEqual(o.map(i => i.name), ["Ágil", "beta", "alfa.pdf", "zeta.pdf"]);
});

test("CI: nenhuma migration nova recria acesso direto de não ADMIN à Pasta Pública", () => {
  const dir = path.join(__dirname, "..", "..", "supabase", "migrations");
  const ruins: string[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".sql") || f < "20261125a") continue; // históricas ficam como estão; a 20261125a remove
    const sql = fs.readFileSync(path.join(dir, f), "utf8").toLowerCase();
    for (const m of sql.matchAll(/create\s+policy[\s\S]*?;/g)) {
      const pol = m[0];
      const alvo = pol.includes("v3-docs-publico") || /on\s+(public\.)?(folder_registry|folder_access_grants|document_chunks)\b/.test(pol);
      if (alvo && !pol.includes("'admin'")) ruins.push(`${f}: ${pol.slice(0, 80)}`);
    }
    if (/grant\s+[\s\S]*?on\s+(public\.)?(folder_registry|folder_access_grants)\s+to\s+(anon|authenticated)/.test(sql)) ruins.push(`${f}: grant em tabela de pasta`);
  }
  assert.deepEqual(ruins, []);
});
