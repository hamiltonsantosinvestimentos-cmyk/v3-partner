// Pedido de commodity na Mesa M&A (BRIEF 2026-11-24, bloco A): validação, total, trava, documentos e sigilo.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  montarPedido, pedidoTravado, camposTravadosAlterados, brParaIso, isoParaBr, isoValida, contemDocumento,
  validarArquivo, caminhoDocumento, caminhoPertenceAoDeal, situacaoDocumentos, acessoCommodity, ehOriginador,
  modoVisao, filtrarAssetData, filtrarDealParaPerfil, preservarCommodity, podeExcluirDocumento,
  TOTAL_MAX_CENTAVOS, type CommodityGravada, type DocumentoComercial,
} from "../../lib/ma/commodity";

const DEAL = "8a1f3c52-7d9e-4b21-9c5a-0e6f4d2a1b37";
const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";

const base = { lado: "VENDA", produto: "MILHO", quantidade_sacas: 300000, preco_saca_centavos: 7250, moeda: "BRL" };

test("pedido válido: total calculado no servidor e peso padrão 60 kg", () => {
  const r = montarPedido({ ...base, valor_total_centavos: 1 });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.pedido.valor_total_centavos, 300000 * 7250); // ignora o total enviado pelo cliente
    assert.equal(r.pedido.peso_saca_g, 60000);
    assert.equal(r.pedido.produto_outro, null);
  }
});

test("limites: quantidade, preço por saca e teto de 1 trilhão", () => {
  assert.equal(montarPedido({ ...base, quantidade_sacas: 0 }).ok, false);
  assert.equal(montarPedido({ ...base, quantidade_sacas: 10_000_001 }).ok, false);
  assert.equal(montarPedido({ ...base, preco_saca_centavos: 0 }).ok, false);
  assert.equal(montarPedido({ ...base, preco_saca_centavos: 100_000_001 }).ok, false);
  assert.equal(montarPedido({ ...base, quantidade_sacas: 1.5 }).ok, false);
  const acima = montarPedido({ ...base, quantidade_sacas: 10_000_000, preco_saca_centavos: 100_000_000 });
  assert.equal(10_000_000 * 100_000_000 > TOTAL_MAX_CENTAVOS, true);
  assert.equal(acima.ok, false);
});

test("listas fechadas e produto Outro", () => {
  assert.equal(montarPedido({ ...base, lado: "TROCA" }).ok, false);
  assert.equal(montarPedido({ ...base, moeda: "EUR" }).ok, false);
  assert.equal(montarPedido({ ...base, incoterm: "EXW" }).ok, false);
  assert.equal(montarPedido({ ...base, peso_saca_g: 55000 }).ok, false);
  assert.equal(montarPedido({ ...base, produto: "OUTRO" }).ok, false);
  assert.equal(montarPedido({ ...base, produto: "OUTRO", produto_outro: "Sorgo" }).ok, true);
  assert.equal(montarPedido({ ...base, produto: "OUTRO", produto_outro: "Sorgo 111.111.111-11" }).ok, false);
});

test("datas: texto AAAA-MM-DD, fim antes do início recusado", () => {
  assert.equal(montarPedido({ ...base, entrega_inicio: "2026-12-10", entrega_fim: "2026-12-01" }).ok, false);
  assert.equal(montarPedido({ ...base, entrega_inicio: "2026-12-01", entrega_fim: "2026-12-10" }).ok, true);
  assert.equal(montarPedido({ ...base, entrega_inicio: "2026-02-30" }).ok, false);
  assert.equal(isoValida("2028-02-29"), true);
  assert.equal(brParaIso("01/12/2026"), "2026-12-01");
  assert.equal(brParaIso("31/02/2026"), null);
  assert.equal(isoParaBr("2026-12-01"), "01/12/2026");
});

test("percentuais com no máximo 1 casa, de 0 a 100", () => {
  assert.equal(montarPedido({ ...base, umidade_pct: 14.5 }).ok, true);
  assert.equal(montarPedido({ ...base, umidade_pct: 14.55 }).ok, false);
  assert.equal(montarPedido({ ...base, impureza_pct: 101 }).ok, false);
});

