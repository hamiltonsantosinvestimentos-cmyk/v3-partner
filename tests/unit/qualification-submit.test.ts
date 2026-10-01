// Validação e normalização do envio da qualificação (BRIEF 30/09/2026, Fase 1B).
// Lógica pura: sem banco, sem rede. Rodar com `npm run test:unit`.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isValidBirthDate,
  maskCep,
  maskCnpj,
  maskCpf,
  normalizeEmail,
  normalizeSubmission,
  previewQualificationText,
  toRepresentationJson,
  type RepresentationInput,
  type SubmissionInput,
} from "../../lib/qualification-submit";

const ENDERECO = {
  endereco_cep: "30140-000", endereco_rua: "Rua das Acácias", endereco_numero: "120",
  endereco_complemento: "ap. 302", endereco_bairro: "Centro", endereco_cidade: "Belo Horizonte", endereco_estado: "MG",
};
const SEDE = {
  company_cep: "30110000", company_rua: "Avenida do Contorno", company_numero: "2.000", company_complemento: "sala 1501",
  company_bairro: "Centro", company_cidade: "Belo Horizonte", company_estado: "MG",
};

const pf = (extra: Partial<SubmissionInput> = {}): SubmissionInput => ({
  party_nature: "PF",
  cpf_cnpj: "529.982.247-25",
  nationality_code: "br",
  profession: "advogada",
  marital_status_code: "casado",
  birth_date: "1985-03-12",
  id_type: "oab", id_number: "123.456", id_issuer_uf: "mg",
  email: "Maria.Souza@Escritorio.com.br",
  phone: "(31) 98765-4321",
  ...ENDERECO,
  ...extra,
});

const repPf = (extra: Partial<RepresentationInput> = {}): RepresentationInput => ({
  representative_type: "procurador", party_nature: "PF",
  full_name: "Ana Paula Ribeiro", cpf_cnpj: "390.533.447-05", nationality_code: "br", profession: "advogada",
  marital_status_code: "solteiro", id_type: "oab", id_number: "234.567", id_issuer_uf: "MG",
  email: "ana.ribeiro@escritorio.com.br", phone: "(31) 97777-6666",
  endereco_cep: "30150-010", endereco_rua: "Rua dos Ipês", endereco_numero: "45", endereco_bairro: "Centro", endereco_cidade: "Belo Horizonte", endereco_estado: "MG",
  ...extra,
});

const campos = (r: ReturnType<typeof normalizeSubmission>) => r.errors.map((e) => `${e.path}:${e.field}`).sort();

test("A1: envio completo normaliza e grava a forma dupla", () => {
  const r = normalizeSubmission(pf(), { inviteName: "Maria Helena de Souza" });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  const p = r.principal!;
  assert.equal(p.cpf_cnpj, "52998224725");
  assert.equal(p.marital_status_code, "casado");
  assert.equal(p.marital_status, "casado(a)");
  assert.equal(p.nationality_code, "br");
  assert.equal(p.nationality, "brasileiro(a)");
  assert.equal(p.rg, "OAB/MG 123.456");
  assert.equal(p.phone, "+5531987654321");
  assert.equal(p.email, "maria.souza@escritorio.com.br");
  assert.equal(p.endereco_completo, "Rua das Acácias, 120, ap. 302 - CEP 30140-000 - Centro, Belo Horizonte/MG");
  assert.equal(p.endereco_cep, "30140-000");
});

test("A1: texto de pré-visualização igual ao que vai para o contrato", () => {
  const r = normalizeSubmission(pf(), { inviteName: "Maria Helena de Souza" });
  assert.equal(
    previewQualificationText(r),
    "MARIA HELENA DE SOUZA, brasileiro(a), advogada, casado(a), CPF 529.982.247-25, Identidade OAB/MG 123.456, e-mail maria.souza@escritorio.com.br, +55 (31) 98765-4321, residente e domiciliado(a) na Rua das Acácias, 120, ap. 302 - CEP 30140-000 - Centro, Belo Horizonte/MG.",
  );
});

test("A1: formulário vazio acusa cada obrigatório", () => {
  const r = normalizeSubmission({ party_nature: "PF" }, { inviteName: "Fulano" });
  assert.equal(r.ok, false);
  assert.deepEqual(
    campos(r),
    ["principal:address", "principal:birth_date", "principal:cpf", "principal:email", "principal:identity", "principal:marital_status", "principal:nationality", "principal:phone", "principal:profession"],
  );
  assert.equal(previewQualificationText(r), null);
});

test("natureza ausente ou inválida", () => {
  assert.equal(normalizeSubmission({}).errors[0].field, "party_nature");
  assert.equal(normalizeSubmission({ party_nature: "XYZ" }).ok, false);
});

