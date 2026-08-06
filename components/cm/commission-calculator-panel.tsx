"use client";

import React, { useState, useEffect } from "react";
import { Calculator, Loader2, Download, Image as ImageIcon, History } from "lucide-react";
import type { CommissionCalculatorResult } from "@/lib/commission-calculator";
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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<CommissionCalculatorResult | null>(null);
  const [simId, setSimId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "png" | null>(null);

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

  async function handleCalcular() {
    if (loading) return;
    setError(null);

    const valorFaceNum = parseCurrencyBRLInput(valorFace);
    if (!valorFace || valorFaceNum <= 0) return setError("Informe o Valor de Face.");
    if (!feeTotal || Number(feeTotal) <= 0) return setError("Informe o Fee Total da operação.");
    if (feeV3 === "") return setError("Informe o Fee V3 (a Mesa define manualmente por operação).");
    if (buySide === "" || sellSide === "") return setError("Informe o split Compra/Venda.");
    if (!splitFecha) return setError(`Compra + Venda + V3 precisa somar 100% (soma atual: ${somaSplit.toFixed(2)}%)`);

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

  async function handleExportPDF() {
    if (!resultado || exporting) return;
    setExporting("pdf");
    try {
      const { renderLaminaPDF } = await import("@/lib/lamina-fechamento-render");
      await renderLaminaPDF(resultado, { dealLabel, simId, dataSimulacao: new Date() });
    } finally {
      setExporting(null);
    }
  }

  async function handleExportPNG() {
    if (!resultado || exporting) return;
    setExporting("png");
    try {
      const { renderLaminaPNG } = await import("@/lib/lamina-fechamento-render");
      await renderLaminaPNG(resultado, { dealLabel, simId, dataSimulacao: new Date() });
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
              onClick={handleExportPDF}
              disabled={!resultado || !!exporting}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-[#C9A84C] border border-[#C9A84C]/30 rounded px-2.5 py-1.5 hover:bg-[#C9A84C]/10 transition disabled:opacity-30"
            >
              {exporting === "pdf" ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Salvar PDF
            </button>
            <button
              onClick={handleExportPNG}
              disabled={!resultado || !!exporting}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-[#9BAFC5] border border-[#9BAFC5]/20 rounded px-2.5 py-1.5 hover:bg-[#9BAFC5]/10 hover:text-[#F5F1E8] transition disabled:opacity-30"
            >
              {exporting === "png" ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />} Gerar Imagem
            </button>
            <button onClick={onClose} className="text-[#9BAFC5] hover:text-[#F5F1E8] text-lg leading-none ml-2">&times;</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Inputs */}
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

          {/* Tabela A: Operação Mensal / Pontual */}
          {resultado && (
            <div className="mt-5">
              <div className="text-[10px] text-[#E8C97A] font-bold uppercase mb-2">Tabela A: Operação Mensal / Pontual</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Stat label="Valor de Face" value={formatBRL(resultado.operacao.valor_face)} />
                <Stat label="Deságio" value={`${resultado.operacao.desagio_pct}%`} />
                <Stat label="Preço do Comprador" value={formatBRL(resultado.operacao.valor_comprador)} highlight />
                <Stat label="Fee Total" value={`${resultado.split.fee_total_pct}% · ${formatBRL(resultado.split.fee_total_value)}`} />
                <Stat label="Grupo Compra (líquido)" value={formatBRL(resultado.split.grupo_compra.liquido)} sub={`${resultado.split.grupo_compra.pct}% do fee`} />
                <Stat label="Grupo Venda (líquido)" value={formatBRL(resultado.split.grupo_venda.liquido)} sub={`${resultado.split.grupo_venda.pct}% do fee`} />
                <Stat label="V3 Partners (líquido)" value={formatBRL(resultado.split.v3_partners.liquido)} sub={`${resultado.split.v3_partners.pct}% do fee`} highlight />
                <Stat label="Dedução Bancária" value={`${resultado.split.deducao_bancaria_pct}%`} />
              </div>
            </div>
          )}

          {/* Tabela B: Projeção Acumulada da Recorrência */}
          {resultado && resultado.recorrencia.is_recorrente && (
            <div className="mt-5">
              <div className="text-[10px] text-[#E8C97A] font-bold uppercase mb-2">
                Tabela B: Projeção Acumulada ({resultado.recorrencia.meses_recorrencia} meses)
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Volume Total Acumulado" value={formatBRL(resultado.recorrencia.volume_total_acumulado)} highlight className="total-accumulated-volume" />
                <Stat label="Fee Total Acumulado" value={formatBRL(resultado.recorrencia.fee_total_acumulado)} />
                <Stat label="Grupo Compra Acum. (líq.)" value={formatBRL(resultado.recorrencia.grupo_compra_acumulado_liquido)} />
                <Stat label="Grupo Venda Acum. (líq.)" value={formatBRL(resultado.recorrencia.grupo_venda_acumulado_liquido)} />
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

function Stat({ label, value, sub, highlight, className }: { label: string; value: string; sub?: string; highlight?: boolean; className?: string }) {
  return (
    <div className={`bg-[#162744] rounded-lg p-3 ${className ?? ""}`}>
      <div className="text-[10px] text-[#9BAFC5]">{label}</div>
      <div className={`text-sm font-bold ${highlight ? "text-[#C9A84C]" : "text-[#F5F1E8]"}`}>{value}</div>
      {sub && <div className="text-[9px] text-[#9BAFC5]/70">{sub}</div>}
    </div>
  );
}