test("edição parcial mescla com o pedido anterior e preserva documentos", () => {
  const ant = montarPedido(base);
  assert.ok(ant.ok);
  if (!ant.ok) return;
  const doc: DocumentoComercial = { id: U1, tipo: "LOI", nome: "loi.pdf", caminho: `${DEAL}/comercial/x-loi.pdf`, enviado_por: U2, enviado_em: "2026-11-24T10:00:00Z" };
  const anterior: CommodityGravada = { ...ant.pedido, documentos: [doc] };
  const r = montarPedido({ local_entrega: "Paranaguá · PR" }, anterior);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.pedido.local_entrega, "Paranaguá · PR");
    assert.equal(r.pedido.quantidade_sacas, 300000);
    assert.equal(r.pedido.documentos?.length, 1);
  }
});

test("trava: V3C-ICM ou V3C-CVC enviado ou assinado; exclusão aprovada não trava", () => {
  assert.equal(pedidoTravado([{ contract_code: "V3C-ICM-2026-0001", status_signature: "enviado_assinatura", deletion_status: "none" }]), true);
  assert.equal(pedidoTravado([{ contract_code: "V3C-CVC-2026-0001", status_signature: "assinado", deletion_status: null }]), true);
  assert.equal(pedidoTravado([{ contract_code: "V3C-ICM-2026-0001", status_signature: "rascunho", deletion_status: "none" }]), false);
  assert.equal(pedidoTravado([{ contract_code: "V3C-NDA-2026-0001", status_signature: "assinado", deletion_status: "none" }]), false);
  assert.equal(pedidoTravado([{ contract_code: "V3C-ICM-2026-0001", status_signature: "assinado", deletion_status: "approved" }]), false);
  assert.equal(pedidoTravado([{ contract_code: "V3C-ICM-2026-0001", status_signature: "assinado", deletion_status: "pending_governance" }]), true);
  const ant = montarPedido(base);
  if (!ant.ok) throw new Error();
  assert.deepEqual(camposTravadosAlterados(ant.pedido, { ...ant.pedido, preco_saca_centavos: 8000 }), ["preco_saca_centavos"]);
  assert.deepEqual(camposTravadosAlterados(ant.pedido, { ...ant.pedido, local_entrega: "Santos" }), []);
});

test("documentos: tipo, tamanho, caminho do deal e situação pelo envio mais recente", () => {
  assert.equal(validarArquivo("loi.pdf", 1000), null);
  assert.notEqual(validarArquivo("loi.exe", 1000), null);
  assert.notEqual(validarArquivo("loi.pdf", 21 * 1024 * 1024), null);
  const cam = caminhoDocumento(DEAL, U1, "LOI Cliente/final.PDF");
  assert.equal(cam.startsWith(`${DEAL}/comercial/${U1}-`), true);
  assert.equal(caminhoPertenceAoDeal(DEAL, cam), true);
  assert.equal(caminhoPertenceAoDeal(DEAL, `${U2}/comercial/x.pdf`), false);
  assert.equal(caminhoPertenceAoDeal(DEAL, `${DEAL}/comercial/../x.pdf`), false);
  assert.equal(caminhoPertenceAoDeal(DEAL, `${DEAL}/outra/x.pdf`), false);
  const docs: DocumentoComercial[] = [
    { id: U1, tipo: "LOI", nome: "a", caminho: "", enviado_por: U2, enviado_em: "2026-11-24T10:00:00Z" },
    { id: U2, tipo: "ICPO", nome: "b", caminho: "", enviado_por: U2, enviado_em: "2026-11-24T11:00:00Z", excluido_em: "2026-11-24T12:00:00Z" },
  ];
  const s = situacaoDocumentos(docs);
  assert.equal(s[0].tipo, "LOI");
  assert.equal(s.find(x => x.tipo === "LOI")?.recebido, true);
  assert.equal(s.find(x => x.tipo === "ICPO")?.recebido, false); // excluído não conta
  assert.equal(contemDocumento("12345678000190"), true);
  assert.equal(contemDocumento("Milho safrinha 2026"), false);
});

