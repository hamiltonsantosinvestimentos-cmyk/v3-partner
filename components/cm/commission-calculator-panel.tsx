"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Calculator, Loader2, Download, Lock, History, AlertTriangle } from "lucide-react";
import { calculateCommission, hasNegativeResidual, type CommissionCalculatorResult, type SideBreakdown } from "@/lib/commission-calculator";
import { maskCurrencyBRLInput, parseCurrencyBRLInput, sanitizeDecimalInput, parseDecimalInput } from "@/lib/utils";

interface SimulationRecord {
  id: string;
  deal_label: string | null;
  valor_face: number;
  fee_total_pct: number;
  is_recorrente: boolean;
  meses_recorrencia: number;
  resultado: CommissionCalculatorResult;
  created_at: string;
}

interface Props {
  onClose: () => void;
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const NEGATIVE_RESIDUAL_MSG = "Ajuste as fatias para que o saldo dos intermediários seja positivo antes de exportar o PDF";

/** Bloco de cascata de um lado: Fatia do Lado + V3 + Mandatário (manuais),
 * Intermediários sempre o resto automatico (nunca digitado, pode dar negativo). */
function SideCascadeInputs({
  title,
  fieldPrefix,
  sidePct, onSidePct,
  v3Pct, onV3Pct,
  mandatarioPct, onMandatarioPct,
  breakdown,
}: {
  title: string;
  fieldPrefix: "buy" | "sell";
  sidePct: string; onSidePct: (v: string) => void;
  v3Pct: string; onV3Pct: (v: string) => void;
  mandatarioPct: string; onMandatarioPct: (v: string) => void;
  breakdown: SideBreakdown;
}) {
  const negativo = hasNegativeResidual(breakdown);
  return (
    <div className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-3">
      <div className="text-[10px] text-[#E8C97A] font-bold uppercase mb-2">{title}</div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div>
          <label className="block text-[9px] text-[#9BAFC5] uppercase mb-1">Fatia do Lado (%)</label>
          <input type="text" inputMode="decimal" name={`${fieldPrefix}_side_pct`} value={sidePct} onChange={(e) => onSidePct(sanitizeDecimalInput(e.target.value))}
            className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
        </div>
        <div>
          <label className="block text-[9px] text-[#9BAFC5] uppercase mb-1">Taxa V3 (%)</label>
          <input type="text" inputMode="decimal" name={`${fieldPrefix}_fee_v3_pct`} value={v3Pct} onChange={(e) => onV3Pct(sanitizeDecimalInput(e.target.value))} placeholder="Mesa define"
            className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
        </div>
        <div>
          <label className="block text-[9px] text-[#9BAFC5] uppercase mb-1">Mandatário (%)</label>
          <input type="text" inputMode="decimal" name={`${fieldPrefix}_mandatario_pct`} value={mandatarioPct} onChange={(e) => onMandatarioPct(sanitizeDecimalInput(e.target.value))}
            className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-[9px] text-[#9BAFC5] uppercase font-bold mb-1 px-1">
        <span>Papel</span>
        <span className="text-right">Bruto (R$)</span>
        <span className="text-right">Líquido (R$)</span>
      </div>
      <SideRow label="Taxa de Estruturação V3" pct={breakdown.v3.pct_of_side} bruto={breakdown.v3.bruto} liquido={breakdown.v3.liquido} highlight />
      <SideRow label="Mandatário / Titular" pct={breakdown.mandatario.pct_of_side} bruto={breakdown.mandatario.bruto} liquido={breakdown.mandatario.liquido} />
      <SideRow label="Grupo de Intermediários" pct={breakdown.intermediarios.pct_of_side} bruto={breakdown.intermediarios.bruto} liquido={breakdown.intermediarios.liquido} negativo={negativo} />

      {negativo && (
        <div className="flex items-start gap-1.5 mt-2 text-[10px] text-red-400">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          <span>{NEGATIVE_RESIDUAL_MSG}</span>
        </div>
      )}
    </div>
  );
}

function SideRow({ label, pct, bruto, liquido, highlight, negativo }: { label: string; pct: number; bruto: number; liquido: number; highlight?: boolean; negativo?: boolean }) {
  const cor = negativo ? "text-red-400" : highlight ? "text-[#C9A84C]" : "text-[#F5F1E8]";
  return (
    <div className="grid grid-cols-3 gap-2 items-center bg-[#162744] rounded px-1 py-1.5 mb-1 text-xs">
      <div>
        <div className={negativo ? "text-red-400 font-bold" : highlight ? "text-[#C9A84C] font-bold" : "text-[#F5F1E8]"}>{label}</div>
        <div className="text-[9px] text-[#9BAFC5]/70">{pct}% do lado</div>
      </div>
      <div className={`text-right ${cor}`}>{formatBRL(bruto)}</div>
      <div className={`text-right font-bold ${cor}`}>{formatBRL(liquido)}</div>
    </div>
  );
}

export function CommissionCalculatorPanel({ onClose }: Props) {
  const [dealLabel, setDealLabel] = useState("");
  const [valorFace, setValorFace] = useState("");
  const [desagio, setDesagio] = useState("0");
  const [isRecorrente, setIsRecorrente] = useState(false);
  const [meses, setMeses] = useState("1");
  const [comissaoTotal, setComissaoTotal] = useState("5");
  const [deducao, setDeducao] = useState("6");

  const [buySidePct, setBuySidePct] = useState("50");
  const [buyV3Pct, setBuyV3Pct] = useState("");
  const [buyMandatarioPct, setBuyMandatarioPct] = useState("");

  const [sellSidePct, setSellSidePct] = useState("50");
  const [sellV3Pct, setSellV3Pct] = useState("");
  const [sellMandatarioPct, setSellMandatarioPct] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [simId, setSimId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"buy" | "sell" | "consolidado" | null>(null);

  const [history, setHistory] = useState<SimulationRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/cm/commission-calculator")
      .then((r) => r.json())
      .then((json) => { if (!cancelled) setHistory(json.simulations ?? []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingHistory(false); });
    return () => { cancelled = true; };
  }, []);

  const valorFaceNum = parseCurrencyBRLInput(valorFace);

  // Cascata inteira roda no navegador, sem fetch, recalculada a cada tecla.
  // Nunca bloqueia, Intermediarios pode dar negativo, so afeta os botoes
  // de exportacao (ver disabled dos 3 botoes de PDF abaixo).
  const resultado = useMemo<CommissionCalculatorResult>(() => calculateCommission({
    valor_face: valorFaceNum,
    desagio_pct: parseDecimalInput(desagio),
    is_recorrente: isRecorrente,
    meses_recorrencia: Number(meses) || 1,
    comissao_total_pct: parseDecimalInput(comissaoTotal),
    buy_side: {
      side_pct: parseDecimalInput(buySidePct),
      fee_v3_pct: parseDecimalInput(buyV3Pct),
      mandatario_pct: parseDecimalInput(buyMandatarioPct),
    },
    sell_side: {
      side_pct: parseDecimalInput(sellSidePct),
      fee_v3_pct: parseDecimalInput(sellV3Pct),
      mandatario_pct: parseDecimalInput(sellMandatarioPct),
    },
    deducao_bancaria_pct: parseDecimalInput(deducao) || 6,
  }), [valorFaceNum, desagio, isRecorrente, meses, comissaoTotal, buySidePct, buyV3Pct, buyMandatarioPct, sellSidePct, sellV3Pct, sellMandatarioPct, deducao]);

  const temDado = valorFaceNum > 0 && parseDecimalInput(comissaoTotal) > 0;
  const buyNegativo = hasNegativeResidual(resultado.buy_side);
  const sellNegativo = hasNegativeResidual(resultado.sell_side);

  async function handleSalvar() {
    if (saving || !temDado) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/cm/commission-calculator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deal_label: dealLabel || null,
          valor_face: valorFaceNum,
          desagio_pct: parseDecimalInput(desagio),
          is_recorrente: isRecorrente,
          meses_recorrencia: isRecorrente ? Number(meses) || 1 : 1,
          comissao_total_pct: parseDecimalInput(comissaoTotal),
          buy_side: { side_pct: parseDecimalInput(buySidePct), fee_v3_pct: parseDecimalInput(buyV3Pct), mandatario_pct: parseDecimalInput(buyMandatarioPct) },
          sell_side: { side_pct: parseDecimalInput(sellSidePct), fee_v3_pct: parseDecimalInput(sellV3Pct), mandatario_pct: parseDecimalInput(sellMandatarioPct) },
          deducao_bancaria_pct: parseDecimalInput(deducao) || 6,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setSaveMsg(json.error ?? "Erro ao salvar"); return; }
      setSimId(json.id);
      setSaveMsg("Simulação salva.");
      setHistory((h) => [{ id: json.id, deal_label: dealLabel || null, valor_face: valorFaceNum, fee_total_pct: parseDecimalInput(comissaoTotal), is_recorrente: isRecorrente, meses_recorrencia: isRecorrente ? Number(meses) || 1 : 1, resultado: json.resultado, created_at: json.created_at }, ...h]);
    } catch {
      setSaveMsg("Erro de conexão ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleExport(variante: "buy" | "sell" | "consolidado") {
    if (!temDado || exporting) return;
    setExporting(variante);
    try {
      const { renderLaminaPDF } = await import("@/lib/lamina-fechamento-render");
      await renderLaminaPDF(resultado, variante, { dealLabel, simId, dataSimulacao: new Date() });
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60">
      <div className="w-full max-w-5xl bg-[#09081A] border border-[#C9A84C]/30 rounded-xl overflow-hidden flex flex-col" style={{ height: "90vh" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#9BAFC5]/10">
          <div className="flex items-center gap-2 text-[#C9A84C] font-bold text-sm">
            <Calculator size={18} /> Calculadora Rápida · Comissionamento e Lâmina de Fechamento
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport("buy")}
              disabled={!temDado || !!exporting || buyNegativo}
              title={buyNegativo ? NEGATIVE_RESIDUAL_MSG : undefined}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-[#C9A84C] border border-[#C9A84C]/30 rounded px-2.5 py-1.5 hover:bg-[#C9A84C]/10 transition disabled:opacity-30"
            >
              {exporting === "buy" ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} PDF Buy-Side
            </button>
            <button
              onClick={() => handleExport("sell")}
              disabled={!temDado || !!exporting || sellNegativo}
              title={sellNegativo ? NEGATIVE_RESIDUAL_MSG : undefined}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-[#C9A84C] border border-[#C9A84C]/30 rounded px-2.5 py-1.5 hover:bg-[#C9A84C]/10 transition disabled:opacity-30"
            >
              {exporting === "sell" ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} PDF Sell-Side
            </button>
            <button
              onClick={() => handleExport("consolidado")}
              disabled={!temDado || !!exporting || buyNegativo || sellNegativo}
              title={buyNegativo || sellNegativo ? NEGATIVE_RESIDUAL_MSG : "Visão interna, mostra os dois lados juntos"}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-[#9BAFC5] border border-[#9BAFC5]/25 rounded px-2.5 py-1.5 hover:bg-[#9BAFC5]/10 hover:text-[#F5F1E8] transition disabled:opacity-30"
            >
              {exporting === "consolidado" ? <Loader2 size={12} className="animate-spin" /> : <Lock size={12} />} PDF Consolidado (Mesa V3)
            </button>
            <button onClick={onClose} className="text-[#9BAFC5] hover:text-[#F5F1E8] text-lg leading-none ml-2">&times;</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Base da operação */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="col-span-2 md:col-span-1">
              <label className="block text-[10px] text-[#E8C97A] font-bold uppercase mb-1">Identificação (opcional)</label>
              <input value={dealLabel} onChange={(e) => setDealLabel(e.target.value)} placeholder="Ex: Precatório XYZ"
                className="w-full bg-[#162744] border border-[#C9A84C]/30 rounded-md px-3 py-2 text-xs text-[#F5F1E8]" />
            </div>
            <div>
              <label className="block text-[10px] text-[#E8C97A] font-bold uppercase mb-1">Valor de Face (R$)</label>
              <input inputMode="numeric" name="face_value" value={valorFace} onChange={(e) => setValorFace(maskCurrencyBRLInput(e.target.value))}
                placeholder="0,00"
                className="w-full bg-[#162744] border border-[#C9A84C]/30 rounded-md px-3 py-2 text-xs text-[#F5F1E8] font-semibold" />
            </div>
            <div>
              <label className="block text-[10px] text-[#E8C97A] font-bold uppercase mb-1">Deságio (%)</label>
              <input type="text" inputMode="decimal" name="desconto_desagio_pct" value={desagio} onChange={(e) => setDesagio(sanitizeDecimalInput(e.target.value))}
                className="w-full bg-[#162744] border border-[#C9A84C]/30 rounded-md px-3 py-2 text-xs text-[#F5F1E8] font-semibold" />
            </div>
            <div>
              <label className="block text-[10px] text-[#E8C97A] font-bold uppercase mb-1">Comissão Total (%)</label>
              <input type="text" inputMode="decimal" name="fee_total_pct" value={comissaoTotal} onChange={(e) => setComissaoTotal(sanitizeDecimalInput(e.target.value))}
                className="w-full bg-[#162744] border border-[#C9A84C]/30 rounded-md px-3 py-2 text-xs text-[#F5F1E8] font-semibold" />
            </div>
            <div>
              <label className="block text-[10px] text-[#E8C97A] font-bold uppercase mb-1">Dedução Bancária (%)</label>
              <input type="text" inputMode="decimal" name="deducao_bancaria_pct" value={deducao} onChange={(e) => setDeducao(sanitizeDecimalInput(e.target.value))}
                className="w-full bg-[#162744] border border-[#C9A84C]/30 rounded-md px-3 py-2 text-xs text-[#F5F1E8] font-semibold" />
            </div>
          </div>

          <div className="flex items-center gap-2 mt-3">
            <label className="flex items-center gap-2 text-xs text-[#9BAFC5]">
              <input type="checkbox" name="is_recurrent" checked={isRecorrente} onChange={(e) => setIsRecorrente(e.target.checked)}
                className="accent-[#C9A84C]" />
              Operação Recorrente?
              {isRecorrente && (
                <input type="number" min={1} max={60} value={meses} onChange={(e) => setMeses(e.target.value)}
                  name="recurrence_months"
                  className="ml-2 w-16 bg-[#162744] border border-[#C9A84C]/30 rounded-md px-2 py-1 text-xs text-[#F5F1E8]" />
              )}
              {isRecorrente && <span className="text-[10px]">meses</span>}
            </label>
          </div>

          {/* Cascata por lado, tela sempre livre, sem trava de soma */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            <SideCascadeInputs
              title="Lado Compra (Buy-Side)"
              fieldPrefix="buy"
              sidePct={buySidePct} onSidePct={setBuySidePct}
              v3Pct={buyV3Pct} onV3Pct={setBuyV3Pct}
              mandatarioPct={buyMandatarioPct} onMandatarioPct={setBuyMandatarioPct}
              breakdown={resultado.buy_side}
            />
            <SideCascadeInputs
              title="Lado Venda (Sell-Side)"
              fieldPrefix="sell"
              sidePct={sellSidePct} onSidePct={setSellSidePct}
              v3Pct={sellV3Pct} onV3Pct={setSellV3Pct}
              mandatarioPct={sellMandatarioPct} onMandatarioPct={setSellMandatarioPct}
              breakdown={resultado.sell_side}
            />
          </div>

          {/* Resumo da operação */}
          {temDado && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <div className="bg-[#162744] rounded-lg p-3">
                <div className="text-[10px] text-[#9BAFC5]">Valor de Face</div>
                <div className="text-sm font-bold text-[#F5F1E8]">{formatBRL(resultado.operacao.valor_face)}</div>
              </div>
              <div className="bg-[#162744] rounded-lg p-3">
                <div className="text-[10px] text-[#9BAFC5]">Preço do Comprador</div>
                <div className="text-sm font-bold text-[#C9A84C]">{formatBRL(resultado.operacao.valor_comprador)}</div>
              </div>
              <div className="bg-[#162744] rounded-lg p-3">
                <div className="text-[10px] text-[#9BAFC5]">Comissão Total</div>
                <div className="text-sm font-bold text-[#F5F1E8]">{resultado.fee.comissao_total_pct}% · {formatBRL(resultado.fee.comissao_total_value)}</div>
              </div>
              <div className="bg-[#162744] rounded-lg p-3">
                <div className="text-[10px] text-[#9BAFC5]">Compra + Venda (fatia bruta)</div>
                <div className="text-sm font-bold text-[#F5F1E8]">{(resultado.buy_side.side_pct + resultado.sell_side.side_pct).toFixed(2)}% da comissão</div>
              </div>
            </div>
          )}

          {/* Projeção acumulada da recorrência */}
          {temDado && resultado.recorrencia.is_recorrente && (
            <div className="mt-4">
              <div className="text-[10px] text-[#E8C97A] font-bold uppercase mb-2">
                Projeção Acumulada ({resultado.recorrencia.meses_recorrencia} meses)
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[#162744] rounded-lg p-3 total-accumulated-volume">
                  <div className="text-[10px] text-[#9BAFC5]">Volume Total Acumulado</div>
                  <div className="text-sm font-bold text-[#C9A84C]">{formatBRL(resultado.recorrencia.volume_total_acumulado)}</div>
                </div>
                <div className="bg-[#162744] rounded-lg p-3">
                  <div className="text-[10px] text-[#9BAFC5]">Fee Total Acumulado</div>
                  <div className="text-sm font-bold text-[#F5F1E8]">{formatBRL(resultado.recorrencia.fee_total_acumulado)}</div>
                </div>
                <div className="bg-[#162744] rounded-lg p-3">
                  <div className="text-[10px] text-[#9BAFC5]">Lado Compra Acum. (líq.)</div>
                  <div className="text-sm font-bold text-[#F5F1E8]">{formatBRL(resultado.recorrencia.buy_side_acumulado_liquido)}</div>
                </div>
                <div className="bg-[#162744] rounded-lg p-3">
                  <div className="text-[10px] text-[#9BAFC5]">Lado Venda Acum. (líq.)</div>
                  <div className="text-sm font-bold text-[#F5F1E8]">{formatBRL(resultado.recorrencia.sell_side_acumulado_liquido)}</div>
                </div>
              </div>
            </div>
          )}

          <button onClick={handleSalvar} disabled={saving || !temDado}
            className="w-full mt-4 py-2.5 bg-[#C9A84C] text-[#09081A] rounded-md text-xs font-bold hover:bg-[#D4B96A] transition disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Salvar Simulação"}
          </button>
          {saveMsg && (
            <div className="mt-2 text-xs text-[#9BAFC5]">{saveMsg}</div>
          )}

          {/* Histórico */}
          <div className="mt-6 pt-4 border-t border-[#9BAFC5]/10">
            <div className="flex items-center gap-2 text-[10px] text-[#9BAFC5] font-bold uppercase mb-2">
              <History size={12} /> Últimas Simulações
            </div>
            {loadingHistory ? (
              <Loader2 size={14} className="animate-spin text-[#9BAFC5]" />
            ) : history.length === 0 ? (
              <div className="text-xs text-[#9BAFC5]/60">Nenhuma simulação salva ainda.</div>
            ) : (
              <div className="space-y-1.5">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center justify-between text-xs bg-[#162744] rounded-md px-3 py-2">
                    <span className="text-[#F5F1E8]">{h.deal_label || "Sem identificação"}</span>
                    <span className="text-[#9BAFC5]">{formatBRL(h.valor_face)} · fee {h.fee_total_pct}%{h.is_recorrente ? ` · ${h.meses_recorrencia}m` : ""}</span>
                    <span className="text-[#9BAFC5]/60">{new Date(h.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