test("CPF inválido e CPF só com dígitos repetidos", () => {
  assert.deepEqual(campos(normalizeSubmission(pf({ cpf_cnpj: "529.982.247-26" }), { inviteName: "X" })), ["principal:cpf"]);
  assert.deepEqual(campos(normalizeSubmission(pf({ cpf_cnpj: "111.111.111-11" }), { inviteName: "X" })), ["principal:cpf"]);
});

test("nacionalidade 'outra' exige o texto", () => {
  assert.deepEqual(campos(normalizeSubmission(pf({ nationality_code: "outra" }), { inviteName: "X" })), ["principal:nationality"]);
  const ok = normalizeSubmission(pf({ nationality_code: "outra", nationality_other: " Norte-Americano(a), " }), { inviteName: "X" });
  assert.equal(ok.ok, true);
  assert.equal(ok.principal!.nationality, "norte-americano(a)");
});

test("estado civil fora da lista fechada é recusado", () => {
  assert.deepEqual(campos(normalizeSubmission(pf({ marital_status_code: "mg" }), { inviteName: "X" })), ["principal:marital_status"]);
});

test("identidade incompleta e passaporte inválido", () => {
  assert.deepEqual(campos(normalizeSubmission(pf({ id_type: "rg", id_number: "12345" }), { inviteName: "X" })), ["principal:identity"]);
  assert.deepEqual(campos(normalizeSubmission(pf({ id_type: "passaporte", id_number: "0000000", id_country: "US" }), { inviteName: "X" })), ["principal:identity"]);
  assert.deepEqual(campos(normalizeSubmission(pf({ id_type: "passaporte", id_number: "X1234567", id_country: "ZZ" }), { inviteName: "X" })), ["principal:identity"]);
});

test("estrangeiro adulto com passaporte e sem CPF: dispensado, e o texto não imprime CPF", () => {
  const r = normalizeSubmission(
    pf({ nationality_code: "outra", nationality_other: "norte-americano(a)", id_type: "passaporte", id_number: "x1234567", id_country: "us", id_issuer_uf: null, cpf_cnpj: null, declared_no_cpf: true, marital_status_code: "solteiro" }),
    { inviteName: "Robert Example Miller" },
  );
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.principal!.cpf_waived, true);
  assert.equal(r.principal!.cpf_cnpj, null);
  assert.equal(r.principal!.rg, "Passaporte X1234567 (US)");
  const texto = previewQualificationText(r)!;
  assert.equal(texto.includes("CPF"), false);
  assert.ok(texto.includes("Identidade Passaporte X1234567 (US)"));
});

test("dispensa de CPF recusada para brasileiro, para quem não usa passaporte e para menor", () => {
  const base = { id_type: "passaporte", id_number: "X1234567", id_country: "US", cpf_cnpj: null, declared_no_cpf: true };
  assert.deepEqual(campos(normalizeSubmission(pf({ ...base, nationality_code: "br" }), { inviteName: "X" })), ["principal:cpf"]);
  assert.deepEqual(campos(normalizeSubmission(pf({ ...base, nationality_code: "outra", nationality_other: "americano(a)", id_type: "rg", id_issuer: "SSP", id_issuer_uf: "SP" }), { inviteName: "X" })), ["principal:cpf"]);
  const menor = normalizeSubmission(
    { party_nature: "INCAPAZ_ABSOLUTO", ...base, nationality_code: "outra", nationality_other: "americano(a)", birth_date: "2016-02-03", representation: repPf({ representative_type: "genitor" }) },
    { inviteName: "Menor" },
  );
  assert.ok(campos(menor).includes("principal:cpf"));
});

test("informar CPF junto com 'Não possuo CPF' é recusado", () => {
  const r = normalizeSubmission(
    pf({ nationality_code: "outra", nationality_other: "americano(a)", id_type: "passaporte", id_number: "X1234567", id_country: "US", declared_no_cpf: true }),
    { inviteName: "X" },
  );
  assert.deepEqual(campos(r), ["principal:cpf"]);
});

test("B3: menor impúbere sem nenhuma obrigatoriedade nova (identidade 'se houver')", () => {
  const r = normalizeSubmission(
    { party_nature: "INCAPAZ_ABSOLUTO", cpf_cnpj: "746.223.950-70", nationality_code: "br", birth_date: "2016-02-03", representation: repPf({ representative_type: "genitor" }) },
    { inviteName: "Lucas Gabriel Ferreira" },
  );
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.principal!.rg, null);
});

test("B2: relativamente incapaz sem identidade passa; identidade parcial não", () => {
  const base: SubmissionInput = {
    party_nature: "INCAPAZ_RELATIVO", cpf_cnpj: "935.411.347-80", nationality_code: "br", profession: "estudante",
    marital_status_code: "solteiro", birth_date: "2008-05-10", ...ENDERECO, representation: repPf({ representative_type: "genitor" }),
  };
  assert.equal(normalizeSubmission(base, { inviteName: "Pedro" }).ok, true);
  assert.deepEqual(campos(normalizeSubmission({ ...base, id_type: "rg" }, { inviteName: "Pedro" })), ["principal:identity"]);
});

