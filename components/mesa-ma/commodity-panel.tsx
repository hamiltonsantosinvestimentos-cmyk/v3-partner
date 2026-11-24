"use client";

// Aba "Commodity" do deal na Mesa M&A (BRIEF docs/briefs/2026-11-24_mesa-ma-pedido-de-commodity-bloco-A.md).
// Pedido (lado, produto, volume, preço, Incoterm, entrega, pagamento, especificação) e documentos comerciais.
// Toda regra (validação, total, trava, sigilo) vive no servidor e em lib/ma/commodity.ts.

import { useCallback, useEffect, useRef, useState } from "react";
import { Info, Loader2, Lock, Paperclip, Trash2, Upload, ExternalLink, Wheat } from "lucide-react";
import { aviso, confirmar, pedirMotivo } from "@/lib/aviso";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { formatCurrencyBRLFromNumber, formatMoney, parseCurrencyBRLInput, type CmCurrency } from "@/lib/utils";
import { valorPorExtenso } from "@/lib/utils/valor-extenso";
import { MoneyCurrencyField } from "@/components/ma/deal-money";
import {
  LADOS, PRODUTOS, INCOTERMS, MODOS_PAGAMENTO, PESOS_SACA, TIPOS_DOCUMENTO, MSG_ARQUIVO_INVALIDO,
  validarArquivo, calcularTotalCentavos, totalEmUnidades, type TipoDocumento,
} from "@/lib/ma/commodity";

type Situacao = { tipo: TipoDocumento; label: string; recebido: boolean; enviado_em: string | null };
type DocLista = { id: string; tipo: TipoDocumento; nome: string; enviado_por_nome: string | null; enviado_em: string };
type Commodity = {
  lado?: string; produto?: string; produto_outro?: string | null; quantidade_sacas?: number; peso_saca_g?: number;
  preco_saca_centavos?: number; moeda?: "BRL" | "USD"; incoterm?: string | null; local_embarque?: string | null;
  local_entrega?: string | null; entrega_inicio?: string | null; entrega_fim?: string | null; cargas_por_dia?: number | null;
  modo_pagamento?: string | null; umidade_pct?: number | null; impureza_pct?: number | null; avariados_pct?: number | null;
  valor_total_centavos?: number;
};
type Resposta = {
  commodity: Commodity | null; situacao_documentos: Situacao[]; travado: boolean; pode_gravar: boolean;
  deal_value: number | null; currency: string | null;
};

type Form = {
  lado: string; produto: string; produto_outro: string; quantidade: string; peso_saca_g: number; preco: string;
  moeda: CmCurrency; incoterm: string; local_embarque: string; local_entrega: string; entrega_inicio: string;
  entrega_fim: string; cargas_por_dia: string; modo_pagamento: string; umidade: string; impureza: string; avariados: string;
};

const NOTA_PRECO = "Base do valor total, do contrato e da liberação de pagamento no V3 Cargas.";
const NOTA_PAGAMENTO = "Define como o V3 Cargas libera cada carga.";
const NOTA_DOCUMENTOS = "A Mesa de Compliance só libera a ficha com LOI ou ICPO e a prova de fundos recebidas.";

const input = "w-full rounded-lg border border-[#243A66] bg-[#13223A] text-[#F5F1E8] text-sm px-3 py-2 placeholder:text-[#9BAFC5] focus:outline-none focus:border-[#C9A84C] disabled:opacity-60 disabled:cursor-not-allowed";
const label = "text-xs text-[#9BAFC5] mb-1.5 block";

function soDigitos(v: string) { return v.replace(/\D/g, ""); }
function fmtInteiro(v: string) { const d = soDigitos(v).slice(0, 9); return d ? Number(d).toLocaleString("pt-BR") : ""; }
function pctTexto(n: number | null | undefined) { return n === null || n === undefined ? "" : String(n).replace(".", ","); }
function pctNumero(v: string): number | null {
  const t = v.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}
function dataHoraBr(iso: string) {
  // Exibição local do momento do envio (timestamp com hora, não data pura).
  try { return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }); } catch { return iso; }
}

