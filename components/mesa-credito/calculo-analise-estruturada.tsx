"use client";

import { useCallback, useEffect, useState } from "react";
import { Calculator, Loader2, AlertTriangle, Info, CheckCircle2, Circle } from "lucide-react";
import type { CalculoSalvo } from "@/lib/analise-estruturada/calculo-pedido";

// Resultado do motor de cálculo da Análise Estruturada V3 no detalhe do pedido (Mesa):
// capacidade de pagamento, estresse, indicadores, validação cruzada e raio-X de custos.

const brl = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (v: number | null | undefined) => (v == null ? "—" : `${(v * 100).toFixed(1).replace(".", ",")}%`);
const dec = (v: number | null | undefined, sufixo = "") => (v == null ? "—" : `${v.toFixed(2).replace(".", ",")}${sufixo}`);
const dias = (v: number | null | undefined) => (v == null ? "—" : `${v} dias`);
const fmtData = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/50 p-3 space-y-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{titulo}</p>
      {children}
    </div>
  );
}

function Numero({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{rotulo}</p>
      <p className={`text-sm font-semibold ${destaque ? "text-[#E8C97A]" : "text-foreground"}`}>{valor}</p>
    </div>
  );
}

type Indicador = CalculoSalvo["indicadores"][number];
const LINHAS_INDICADORES: Array<[string, (i: Indicador) => string]> = [
  ["Receita líquida", (i) => brl(i.receitaLiquida)],
  ["EBITDA", (i) => brl(i.ebitda)],
  ["Margem bruta", (i) => pct(i.margemBruta)],
  ["Margem EBITDA", (i) => pct(i.margemEbitda)],
  ["Margem líquida", (i) => pct(i.margemLiquida)],
  ["Liquidez corrente", (i) => dec(i.liquidezCorrente)],
  ["Liquidez seca", (i) => dec(i.liquidezSeca)],
  ["Endividamento geral", (i) => pct(i.endividamentoGeral)],
  ["Dívida no curto prazo", (i) => pct(i.composicaoCurtoPrazo)],
  ["Dívida líquida ÷ EBITDA", (i) => dec(i.dividaLiquidaEbitda, "×")],
  ["EBITDA ÷ despesa financeira", (i) => dec(i.ebitdaDespesaFinanceira, "×")],
  ["Ciclo financeiro", (i) => dias(i.cicloFinanceiroDias)],
  ["Necessidade de capital de giro", (i) => brl(i.ncg)],
  ["Saldo de tesouraria", (i) => brl(i.saldoTesouraria)],
  ["Tributos a recolher", (i) => brl(i.tributosARecolher)],
];

