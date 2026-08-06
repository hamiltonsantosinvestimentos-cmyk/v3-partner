"use client";

import React, { useState, useEffect } from "react";
import { Calculator, Loader2, Download, History } from "lucide-react";
import type { CommissionCalculatorResult, MandatarioInputUnit, SideBreakdown } from "@/lib/commission-calculator";
import { maskCurrencyBRLInput, parseCurrencyBRLInput } from "@/lib/utils";

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

/** Input de Mandatario/Titular com toggle %/R$. Intermediarios nunca e digitado
 * (e sempre o restante automatico do lado), por isso nao tem componente proprio. */
function MandatarioField({
  label,
  unit,
  onToggleUnit,
  rawValue,
  onChangeRaw,
  fieldName,
}: {
  label: string;
  unit: MandatarioInputUnit;
  onToggleUnit: () => void;
  rawValue: string;
  onChangeRaw: (v: string) => void;
  fieldName: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] text-[#9BAFC5] font-bold uppercase mb-1">
        <span>{label}</span>
        <button type="button" onClick={onToggleUnit}
          className="text-[9px] text-[#C9A84C] border border-[#C9A84C]/30 rounded px-1.5 py-0.5 hover:bg-[#C9A84C]/10">
          {unit === "pct" ? "% do lado" : "R$"}
        </button>
      </div>
      <input
        inputMode={unit === "pct" ? "decimal" : "numeric"}
        name={fieldName}
        value={rawValue}
        placeholder={unit === "pct" ? "0" : "0,00"}
        onChange={(e) => onChangeRaw(unit === "pct" ? e.target.value : maskCurrencyBRLInput(e.target.value))}
        className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-md px-3 py-2 text-xs text-[#F5F1E8]"
      />
    </div>
  );
}

function SideTable({ title, breakdown }: { title: string; breakdown: SideBreakdown }) {
  return (
    <div className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-3">
      <div className="text-[10px] text-[#E8C97A] font-bold uppercase mb-2">{title}</div>
      <div className="grid grid-cols-3 gap-2 text-[9px] text-[#9BAFC5] uppercase font-bold mb-1 px-1">
        <span>Papel / Participante</span>
        <span className="text-right">Bruto (R$)</span>
        <span className="text-right">Líquido (R$)</span>
      </div>
      <SideRow label="Taxa de Estruturação V3" pct={breakdown.v3_share.pct_of_total} bruto={breakdown.v3_share.bruto} liquido={breakdown.v3_share.liquido} highlight />
      <SideRow label="Mandatário / Titular" pct={breakdown.mandatario.pct_of_total} bruto={breakdown.mandatario.bruto} liquido={breakdown.mandatario.liquido} />
      <SideRow label="Grupo de Intermediários" pct={breakdown.intermediarios.pct_of_total} bruto={breakdown.intermediarios.bruto} liquido={breakdown.intermediarios.liquido} />
    </div>
  );
}

function SideRow({ label, pct, bruto, liquido, highlight }: { label: string; pct: number; bruto: number; liquido: number; highlight?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-2 items-center bg-[#162744] rounded px-1 py-1.5 mb-1 text-xs">
      <div>
        <div className={highlight ? "text-[#C9A84C] font-bold" : "text-[#F5F1E8]"}>{label}</div>
        <div className="text-[9px] text-[#9BAFC5]/70">{pct}% do fee total</div>
      </div>
      <div className="text-right text-[#F5F1E8]">{formatBRL(bruto)}</div>
      <div className={`text-right font-bold ${highlight ? "text-[#C9A84C]" : "text-[#F5F1E8]"}`}>{formatBRL(liquido)}</div>
    </div>
  );
}

export function CommissionCalculatorPanel({ onClose }: Props) {
  const [dealLabel, setDealLabel] = useState("");
  const [valorFace, setValorFace] = useState("");
  const [desagio, setDesagio] = useState("0");
  const [isRecorrente, setIsRecorrente] = useState(false);
  const [meses, setMeses] = useState("1");
  const [feeTotal, setFeeTotal] = useState("5");
  const [feeV3, setFeeV3] = useState("");
  const [buySide, setBuySide] = useState("");
  const [sellSide, setSellSide] = useState("");
  const [deducao, setDeducao] = useState("6");

  const [buyMandatarioUnit, setBuyMandatarioUnit] = useState<MandatarioInputUnit>("pct");
  const [buyMandatarioRaw, setBuyMandatarioRaw] = useState("");
  const [sellMandatarioUnit, setSellMandatarioUnit] = useState<MandatarioInputUnit>("pct");
  const [sellMandatarioRaw, setSellMandatarioRaw] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<CommissionCalculatorResult | null>(null);
  const [simId, setSimId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"buy" | "sell" | null>(null);

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

  const somaSplit = (Number(buySide) || 0) + (Number(sellSide) || 0) + (Number(feeV3) || 0);
  const splitFecha = Math.abs(somaSplit - 100) < 0.01;

  function mandatarioValue(raw: string, unit: MandatarioInputUnit) {
    return unit === "pct" ? Number(raw) || 0 : parseCurrencyBRLInput(raw);
  }

  async function handleCalcular() {
    if (loading) return;
    setError(null);

    const valorFaceNum = parseCurrencyBRLInput(valorFace);
    if (!valorFace || valorFaceNum <= 0) return setError("Informe o Valor de Face.");
    if (!feeTotal || Number(feeTotal) <= 0) return setError("Informe o Fee Total da operação.");
    if (feeV3 === "") return setError("Informe o Fee V3 (a Mesa define manualmente por operação).");
    if (buySide === "" || sellSide === "") return setError("Informe o split Compra/Venda.");
    if (!splitFecha) return setError(`Compra + Venda + V3 precisa somar 100% (soma atual: ${somaSplit.toFixed(2)}%)`);
    if (buyMandatarioRaw === "") return setError("Informe o Mandatário/Titular do lado Compra.");
    if (sellMandatarioRaw === "") return setError("Informe o Mandatário/Titular do lado Venda.");

    setLoading(true);
    try {
      const res = await fetch("/api/cm/commission-calculator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deal_label: dealLabel || null,
          valor_face: valorFaceNum,
          desagio_pct: Number(desagio) || 0,
          is_recorrente: isRecorrente,
          meses_recorrencia: isRecorrente ? Number(meses) || 1 : 1,
          fee_total_pct: Number(feeTotal),
          fee_v3_pct: Number(feeV3),
          buy_side_pct: Number(buySide),
          sell_side_pct: Number(sellSide),
          buy_mandatario_input: { value: mandatarioValue(buyMandatarioRaw, buyMandatarioUnit), unit: buyMandatarioUnit },
          sell_mandatario_input: { value: mandatarioValue(sellMandatarioRaw, sellMandatarioUnit), unit: sellMandatarioUnit },
          deducao_bancaria_pct: Number(deducao) || 6,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erro ao calcular"); return; }
      setResultado(json.resultado);
      setSimId(json.id);
      setHistory((h) => [{ id: json.id, deal_label: dealLabel || null, valor_face: valorFaceNum, fee_total_pct: Number(feeTotal), is_recorrente: isRecorrente, meses_recorrencia: isRecorrente ? Number(meses) || 1 : 1, resultado: json.resultado, created_at: json.created_at }, ...h]);
    } catch {
      setError("Erro de conexão ao calcular.");
    } finally {
      setLoading(false);
    }
  }

  async function handleExportSide(side: "buy" | "sell") {
    if (!resultado || exporting) return;
    setExporting(side);
    try {
      const { renderLaminaSidePDF } = await import("@/lib/lamina-fechamento-render");
      await renderLaminaSidePDF(resultado, side, { dealLabel, simId, dataSimulacao: new Date() });
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60">
      <div className="w-full max-w-4xl bg-[#09081A] border border-[#C9A84C]/30 rounded-xl overflow-hidden flex flex-col" style={{ height: "88vh" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#9BAFC5]/10">
          <div className="flex items-center gap-2 text-[#C9A84C] font-bold text-sm">
            <Calculator size={18} /> Calculadora Rápida · Comissionamento e Lâmina de Fechamento
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExportSide("buy")}
              disabled={!resultado || !!exporting}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-[#C9A84C] border border-[#C9A84C]/30 rounded px-2.5 py-1.5 hover:bg-[#C9A84C]/10 transition disabled:opacity-30"
            >
              {exporting === "buy" ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} PDF Buy-Side
            </button>
            <button
              onClick={() => handleExportSide("sell")}
              disabled={!resultado || !!exporting}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-[#C9A84C] border border-[#C9A84C]/30 rounded px-2.5 py-1.5 hover:bg-[#C9A84C]/10 transition disabled:opacity-30"
            >
              {exporting === "sell" ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} PDF Sell-Side
            </button>
            <button onClick={onClose} className="text-[#9BAFC5] hover:text-[#F5F1E8] text-lg leading-none ml-2">&times;</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Inputs: base da operação */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
              <input type="number" name="desconto_desagio_pct" value={desagio} onChange={(e) => setDesagio(e.target.value)}
                className="w-full bg-[#162744] border border-[#C9A84C]/30 rounded-md px-3 py-2 text-xs text-[#F5F1E8] font-semibold" />
            </div>
            <div>
              <label className="block text-[10px] text-[#E8C97A] font-bold uppercase mb-1">Fee Total (%)</label>
              <input type="number" name="fee_total_pct" value={feeTotal} onChange={(e) => setFeeTotal(e.target.value)}
                className="w-full bg-[#162744] border border-[#C9A84C]/30 rounded-md px-3 py-2 text-xs text-[#F5F1E8] font-semibold" />
            </div>
          </div>

          {/* Split de topo: Compra / Venda / V3 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            <div>
              <label className="block text-[10px] text-[#9BAFC5] font-bold uppercase mb-1">Fee V3 (%) (manual por operação)</label>
              <input type="number" name="fee_v3_pct" value={feeV3} onChange={(e) => setFeeV3(e.target.value)} placeholder="Mesa define"
                className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-md px-3 py-2 text-xs text-[#F5F1E8]" />
            </div>
            <div>
              <label className="block text-[10px] text-[#9BAFC5] font-bold uppercase mb-1">Split Compra (% do fee)</label>
              <input type="number" name="buy_side_pct" value={buySide} onChange={(e) => setBuySide(e.target.value)}
                className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-md px-3 py-2 text-xs text-[#F5F1E8]" />
            </div>
            <div>
              <label className="block text-[10px] text-[#9BAFC5] font-bold uppercase mb-1">Split Venda (% do fee)</label>
              <input type="number" name="sell_side_pct" value={sellSide} onChange={(e) => setSellSide(e.target.value)}
                className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-md px-3 py-2 text-xs text-[#F5F1E8]" />
            </div>
            <div>
              <label className="block text-[10px] text-[#9BAFC5] font-bold uppercase mb-1">Dedução Bancária (%)</label>
              <input type="number" name="deducao_bancaria_pct" value={deducao} onChange={(e) => setDeducao(e.target.value)}
                className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-md px-3 py-2 text-xs text-[#F5F1E8]" />
            </div>
          </div>

          {/* Mandatario/Titular por lado. Intermediarios e sempre o restante automatico */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <MandatarioField
              label="Mandatário Compra"
              unit={buyMandatarioUnit}
              onToggleUnit={() => { setBuyMandatarioUnit((u) => (u === "pct" ? "valor" : "pct")); setBuyMandatarioRaw(""); }}
              rawValue={buyMandatarioRaw}
              onChangeRaw={setBuyMandatarioRaw}
              fieldName="buy_mandatario_input"
            />
            <MandatarioField
              label="Mandatário Venda"
              unit={sellMandatarioUnit}
              onToggleUnit={() => { setSellMandatarioUnit((u) => (u === "pct" ? "valor" : "pct")); setSellMandatarioRaw(""); }}
              rawValue={sellMandatarioRaw}
              onChangeRaw={setSellMandatarioRaw}
              fieldName="sell_mandatario_input"
            />
          </div>

          <div className="flex items-center justify-between mt-3">
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
            <span className={`text-[10px] font-bold ${splitFecha ? "text-emerald-400" : "text-[#E8C97A]"}`}>
              Compra + Venda + V3 = {somaSplit.toFixed(2)}% {splitFecha ? "✓" : "(precisa fechar 100%)"}
            </span>
          </div>

          <button onClick={handleCalcular} disabled={loading}
            className="w-full mt-3 py-2.5 bg-[#C9A84C] text-[#09081A] rounded-md text-xs font-bold hover:bg-[#D4B96A] transition disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Calcular"}
          </button>

          {error && (
            <div className="mt-3 py-2 px-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">{error}</div>
          )}

          {/* Resumo da operação */}
          {resultado && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
              <div className="bg-[#162744] rounded-lg p-3">
                <div className="text-[10px] text-[#9BAFC5]">Valor de Face</div>
                <div className="text-sm font-bold text-[#F5F1E8]">{formatBRL(resultado.operacao.valor_face)}</div>
              </div>
              <div className="bg-[#162744] rounded-lg p-3">
                <div className="text-[10px] text-[#9BAFC5]">Deságio</div>
                <div className="text-sm font-bold text-[#F5F1E8]">{resultado.operacao.desagio_pct}%</div>
              </div>
              <div className="bg-[#162744] rounded-lg p-3">
                <div className="text-[10px] text-[#9BAFC5]">Preço do Comprador</div>
                <div className="text-sm font-bold text-[#C9A84C]">{formatBRL(resultado.operacao.valor_comprador)}</div>
              </div>
              <div className="bg-[#162744] rounded-lg p-3">
                <div className="text-[10px] text-[#9BAFC5]">Fee Total</div>
                <div className="text-sm font-bold text-[#F5F1E8]">{resultado.fee.fee_total_pct}% · {formatBRL(resultado.fee.fee_total_value)}</div>
              </div>
            </div>
          )}

          {/* Tabelas por lado: nunca combinadas num unico PDF, so na tela para conferencia da Mesa */}
          {resultado && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <SideTable title="Lado Compra (Buy-Side)" breakdown={resultado.buy_side} />
              <SideTable title="Lado Venda (Sell-Side)" breakdown={resultado.sell_side} />
            </div>
          )}

          {/* Projeção acumulada da recorrência */}
          {resultado && resultado.recorrencia.is_recorrente && (
            <div className="mt-5">
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

          {/* Histórico */}
          <div className="mt-6 pt-4 border-t border-[#9BAFC5]/10">
            <div className="flex items-center gap-2 text-[10px] text-[#9BAFC5] font-bold uppercase mb-2">
              <History size={12} /> Últimas Simulações
            </div>
            {loadingHistory ? (
              <Loader2 size={14} className="animate-spin text-[#9BAFC5]" />
            ) : history.length === 0 ? (
              <div className="text-xs text-[#9BAFC5]/60">Nenhuma simulação ainda.</div>
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
