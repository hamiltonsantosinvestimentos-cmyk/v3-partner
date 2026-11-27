"use client";
// Contratar cota nova: quiz de 5 passos + lista "Contratação de cotas novas" em Consórcio › Projetos.
// BRIEF docs/briefs/2026-11-27_contratar-cota-nova-em-projetos.md
// Para login Enterprise, marca (logo e nome) do Enterprise no lugar da V3.

import React, { useCallback, useEffect, useState } from "react";
import { Eye, Loader2, X } from "lucide-react";
import { PhoneIntlInput } from "@/components/ui/phone-intl-input";
import { formatPhoneIntl } from "@/lib/phone";
import { valorEmReaisPorExtenso } from "@/lib/utils/valor-extenso";
import { dataBR, valorBR } from "@/app/(platform)/enterprise/mesa-operacional/exibicao";
import {
  ABAC, ORDEM_QUANDO, ORDEM_SEGMENTOS, ORDEM_STATUS, QUANDO, ROTULO_STATUS, SEGMENTOS, TETO_CREDITO,
  estimativaParcela, nomeExibido, rotuloStatusContratacao, textoAutorizacao,
  type ContratacaoLista, type Quando, type Segmento,
} from "@/lib/consorcio/contratacoes";
import { ModalItem, QuadroKanban, SeletorVisao, SeloComentarios, useVisao } from "./kanban-consorcio";

const EVENTO_ABRIR = "v3:contratar-cota";
type Marca = { nome: string; logoUrl: string | null } | null;
type Indicador = { valor: number; referencia: string } | null;
type Mercado = { selic: Indicador; ipca12: Indicador; incc: Indicador } | null;

const pct = (v: number, casas = 2) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
const centavosParaNumero = (dig: string) => (dig ? Number(dig) / 100 : 0);
const mascaraBRL = (dig: string) => (dig ? `R$ ${centavosParaNumero(dig).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "");
const extenso = (n: number) => (n > 0 ? valorEmReaisPorExtenso(n) : "");

const inputCls = "h-10 w-full px-3 text-sm bg-[#162744] border border-[#243A66] rounded-lg text-[#F0ECE4] placeholder:text-[#7A8FA8] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/60";
const opcaoCls = (sel: boolean) =>
  `text-left rounded-xl border p-3 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#E8C97A] ${sel ? "border-[#C9A84C] bg-[#C9A84C]/10" : "border-[#243A66] bg-[#162744] hover:border-[#C9A84C]/50"}`;
const chipCls = (sel: boolean) =>
  `rounded-full border px-4 py-1.5 text-sm transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#E8C97A] ${sel ? "border-[#C9A84C] bg-[#C9A84C] text-[#09081A] font-semibold" : "border-[#243A66] bg-[#162744] text-[#F0ECE4] hover:border-[#C9A84C]/50"}`;

/** Botão do cabeçalho de Projetos: abre o quiz. */
export function BotaoContratarCota() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(EVENTO_ABRIR))}
      className="h-8 rounded-md bg-[#C9A84C] px-3 text-xs font-semibold text-[#09081A] hover:bg-[#E8C97A] transition-colors"
    >
      Contratar cota nova
    </button>
  );
}

function CampoBRL({ id, rotulo, digitos, onChange, aviso }: { id: string; rotulo: string; digitos: string; onChange: (d: string) => void; aviso?: string | null }) {
  const n = centavosParaNumero(digitos);
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-xs text-[#7A8FA8]">
      {rotulo}
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="R$ 0,00"
        value={mascaraBRL(digitos)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 12))}
        className={inputCls}
      />
      {aviso ? <span className="text-[11px] text-[#E8C97A]">{aviso}</span> : <span className="text-[11px] italic">{extenso(n)}</span>}
    </label>
  );
}

function Item({ rotulo, valor, fonte }: { rotulo: string; valor: string; fonte: string }) {
  return (
    <div className="border-b border-[#243A66] pb-2.5">
      <p className="text-[11px] text-[#7A8FA8]">{rotulo}</p>
      <p className="text-lg font-semibold text-[#F0ECE4] tabular-nums">{valor}</p>
      <p className="text-[10px] italic text-[#7A8FA8]">{fonte}</p>
    </div>
  );
}

