// BRIEF docs/briefs/2026-11-27_contratar-cota-nova-em-projetos.md
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CAMPOS_LISTA, contratacaoParaLista, decidirRevelacao, estimativaParcela, mascararEmail, mascararWhatsapp,
  ordenarContratacoes, podeRevelarContato, podeVerContratacao, rotuloStatusContratacao, textoAutorizacao, validarPedido,
} from "../../lib/consorcio/contratacoes";

// Equipe X: master MX com U1 e U2. Equipe Y: master MY com U3. Partner avulso A.
const interno = { id: "adm", interno: true, equipe: [] };
const A = { id: "A", interno: false, equipe: ["A"] };
const U1 = { id: "U1", interno: false, equipe: ["U1"] };
const MX = { id: "MX", interno: false, equipe: ["MX", "U1", "U2"] };
const MY = { id: "MY", interno: false, equipe: ["MY", "U3"] };
const de = (created_by: string | null) => ({ created_by });

test("podeVerContratacao: matriz de acesso", () => {
  for (const c of ["A", "U1", "MX", "U3", null]) assert.equal(podeVerContratacao(interno, de(c)), true);
  assert.equal(podeVerContratacao(A, de("A")), true);
  assert.equal(podeVerContratacao(A, de("U1")), false);
  assert.equal(podeVerContratacao(U1, de("U2")), false, "colega");
  assert.equal(podeVerContratacao(U1, de("MX")), false, "master");
  assert.equal(podeVerContratacao(MX, de("U1")), true);
  assert.equal(podeVerContratacao(MX, de("U3")), false, "outra equipe");
  assert.equal(podeVerContratacao(MY, de("U1")), false);
  assert.equal(podeVerContratacao(A, de(null)), false, "sem created_by");
});

test("revelar contato: interno e quem enviou; master de outro usuário não", () => {
  assert.equal(podeRevelarContato(interno, de("U1")), true);
  assert.equal(podeRevelarContato(U1, de("U1")), true);
  assert.equal(podeRevelarContato(MX, de("U1")), false);
  assert.equal(podeRevelarContato(MX, de("MX")), true);
  assert.equal(decidirRevelacao(U1, null), 404);
  assert.equal(decidirRevelacao(interno, { created_by: "U1", deleted_at: "2026-11-27T00:00:00Z" }), 404, "excluído");
  assert.equal(decidirRevelacao(MX, { created_by: "U1", deleted_at: null }), 403);
  assert.equal(decidirRevelacao(A, { created_by: "U1", deleted_at: null }), 403);
  assert.equal(decidirRevelacao(U1, { created_by: "U1", deleted_at: null }), 200);
});

const linha = {
  id: "c1", code: "CS-26-0042", segmento: "IMOVEL", valor_credito: "600000", parcela_maxima: "3800", prazo_meses: 200,
  tem_lance: true, lance_valor: "90000", quando: "ATE_12_MESES", cliente_nome: "Cliente Teste",
  cliente_whatsapp: "+5521989937178", cliente_email: "maria@exemplo.com", status: "NOVA",
  created_at: "2026-11-27T10:00:00Z", created_by: "U1", consentimento_texto: "SEGREDO-CONSENT",
};

test("contratacaoParaLista: paridade e contato completo nunca sai", () => {
  for (const v of [interno, U1, MX]) {
    const r = contratacaoParaLista(linha, v, { enviadoPor: "Ana", origem: "AGS Finance" });
    assert.deepEqual(Object.keys(r).sort(), [...CAMPOS_LISTA].sort());
    const j = JSON.stringify(r);
    for (const s of ["989937178", "99378", "maria@exemplo.com", "SEGREDO-CONSENT", "created_by"]) assert.equal(j.includes(s), false, s);
  }
  const dono = contratacaoParaLista(linha, U1, { enviadoPor: "Ana", origem: "AGS Finance" });
  assert.equal(dono.whatsapp_mascarado, "+55 (21) *****-7178");
  assert.equal(dono.email_mascarado, "ma***@exemplo.com");
  assert.equal(dono.origem, null, "origem só para interno");
  const master = contratacaoParaLista(linha, MX, { enviadoPor: "Ana", origem: "AGS Finance" });
  assert.equal(master.pode_revelar, false);
  assert.equal(master.whatsapp_mascarado, null);
  assert.equal(master.email_mascarado, null);
  assert.equal(contratacaoParaLista(linha, interno, { enviadoPor: "Ana", origem: "AGS Finance" }).origem, "AGS Finance");
  assert.equal(dono.valor_credito, 600000);
});