test("representante PF exige e-mail e identidade", () => {
  const r = normalizeSubmission(
    pf({ party_nature: "PF_PROCURACAO", email: null, phone: null, representation: repPf({ email: null, id_type: null, id_number: null, id_issuer_uf: null }) }),
    { inviteName: "João Carlos Pereira" },
  );
  assert.deepEqual(campos(r), ["representante.1:email", "representante.1:identity"]);
});

test("B1: procuração completa e o JSON da representação traz e-mail e identidade", () => {
  const r = normalizeSubmission(pf({ party_nature: "PF_PROCURACAO", representation: repPf() }), { inviteName: "João Carlos Pereira" });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  const json = toRepresentationJson(r.representation!);
  assert.equal(json.email, "ana.ribeiro@escritorio.com.br");
  assert.equal(json.rg, "OAB/MG 234.567");
  assert.equal(json.representative_type, "procurador");
  assert.ok(previewQualificationText(r)!.includes("representado(a) por seu(sua) procurador(a) (mandato anexo) ANA PAULA RIBEIRO"));
});

test("tipo de representação não permitido para a natureza", () => {
  const r = normalizeSubmission(pf({ party_nature: "PF_PROCURACAO", representation: repPf({ representative_type: "genitor" }) }), { inviteName: "X" });
  assert.deepEqual(campos(r), ["representante.1:representation"]);
});

test("representante ausente numa natureza que exige", () => {
  assert.deepEqual(campos(normalizeSubmission(pf({ party_nature: "ESPOLIO", cpf_cnpj: "813.207.540-40" }), { inviteName: "Antônio" })), ["representante.1:representation"]);
});

test("C1: espólio só pede nome e CPF do falecido e o inventariante completo", () => {
  const r = normalizeSubmission(
    { party_nature: "ESPOLIO", cpf_cnpj: "813.207.540-40", representation: repPf({ representative_type: "inventariante", marital_status_code: "viuvo" }) },
    { inviteName: "Antônio Carlos Mendes" },
  );
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.ok(previewQualificationText(r)!.startsWith("ESPÓLIO DE ANTÔNIO CARLOS MENDES, CPF 813.207.540-40"));
});

test("D1: PJ com CNPJ alfanumérico representada por administrador", () => {
  const r = normalizeSubmission(
    {
      party_nature: "PJ", company_name: "Comércio de Alimentos Sabor & Cia Ltda.", company_legal_nature: "privado", company_cnpj: "12.abc.345/01de-35",
      email: "contato@saborcia.com.br", phone: "(31) 92222-1111", ...SEDE,
      representation: repPf({ representative_type: "administrador" }),
    },
    { inviteName: "Sabor e Cia" },
  );
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.principal!.company_cnpj, "12ABC34501DE35");
  assert.ok(previewQualificationText(r)!.includes("CNPJ 12.ABC.345/01DE-35"));
});

test("D1: CNPJ inválido, natureza jurídica fora da lista e sede incompleta", () => {
  const base: SubmissionInput = { party_nature: "PJ", company_name: "X Ltda", company_legal_nature: "privado", company_cnpj: "11.222.333/0001-81", ...SEDE, representation: repPf({ representative_type: "administrador" }) };
  assert.equal(normalizeSubmission(base, {}).ok, true);
  assert.deepEqual(campos(normalizeSubmission({ ...base, company_cnpj: "11.222.333/0001-80" }, {})), ["principal:cnpj"]);
  assert.deepEqual(campos(normalizeSubmission({ ...base, company_legal_nature: "ltda" }, {})), ["principal:legal_nature"]);
  assert.deepEqual(campos(normalizeSubmission({ ...base, company_cep: "" }, {})), ["principal:address"]);
});

test("D1 encadeada: PJ representada por PJ, representada por pessoa física", () => {
  const r = normalizeSubmission(
    {
      party_nature: "PJ", company_name: "Indústria Exemplo Ltda.", company_legal_nature: "privado", company_cnpj: "11.222.333/0001-81", ...SEDE,
      representation: {
        representative_type: "representante_legal", party_nature: "PJ", company_name: "Holding Exemplo S.A.", company_legal_nature: "privado",
        company_cnpj: "12.ABC.345/01DE-35", company_cep: "01310-100", company_rua: "Avenida Paulista", company_numero: "1000", company_bairro: "Bela Vista", company_cidade: "São Paulo", company_estado: "SP",
        representation: repPf({ representative_type: "administrador" }),
      },
    },
    {},
  );
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.representation!.party_nature, "PJ");
  assert.equal(r.representation!.representation!.party_nature, "PF");
});

