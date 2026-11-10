// CertOne: CPF do representante como signatário (BRIEF 09/11/2026). Funções puras.
// CPFs abaixo são sintéticos (válidos só pelo dígito verificador), sem relação com pessoa real.
import { test } from "node:test";
import assert from "node:assert/strict";
import { findRepresentativeSigner, normalizeCpf, resolveCertOneSigners, type QualificationRow } from "../../lib/esignature/certone-signer";

const CPF_OK = "52998224725"; // CPF sintético válido (exemplo público de validação)
const CPF_OK_MASK = "529.982.247-25";

test("normalizeCpf: aceita válido, mascarado e com espaços", () => {
  assert.equal(normalizeCpf(CPF_OK), CPF_OK);
  assert.equal(normalizeCpf(CPF_OK_MASK), CPF_OK);
  assert.equal(normalizeCpf(` ${CPF_OK_MASK} `), CPF_OK);
});

test("normalizeCpf: rejeita inválido, repetido, CNPJ e vazio", () => {
  assert.equal(normalizeCpf("52998224726"), null);
  assert.equal(normalizeCpf("111.111.111-11"), null);
  assert.equal(normalizeCpf("14.219.287/0001-50"), null);
  assert.equal(normalizeCpf("12ABC34500LL01"), null);
  assert.equal(normalizeCpf(""), null);
  assert.equal(normalizeCpf(null), null);
});

test("findRepresentativeSigner: PF direto, PJ aninhado e sem PF", () => {
  assert.deepEqual(
    findRepresentativeSigner({ party_nature: "PF", full_name: "Fulana de Tal", cpf_cnpj: CPF_OK_MASK }),
    { name: "Fulana de Tal", cpf: CPF_OK },
  );
  assert.deepEqual(
    findRepresentativeSigner({
      party_nature: "PJ",
      full_name: "Holding Ltda",
      cpf_cnpj: "14.219.287/0001-50",
      representation: { party_nature: "PF", full_name: "Beltrano", cpf_cnpj: CPF_OK },
    }),
    { name: "Beltrano", cpf: CPF_OK },
  );
  assert.equal(findRepresentativeSigner({ party_nature: "PJ", cpf_cnpj: "14.219.287/0001-50", representation: null }), null);
  assert.equal(findRepresentativeSigner({ party_nature: "PF", full_name: "Sem CPF", cpf_cnpj: "123" }), null);
  assert.equal(findRepresentativeSigner(null), null);
});

const qualPJ = (role: string, email: string, rep: QualificationRow["representation"]): QualificationRow => ({
  role_in_document: role, email, person_type: "PJ", representation: rep,
});

test("resolveCertOneSigners: PF usa o próprio CPF; PJ usa nome e CPF do representante", () => {
  const r = resolveCertOneSigners(
    [
      { role: "head_mesa", name: "SOCIO V3", email: "socio@v3.test", document: CPF_OK_MASK },
      { role: "partner", name: "NOME FANTASIA", email: "p@x.test", document: "14.219.287/0001-50" },
    ],
    [qualPJ("partner", "P@X.test", { party_nature: "PF", full_name: "Administrador Real", cpf_cnpj: CPF_OK })],
  );
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.signers.map((s) => [s.role, s.name, s.document, s.fromRepresentative]), [
      ["head_mesa", "SOCIO V3", CPF_OK, false],
      ["partner", "Administrador Real", CPF_OK, true],
    ]);
  }
});

test("resolveCertOneSigners: ambiguidade ou ausência falha sem número de CPF", () => {
  const parte = [{ role: "partner", name: "N", email: "p@x.test", document: "14.219.287/0001-50" }];
  const rep = { party_nature: "PF", full_name: "Adm", cpf_cnpj: CPF_OK } as const;
  for (const quals of [
    [],
    [qualPJ("partner", "p@x.test", rep), qualPJ("partner", "p@x.test", rep)],
    [qualPJ("partner", "outro@x.test", rep)],
    [qualPJ("partner", "p@x.test", { party_nature: "PF", full_name: "Adm", cpf_cnpj: "52998224726" })],
    [qualPJ("partner", "p@x.test", null)],
  ] as QualificationRow[][]) {
    const r = resolveCertOneSigners(parte, quals);
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.match(r.error, /partner \(p@x\.test\)/);
      assert.ok(!/\d{6,}/.test(r.error), "mensagem não pode conter número de documento");
    }
  }
});

// Regressão ClickSign: o ramo ClickSign não consulta cm_party_qualifications nem a chave.
import { prepareSignatoriesForProvider, type SendContract } from "../../lib/contract-send";

const contrato = { id: "c1", vertical: "ma", contract_title: "NCNDA", contract_code: "X", status_signature: "rascunho", parties: [], signing_token: null, qualification_batch_id: "b1" } as unknown as SendContract;
const partes = [{ role: "partner", name: "N", email: "p@x.test", doc: "14.219.287/0001-50" }];
const sigs = [{ name: "N", email: "p@x.test", document: "14.219.287/0001-50" }];
const dbQueFalhaSeTocar = { from: () => { throw new Error("não pode consultar o banco"); } } as never;

test("prepareSignatories: ClickSign devolve intacto, sem tocar banco nem chave", async () => {
  const r = await prepareSignatoriesForProvider(dbQueFalhaSeTocar, "clicksign", contrato, partes, sigs, async () => { throw new Error("não pode ler a chave"); });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.signatories, sigs);
});

test("prepareSignatories: CertOne com chave desligada bloqueia (422) sem tocar banco", async () => {
  const r = await prepareSignatoriesForProvider(dbQueFalhaSeTocar, "certone", contrato, partes, sigs, async () => false);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.status, 422);
    assert.match(r.error, /partner \(p@x\.test\)/);
  }
});

test("prepareSignatories: CertOne com todas as partes já com CPF não consulta nada", async () => {
  const pf = [{ name: "S", email: "s@v3.test", document: CPF_OK_MASK }];
  const r = await prepareSignatoriesForProvider(dbQueFalhaSeTocar, "certone", contrato, [], pf, async () => { throw new Error("não pode ler a chave"); });
  assert.equal(r.ok, true);
});