function PainelMercado({ mercado, segmento }: { mercado: Mercado; segmento: Segmento | null }) {
  const s = segmento ? SEGMENTOS[segmento] : SEGMENTOS.IMOVEL;
  return (
    <aside className="flex flex-col gap-3 border-t md:border-t-0 md:border-l border-[#243A66] bg-[#09081A] p-5">
      <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-[#C9A84C]">Mercado agora</p>
      {mercado ? (
        <>
          {mercado.selic && <Item rotulo="Selic meta" valor={`${pct(mercado.selic.valor)} a.a.`} fonte="Banco Central, atualização automática" />}
          {mercado.ipca12 && <Item rotulo="IPCA 12 meses" valor={pct(mercado.ipca12.valor)} fonte={`IBGE via Banco Central, ${mercado.ipca12.referencia}`} />}
          {mercado.incc && <Item rotulo="INCC 12 meses (corrige a carta de imóvel)" valor={pct(mercado.incc.valor)} fonte={`FGV via Banco Central, ${mercado.incc.referencia}`} />}
        </>
      ) : (
        <p className="text-[11px] text-[#7A8FA8]">Indicadores do Banco Central indisponíveis agora.</p>
      )}
      <Item rotulo="Taxa de administração média" valor={`≈ ${pct(ABAC.taxaAdmMedia, 1)}`} fonte="do crédito, no grupo todo · ABAC, mar/2026" />
      <Item rotulo={`${s.vendasRotulo} em 2026`} valor={`${s.vendas > 0 ? "+" : ""}${pct(s.vendas, 1)}`} fonte={`cotas vendidas ${ABAC.vendasPeriodo} · ABAC`} />
      <p className="text-[11px] text-[#7A8FA8] leading-relaxed">Consórcio não tem juros: o custo é a taxa de administração, diluída no prazo.</p>
    </aside>
  );
}

type Form = {
  segmento: Segmento | null; credito: string; parcela: string; prazo: number | null;
  temLance: boolean | null; lance: string; quando: Quando | null;
  nome: string; whatsapp: string; email: string; consentimento: boolean;
};
const VAZIO: Form = { segmento: null, credito: "", parcela: "", prazo: null, temLance: null, lance: "", quando: null, nome: "", whatsapp: "", email: "", consentimento: false };

function Quiz({ marca, mercado, onFechar, onEnviado }: { marca: Marca; mercado: Mercado; onFechar: () => void; onEnviado: () => void }) {
  const [passo, setPasso] = useState(0);
  const [f, setF] = useState<Form>(VAZIO);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  const nome = nomeExibido(marca?.nome);

  const credito = centavosParaNumero(f.credito);
  const parcela = centavosParaNumero(f.parcela);
  const lance = centavosParaNumero(f.lance);
  const prazoRef = f.prazo ?? (f.segmento ? SEGMENTOS[f.segmento].prazos[1] : 180);
  const est = estimativaParcela(credito, prazoRef);
  const avisoCredito = credito > TETO_CREDITO ? "O valor máximo da carta é R$ 10.000.000,00." : null;
  const avisoParcela = parcela > 0 && credito > 0 && parcela > credito ? "A parcela não pode ser maior que o valor da carta." : null;
  const avisoLance = f.temLance && lance > 0 && credito > 0 && lance >= credito ? "O lance precisa ser menor que o valor da carta." : null;
  const zapOk = f.whatsapp.replace(/\D/g, "").length >= 10;

  const valido = [
    !!f.segmento,
    credito > 0 && !avisoCredito && parcela > 0 && !avisoParcela,
    !!f.prazo && f.temLance !== null && (!f.temLance || (lance > 0 && !avisoLance)),
    !!f.quando,
    f.nome.trim().length >= 3 && zapOk && f.consentimento,
  ][passo] ?? true;

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !enviando) onFechar(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar, enviando]);

  const enviar = async () => {
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch("/api/consorcio/contratacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segmento: f.segmento, valor_credito: credito, parcela_maxima: parcela, prazo_meses: f.prazo,
          tem_lance: !!f.temLance, lance_valor: f.temLance ? lance : null, quando: f.quando,
          cliente_nome: f.nome.trim(), cliente_whatsapp: f.whatsapp, cliente_email: f.email.trim() || null, consentimento: f.consentimento,
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(typeof j?.error === "string" ? j.error : "Não foi possível enviar o pedido agora. Tente novamente.");
      setCodigo(String(j.code));
      setPasso(5);
      onEnviado();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar o pedido agora. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  const avancar = () => { if (!valido) return; if (passo === 4) void enviar(); else setPasso(passo + 1); };
  const seg = f.segmento ? SEGMENTOS[f.segmento] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#09081A]/80 p-4" onClick={() => !enviando && onFechar()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quiz-titulo"
        onClick={(e) => e.stopPropagation()}
        className="grid w-full max-w-[900px] max-h-[calc(100vh-32px)] overflow-y-auto rounded-2xl border border-[#243A66] bg-[#111F35] md:grid-cols-[1fr_280px]"
      >
        <div className="flex min-w-0 flex-col gap-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {marca?.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={marca.logoUrl} alt={marca.nome} className="h-7 w-auto max-w-[110px] object-contain" />
              )}
              <span className="truncate text-[9px] font-bold tracking-[0.18em] uppercase text-[#C9A84C]">
                {passo < 5 ? `${nome} · Passo ${passo + 1} de 5` : nome}
              </span>
            </div>
            <button type="button" onClick={onFechar} disabled={enviando} aria-label="Fechar" className="rounded-md p-1 text-[#7A8FA8] hover:text-[#F0ECE4]">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => <span key={i} className={`h-1 flex-1 rounded ${i <= passo ? "bg-[#C9A84C]" : "bg-[#243A66]"}`} />)}
          </div>

          {passo === 0 && (
            <>
              <h3 id="quiz-titulo" className="text-xl font-semibold text-[#F0ECE4]">O que o cliente quer conquistar?</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {ORDEM_SEGMENTOS.map((k) => (
                  <button key={k} type="button" className={opcaoCls(f.segmento === k)} onClick={() => setF({ ...f, segmento: k, prazo: null })}>
                    <p className="text-sm font-semibold text-[#F0ECE4]">{SEGMENTOS[k].nome}</p>
                    <p className="text-[11px] text-[#7A8FA8]">{SEGMENTOS[k].descricao}</p>
                  </button>
                ))}
              </div>
            </>
          )}

          {passo === 1 && (
            <>
              <h3 id="quiz-titulo" className="text-xl font-semibold text-[#F0ECE4]">Qual o valor da carta e quanto cabe por mês?</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <CampoBRL id="quiz-credito" rotulo="Valor da carta de crédito" digitos={f.credito} onChange={(d) => setF({ ...f, credito: d })} aviso={avisoCredito} />
                <CampoBRL id="quiz-parcela" rotulo="Parcela que cabe no mês" digitos={f.parcela} onChange={(d) => setF({ ...f, parcela: d })} aviso={avisoParcela} />
              </div>
              <div className="rounded-xl border border-[#C9A84C]/40 p-3.5">
                <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-[#C9A84C]">Estimativa de mercado</p>
                <p className="text-2xl font-semibold text-[#E8C97A] tabular-nums">{est && !avisoCredito ? `${valorBR(est)} /mês` : "Informe o valor da carta"}</p>
                <p className="text-[11px] text-[#7A8FA8]">
                  Em {prazoRef} meses, com taxa média de {pct(ABAC.taxaAdmMedia, 1)} e fundo de reserva de {ABAC.fundoReservaReferencia}%. É uma referência: a parcela real vem da administradora.
                </p>
              </div>
            </>
          )}

          {passo === 2 && seg && (
            <>
              <h3 id="quiz-titulo" className="text-xl font-semibold text-[#F0ECE4]">Prazo e lance</h3>
              <p className="text-xs text-[#7A8FA8]">Prazos comuns para {seg.nome.toLowerCase()}:</p>
              <div className="flex flex-wrap gap-2">
                {seg.prazos.map((p) => <button key={p} type="button" className={chipCls(f.prazo === p)} onClick={() => setF({ ...f, prazo: p })}>{p} meses</button>)}
              </div>
              <p className="text-xs text-[#7A8FA8] mt-1">O cliente tem dinheiro para dar lance?</p>
              <div className="flex gap-2">
                <button type="button" className={chipCls(f.temLance === true)} onClick={() => setF({ ...f, temLance: true })}>Sim</button>
                <button type="button" className={chipCls(f.temLance === false)} onClick={() => setF({ ...f, temLance: false, lance: "" })}>Não</button>
              </div>
              {f.temLance && <CampoBRL id="quiz-lance" rotulo="Quanto, mais ou menos?" digitos={f.lance} onChange={(d) => setF({ ...f, lance: d })} aviso={avisoLance} />}
            </>
          )}

          {passo === 3 && (
            <>
              <h3 id="quiz-titulo" className="text-xl font-semibold text-[#F0ECE4]">Quando o cliente quer usar o crédito?</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {ORDEM_QUANDO.map((q) => (
                  <button key={q} type="button" className={opcaoCls(f.quando === q)} onClick={() => setF({ ...f, quando: q })}>
                    <p className="text-sm font-semibold text-[#F0ECE4]">{QUANDO[q]}</p>
                  </button>
                ))}
              </div>
              <p className="text-xs text-[#7A8FA8]">Isso define a estratégia: quem tem pressa precisa de lance ou de grupo em andamento.</p>
            </>
          )}

          {passo === 4 && seg && (
            <>
              <h3 id="quiz-titulo" className="text-xl font-semibold text-[#F0ECE4]">Para quem é a cota?</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label htmlFor="quiz-nome" className="flex flex-col gap-1.5 text-xs text-[#7A8FA8] sm:col-span-2">
                  Nome do cliente
                  <input id="quiz-nome" type="text" value={f.nome} maxLength={200} placeholder="Nome completo" onChange={(e) => setF({ ...f, nome: e.target.value })} className={inputCls} />
                </label>
                <label htmlFor="quiz-whatsapp" className="flex flex-col gap-1.5 text-xs text-[#7A8FA8]">
                  WhatsApp
                  <PhoneIntlInput id="quiz-whatsapp" value={f.whatsapp} onChange={(v) => setF({ ...f, whatsapp: v })} className={inputCls} required />
                </label>
                <label htmlFor="quiz-email" className="flex flex-col gap-1.5 text-xs text-[#7A8FA8]">
                  E-mail (opcional)
                  <input id="quiz-email" type="email" value={f.email} maxLength={200} placeholder="cliente@email.com" onChange={(e) => setF({ ...f, email: e.target.value })} className={inputCls} />
                </label>
              </div>
              <label htmlFor="quiz-consent" className="flex items-start gap-2.5 text-xs text-[#7A8FA8]" title="Precisamos da autorização para cotar e falar com o cliente.">
                <input id="quiz-consent" type="checkbox" checked={f.consentimento} onChange={(e) => setF({ ...f, consentimento: e.target.checked })} className="mt-0.5 accent-[#C9A84C]" />
                {textoAutorizacao(marca?.nome)}
              </label>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl border border-[#243A66] p-3.5 text-xs">
                <dt className="text-[#7A8FA8]">Segmento</dt><dd className="text-[#F0ECE4]">{seg.nome}</dd>
                <dt className="text-[#7A8FA8]">Carta</dt><dd className="text-[#F0ECE4]">{valorBR(credito)} <span className="italic text-[#7A8FA8]">({extenso(credito)})</span></dd>
                <dt className="text-[#7A8FA8]">Parcela até</dt><dd className="text-[#F0ECE4]">{valorBR(parcela)} <span className="italic text-[#7A8FA8]">({extenso(parcela)})</span></dd>
                <dt className="text-[#7A8FA8]">Prazo</dt><dd className="text-[#F0ECE4]">{f.prazo} meses</dd>
                <dt className="text-[#7A8FA8]">Lance</dt><dd className="text-[#F0ECE4]">{f.temLance ? <>{valorBR(lance)} <span className="italic text-[#7A8FA8]">({extenso(lance)})</span></> : "Não"}</dd>
                <dt className="text-[#7A8FA8]">Quando</dt><dd className="text-[#F0ECE4]">{f.quando ? QUANDO[f.quando] : ""}</dd>
              </dl>
              {erro && <p className="rounded-lg border border-[#E8C97A]/40 px-3 py-2 text-xs text-[#E8C97A]">{erro}</p>}
            </>
          )}

          {passo === 5 && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-[#C9A84C]/15 text-2xl text-[#C9A84C]">✓</div>
              <h3 id="quiz-titulo" className="text-xl font-semibold text-[#F0ECE4]">Pedido enviado: {codigo}</h3>
              <p className="max-w-md text-xs text-[#7A8FA8]">A {nome} já recebeu seu pedido e vai cotar nas administradoras. Você acompanha o andamento aqui em Projetos.</p>
              <button type="button" onClick={onFechar} className="h-9 rounded-md bg-[#C9A84C] px-4 text-sm font-semibold text-[#09081A] hover:bg-[#E8C97A]">Ver meus pedidos</button>
            </div>
          )}

          {passo < 5 && (
            <div className="mt-auto flex justify-between gap-2 pt-2">
              <button type="button" onClick={() => setPasso(passo - 1)} disabled={passo === 0 || enviando} className="h-9 rounded-md border border-[#243A66] px-4 text-sm text-[#F0ECE4] disabled:opacity-0">Voltar</button>
              <button type="button" onClick={avancar} disabled={!valido || enviando} className="h-9 rounded-md bg-[#C9A84C] px-4 text-sm font-semibold text-[#09081A] hover:bg-[#E8C97A] disabled:opacity-45 disabled:cursor-not-allowed">
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : passo === 4 ? `Enviar para a ${nome}` : "Continuar"}
              </button>
            </div>
          )}
        </div>
        <PainelMercado mercado={mercado} segmento={f.segmento} />
      </div>
    </div>
  );
}