test("papéis: rota nova do pedido e exclusão de documento", () => {
  const deal = { assigned_to: U1, created_by: U1 };
  assert.equal(acessoCommodity("ADMIN", deal, U2), "gravar");
  assert.equal(acessoCommodity("GESTAO", deal, U2), "gravar");
  assert.equal(acessoCommodity("MESA", deal, U1), "gravar");
  assert.equal(acessoCommodity("MESA", deal, U2), null);
  assert.equal(acessoCommodity("MESA_OPERACIONAL", deal, U2), "ler");
  assert.equal(acessoCommodity("PARTNER_PRO", deal, U1), null);
  assert.equal(acessoCommodity("INSTITUICAO", deal, U1), null);
  assert.equal(acessoCommodity(null, deal, U1), null);
  assert.equal(podeExcluirDocumento("MESA"), false);
  assert.equal(podeExcluirDocumento("GESTAO"), true);
});

test("sigilo: originador vê recorte sem arquivo; transferido e demais não veem", () => {
  assert.equal(ehOriginador({ originator_profile_id: U1, created_by: U2 }, U1), true);
  assert.equal(ehOriginador({ originator_profile_id: U1, created_by: U2 }, U2), false);
  assert.equal(ehOriginador({ originator_profile_id: null, created_by: U2 }, U2), true);
  assert.equal(modoVisao("PARTNER", { originator_profile_id: U1 }, U1), "recorte");
  assert.equal(modoVisao("PARTNER", { originator_profile_id: U1 }, U2), "nenhum"); // recebeu por transferência
  assert.equal(modoVisao("MESA", { originator_profile_id: U1 }, U2), "completo");

  const ant = montarPedido(base);
  if (!ant.ok) throw new Error();
  const doc: DocumentoComercial = { id: U1, tipo: "SCO", nome: "sco-vendedora.pdf", caminho: `${DEAL}/comercial/x.pdf`, enviado_por: U2, enviado_em: "2026-11-24T10:00:00Z" };
  const ad = { transfer_history: [1], commodity: { ...ant.pedido, documentos: [doc] } };

  const recorte = filtrarAssetData(ad, "recorte")!;
  const txt = JSON.stringify(recorte);
  assert.equal(txt.includes("sco-vendedora"), false);
  assert.equal(txt.includes("comercial/"), false);
  assert.equal((recorte.commodity as Record<string, unknown>).quantidade_sacas, 300000);
  assert.equal(Array.isArray((recorte.commodity as Record<string, unknown>).situacao_documentos), true);
  assert.deepEqual(recorte.transfer_history, [1]);

  assert.equal("commodity" in filtrarAssetData(ad, "nenhum")!, false);
  assert.equal(JSON.stringify(filtrarAssetData(ad, "completo")).includes("sco-vendedora"), true);
  assert.equal(JSON.stringify(ad).includes("sco-vendedora"), true); // original não é alterado

  const linha = { id: DEAL, created_by: U2, originator_profile_id: U1, asset_data: ad };
  const paraTransferido = filtrarDealParaPerfil(linha, "PARTNER", U2, false);
  assert.equal("originator_profile_id" in paraTransferido, false);
  assert.equal("commodity" in (paraTransferido.asset_data as Record<string, unknown>), false);
});

test("PATCH antigo preserva a commodity do banco", () => {
  const banco = { commodity: { quantidade_sacas: 300000 }, transfer_history: [1] };
  const cliente = { commodity: { quantidade_sacas: 1 }, outra: "x" };
  assert.deepEqual(preservarCommodity(cliente, banco), { outra: "x", commodity: { quantidade_sacas: 300000 } });
  assert.deepEqual(preservarCommodity({ outra: "x" }, { transfer_history: [1] }), { outra: "x" });
  assert.deepEqual(preservarCommodity({ outra: "x" }, banco), { outra: "x", commodity: { quantidade_sacas: 300000 } });
});
