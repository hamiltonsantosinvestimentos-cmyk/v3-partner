// Texto da qualificacao nos 6 modelos do manual v4 (BRIEF 30/09/2026, Fase 1A).
// Os valores de entrada sao os que a rota passa a gravar: dicionario fechado, identidade
// composta em `rg`, endereco no formato do manual. Rodar com `npm run test:unit`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLegalQualification, type LegalQualificationParty } from "../../lib/legal-qualification";
import { buildAddressText, composeIdentity } from "../../lib/qualification-schema";

const endereco = buildAddressText({
  rua: "Rua das Acácias", numero: "120", complemento: "ap. 302", bairro: "Centro", cidade: "Belo Horizonte", estado: "MG", cep: "30140000",
}) as string;

const maria: LegalQualificationParty = {
  party_nature: "PF",
  full_name: "Maria Helena de Souza",
  nationality: "brasileiro(a)",
  profession: "advogada",
  marital_status: "casado(a)",
  cpf_cnpj: "52998224725",
  id_type: "oab",
  rg: composeIdentity({ id_type: "oab", id_number: "123.456", id_issuer_uf: "MG" }),
  email: "maria.souza@escritorio.com.br",
  phone: "+5531987654321",
  endereco_completo: endereco,
};

test("A1: pessoa fisica, na ordem do manual, com identidade composta e endereco novo", () => {
  assert.equal(
    buildLegalQualification(maria),
    "MARIA HELENA DE SOUZA, brasileiro(a), advogada, casado(a), CPF 529.982.247-25, Identidade OAB/MG 123.456, e-mail maria.souza@escritorio.com.br, +55 (31) 98765-4321, residente e domiciliado(a) na Rua das Acácias, 120, ap. 302 - CEP 30140-000 - Centro, Belo Horizonte/MG.",
  );
});

test("A1: estrangeiro com passaporte e sem CPF nao imprime o termo CPF", () => {
  const robert: LegalQualificationParty = {
    ...maria,
    full_name: "Robert Example Miller",
    nationality: "norte-americano(a)",
    profession: "engenheiro",
    marital_status: "solteiro(a)",
    cpf_cnpj: null,
    id_type: "passaporte",
    rg: composeIdentity({ id_type: "passaporte", id_number: "X1234567", id_country: "US" }),
    email: "robert.example@email.com",
    phone: "+15551234567",
  };
  const texto = buildLegalQualification(robert);
  assert.equal(texto.includes("CPF"), false);
  assert.ok(texto.includes("norte-americano(a), engenheiro, solteiro(a), Identidade Passaporte X1234567 (US)"));
});

test("CPF ausente sem passaporte continua visivel como pendencia", () => {
  const semCpf = buildLegalQualification({ ...maria, cpf_cnpj: null, id_type: "rg" });
  assert.ok(semCpf.includes("CPF [NÃO INFORMADO]"));
});

test("registro antigo, sem id_type, segue com o texto original gravado", () => {
  const antigo: LegalQualificationParty = {
    party_nature: "PF",
    full_name: "Fulano de Tal",
    nationality: "brasileiro",
    profession: "empresário",
    marital_status: "casado",
    cpf_cnpj: "529.982.247-25",
    rg: "MG-12.345.678 SSP/MG",
    email: "fulano@exemplo.com.br",
    endereco_completo: "Rua X, 10, Bairro Centro, Belo Horizonte, MG, CEP 30140000",
  };
  const texto = buildLegalQualification(antigo);
  assert.ok(texto.includes("FULANO DE TAL, brasileiro, empresário, casado, CPF 529.982.247-25, Identidade MG-12.345.678 SSP/MG"));
  assert.ok(texto.includes("CEP 30140-000"));
});

test("B1: procuracao, com e-mail do procurador impresso", () => {
  const texto = buildLegalQualification({
    ...maria,
    party_nature: "PF_PROCURACAO",
    email: null,
    phone: null,
    representation: {
      representative_type: "procurador",
      party_nature: "PF",
      full_name: "Ana Paula Ribeiro",
      nationality: "brasileiro(a)",
      profession: "advogada",
      marital_status: "solteiro(a)",
      cpf_cnpj: "39053344705",
      id_type: "oab",
      rg: "OAB/MG 234.567",
      email: "ana.ribeiro@escritorio.com.br",
      phone: "+5531977776666",
      endereco_completo: "Rua dos Ipês, 45 - CEP 30150-010 - Centro, Belo Horizonte/MG",
    },
  });
  assert.ok(texto.includes(", representado(a) por seu(sua) procurador(a) (mandato anexo) ANA PAULA RIBEIRO, brasileiro(a), advogada, solteiro(a), CPF 390.533.447-05, Identidade OAB/MG 234.567, e-mail ana.ribeiro@escritorio.com.br"));
  assert.equal(texto.includes("e-mail maria"), false);
});