function Contato({ pedido }: { pedido: ContratacaoLista }) {
  const [aberto, setAberto] = useState<{ whatsapp: string; email: string | null } | null>(null);
  const [estado, setEstado] = useState<"" | "carregando" | "erro">("");
  if (!pedido.pode_revelar) return null;
  const revelar = async () => {
    setEstado("carregando");
    try {
      const r = await fetch(`/api/consorcio/contratacoes/${pedido.id}/contato`, { method: "POST" });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error();
      setAberto({ whatsapp: String(j.whatsapp ?? ""), email: j.email ?? null });
      setEstado("");
    } catch {
      setEstado("erro");
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-[#7A8FA8]">
      <span>{aberto ? formatPhoneIntl(aberto.whatsapp) : pedido.whatsapp_mascarado}</span>
      <span>·</span>
      <span className="break-all">{aberto ? (aberto.email || "Sem e-mail") : pedido.email_mascarado}</span>
      {!aberto && (
        <button type="button" onClick={revelar} disabled={estado === "carregando"} title="Ver contato completo (o acesso fica registrado)" aria-label="Ver contato completo" className="rounded p-0.5 text-[#C9A84C] hover:text-[#E8C97A]">
          {estado === "carregando" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      )}
      {estado === "erro" && <span className="text-[#E8C97A]">Não foi possível abrir o contato agora.</span>}
    </div>
  );
}

/** Seção "Contratação de cotas novas" + o quiz (aberto pelo BotaoContratarCota). */
export function CotasNovas() {
  const [lista, setLista] = useState<ContratacaoLista[] | null>(null);
  const [interno, setInterno] = useState(false);
  const [marca, setMarca] = useState<Marca>(null);
  const [mercado, setMercado] = useState<Mercado>(null);
  const [erro, setErro] = useState(false);
  const [quizAberto, setQuizAberto] = useState(false);
  const [mudando, setMudando] = useState<string | null>(null);
  const [podeMoverCards, setPodeMoverCards] = useState(false);
  const [visao, setVisao] = useVisao("v3:consorcio:cotas-novas:visao");
  const [abertoId, setAbertoId] = useState<string | null>(null);

  const carregar = useCallback(() => {
    fetch("/api/consorcio/contratacoes")
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok || !Array.isArray(j?.contratacoes)) throw new Error("falha");
        setLista(j.contratacoes);
        setInterno(!!j.interno);
        setMarca(j.marca ?? null);
        setMercado(j.mercado ?? null);
        setPodeMoverCards(!!j.pode_mover);
        setErro(false);
      })
      .catch(() => setErro(true));
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    const abrir = () => setQuizAberto(true);
    window.addEventListener(EVENTO_ABRIR, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR, abrir);
  }, []);

  const mudarStatus = async (id: string, status: string): Promise<boolean> => {
    setMudando(id);
    const anterior = lista?.find((p) => p.id === id)?.status;
    setLista((l) => l?.map((p) => (p.id === id ? { ...p, status } : p)) ?? l);
    const r = await fetch("/api/consorcio/contratacoes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) }).catch(() => null);
    if (!r?.ok && anterior) setLista((l) => l?.map((p) => (p.id === id ? { ...p, status: anterior } : p)) ?? l);
    setMudando(null);
    return !!r?.ok;
  };
  const aberto = lista?.find((p) => p.id === abertoId) ?? null;

  const novas = lista?.filter((p) => p.status === "NOVA").length;
  const emCotacao = lista?.filter((p) => p.status === "EM_COTACAO").length;

  return (
    <section id="cotas-novas" className="space-y-3 scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#F0ECE4]">Contratação de cotas novas</h2>
          <p className="text-xs text-[#7A8FA8]">
            {interno ? "Todos os pedidos de cota nova. Mude o status conforme a cotação andar." : `Pedidos que você e sua equipe enviaram. A ${nomeExibido(marca?.nome)} cota nas administradoras e retorna.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SeletorVisao visao={visao} onTrocar={setVisao} />
          {[["Novas", novas], ["Em cotação", emCotacao], ["Total", lista?.length]].map(([r, v]) => (
            <div key={String(r)} className="rounded-lg border border-[#243A66] bg-[#111F35] px-3 py-1.5 text-center">
              <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-[#C9A84C]">{r}</p>
              <p className="text-sm font-semibold text-[#F0ECE4]">{v ?? ""}</p>
            </div>
          ))}
        </div>
      </div>

      {erro ? (
        <p className="rounded-xl border border-[#243A66] p-4 text-sm text-[#7A8FA8]">Não foi possível carregar os pedidos agora.</p>
      ) : lista === null ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[#C9A84C]" /></div>
      ) : lista.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#243A66] p-6 text-center text-sm text-[#7A8FA8]">Nenhum pedido de cota nova ainda. Use Contratar cota nova para enviar o primeiro.</p>
      ) : visao === "kanban" ? (
        <QuadroKanban
          colunas={ORDEM_STATUS.map((s) => ({ id: s, rotulo: ROTULO_STATUS[s] }))}
          itens={lista}
          colunaDe={(p) => p.status}
          podeMover={podeMoverCards}
          onMover={(p, coluna) => mudarStatus(p.id, coluna)}
          onAbrir={(p) => setAbertoId(p.id)}
          renderCard={(p) => <CardKanbanCota p={p} />}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {lista.map((p) => {
            const seg = SEGMENTOS[p.segmento as Segmento]?.nome ?? p.segmento;
            return (
              <div key={p.id} className="overflow-hidden rounded-xl border border-[#243A66] bg-[#162744]">
                <div className="bg-[#C9A84C] px-4 py-1 text-[9px] font-bold tracking-[0.18em] uppercase text-[#09081A]">Contratação cota nova</div>
                <div className="space-y-1.5 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#C9A84C]">Pedido de cota {p.code} · {seg}</span>
                    {podeMoverCards ? (
                      <select
                        aria-label={`Status do pedido ${p.code}`}
                        value={p.status}
                        disabled={mudando === p.id}
                        onChange={(e) => mudarStatus(p.id, e.target.value)}
                        className="rounded-full border border-[#243A66] bg-[#111F35] px-2 py-0.5 text-[10px] font-semibold text-[#F0ECE4] focus:outline-none"
                      >
                        {ORDEM_STATUS.map((s) => <option key={s} value={s}>{ROTULO_STATUS[s]}</option>)}
                      </select>
                    ) : (
                      <span className={p.status === "NOVA" ? "rounded-full bg-[#C9A84C]/15 px-2 py-0.5 text-[10px] font-semibold text-[#E8C97A]" : "rounded-full bg-[#243A66] px-2 py-0.5 text-[10px] font-semibold text-[#F0ECE4]"}>
                        {rotuloStatusContratacao(p.status)}
                      </span>
                    )}
                  </div>
                  <p className="break-words text-sm font-medium text-[#F0ECE4]">{p.cliente_nome || "Cliente sem nome"}</p>
                  <Contato pedido={p} />
                  <p className="text-xs text-[#7A8FA8]">Carta de <span className="font-semibold text-[#E8C97A]">{valorBR(p.valor_credito)}</span> · parcela até {valorBR(p.parcela_maxima)} · {p.prazo_meses} meses</p>
                  <p className="text-xs text-[#7A8FA8]">Lance: {p.tem_lance ? valorBR(p.lance_valor) : "não"} · {QUANDO[p.quando as Quando] ?? ""}</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-[#7A8FA8]">Enviado por {p.enviado_por} em {dataBR(p.created_at, true)}</p>
                    <div className="flex items-center gap-2">
                      <SeloComentarios n={p.comentarios} />
                      <button type="button" onClick={() => setAbertoId(p.id)} className="text-xs font-semibold text-[#C9A84C] hover:underline">Abrir</button>
                    </div>
                  </div>
                  {interno && p.origem && <span className="inline-block rounded-full border border-[#C9A84C]/35 px-2 py-0.5 text-[10px] text-[#E8C97A]">{p.origem}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {quizAberto && <Quiz marca={marca} mercado={mercado} onFechar={() => setQuizAberto(false)} onEnviado={carregar} />}
      {aberto && (
        <ModalItem
          tipo="CONTRATACAO"
          id={aberto.id}
          titulo={`Pedido de cota ${aberto.code} · ${SEGMENTOS[aberto.segmento as Segmento]?.nome ?? aberto.segmento}`}
          tarja="Contratação cota nova"
          detalhes={<DetalhesCota p={aberto} interno={interno} />}
          etapas={ORDEM_STATUS.map((s) => ({ id: s, rotulo: ROTULO_STATUS[s] }))}
          etapaAtual={aberto.status}
          podeMover={podeMoverCards}
          onMudarEtapa={(e) => mudarStatus(aberto.id, e)}
          onFechar={() => setAbertoId(null)}
          onComentou={carregar}
        />
      )}
    </section>
  );
}

function CardKanbanCota({ p }: { p: ContratacaoLista }) {
  const seg = SEGMENTOS[p.segmento as Segmento]?.nome ?? p.segmento;
  return (
    <>
      <div className="bg-[#C9A84C] px-3 py-0.5 text-[8px] font-bold tracking-[0.18em] uppercase text-[#09081A]">Contratação cota nova</div>
      <div className="space-y-1 p-3">
        <p className="text-[11px] font-bold text-[#C9A84C]">{p.code} · {seg}</p>
        <p className="break-words text-sm font-medium text-[#F0ECE4]">{p.cliente_nome || "Cliente sem nome"}</p>
        <p className="text-xs text-[#E8C97A] tabular-nums">{valorBR(p.valor_credito)}</p>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[10px] text-[#7A8FA8]">{p.enviado_por} · {dataBR(p.created_at)}</p>
          <SeloComentarios n={p.comentarios} />
        </div>
      </div>
    </>
  );
}

function DetalhesCota({ p, interno }: { p: ContratacaoLista; interno: boolean }) {
  return (
    <>
      <p className="break-words text-sm font-medium text-[#F0ECE4]">{p.cliente_nome || "Cliente sem nome"}</p>
      <Contato pedido={p} />
      <p className="text-xs text-[#7A8FA8]">Carta de <span className="font-semibold text-[#E8C97A]">{valorBR(p.valor_credito)}</span> · parcela até {valorBR(p.parcela_maxima)} · {p.prazo_meses} meses</p>
      <p className="text-xs text-[#7A8FA8]">Lance: {p.tem_lance ? valorBR(p.lance_valor) : "não"} · {QUANDO[p.quando as Quando] ?? ""}</p>
      <p className="text-[11px] text-[#7A8FA8]">Enviado por {p.enviado_por} em {dataBR(p.created_at, true)}</p>
      {interno && p.origem && <span className="inline-block rounded-full border border-[#C9A84C]/35 px-2 py-0.5 text-[10px] text-[#E8C97A]">{p.origem}</span>}
    </>
  );
}