function formDe(c: Commodity | null): Form {
  return {
    lado: c?.lado ?? "", produto: c?.produto ?? "", produto_outro: c?.produto_outro ?? "",
    quantidade: c?.quantidade_sacas ? c.quantidade_sacas.toLocaleString("pt-BR") : "",
    peso_saca_g: c?.peso_saca_g ?? 60000,
    preco: c?.preco_saca_centavos ? formatCurrencyBRLFromNumber(c.preco_saca_centavos / 100) : "",
    moeda: (c?.moeda ?? "BRL") as CmCurrency, incoterm: c?.incoterm ?? "", local_embarque: c?.local_embarque ?? "",
    local_entrega: c?.local_entrega ?? "", entrega_inicio: c?.entrega_inicio ?? "", entrega_fim: c?.entrega_fim ?? "",
    cargas_por_dia: c?.cargas_por_dia ? String(c.cargas_por_dia) : "", modo_pagamento: c?.modo_pagamento ?? "",
    umidade: pctTexto(c?.umidade_pct), impureza: pctTexto(c?.impureza_pct), avariados: pctTexto(c?.avariados_pct),
  };
}

function Nota({ texto }: { texto: string }) {
  const [aberta, setAberta] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="Por que este campo existe"
        aria-expanded={aberta}
        title={texto}
        onClick={() => setAberta(v => !v)}
        onFocus={() => setAberta(true)}
        onBlur={() => setAberta(false)}
        className="text-[#C9A84C] hover:text-[#E8C97A] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/50 rounded"
      >
        <Info size={12} />
      </button>
      {aberta && (
        <span role="tooltip" className="absolute left-5 top-0 z-20 w-60 rounded-lg border border-[#243A66] bg-[#162744] p-2 text-[11px] leading-snug text-[#9BAFC5]">
          {texto}
        </span>
      )}
    </span>
  );
}