test("B2: relativamente incapaz", () => {
  const texto = buildLegalQualification({ ...maria, party_nature: "INCAPAZ_RELATIVO", full_name: "Pedro Henrique Alves", email: null, phone: null });
  assert.ok(texto.startsWith("PEDRO HENRIQUE ALVES, relativamente incapaz, brasileiro(a), advogada, casado(a), CPF 529.982.247-25"));
});

test("B3: menor impubere, so nome, nacionalidade, CPF e identidade", () => {
  const texto = buildLegalQualification({
    party_nature: "INCAPAZ_ABSOLUTO",
    full_name: "Lucas Gabriel Ferreira",
    nationality: "brasileiro(a)",
    cpf_cnpj: "74622395070",
    id_type: "rg",
    rg: composeIdentity({ id_type: "rg", id_number: "11.122.233", id_issuer: "SSP", id_issuer_uf: "MG" }),
    representation: {
      representative_type: "genitor",
      party_nature: "PF",
      full_name: "Fernanda Lima Ferreira",
      nationality: "brasileiro(a)",
      profession: "professora",
      marital_status: "casado(a)",
      cpf_cnpj: "45237183000",
      rg: "RG 55.566.677 SSP/MG",
      email: "fernanda.ferreira@email.com.br",
    },
  });
  assert.ok(texto.startsWith("LUCAS GABRIEL FERREIRA, menor impúbere, totalmente incapaz, brasileiro(a), CPF 746.223.950-70, Identidade RG 11.122.233 SSP/MG, representado(a) por seu(sua) genitor(a) (certidão de nascimento anexa) FERNANDA LIMA FERREIRA"));
});

test("C1: espolio", () => {
  const texto = buildLegalQualification({
    party_nature: "ESPOLIO",
    full_name: "Antônio Carlos Mendes",
    cpf_cnpj: "81320754040",
    representation: { representative_type: "inventariante", party_nature: "PF", full_name: "Renata Mendes Oliveira", cpf_cnpj: "27465918049" },
  });
  assert.ok(texto.startsWith("ESPÓLIO DE ANTÔNIO CARLOS MENDES, CPF 813.207.540-40, representado(a) por seu(sua) inventariante (termo anexo) RENATA MENDES OLIVEIRA"));
});

test("D1: pessoa juridica com CNPJ alfanumerico, representada por administrador", () => {
  const texto = buildLegalQualification({
    party_nature: "PJ",
    company_name: "Comércio de Alimentos Sabor & Cia Ltda.",
    company_legal_nature: "privado",
    company_cnpj: "12abc34501de35",
    email: "contato@saborcia.com.br",
    company_address: "Av. do Contorno, 2.000, sala 1501 - CEP 30110-000 - Centro, Belo Horizonte/MG",
    representation: {
      representative_type: "administrador",
      party_nature: "PF",
      full_name: "Marcos Vinícius Rocha",
      cpf_cnpj: "63180492074",
    },
  });
  assert.ok(texto.startsWith("COMÉRCIO DE ALIMENTOS SABOR & CIA LTDA., pessoa jurídica de direito privado, CNPJ 12.ABC.345/01DE-35, e-mail contato@saborcia.com.br, com sede na Av. do Contorno"));
  assert.ok(texto.includes(", representada por seu(sua) administrador(a) (contrato social anexo) MARCOS VINÍCIUS ROCHA"));
});

test("D1 encadeada: PJ representada por PJ, que e representada por pessoa fisica", () => {
  const texto = buildLegalQualification({
    party_nature: "PJ",
    company_name: "Indústria Exemplo Ltda.",
    company_cnpj: "11222333000181",
    representation: {
      representative_type: "representante_legal",
      party_nature: "PJ",
      company_name: "Holding Exemplo Participações S.A.",
      company_cnpj: "12ABC34501DE35",
      representation: { representative_type: "administrador", party_nature: "PF", full_name: "Patrícia Gomes Lima", cpf_cnpj: "19283746546" },
    },
  });
  assert.ok(texto.includes("CNPJ 11.222.333/0001-81"));
  assert.ok(texto.includes(", representada por seu(sua) representante legal (contrato social anexo) HOLDING EXEMPLO PARTICIPAÇÕES S.A., pessoa jurídica de direito privado, CNPJ 12.ABC.345/01DE-35"));
  assert.ok(texto.includes(", representada por seu(sua) administrador(a) (contrato social anexo) PATRÍCIA GOMES LIMA"));
});