test("cadeia de representação com mais de 5 níveis é recusada", () => {
  let nested: RepresentationInput = repPf({ representative_type: "administrador" });
  for (let i = 0; i < 6; i++) {
    nested = { representative_type: "administrador", party_nature: "PJ", company_name: "PJ " + i, company_legal_nature: "privado", company_cnpj: "11.222.333/0001-81", ...SEDE, representation: nested };
  }
  const r = normalizeSubmission({ party_nature: "PJ", company_name: "Topo", company_legal_nature: "privado", company_cnpj: "11.222.333/0001-81", ...SEDE, representation: { ...nested, representative_type: "administrador" } }, {});
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.field === "representation" && /5 níveis/.test(e.message)));
});

test("data de nascimento: futura, antiga demais e inexistente", () => {
  const hoje = new Date("2026-10-01T12:00:00Z");
  assert.equal(isValidBirthDate("1985-03-12", hoje), true);
  assert.equal(isValidBirthDate("2026-10-01", hoje), true);
  assert.equal(isValidBirthDate("2026-10-02", hoje), false);
  assert.equal(isValidBirthDate("1906-09-30", hoje), false);
  assert.equal(isValidBirthDate("2026-02-31", hoje), false);
  assert.equal(isValidBirthDate("12/03/1985", hoje), false);
  assert.equal(isValidBirthDate("", hoje), false);
});

test("e-mail: normaliza e recusa formato inválido", () => {
  assert.equal(normalizeEmail("  Ana@Dominio.com.br "), "ana@dominio.com.br");
  assert.equal(normalizeEmail("sem-arroba"), null);
  assert.equal(normalizeEmail("a@b"), null);
  assert.equal(normalizeEmail("a".repeat(250) + "@x.com"), null);
});

test("e-mail da parte principal cai no do convite quando não é alterado", () => {
  const r = normalizeSubmission(pf({ email: null }), { inviteName: "X", inviteEmail: "Convite@Exemplo.com.br" });
  assert.equal(r.ok, true);
  assert.equal(r.principal!.email, "convite@exemplo.com.br");
});

test("telefone: brasileiro vira E.164, internacional é aceito, inválido é recusado", () => {
  assert.equal(normalizeSubmission(pf({ phone: "+1 555 123 4567" }), { inviteName: "X" }).principal!.phone, "+15551234567");
  assert.deepEqual(campos(normalizeSubmission(pf({ phone: "123" }), { inviteName: "X" })), ["principal:phone"]);
});

test("endereço: S/N aceito, manual preservado, incompleto devolve a mensagem certa", () => {
  const sn = normalizeSubmission(pf({ endereco_numero: "s/n", endereco_complemento: null }), { inviteName: "X" });
  assert.ok(sn.principal!.endereco_completo!.startsWith("Rua das Acácias, S/N - CEP 30140-000"));
  const manual = normalizeSubmission(pf({ endereco_manual: true }), { inviteName: "X" });
  assert.equal(manual.principal!.endereco_manual, true);
  const semCep = normalizeSubmission(pf({ endereco_cep: "301" }), { inviteName: "X" });
  assert.equal(semCep.errors[0].message, "Informe um CEP válido (8 dígitos).");
  const semRua = normalizeSubmission(pf({ endereco_rua: "" }), { inviteName: "X" });
  assert.equal(semRua.errors[0].message, "Informe o logradouro.");
});

test("histórico: nenhum texto vem de campo digitado livre de estado civil ou nacionalidade", () => {
  const r = normalizeSubmission(pf({ marital_status_code: "casado", nationality_code: "br" }), { inviteName: "X" });
  assert.equal(r.principal!.marital_status, "casado(a)");
  assert.equal(r.principal!.nationality, "brasileiro(a)");
});

test("máscaras de digitação: CPF, CNPJ legado, CNPJ alfanumérico e CEP", () => {
  assert.equal(maskCpf("52998224725"), "529.982.247-25");
  assert.equal(maskCpf("529"), "529");
  assert.equal(maskCpf("5299822472599"), "529.982.247-25");
  assert.equal(maskCpf("52a998"), "529.98");
  assert.equal(maskCnpj("11222333000181"), "11.222.333/0001-81");
  assert.equal(maskCnpj("12abc34501de35"), "12.ABC.345/01DE-35");
  assert.equal(maskCnpj("12ab"), "12.AB");
  assert.equal(maskCnpj("12abc345"), "12.ABC.345");
  assert.equal(maskCnpj("12abc34501de35999"), "12.ABC.345/01DE-35");
  assert.equal(maskCep("30140000"), "30140-000");
  assert.equal(maskCep("30140"), "30140");
  assert.equal(maskCep("30140-0009999"), "30140-000");
});
