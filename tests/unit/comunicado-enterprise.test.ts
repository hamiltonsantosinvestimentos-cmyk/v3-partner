// BRIEF 10/11/2026: docs/briefs/2026-11-10_aprovacao-enterprise-comunicado-white-label.md
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  telefoneBrasilParaEnvio, phoneParaHistorico, mensagemWhatsappEnterprise, blocoWhiteLabelEmailHtml,
  ASSUNTO_BOAS_VINDAS, textoConfirmacaoEnterprise,
} from "../../lib/enterprise/comunicado-aprovacao";

test("telefone brasileiro válido em vários formatos vira 55 + DDD + número", () => {
  for (const t of ["(11) 91217-7771", "11912177771", "5511912177771", "+5511912177771", "+55 11 91217-7771"]) {
    const r = telefoneBrasilParaEnvio(t);
    assert.equal(r.ok, true, t);
    if (r.ok) { assert.equal(r.digitos, "5511912177771"); assert.equal(r.exibicao, "+55 (11) 91217-7771"); }
  }
  const fixo = telefoneBrasilParaEnvio("(21) 3333-4444");
  assert.equal(fixo.ok, true);
  if (fixo.ok) assert.equal(fixo.digitos, "552133334444");
});

test("número estrangeiro, ambíguo ou inválido nunca é enviado", () => {
  const casos: Record<string, RegExp> = {
    "+1 305 555 0100": /estrangeiro/,
    "3055550100": /DDD inexistente/,
    "12345": /fora do padrão/,
    "": /sem telefone/,
    "0091234567": /DDD inexistente/,
    "11812177771": /sem o 9/,
    "+5530555501000": /DDD inexistente/,
  };
  for (const [t, motivo] of Object.entries(casos)) {
    const r = telefoneBrasilParaEnvio(t);
    assert.equal(r.ok, false, t);
    if (!r.ok) assert.match(r.motivo, motivo, t);
  }
  assert.equal(telefoneBrasilParaEnvio(null).ok, false);
});

test("phone do histórico usa o JID canônico (12 dígitos) quando o check devolve, e o dialável sem check", () => {
  assert.equal(phoneParaHistorico({ existe: true, chatId: "554899868743@c.us" }, "5548998687433"), "554899868743");
  assert.equal(phoneParaHistorico({ existe: true, chatId: "5511912177771@s.whatsapp.net" }, "5511912177771"), "5511912177771");
  assert.equal(phoneParaHistorico(null, "5511912177771"), "5511912177771");
  assert.equal(phoneParaHistorico({ existe: true, chatId: null }, "5511912177771"), "5511912177771");
});

test("WhatsApp tem nome, empresa, e-mail, white label e 10 acessos, sem senha e sem travessão", () => {
  const m = mensagemWhatsappEnterprise({ nome: "MARCIANO NUNES DO NASCIMENTO", empresa: "AGS Agronegócios Sustentáveis S.A.", email: "comercial@agsfin.com.br" });
  assert.match(m, /Olá, Marciano!/);
  assert.match(m, /AGS Agronegócios Sustentáveis S\.A\./);
  assert.match(m, /comercial@agsfin\.com\.br/);
  assert.match(m, /white label/);
  assert.match(m, /10 acessos/);
  assert.doesNotMatch(m, /12345678|senha provisória:/i);
  assert.doesNotMatch(m, /[—–]/);
});

test("bloco do e-mail só usa cores da paleta V3 e não tem travessão", () => {
  const html = blocoWhiteLabelEmailHtml();
  const PALETA = new Set(["09081A", "111F35", "162744", "243A66", "C9A84C", "E8C97A", "F0ECE4", "7A8FA8"]);
  for (const c of html.match(/#[0-9A-Fa-f]{6}/g) ?? []) assert.ok(PALETA.has(c.slice(1).toUpperCase()), c);
  assert.doesNotMatch(html, /[—–]/);
  assert.match(html, /10 acessos/);
});

test("assunto do e-mail de boas-vindas sem travessão", () => {
  assert.doesNotMatch(ASSUNTO_BOAS_VINDAS, /[—–]/);
});

test("texto do modal mostra e-mail, telefone formatado ou o motivo de não enviar", () => {
  const ok = textoConfirmacaoEnterprise({ empresa: "AGS", email: "a@b.com", telefone: "(11) 91217-7771" });
  assert.match(ok, /a@b\.com/);
  assert.match(ok, /\n\+55 \(11\) 91217-7771$/);
  const semFone = textoConfirmacaoEnterprise({ empresa: "AGS", email: "a@b.com", telefone: "+1 305 555 0100" });
  assert.match(semFone, /WhatsApp não será enviado: número estrangeiro/);
});