export function CalculoAnaliseEstruturada({ orderId }: { orderId: string }) {
  const [calculo, setCalculo] = useState<CalculoSalvo | null>(null);
  const [ativo, setAtivo] = useState(false);
  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    try {
      const [rp, rc] = await Promise.all([
        fetch(`/api/analise-estruturada/pedido/${orderId}`).then((r) => r.json()),
        fetch(`/api/analise-estruturada/pedido/${orderId}/calculo`).then((r) => r.json()),
      ]);
      setAtivo(!!rp?.ativo);
      setCalculo(rc?.calculo ?? null);
    } catch { setAtivo(false); }
  }, [orderId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function calcular() {
    setCalculando(true); setErro("");
    try {
      const r = await fetch(`/api/analise-estruturada/pedido/${orderId}/calculo`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Falha no cálculo.");
      setCalculo(d.calculo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha no cálculo.");
    } finally {
      setCalculando(false);
    }
  }

  if (!ativo) return null;
  const cap = (calculo?.capacidade ?? {}) as Record<string, unknown>;
  const n = (k: string) => (typeof cap[k] === "number" ? (cap[k] as number) : null);
  const tabelaCredito = (cap.creditoMaximo as Array<{ prazoMeses: number; creditoMaximo: number }>) ?? [];
  const estresse = (cap.estresse as Array<{ cenario: string; caixaMensal: number | null; icsd: number | null }>) ?? [];

  return (
    <div className="rounded-xl border border-[#C9A84C]/30 bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Análise Estruturada V3 · indicadores e capacidade</p>
          <p className="text-sm font-semibold text-foreground">
            {calculo ? `Calculado em ${fmtData(calculo.calculadoEm)}${calculo.calculadoPor ? ` por ${calculo.calculadoPor}` : ""}` : "Ainda não calculado"}
          </p>
        </div>
        <button onClick={calcular} disabled={calculando}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-bold disabled:opacity-50">
          {calculando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calculator className="w-3.5 h-3.5" />}
          {calculo ? "Recalcular" : "Calcular"}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">Usa os números lidos e corrigidos acima. Recalcule depois de cada correção.</p>
      {erro && <p className="text-xs text-red-400">{erro}</p>}
      {calculo && calculo.arquivosNaoLidos > 0 && (
        <p className="text-xs text-amber-400">{calculo.arquivosNaoLidos} arquivo(s) ainda sem leitura ficaram fora do cálculo.</p>
      )}

      {calculo && (
        <>
          {calculo.rating && (
            <Bloco titulo="Rating V3 2.0">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="w-16 h-16 rounded-xl border-2 border-[#C9A84C] flex flex-col items-center justify-center">
                  <span className="text-2xl font-extrabold text-[#C9A84C] leading-none">{calculo.rating.faixa}</span>
                  <span className="text-[10px] text-muted-foreground">{calculo.rating.nota}/100</span>
                </div>
                <div className="flex-1 min-w-[12rem] space-y-1">
                  <p className="text-sm text-foreground">{calculo.rating.leitura}</p>
                  <p className="text-xs text-muted-foreground">
                    Confiança <strong className={calculo.rating.confianca === "alto" ? "text-[#C9A84C]" : calculo.rating.confianca === "medio" ? "text-amber-400" : "text-red-400"}>{calculo.rating.confianca === "medio" ? "média" : calculo.rating.confianca === "alto" ? "alta" : "baixa"}</strong>
                    {calculo.rating.motivosConfianca.length ? ` · ${calculo.rating.motivosConfianca.join("; ")}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Nota projetada com o plano de ação: <strong className="text-foreground">{calculo.rating.notaProjetada} ({calculo.rating.faixaProjetada})</strong>
                  </p>
                  {calculo.rating.travas.length > 0 && (
                    <p className="text-xs text-red-400">Travas (limitam a nota à faixa D): {calculo.rating.travas.join("; ")}</p>
                  )}
                </div>
              </div>
              <table className="w-full text-xs mt-2">
                <thead><tr className="text-muted-foreground"><th className="text-left font-normal">Pilar</th><th className="text-right font-normal">Peso</th><th className="text-right font-normal">Nota</th></tr></thead>
                <tbody>{calculo.rating.pilares.map((p) => (
                  <tr key={p.id} className="border-t border-border/30 align-top">
                    <td className="py-1"><span className="text-foreground">{p.nome}</span>{p.motivos.length > 0 && <><br /><span className="text-[11px] text-muted-foreground">{p.motivos.join(" · ")}</span></>}</td>
                    <td className="py-1 text-right">{p.peso}%</td>
                    <td className="py-1 text-right font-semibold text-foreground">{p.nota ?? "sem dado"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </Bloco>
          )}

          {calculo.alertas.length > 0 && (
            <Bloco titulo="Pontos de atenção">
              <ul className="space-y-1">
                {calculo.alertas.map((a, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs">
                    {a.nivel === "info" ? <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-px" />
                      : <AlertTriangle className={`w-3.5 h-3.5 shrink-0 mt-px ${a.nivel === "alto" ? "text-red-400" : "text-amber-400"}`} />}
                    <span><strong className="text-foreground">{a.tema}:</strong> <span className="text-muted-foreground">{a.texto}</span></span>
                  </li>
                ))}
              </ul>
            </Bloco>
          )}

          <Bloco titulo="Capacidade de pagamento">
            {calculo.perfil === "PJ" ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Numero rotulo={`Caixa mensal (${(cap.fonteCaixa as string) ?? "—"})`} valor={brl(n("caixaMensal"))} />
                <Numero rotulo={`Parcelas atuais (${(cap.fonteServico as string) ?? "—"})`} valor={brl(n("servicoDividaMensal"))} />
                <Numero rotulo="ICSD atual (piso 1,30)" valor={dec(n("icsdAtual"))} destaque />
                <Numero rotulo="Parcela máxima nova" valor={brl(n("parcelaMaximaNova"))} destaque />
                <Numero rotulo="EBITDA mensal" valor={brl(n("ebitdaMensal"))} />
                <Numero rotulo="Fluxo dos extratos / mês" valor={brl(n("fluxoExtratosMensal"))} />
                <Numero rotulo="Caixa ÷ EBITDA" valor={pct(n("conversaoCaixa"))} />
                <Numero rotulo="Capital de giro p/ +30 dias de prazo" valor={brl(n("capitalGiroPrazoMais30Dias"))} />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Numero rotulo="Renda mensal considerada" valor={brl(n("rendaMensal"))} />
                <Numero rotulo={`Parcelas atuais (${(cap.fonteServico as string) ?? "—"})`} valor={brl(n("servicoDividaMensal"))} />
                <Numero rotulo="Comprometimento atual" valor={pct(n("comprometimentoAtual"))} destaque />
                <Numero rotulo="Parcela máxima nova" valor={brl(n("parcelaMaximaNova"))} destaque />
                <Numero rotulo="Renda pelo IR / mês" valor={brl(n("rendaIrMensal"))} />
                <Numero rotulo="Renda comprovada / mês" valor={brl(n("rendaComprovadaMensal"))} />
                <Numero rotulo="Entradas nos extratos / mês" valor={brl(n("entradasExtratosMensal"))} />
                <Numero rotulo="Patrimônio líquido declarado" valor={brl(n("patrimonioLiquidoDeclarado"))} />
              </div>
            )}
            {tabelaCredito.length > 0 && (
              <table className="w-full text-xs mt-2">
                <thead><tr className="text-muted-foreground"><th className="text-left font-normal">Prazo</th><th className="text-right font-normal">Crédito máximo (taxa de referência {pct(calculo.premissas.taxaReferenciaMensal)} a.m.)</th></tr></thead>
                <tbody>{tabelaCredito.map((t) => (
                  <tr key={t.prazoMeses} className="border-t border-border/30"><td className="py-1">{t.prazoMeses} meses</td><td className="py-1 text-right text-foreground font-semibold">{brl(t.creditoMaximo)}</td></tr>
                ))}</tbody>
              </table>
            )}
            {estresse.length > 0 && (
              <table className="w-full text-xs mt-2">
                <thead><tr className="text-muted-foreground"><th className="text-left font-normal">Teste de estresse</th><th className="text-right font-normal">Caixa mensal</th><th className="text-right font-normal">ICSD</th></tr></thead>
                <tbody>{estresse.map((e) => (
                  <tr key={e.cenario} className="border-t border-border/30">
                    <td className="py-1">{e.cenario}</td>
                    <td className="py-1 text-right">{brl(e.caixaMensal)}</td>
                    <td className={`py-1 text-right font-semibold ${e.icsd != null && e.icsd < 1 ? "text-red-400" : e.icsd != null && e.icsd < 1.3 ? "text-amber-400" : "text-foreground"}`}>{dec(e.icsd)}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </Bloco>

          {calculo.indicadores.length > 0 && (
            <Bloco titulo={`Indicadores financeiros${calculo.crescimentoReceita != null ? ` · receita ${calculo.crescimentoReceita >= 0 ? "+" : ""}${pct(calculo.crescimentoReceita)} no ano` : ""}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-muted-foreground"><th className="text-left font-normal">Indicador</th>
                    {calculo.indicadores.map((i) => <th key={i.periodo ?? ""} className="text-right font-normal">{i.periodo}{i.parcial ? " (parcial)" : ""}</th>)}</tr></thead>
                  <tbody>{LINHAS_INDICADORES.map(([rotulo, f]) => (
                    <tr key={rotulo} className="border-t border-border/30"><td className="py-1">{rotulo}</td>
                      {calculo.indicadores.map((i) => <td key={i.periodo ?? ""} className="py-1 text-right text-foreground">{f(i)}</td>)}</tr>
                  ))}</tbody>
                </table>
              </div>
            </Bloco>
          )}

          {calculo.faturamento && (
            <Bloco titulo="Faturamento">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Numero rotulo="Total 12 meses" valor={brl(calculo.faturamento.total)} />
                <Numero rotulo="Média mensal" valor={brl(calculo.faturamento.mediaMensal)} />
                <Numero rotulo="Últimos 3 meses × 3 anteriores" valor={pct(calculo.faturamento.tendencia3m)} />
                <Numero rotulo="Maior sequência de quedas" valor={`${calculo.faturamento.maiorSequenciaQuedas} meses`} />
              </div>
            </Bloco>
          )}

          {calculo.cruzamentos.length > 0 && (
            <Bloco titulo="Validação cruzada">
              <ul className="space-y-1">
                {calculo.cruzamentos.map((c, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs">
                    {c.ok === true ? <CheckCircle2 className="w-3.5 h-3.5 text-[#C9A84C] shrink-0 mt-px" />
                      : c.ok === false ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-px" />
                      : <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-px" />}
                    <span><strong className="text-foreground">{c.cruzamento}:</strong> <span className="text-muted-foreground">{c.resultado}</span></span>
                  </li>
                ))}
              </ul>
            </Bloco>
          )}

          {calculo.raioX && (
            <Bloco titulo={`Raio-X de custos bancários · ${calculo.raioX.mesesAnalisados} meses de extrato`}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Numero rotulo="Custo projetado em 12 meses" valor={brl(calculo.raioX.projecaoAnual)} />
                <Numero rotulo="Economia potencial por ano (estimativa)" valor={brl(calculo.raioX.economiaAnualEstimada)} destaque />
                {calculo.raioX.pacoteEmMaisDeUmBanco.length > 0 && <Numero rotulo="Pacote cobrado em" valor={calculo.raioX.pacoteEmMaisDeUmBanco.join(", ")} />}
              </div>
              <table className="w-full text-xs mt-2">
                <thead><tr className="text-muted-foreground"><th className="text-left font-normal">Categoria</th><th className="text-right font-normal">12 meses</th><th className="text-right font-normal">Economia</th></tr></thead>
                <tbody>{calculo.raioX.categorias.map((c) => (
                  <tr key={c.id} className="border-t border-border/30 align-top">
                    <td className="py-1"><span className="text-foreground">{c.nome}</span> <span className="text-muted-foreground">({c.lancamentos} lanç.)</span><br /><span className="text-[11px] text-muted-foreground">{c.acao}</span></td>
                    <td className="py-1 text-right">{brl(c.projecaoAnual)}</td>
                    <td className="py-1 text-right text-[#E8C97A]">{brl(c.economiaAnualEstimada)}</td>
                  </tr>
                ))}</tbody>
              </table>
              {calculo.raioX.recorrentes.length > 0 && (
                <div className="mt-2">
                  <p className="text-[11px] text-muted-foreground mb-1">Cobranças recorrentes</p>
                  <ul className="space-y-0.5">
                    {calculo.raioX.recorrentes.slice(0, 10).map((r, i) => (
                      <li key={i} className="text-xs text-muted-foreground">
                        <span className="text-foreground">{r.descricao}</span>{r.banco ? ` · ${r.banco}` : ""} · {r.ocorrencias}× · {brl(r.valorAtual)}
                        {r.aumentou && <span className="text-amber-400"> · aumentou</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Bloco>
          )}
        </>
      )}
    </div>
  );
}
