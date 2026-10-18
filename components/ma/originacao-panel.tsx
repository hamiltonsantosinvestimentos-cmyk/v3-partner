"use client";

// Aba "Originação" do modal do deal na Mesa M&A (BRIEF 2026-10-17).
// Fatia 1: Etapa 1, Ingestão e diagnóstico. Etapas 2 a 6 aparecem no stepper, ainda fechadas.

import { useCallback, useEffect, useState } from "react";
import { aviso, confirmar } from "@/lib/aviso";
import { ROTULO_LABEL, fmtDataBR, type Rotulo } from "@/lib/ma/originacao";

type Nome = { id: string; tipo: string; grafias: string[]; grafia_provavel: string | null; grafia_confirmada: string | null; status: "A_CONFIRMAR" | "CONFIRMADO" };
type Fato = { id: string; tema: string; afirmacao: string; quem_disse: string | null; rotulo: Rotulo; valor_min: number | null; valor_max: number | null; unidade: string | null; moeda: string | null; ausencia: boolean };
type Unidade = { code: string; label: string; monetaria: boolean };
type Reuniao = { id: string; title: string | null; meeting_date: string | null; ma_deal_id: string | null };
type Estado = {
  deal: { etapa: number | null; data_reuniao: string | null; decisao: string | null; reuniao_id: string | null;
    diagnostico: { dor?: string; tese?: string; gargalos?: string[]; proximos_passos?: { acao: string; responsavel?: string; prazo?: string | null }[]; extraido_em?: string; fatos_rejeitados?: unknown[] } | null };
  nomes: Nome[]; fatos: Fato[]; reunioes: Reuniao[]; unidades: Unidade[];
  gate: { ok: boolean; motivos: string[] };
};

const ETAPAS = ["Ingestão", "Benchmark", "Validação", "Relatórios", "Cenários", "Deck e proposta"];
const DECISAO: Record<string, string> = { sim: "Sim, há mandato", nao: "Não", em_conversa: "Em conversa" };

const card = "rounded-lg border border-[#162744] bg-[#13223A] p-4";
const h = "text-xs font-bold uppercase tracking-wider text-[#C9A84C]";
const muted = "text-[#9BAFC5]";
const btn = "rounded-md px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
const btnGold = `${btn} bg-[#C9A84C] text-[#09081A] hover:bg-[#E8C97A]`;
const btnLine = `${btn} border border-[#243A66] text-[#F5F1E8] hover:border-[#C9A84C]`;
const input = "rounded-md border border-[#243A66] bg-[#09081A] px-2 py-1.5 text-xs text-[#F5F1E8] outline-none focus:border-[#C9A84C]";

function Porque({ texto }: { texto: string }) {
  // Nota do porquê: hover, foco (teclado) e toque.
  return (
    <span tabIndex={0} title={texto} aria-label={texto}
      className="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-[#243A66] text-[10px] font-bold text-[#E8C97A] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
      onClick={() => aviso(texto)}>?</span>
  );
}

function fmtValor(f: Fato, unidades: Unidade[]) {
  if (f.valor_min == null || f.valor_max == null) return "";
  const nf = (v: number) => f.unidade === "moeda" && f.moeda
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: f.moeda, maximumFractionDigits: 0 }).format(v)
    : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(v);
  const u = f.unidade === "moeda" ? "" : ` ${unidades.find(x => x.code === f.unidade)?.label.toLowerCase() ?? f.unidade}`;
  const faixa = f.valor_min === f.valor_max ? nf(f.valor_min) : `${nf(f.valor_min)} a ${nf(f.valor_max)}`;
  return `${faixa}${u}${f.ausencia ? " (ausência declarada)" : ""}`;
}

