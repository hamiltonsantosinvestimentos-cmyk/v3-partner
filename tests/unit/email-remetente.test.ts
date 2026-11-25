// BRIEF docs/briefs/2026-11-25_emails-remetente-enterprise.md
import { test } from "node:test";
import assert from "node:assert/strict";
import { emailParaIlike, montarRemetente, nomeRemetente, trocarTextoV3 } from "../../lib/email-remetente-regras";

const V = new Set(["agsfinance.app"]);

test("remetente da marca com domínio ativo e verificado", () => {
  assert.equal(montarRemetente({ nome: "AGS Finance", dominio: "AGSFinance.app", status: "ativo", verificados: V }), '"AGS Finance" <naoresponda@agsfinance.app>');
});

test("sem remetente: domínio pendente, não verificado, subdomínio ou sem nome", () => {
  assert.equal(montarRemetente({ nome: "AGS", dominio: "agsfinance.app", status: "pendente", verificados: V }), null);
  assert.equal(montarRemetente({ nome: "AGS", dominio: "outro.app", status: "ativo", verificados: V }), null);
  assert.equal(montarRemetente({ nome: "AGS", dominio: "plataforma.agsfinance.app", status: "ativo", verificados: V }), null);
  assert.equal(montarRemetente({ nome: "  ", dominio: "agsfinance.app", status: "ativo", verificados: V }), null);
  assert.equal(montarRemetente({ nome: "AGS", dominio: "agsfinance.app", status: "ativo", verificados: new Set() }), null);
});

test("nome do remetente sem injeção de cabeçalho e limitado a 60", () => {
  assert.equal(nomeRemetente('AGS "Fin"\r\nBcc: x@y.com <a>'), "AGS Fin Bcc: x@y.com a");
  assert.equal(nomeRemetente("x".repeat(80))!.length, 60);
});

test("e-mail para ilike escapa curingas", () => {
  assert.equal(emailParaIlike(" Joao_Silva%@X.com "), "joao\\_silva\\%@x.com");
});

test("troca só as frases da lista fechada, contrato fica V3", () => {
  const html = "Bem-vindo à V3 Partners! Aguardando a contra-assinatura da V3 Partners. V3 Partners · Plataforma Financeira";
  assert.equal(
    trocarTextoV3(html, "AGS Finance", true),
    "Bem-vindo à AGS Finance! Aguardando a contra-assinatura da V3 Partners. AGS Finance · Powered by V3 Partners",
  );
  assert.equal(trocarTextoV3("🎉 Bem-vindo à V3 Partners, Ana!", "A&B", false), "🎉 Bem-vindo à A&B, Ana!");
  assert.equal(trocarTextoV3("seu perfil na V3 Partners", "A&B", true), "seu perfil na A&amp;B");
  assert.equal(trocarTextoV3("Bem-vindo à V3 Partners", null, true), "Bem-vindo à V3 Partners");
});
