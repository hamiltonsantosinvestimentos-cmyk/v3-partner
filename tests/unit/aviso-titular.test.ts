// Aviso ao titular da qualificação (W23). Função pura e comportamento de falha fechada. Dado só inventado.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  avisarTitularDaQualificacao,
  montarPayloadAvisoTitular,
  primeiroNomeTitular,
} from "@/lib/qualificacao/aviso-titular";

const raiz = path.resolve(__dirname, "..", "..");
const ler = (rel: string) => fs.readFileSync(path.join(raiz, rel), "utf8");

const base = {
  email: "teste@exemplo.com.br",
  nomeCompleto: "Maria Souza Teste",
  personType: "PF",
  token: "tok-teste-123",
  appUrl: "https://app.exemplo.test/",
};

test("devolução: payload só com os campos mínimos, link do mesmo token e frase do catálogo", () => {
  const p = montarPayloadAvisoTitular({ ...base, tipo: "devolucao", motivoCodigo: "dados_divergentes" });
  assert.deepEqual(p, {
    tipo: "devolucao",
    destinatario: "teste@exemplo.com.br",
    primeiro_nome: "Maria",
    link: "https://app.exemplo.test/intake/qualificacao/tok-teste-123",
    nome_documento_padrao: "",
    motivo_padrao: "Alguns dados informados são diferentes dos que constam nos documentos.",
  });
  assert.deepEqual(Object.keys(p!).sort(), ["destinatario", "link", "motivo_padrao", "nome_documento_padrao", "primeiro_nome", "tipo"]);
});

test("exclusão: leva o nome externo do documento de cadastro; tipo fora do catálogo não envia", () => {
  const ok = montarPayloadAvisoTitular({ ...base, tipo: "exclusao", motivoCodigo: "documento_vencido", documentKind: "identificacao_foto" });
  assert.equal(ok?.nome_documento_padrao, "Documento de identificação com foto");
  assert.equal(ok?.motivo_padrao, "O documento está com a validade vencida.");
  assert.equal(montarPayloadAvisoTitular({ ...base, tipo: "exclusao", motivoCodigo: "documento_vencido", documentKind: "ncnda_ma" }), null);
  assert.equal(montarPayloadAvisoTitular({ ...base, tipo: "exclusao", motivoCodigo: "documento_vencido" }), null);
});

test("'Outro motivo' não envia frase; código inválido ou de outra lista não envia nada", () => {
  assert.equal(montarPayloadAvisoTitular({ ...base, tipo: "devolucao", motivoCodigo: "outro" })?.motivo_padrao, "");
  assert.equal(montarPayloadAvisoTitular({ ...base, tipo: "devolucao", motivoCodigo: undefined }), null);
  assert.equal(montarPayloadAvisoTitular({ ...base, tipo: "devolucao", motivoCodigo: "documento_ilegivel" }), null);
  assert.equal(montarPayloadAvisoTitular({ ...base, tipo: "exclusao", motivoCodigo: "dados_divergentes", documentKind: "contrato_social" }), null);
});

test("saudação: pessoa jurídica e nome vazio saem sem nome; só PF usa o primeiro nome", () => {
  assert.equal(primeiroNomeTitular("Maria Souza Teste", "PF"), "Maria");
  assert.equal(primeiroNomeTitular("Empresa Exemplo Teste Ltda", "PJ"), "");
  assert.equal(primeiroNomeTitular("   ", "PF"), "");
  assert.equal(primeiroNomeTitular(null, "PF"), "");
  assert.equal(primeiroNomeTitular("Maria", null), "");
  const pj = montarPayloadAvisoTitular({ ...base, personType: "PJ", nomeCompleto: "Empresa Exemplo Teste Ltda", tipo: "devolucao", motivoCodigo: "outro" });
  assert.equal(pj?.primeiro_nome, "");
});

test("sem e-mail válido ou sem token: nada é enviado", () => {
  for (const email of [null, undefined, "", "   ", "sem-arroba", "a@b", "x y@z.com"]) {
    assert.equal(montarPayloadAvisoTitular({ ...base, email, tipo: "devolucao", motivoCodigo: "outro" }), null, String(email));
  }
  assert.equal(montarPayloadAvisoTitular({ ...base, token: null, tipo: "devolucao", motivoCodigo: "outro" }), null);
});

test("nunca vaza: nome completo, texto livre, deal, setor e contrato ficam fora do payload", () => {
  const p = montarPayloadAvisoTitular({ ...base, nomeCompleto: "Maria Souza Teste", tipo: "devolucao", motivoCodigo: "dados_divergentes" })!;
  const json = JSON.stringify(p);
  assert.ok(!json.includes("Souza") && !json.includes("Teste"), "nome completo no payload");
  assert.ok(!/V3-MA|V3C-|deal|setor|motivo_livre/i.test(json));
});

test("helper nunca lança e, sem a chave ligada (ou sem ambiente), devolve 'desligado' sem enviar", async () => {
  const antes = { u: process.env.NEXT_PUBLIC_SUPABASE_URL, k: process.env.SUPABASE_SERVICE_ROLE_KEY };
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const r = await avisarTitularDaQualificacao({} as never, { qualificationId: "id-teste", tipo: "devolucao", motivoCodigo: "outro" });
    assert.equal(r, "desligado");
  } finally {
    if (antes.u !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = antes.u;
    if (antes.k !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = antes.k;
  }
});

test("rotas: o código do motivo é validado no servidor ANTES de qualquer alteração (422)", () => {
  const reopen = ler("app/api/cm/qualifications/[id]/reopen/route.ts");
  assert.match(reopen, /fraseMotivo\(MOTIVOS_DEVOLUCAO, corpo\.motivo_codigo\)/);
  assert.ok(reopen.indexOf("fraseMotivo(") < reopen.indexOf('.update({ status: "pendente"'), "validação depois da alteração");
  assert.match(reopen, /status: 422/);
  assert.ok(reopen.indexOf("avisarTitularDaQualificacao(db") > reopen.indexOf("fn_limpar_conferencia"), "aviso antes da limpeza");

  const excluir = ler("app/api/cm/qualifications/party/[id]/documents/[docId]/excluir/route.ts");
  assert.match(excluir, /fraseMotivo\(MOTIVOS_EXCLUSAO, body\.motivo_codigo\)/);
  assert.ok(excluir.indexOf("fraseMotivo(MOTIVOS_EXCLUSAO") < excluir.indexOf('rpc("fn_excluir_documento_qualificacao"'), "validação depois da exclusão");
  const iniPost = excluir.indexOf("export async function POST");
  assert.ok(excluir.indexOf('rpc("fn_documento_exclusao_impacto"', iniPost) < excluir.indexOf('rpc("fn_excluir_documento_qualificacao"'), "as fichas reabertas devem ser capturadas antes da exclusão");
  assert.ok(excluir.indexOf("avisarTitularDaQualificacao(db") > excluir.indexOf('rpc("fn_excluir_documento_qualificacao"'), "aviso antes da exclusão");
  assert.match(excluir, /Promise\.all/);
});

test("o webhook do W23 só é chamado com o segredo e tempo limite, com await", () => {
  const src = ler("lib/qualificacao/aviso-titular.ts").replace(/\/\/.*$/gm, "");
  assert.match(src, /"x-v3-secret": segredo/);
  assert.match(src, /AbortSignal\.timeout\(TEMPO_LIMITE_MS\)/);
  assert.ok(!/\bvoid\s+(db|fetch)/.test(src), "void sem await nunca envia");
  assert.match(src, /N8N_AVISO_TITULAR_SECRET/);
});