test("máscaras", () => {
  assert.equal(mascararWhatsapp("+5551997466001"), "+55 (51) *****-6001");
  assert.equal(mascararWhatsapp("+15551234567"), "+155 ****-4567");
  assert.equal(mascararWhatsapp(""), "Não informado");
  assert.equal(mascararEmail(""), "Não informado");
  assert.equal(mascararEmail("a@b.com"), "a***@b.com");
});

const base = {
  segmento: "IMOVEL", valor_credito: 600000, parcela_maxima: 3800, prazo_meses: 200, tem_lance: true, lance_valor: 90000,
  quando: "IMEDIATO", cliente_nome: "Cliente Teste", cliente_whatsapp: "+55 (21) 98993-7178", cliente_email: "", consentimento: true,
};

test("validarPedido: limites e coerência", () => {
  const ok = validarPedido(base);
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.dados.cliente_whatsapp, "+5521989937178", "E.164");
    assert.equal(ok.dados.cliente_email, null);
  }
  const ruins: [Record<string, unknown>, string][] = [
    [{ valor_credito: 0 }, "carta 0"],
    [{ valor_credito: 10_000_000.01 }, "carta acima do teto"],
    [{ parcela_maxima: 700000 }, "parcela maior que a carta"],
    [{ prazo_meses: 5 }, "prazo curto"],
    [{ prazo_meses: 241 }, "prazo longo"],
    [{ tem_lance: false }, "lance com tem_lance false"],
    [{ lance_valor: 600000 }, "lance igual à carta"],
    [{ lance_valor: null }, "tem_lance sem valor"],
    [{ cliente_whatsapp: "" }, "WhatsApp vazio"],
    [{ cliente_whatsapp: "123" }, "WhatsApp inválido"],
    [{ consentimento: false }, "sem autorização"],
    [{ cliente_nome: "Al" }, "nome curto"],
    [{ cliente_email: "x@" }, "e-mail inválido"],
    [{ segmento: "CRIPTO" }, "segmento inválido"],
  ];
  for (const [mud, nome] of ruins) assert.equal(validarPedido({ ...base, ...mud }).ok, false, nome);
  assert.equal(validarPedido({ ...base, tem_lance: false, lance_valor: null }).ok, true);
  assert.equal(validarPedido({ ...base, valor_credito: 10_000_000, parcela_maxima: 50000 }).ok, true, "teto exato");
});

test("estimativa, autorização, status", () => {
  assert.equal(estimativaParcela(600000, 200), 3585);
  assert.equal(estimativaParcela(0, 200), null);
  assert.equal(textoAutorizacao("AGS Finance"), "O cliente autorizou a AGS Finance a entrar em contato com ele sobre consórcio.");
  assert.equal(textoAutorizacao(null), "O cliente autorizou a V3 Partners a entrar em contato com ele sobre consórcio.");
  assert.equal(textoAutorizacao("  "), "O cliente autorizou a V3 Partners a entrar em contato com ele sobre consórcio.");
  assert.equal(rotuloStatusContratacao("NAO_SEGUIU"), "Não seguiu");
  const r = ordenarContratacoes([
    { status: "NAO_SEGUIU", created_at: "2026-11-27" },
    { status: "CONTRATADA", created_at: "2026-11-20" },
    { status: "NOVA", created_at: "2026-11-01" },
    { status: "EM_COTACAO", created_at: "2026-11-26" },
    { status: "NOVA", created_at: "2026-11-25" },
    { status: "PROPOSTA_ENVIADA", created_at: "2026-11-24" },
  ]);
  assert.deepEqual(r.map((x) => `${x.status}:${x.created_at}`), [
    "NOVA:2026-11-25", "NOVA:2026-11-01", "EM_COTACAO:2026-11-26", "PROPOSTA_ENVIADA:2026-11-24", "CONTRATADA:2026-11-20", "NAO_SEGUIU:2026-11-27",
  ]);
});