export function CommodityPanel({ dealId, onSaved }: { dealId: string; onSaved?: (value: number, currency: string) => void }) {
  const [carregando, setCarregando] = useState(true);
  const [dados, setDados] = useState<Resposta | null>(null);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<Form>(formDe(null));
  const [salvando, setSalvando] = useState(false);
  const [docs, setDocs] = useState<DocLista[]>([]);
  const [podeExcluir, setPodeExcluir] = useState(false);
  const [tipoEnvio, setTipoEnvio] = useState<TipoDocumento>("LOI");
  const [enviando, setEnviando] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/ma/deals/${dealId}/commodity`),
        fetch(`/api/ma/deals/${dealId}/commodity/documentos`),
      ]);
      const j1 = await r1.json();
      if (!r1.ok) { setDados(null); aviso(j1.error ?? "Não foi possível carregar o pedido."); return; }
      setDados(j1);
      setForm(formDe(j1.commodity));
      if (r2.ok) { const j2 = await r2.json(); setDocs(j2.documentos ?? []); setPodeExcluir(!!j2.pode_excluir); }
    } catch {
      aviso("Não foi possível carregar o pedido.");
    } finally {
      setCarregando(false);
    }
  }, [dealId]);

  useEffect(() => { carregar(); }, [carregar]);

  const travado = !!dados?.travado;
  const podeGravar = !!dados?.pode_gravar;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(p => ({ ...p, [k]: v }));

  const quantidadeNum = Number(soDigitos(form.quantidade) || 0);
  const precoCentavos = Math.round(parseCurrencyBRLInput(form.preco) * 100);
  const totalCentavos = quantidadeNum > 0 && precoCentavos > 0 ? calcularTotalCentavos(quantidadeNum, precoCentavos) : 0;
  const totalUnidades = totalEmUnidades(totalCentavos);

  async function salvar() {
    const pcts = { umidade_pct: pctNumero(form.umidade), impureza_pct: pctNumero(form.impureza), avariados_pct: pctNumero(form.avariados) };
    if (Object.values(pcts).some(v => Number.isNaN(v))) { aviso("Use números de 0 a 100 nos percentuais (ex: 14,5)."); return; }
    const payload = {
      lado: form.lado || undefined,
      produto: form.produto || undefined,
      produto_outro: form.produto === "OUTRO" ? form.produto_outro : null,
      quantidade_sacas: quantidadeNum || undefined,
      peso_saca_g: form.peso_saca_g,
      preco_saca_centavos: precoCentavos || undefined,
      moeda: form.moeda === "USD" ? "USD" : "BRL",
      incoterm: form.incoterm || null,
      local_embarque: form.local_embarque.trim() || null,
      local_entrega: form.local_entrega.trim() || null,
      entrega_inicio: form.entrega_inicio || null,
      entrega_fim: form.entrega_fim || null,
      cargas_por_dia: form.cargas_por_dia ? Number(soDigitos(form.cargas_por_dia)) : null,
      modo_pagamento: form.modo_pagamento || null,
      ...pcts,
    };

    // Sobrescrita do valor: se o valor do deal foi editado à mão, confirma antes de trocar.
    const totalGravado = dados?.commodity?.valor_total_centavos;
    const valorAtual = dados?.deal_value ?? null;
    const valorAtualDiferente = valorAtual !== null && totalGravado !== undefined
      ? Math.round(valorAtual * 100) !== totalGravado
      : valorAtual !== null && valorAtual > 0 && !dados?.commodity;
    if (valorAtualDiferente && totalCentavos > 0 && Math.round(valorAtual! * 100) !== totalCentavos) {
      const moedaAtual = (dados?.currency ?? "BRL") as CmCurrency;
      const ok = await confirmar(
        `O valor do deal hoje é ${formatMoney(valorAtual!, moedaAtual)}, diferente do pedido. Ao salvar, ele passa a ser ${formatMoney(totalUnidades, form.moeda)} (quantidade × preço por saca).`,
        { titulo: "Substituir o valor do deal?", botao: "Substituir e salvar" },
      );
      if (!ok) return;
    }

    setSalvando(true);
    try {
      const res = await fetch(`/api/ma/deals/${dealId}/commodity`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commodity: payload }),
      });
      const j = await res.json();
      if (!res.ok) { aviso(j.error ?? "Não foi possível salvar o pedido."); return; }
      setDados(j);
      setForm(formDe(j.commodity));
      setEditando(false);
      if (j.deal_value !== null && j.deal_value !== undefined) onSaved?.(Number(j.deal_value), j.currency ?? "BRL");
      aviso("Pedido de commodity salvo.");
    } catch {
      aviso("Não foi possível salvar o pedido.");
    } finally {
      setSalvando(false);
    }
  }

  async function enviarArquivo(file: File) {
    const invalido = validarArquivo(file.name, file.size);
    if (invalido) { aviso(invalido); return; }
    setEnviando(true);
    try {
      const prep = await fetch(`/api/ma/deals/${dealId}/commodity/documentos`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "preparar", tipo: tipoEnvio, nome: file.name, tamanho: file.size }),
      });
      const pj = await prep.json();
      if (!prep.ok) { aviso(pj.error ?? "Não foi possível preparar o envio."); return; }
      const { error } = await createBrowserSupabaseClient().storage.from(pj.bucket).uploadToSignedUrl(pj.caminho, pj.token, file, { contentType: pj.content_type });
      if (error) { aviso(`Falha ao enviar o arquivo: ${error.message}`); return; }
      const conf = await fetch(`/api/ma/deals/${dealId}/commodity/documentos`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "confirmar", tipo: tipoEnvio, nome: file.name, caminho: pj.caminho }),
      });
      const cj = await conf.json();
      if (!conf.ok) { aviso(cj.error ?? MSG_ARQUIVO_INVALIDO); return; }
      aviso("Documento recebido.");
      await carregar();
    } catch {
      aviso("Não foi possível enviar o documento.");
    } finally {
      setEnviando(false);
      if (arquivoRef.current) arquivoRef.current.value = "";
    }
  }

  async function abrir(id: string) {
    const res = await fetch(`/api/ma/deals/${dealId}/commodity/documentos?id=${id}`);
    const j = await res.json();
    if (!res.ok || !j.url) { aviso(j.error ?? "Não foi possível abrir o documento."); return; }
    window.open(j.url, "_blank", "noopener,noreferrer");
  }

  async function excluir(d: DocLista) {
    const motivo = await pedirMotivo({
      titulo: "Excluir documento comercial",
      mensagem: `O arquivo "${d.nome}" será apagado. O registro fica no histórico com o seu nome, a data e o motivo. Esta ação não pode ser desfeita.`,
      botao: "Excluir documento",
      perigo: true,
    });
    if (!motivo) return;
    const res = await fetch(`/api/ma/deals/${dealId}/commodity/documentos`, {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: d.id, motivo }),
    });
    const j = await res.json();
    if (!res.ok) { aviso(j.error ?? "Não foi possível excluir o documento."); return; }
    aviso("Documento excluído.");
    await carregar();
  }

  if (carregando) {
    return <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-[#C9A84C]" /></div>;
  }
  if (!dados) {
    return <p className="py-8 text-center text-xs text-[#9BAFC5]">Não foi possível carregar o pedido de commodity.</p>;
  }

  const c = dados.commodity;
  const bloqueadoEconomico = travado || !editando;
  const bloqueadoGeral = !editando;

  // Estado vazio
  if (!c && !editando) {
    return (
      <div className="rounded-xl border border-[#243A66] bg-[#162744] p-10 text-center space-y-4">
        <Wheat size={22} className="mx-auto text-[#C9A84C]" />
        <p className="text-sm text-[#F5F1E8]">Nenhum pedido de commodity registrado neste deal.</p>
        {podeGravar && (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="rounded-lg bg-[#C9A84C] px-4 py-2 text-xs font-bold text-[#09081A] hover:bg-[#E8C97A]"
          >
            Registrar pedido
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {travado && (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-[#C9A84C]/40 bg-[#C9A84C]/10 p-3 text-xs text-[#E8C97A]">
          <Lock size={14} className="mt-0.5 flex-shrink-0" />
          Pedido travado: há contrato enviado ou assinado. Alteração exige novo contrato. Locais, datas, cargas por dia e especificação continuam editáveis.
        </div>
      )}

      {/* ── Pedido ─────────────────────────────────────────── */}
      <section className="rounded-xl border border-[#243A66] bg-[#162744] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#F5F1E8]">Pedido</h3>
          {podeGravar && !editando && (
            <button type="button" onClick={() => setEditando(true)} className="rounded-lg border border-[#C9A84C]/40 px-3 py-1.5 text-xs font-bold text-[#C9A84C] hover:bg-[#C9A84C]/10">
              Editar
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={label} htmlFor="cm-lado">Lado *</label>
            <select id="cm-lado" className={input} value={form.lado} disabled={bloqueadoEconomico} onChange={e => set("lado", e.target.value)}>
              <option value="">Selecione</option>
              {LADOS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="cm-produto">Produto *</label>
            <select id="cm-produto" className={input} value={form.produto} disabled={bloqueadoEconomico} onChange={e => set("produto", e.target.value)}>
              <option value="">Selecione</option>
              {PRODUTOS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {form.produto === "OUTRO" && (
            <div className="sm:col-span-2">
              <label className={label} htmlFor="cm-outro">Qual produto? *</label>
              <input id="cm-outro" className={input} maxLength={60} value={form.produto_outro} disabled={bloqueadoEconomico}
                placeholder="Ex: Sorgo (não informe nome de empresa, CPF ou CNPJ)" onChange={e => set("produto_outro", e.target.value)} />
            </div>
          )}
          <div>
            <label className={label} htmlFor="cm-qtd">Quantidade (sacas) *</label>
            <input id="cm-qtd" className={input} inputMode="numeric" value={form.quantidade} disabled={bloqueadoEconomico}
              placeholder="Ex: 300.000" onChange={e => set("quantidade", fmtInteiro(e.target.value))} />
          </div>
          <div>
            <label className={label} htmlFor="cm-peso">Peso da saca *</label>
            <select id="cm-peso" className={input} value={form.peso_saca_g} disabled={bloqueadoEconomico} onChange={e => set("peso_saca_g", Number(e.target.value))}>
              {PESOS_SACA.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <div className="flex items-center gap-1.5 mb-1 text-[11px] text-[#9BAFC5]">Preço por saca <Nota texto={NOTA_PRECO} /></div>
            {bloqueadoEconomico ? (
              <p className="rounded-lg border border-[#243A66] bg-[#13223A] px-3 py-2 text-sm text-[#F5F1E8]">
                {precoCentavos > 0 ? formatMoney(precoCentavos / 100, form.moeda) : "Não informado"}
              </p>
            ) : (
              <MoneyCurrencyField label="Preço por saca *" value={form.preco} currency={form.moeda}
                onChange={(v, m) => setForm(p => ({ ...p, preco: v, moeda: m }))} compact />
            )}
          </div>
          <div className="sm:col-span-2 rounded-lg border border-[#C9A84C]/30 bg-[#13223A] p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#E8C97A]">Valor total (calculado)</p>
            <p className="text-lg font-bold text-[#C9A84C]">{totalCentavos > 0 ? formatMoney(totalUnidades, form.moeda) : "Informe quantidade e preço"}</p>
            {totalCentavos > 0 && <p className="text-[11px] italic text-[#F5F1E8]">{valorPorExtenso(totalUnidades, form.moeda)}</p>}
          </div>
          <div>
            <label className={label} htmlFor="cm-incoterm">Incoterm</label>
            <select id="cm-incoterm" className={input} value={form.incoterm} disabled={bloqueadoEconomico} onChange={e => set("incoterm", e.target.value)}>
              <option value="">Selecione</option>
              {INCOTERMS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <div className={`${label} flex items-center gap-1.5`}>Modo de pagamento <Nota texto={NOTA_PAGAMENTO} /></div>
            <select aria-label="Modo de pagamento" className={input} value={form.modo_pagamento} disabled={bloqueadoEconomico} onChange={e => set("modo_pagamento", e.target.value)}>
              <option value="">Selecione</option>
              {MODOS_PAGAMENTO.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="cm-emb">Local de embarque</label>
            <input id="cm-emb" className={input} maxLength={120} value={form.local_embarque} disabled={bloqueadoGeral}
              placeholder="Cidade · UF" onChange={e => set("local_embarque", e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="cm-ent">Local de entrega</label>
            <input id="cm-ent" className={input} maxLength={120} value={form.local_entrega} disabled={bloqueadoGeral}
              placeholder="Cidade · UF ou porto" onChange={e => set("local_entrega", e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="cm-ini">Início da entrega</label>
            <input id="cm-ini" type="date" lang="pt-BR" className={input} value={form.entrega_inicio} disabled={bloqueadoGeral} onChange={e => set("entrega_inicio", e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="cm-fim">Fim da entrega</label>
            <input id="cm-fim" type="date" lang="pt-BR" className={input} value={form.entrega_fim} min={form.entrega_inicio || undefined} disabled={bloqueadoGeral} onChange={e => set("entrega_fim", e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="cm-cargas">Cargas por dia</label>
            <input id="cm-cargas" className={input} inputMode="numeric" value={form.cargas_por_dia} disabled={bloqueadoGeral}
              placeholder="Opcional" onChange={e => set("cargas_por_dia", soDigitos(e.target.value).slice(0, 4))} />
          </div>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#E8C97A] mb-2">Especificação (%)</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {([["umidade", "Umidade"], ["impureza", "Impureza"], ["avariados", "Avariados"]] as const).map(([k, t]) => (
              <div key={k}>
                <label className={label} htmlFor={`cm-${k}`}>{t}</label>
                <input id={`cm-${k}`} className={input} inputMode="decimal" value={form[k]} disabled={bloqueadoGeral}
                  placeholder="Ex: 14,0" onChange={e => set(k, e.target.value.replace(/[^\d,]/g, "").slice(0, 5))} />
              </div>
            ))}
          </div>
        </div>

        {editando && (
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setForm(formDe(c)); setEditando(false); }}
              className="flex-1 rounded-lg border border-[#243A66] py-2.5 text-sm text-[#9BAFC5] hover:text-[#F5F1E8]">
              Cancelar
            </button>
            <button type="button" onClick={salvar} disabled={salvando}
              className="flex-1 rounded-lg bg-[#C9A84C] py-2.5 text-sm font-bold text-[#09081A] hover:bg-[#E8C97A] disabled:opacity-40 flex items-center justify-center gap-2">
              {salvando ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : "Salvar pedido"}
            </button>
          </div>
        )}
      </section>

      {/* ── Documentos comerciais ──────────────────────────── */}
      {c && (
        <section className="rounded-xl border border-[#243A66] bg-[#162744] p-6 space-y-4">
          <h3 className="text-sm font-bold text-[#F5F1E8] flex items-center gap-1.5">Documentos comerciais <Nota texto={NOTA_DOCUMENTOS} /></h3>

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {dados.situacao_documentos.map(s => (
              <li key={s.tipo} className="flex items-center justify-between rounded-lg border border-[#243A66] bg-[#13223A] px-3 py-2">
                <span className="text-xs text-[#F5F1E8]">{s.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${s.recebido ? "bg-[#4ADE80]/15 text-[#4ADE80]" : "bg-[#7C93B5]/15 text-[#9BAFC5]"}`}>
                  {s.recebido ? "Recebido" : "Pendente"}
                </span>
              </li>
            ))}
          </ul>

          {podeGravar && (
            <div className="flex flex-col sm:flex-row gap-3">
              <select aria-label="Tipo do documento" className={`${input} sm:max-w-[220px]`} value={tipoEnvio} onChange={e => setTipoEnvio(e.target.value as TipoDocumento)}>
                {TIPOS_DOCUMENTO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <input ref={arquivoRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.docx" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) enviarArquivo(f); }} />
              <button type="button" disabled={enviando} onClick={() => arquivoRef.current?.click()}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-[#C9A84C]/40 bg-[#C9A84C]/5 py-2.5 text-xs font-bold text-[#C9A84C] hover:bg-[#C9A84C]/10 disabled:opacity-40">
                {enviando ? <><Loader2 size={14} className="animate-spin" /> Enviando...</> : <><Upload size={14} /> Enviar documento (PDF, JPG, PNG ou DOCX até 20 MB)</>}
              </button>
            </div>
          )}

          {docs.length === 0 ? (
            <p className="text-xs text-[#9BAFC5]">Nenhum documento comercial recebido. Envie a LOI, a ICPO ou a SCO.</p>
          ) : (
            <ul className="space-y-1.5">
              {docs.map(d => (
                <li key={d.id} className="flex items-center gap-2 rounded-lg border border-[#243A66] bg-[#13223A] px-3 py-2">
                  <Paperclip size={12} className="flex-shrink-0 text-[#C9A84C]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-[#F5F1E8]">
                      <span className="font-bold text-[#E8C97A]">{TIPOS_DOCUMENTO.find(t => t.value === d.tipo)?.label ?? d.tipo}</span> · {d.nome}
                    </p>
                    <p className="text-[11px] text-[#9BAFC5]">Enviado por {d.enviado_por_nome ?? "equipe"} em {dataHoraBr(d.enviado_em)}</p>
                  </div>
                  <button type="button" onClick={() => abrir(d.id)} aria-label={`Abrir ${d.nome}`} className="text-[#9BAFC5] hover:text-[#C9A84C]">
                    <ExternalLink size={14} />
                  </button>
                  {podeExcluir && (
                    <button type="button" onClick={() => excluir(d)} aria-label={`Excluir ${d.nome}`} className="text-[#9BAFC5] hover:text-[#F26D6D]">
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