export function OriginacaoPanel({ dealId }: { dealId: string }) {
  const [st, setSt] = useState<Estado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [reuniaoSel, setReuniaoSel] = useState("");
  const [dataReuniao, setDataReuniao] = useState("");
  const [grafias, setGrafias] = useState<Record<string, string>>({});
  const [novo, setNovo] = useState({ tema: "", afirmacao: "", quem_disse: "", valor_min: "", valor_max: "", unidade: "", moeda: "" });

  const api = `/api/ma/deals/${dealId}/originacao`;

  const carregar = useCallback(async () => {
    setErro(null);
    const r = await fetch(api);
    const j = await r.json();
    if (!r.ok) { setErro(j.error ?? "Erro ao carregar"); return; }
    setSt(j);
  }, [api]);

  useEffect(() => { carregar(); }, [carregar]);

  async function acao(action: string, extra: Record<string, unknown> = {}) {
    setOcupado(action);
    try {
      const r = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
      const j = await r.json();
      if (!r.ok) { aviso(j.error ?? "Erro"); return false; }
      setSt(j);
      if (action === "extrair" && j.rejeitados) aviso(`${j.rejeitados} fato(s) numérico(s) da IA reprovados na validação e não gravados.`);
      return true;
    } finally { setOcupado(null); }
  }

  async function confirmarNome(n: Nome) {
    const g = (grafias[n.id] ?? n.grafia_provavel ?? n.grafias[0] ?? "").trim();
    if (!g) { aviso("Informe a grafia correta"); return; }
    setOcupado(n.id);
    const r = await fetch(`${api}/nomes/${n.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ grafia_confirmada: g }) });
    const j = await r.json();
    setOcupado(null);
    if (!r.ok) { aviso(j.error ?? "Erro"); return; }
    carregar();
  }

  async function excluirFato(f: Fato) {
    if (!(await confirmar(`Excluir o fato "${f.tema}"? A exclusão não se desfaz.`))) return;
    const r = await fetch(`${api}/fatos/${f.id}`, { method: "DELETE" });
    const j = await r.json();
    if (!r.ok) { aviso(j.error ?? "Erro"); return; }
    carregar();
  }

  async function adicionarFato() {
    const num = (s: string) => s.trim() === "" ? null : Number(s.replace(/\./g, "").replace(",", "."));
    const temValor = novo.valor_min.trim() !== "";
    const fato = {
      tema: novo.tema, afirmacao: novo.afirmacao, quem_disse: novo.quem_disse || null, rotulo: "DECLARADO_REUNIAO",
      valor_min: temValor ? num(novo.valor_min) : null,
      valor_max: temValor ? (num(novo.valor_max) ?? num(novo.valor_min)) : null,
      unidade: temValor ? novo.unidade || null : null,
      moeda: temValor && novo.unidade === "moeda" ? novo.moeda || null : null,
      ausencia: temValor && num(novo.valor_min) === 0,
    };
    if (await acao("adicionar_fato", { fato })) setNovo({ tema: "", afirmacao: "", quem_disse: "", valor_min: "", valor_max: "", unidade: "", moeda: "" });
  }

  if (erro) return <div className={`${card} text-xs text-[#F26D6D]`}>{erro}</div>;
  if (!st) return <div className={`${card} text-xs ${muted}`}>Carregando a Originação...</div>;

  const etapa = st.deal.etapa;
  const reuniao = st.reunioes.find(r => r.id === st.deal.reuniao_id);
  const pend = st.nomes.filter(n => n.status === "A_CONFIRMAR").length;
  const congelada = (etapa ?? 0) > 1;

  return (
    <div className="space-y-3 text-[#F5F1E8]">
      {/* Stepper das 6 etapas */}
      <div className={`${card} flex flex-wrap gap-2`}>
        {ETAPAS.map((e, i) => {
          const n = i + 1;
          const atual = etapa === n, feita = (etapa ?? 0) > n;
          return (
            <div key={e} title={n > 1 ? "Etapa ainda não disponível no portal (próximas fatias do BRIEF)." : undefined}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${atual ? "bg-[#C9A84C] text-[#09081A]" : feita ? "border border-[#C9A84C] text-[#E8C97A]" : "border border-[#243A66] text-[#9BAFC5]"}`}>
              <span>{n}</span><span>{e}</span>
            </div>
          );
        })}
      </div>

      {/* Início: ligar a reunião */}
      {!etapa && (
        <div className={card}>
          <div className={h}>1. Ingestão e diagnóstico</div>
          <p className={`mt-1 text-xs ${muted}`}>Escolha a reunião gravada que deu origem a este deal e confirme a data.</p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs">
              <span>Reunião de origem<Porque texto="A transcrição desta reunião é a única fonte da ficha. Só aparecem reuniões suas sem deal e as já ligadas a este deal, da mais recente para a mais antiga." /></span>
              <select className={`${input} min-w-[320px]`} value={reuniaoSel}
                onChange={e => { setReuniaoSel(e.target.value); const r = st.reunioes.find(x => x.id === e.target.value); if (r?.meeting_date) setDataReuniao(fmtDataBR(r.meeting_date)); }}>
                <option value="">Selecione</option>
                {st.reunioes.map(r => <option key={r.id} value={r.id}>{fmtDataBR(r.meeting_date)} | {r.title ?? "Sem título"}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span>Data da reunião<Porque texto="Formato DD/MM/AAAA. Gravada como data pura, sem fuso, para nunca aparecer com um dia a menos." /></span>
              <input className={`${input} w-[120px]`} placeholder="DD/MM/AAAA" value={dataReuniao} onChange={e => setDataReuniao(e.target.value)} />
            </label>
            <button className={btnGold} disabled={!reuniaoSel || !!ocupado} onClick={() => acao("iniciar", { reuniao_id: reuniaoSel, data_reuniao: dataReuniao })}>
              {ocupado === "iniciar" ? "Ligando..." : "Ligar reunião e iniciar"}
            </button>
          </div>
          {!st.reunioes.length && <p className={`mt-2 text-xs ${muted}`}>Nenhuma reunião sua sem deal nos últimos 60 dias.</p>}
        </div>
      )}

      {etapa && (
        <>
          <div className={`${card} flex flex-wrap items-center justify-between gap-2`}>
            <div className="text-xs">
              <div className={h}>Reunião de origem</div>
              <div className="mt-1">{reuniao?.title ?? "Reunião ligada"} | {fmtDataBR(st.deal.data_reuniao)}</div>
              <div className={muted}>Decisão da reunião: {st.deal.decisao ? DECISAO[st.deal.decisao] : "não registrada"}</div>
            </div>
            {!congelada && (
              <button className={btnGold} disabled={!!ocupado} onClick={async () => {
                if (st.fatos.length && !(await confirmar("Extrair de novo substitui os fatos extraídos desta reunião e os nomes ainda não confirmados. Fatos manuais e nomes confirmados ficam. Continuar?"))) return;
                acao("extrair");
              }}>{ocupado === "extrair" ? "Extraindo (até 2 minutos)..." : st.fatos.length ? "Extrair de novo" : "Extrair diagnóstico da reunião"}</button>
            )}
          </div>

          {st.deal.diagnostico && (
            <div className={card}>
              <div className={h}>Diagnóstico<Porque texto="Gerado pela IA a partir da transcrição, sem números que não foram ditos. É rascunho para o analista revisar." /></div>
              <div className="mt-2 grid gap-2 text-xs md:grid-cols-2">
                <div><b>Dor declarada</b><p className={muted}>{st.deal.diagnostico.dor || "Não registrada"}</p></div>
                <div><b>Tese preliminar</b><p className={muted}>{st.deal.diagnostico.tese || "Não registrada"}</p></div>
                <div><b>Gargalos</b><ul className={`list-disc pl-4 ${muted}`}>{(st.deal.diagnostico.gargalos ?? []).map((g, i) => <li key={i}>{g}</li>)}</ul></div>
                <div><b>Próximos passos</b><ul className={`list-disc pl-4 ${muted}`}>{(st.deal.diagnostico.proximos_passos ?? []).map((p, i) => <li key={i}>{p.acao}{p.responsavel ? ` (${p.responsavel})` : ""}{p.prazo ? `, até ${p.prazo}` : ""}</li>)}</ul></div>
              </div>
            </div>
          )}

          {/* Nomes */}
          <div className={card}>
            <div className={h}>Nomes citados ({pend} a confirmar)<Porque texto="Grafias divergentes ficam A CONFIRMAR até um humano decidir. Nome errado em e-mail ao empresário custa mais que qualquer análise. A Etapa 2 só abre com todos confirmados." /></div>
            {!st.nomes.length && <p className={`mt-2 text-xs ${muted}`}>Nenhum nome ainda. Rode a extração.</p>}
            <div className="mt-2 space-y-2">
              {st.nomes.map(n => (
                <div key={n.id} className="flex flex-wrap items-center gap-2 border-b border-[#162744] pb-2 text-xs">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${n.status === "A_CONFIRMAR" ? "border border-[#F5B942] text-[#F5B942]" : "border border-[#4ADE80] text-[#4ADE80]"}`}>{n.status === "A_CONFIRMAR" ? "A CONFIRMAR" : "CONFIRMADO"}</span>
                  <span className={muted}>{n.tipo}</span>
                  <span>{n.grafias.join(", ")}</span>
                  {n.status === "A_CONFIRMAR" && !congelada ? (
                    <>
                      <input className={`${input} w-[200px]`} value={grafias[n.id] ?? n.grafia_provavel ?? n.grafias[0] ?? ""} onChange={e => setGrafias(p => ({ ...p, [n.id]: e.target.value }))} />
                      <button className={btnLine} disabled={ocupado === n.id} onClick={() => confirmarNome(n)}>Confirmar nome</button>
                    </>
                  ) : <b className="text-[#F5F1E8]">{n.grafia_confirmada}</b>}
                </div>
              ))}
            </div>
          </div>

          {/* Fatos */}
          <div className={card}>
            <div className={h}>Fatos da reunião ({st.fatos.length})<Porque texto="Todo fato da reunião nasce DECLARADO NA REUNIÃO. Só vira VERIFICADO com fonte e data. Números ficam guardados como valor, unidade e moeda para o teste de coerência da Etapa 3." /></div>
            {!st.fatos.length && <p className={`mt-2 text-xs ${muted}`}>Nenhum fato ainda.</p>}
            {!!st.fatos.length && (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead><tr className="text-[#E8C97A]"><th className="py-1 pr-2">Tema</th><th className="pr-2">Afirmação</th><th className="pr-2">Quem disse</th><th className="pr-2">Valor</th><th className="pr-2">Rótulo</th><th /></tr></thead>
                  <tbody>
                    {st.fatos.map(f => (
                      <tr key={f.id} className="border-t border-[#162744] align-top">
                        <td className="py-1.5 pr-2 font-bold">{f.tema}</td>
                        <td className={`pr-2 ${muted}`}>{f.afirmacao}</td>
                        <td className={`pr-2 ${muted}`}>{f.quem_disse ?? ""}</td>
                        <td className="pr-2 whitespace-nowrap">{fmtValor(f, st.unidades)}</td>
                        <td className="pr-2 whitespace-nowrap text-[10px] font-bold text-[#E8C97A]">{ROTULO_LABEL[f.rotulo]}</td>
                        <td>{!congelada && <button className="text-[10px] text-[#9BAFC5] hover:text-[#F26D6D]" onClick={() => excluirFato(f)}>Excluir</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!congelada && (
              <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-[#162744] pt-3 text-xs">
                <input className={`${input} w-[140px]`} placeholder="Tema" value={novo.tema} onChange={e => setNovo(p => ({ ...p, tema: e.target.value }))} />
                <input className={`${input} min-w-[220px] flex-1`} placeholder="Afirmação literal" value={novo.afirmacao} onChange={e => setNovo(p => ({ ...p, afirmacao: e.target.value }))} />
                <input className={`${input} w-[120px]`} placeholder="Quem disse" value={novo.quem_disse} onChange={e => setNovo(p => ({ ...p, quem_disse: e.target.value }))} />
                <input className={`${input} w-[90px]`} placeholder="Mínimo" inputMode="decimal" value={novo.valor_min} onChange={e => setNovo(p => ({ ...p, valor_min: e.target.value }))} />
                <input className={`${input} w-[90px]`} placeholder="Máximo" inputMode="decimal" value={novo.valor_max} onChange={e => setNovo(p => ({ ...p, valor_max: e.target.value }))} />
                <select className={input} value={novo.unidade} onChange={e => setNovo(p => ({ ...p, unidade: e.target.value }))}>
                  <option value="">Unidade</option>
                  {st.unidades.map(u => <option key={u.code} value={u.code}>{u.label}</option>)}
                </select>
                {novo.unidade === "moeda" && (
                  <select className={input} value={novo.moeda} onChange={e => setNovo(p => ({ ...p, moeda: e.target.value }))}>
                    <option value="">Moeda</option>
                    {["BRL", "CHF", "CNY", "EUR", "GBP", "JPY", "USD"].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                )}
                <button className={btnLine} disabled={!novo.tema || !novo.afirmacao || !!ocupado} onClick={adicionarFato}>Adicionar fato</button>
              </div>
            )}
          </div>

          {/* Gate */}
          <div className={`${card} flex flex-wrap items-center justify-between gap-2`}>
            <div className="text-xs">
              {congelada ? <span className="text-[#E8C97A]">Etapa 1 concluída. Ficha congelada.</span>
                : st.gate.ok ? <span className="text-[#4ADE80]">Pronto para avançar.</span>
                : <span className="text-[#F5B942]">Bloqueado: {st.gate.motivos.join("; ")}.</span>}
            </div>
            {!congelada && (
              <button className={btnGold} disabled={!st.gate.ok || !!ocupado} onClick={async () => {
                if (!(await confirmar("Avançar para a Etapa 2 congela a ficha da reunião (nomes e fatos ficam somente leitura). Continuar?"))) return;
                acao("avancar");
              }}>Avançar para Etapa 2</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
