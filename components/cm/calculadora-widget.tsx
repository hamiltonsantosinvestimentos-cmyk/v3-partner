"use client";

import React, { useState } from "react";
import { Calculator, Loader2, ArrowRightLeft } from "lucide-react";

interface CalcResult {
  valor_face: number;
  desagio_percent: number;
  custo_aquisicao: number;
  ganho_bruto: number;
  tir_anual_percent: number;
  vpl_12pct: number;
  prazo_meses: number;
}

function formatBRL(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function CalculadoraWidget() {
  const [valorFace, setValorFace] = useState("4200000");
  const [prazo, setPrazo] = useState("18");
  const [desagio, setDesagio] = useState("32");
  const [tir, setTir] = useState("");
  const [commPercent, setCommPercent] = useState("7");
  const [divisaoPartes, setDivisaoPartes] = useState("3");
  const [taxaEstruturacao, setTaxaEstruturacao] = useState("0");
  const [mode, setMode] = useState<"desagio" | "tir">("desagio");
  const [result, setResult] = useState<CalcResult | null>(null);
  const [commission, setCommission] = useState<any>(null);
  const [commissionPrecision, setCommissionPrecision] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const calculate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cm/calculator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          valor_face: Number(valorFace),
          desagio: mode === "desagio" ? Number(desagio) : null,
          tir: mode === "tir" ? Number(tir) : null,
          prazo_meses: Number(prazo),
          commission_percent: commPercent ? Number(commPercent) : null,
          divisao_partes: divisaoPartes ? Number(divisaoPartes) : null,
          taxa_estruturacao: taxaEstruturacao ? Number(taxaEstruturacao) : null,
        }),
      });
      const json = await res.json();
      if (json.financials && !json.financials.error) setResult(json.financials);
      if (json.commission) setCommission(json.commission);
      if (json.commission_precision) setCommissionPrecision(json.commission_precision);
    } catch (err) {
      console.error("[Calc]", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#12112A] border border-[#C9A84C]/20 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-[#C9A84C] font-bold text-sm">
          <Calculator size={18} /> Calculadora TIR / Deságio / VPL
        </div>
        <button
          onClick={() => setMode(mode === "desagio" ? "tir" : "desagio")}
          className="flex items-center gap-1 text-[10px] text-[#9BAFC5] border border-[#9BAFC5]/20 rounded px-2 py-1 hover:bg-[#162744]"
        >
          <ArrowRightLeft size={12} /> {mode === "desagio" ? "Calcular por TIR" : "Calcular por Deságio"}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div>
          <label className="block text-[10px] text-[#C9A84C] font-bold uppercase mb-1">Valor Face (R$)</label>
          <input
            type="number" value={valorFace} onChange={(e) => setValorFace(e.target.value)}
            className="w-full bg-[#162744] border border-[#C9A84C]/30 rounded-md px-3 py-2 text-xs text-[#F5F1E8] font-semibold"
          />
        </div>
        <div>
          <label className="block text-[10px] text-[#C9A84C] font-bold uppercase mb-1">Prazo (meses)</label>
          <input
            type="number" value={prazo} onChange={(e) => setPrazo(e.target.value)}
            className="w-full bg-[#162744] border border-[#C9A84C]/30 rounded-md px-3 py-2 text-xs text-[#F5F1E8] font-semibold"
          />
        </div>
        {mode === "desagio" ? (
          <div>
            <label className="block text-[10px] text-[#C9A84C] font-bold uppercase mb-1">Deságio (%)</label>
            <input
              type="number" value={desagio} onChange={(e) => setDesagio(e.target.value)}
              className="w-full bg-[#162744] border border-[#C9A84C]/30 rounded-md px-3 py-2 text-xs text-[#F5F1E8] font-semibold"
            />
          </div>
        ) : (
          <div>
            <label className="block text-[10px] text-[#C9A84C] font-bold uppercase mb-1">TIR (% a.a.)</label>
            <input
              type="number" value={tir} onChange={(e) => setTir(e.target.value)}
              className="w-full bg-[#162744] border border-[#C9A84C]/30 rounded-md px-3 py-2 text-xs text-[#F5F1E8] font-semibold"
            />
          </div>
        )}
        <div>
          <label className="block text-[10px] text-[#C9A84C] font-bold uppercase mb-1">Comissão (%)</label>
          <input
            type="number" value={commPercent} onChange={(e) => setCommPercent(e.target.value)}
            className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-md px-3 py-2 text-xs text-[#F5F1E8]"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={calculate} disabled={loading}
            className="w-full py-2 bg-[#C9A84C] text-[#09081A] rounded-md text-xs font-bold hover:bg-[#D4B96A] transition disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Calcular"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
        <div>
          <label className="block text-[10px] text-[#9BAFC5] font-bold uppercase mb-1">Divisão de Partes</label>
          <input
            type="number" value={divisaoPartes} onChange={(e) => setDivisaoPartes(e.target.value)}
            placeholder="3 (compra/plataforma/venda)"
            className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-md px-3 py-2 text-xs text-[#F5F1E8]"
          />
        </div>
        <div>
          <label className="block text-[10px] text-[#9BAFC5] font-bold uppercase mb-1">Taxa de Estruturação V3 (%)</label>
          <input
            type="number" value={taxaEstruturacao} onChange={(e) => setTaxaEstruturacao(e.target.value)}
            className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-md px-3 py-2 text-xs text-[#F5F1E8]"
          />
        </div>
        <div>
          <label className="block text-[10px] text-[#9BAFC5] font-bold uppercase mb-1">Diferença p/ 100% (auto)</label>
          <input
            type="text" readOnly value={commissionPrecision ? `${commissionPrecision.diferenca_para_100_percent}%` : "—"}
            className="w-full bg-[#09081A] border border-[#9BAFC5]/10 rounded-md px-3 py-2 text-xs text-[#9BAFC5] cursor-not-allowed"
          />
        </div>
      </div>

      {/* Resultado */}
      {result && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-[#9BAFC5]/10">
          <div className="bg-[#162744] rounded-lg p-3 text-center">
            <div className="text-[10px] text-[#9BAFC5]">Custo Aquisição</div>
            <div className="text-base font-bold text-[#F5F1E8]">{formatBRL(result.custo_aquisicao)}</div>
          </div>
          <div className="bg-[#162744] rounded-lg p-3 text-center">
            <div className="text-[10px] text-[#9BAFC5]">Ganho Bruto</div>
            <div className="text-base font-bold text-emerald-400">{formatBRL(result.ganho_bruto)}</div>
          </div>
          <div className="bg-[#162744] rounded-lg p-3 text-center">
            <div className="text-[10px] text-[#9BAFC5]">TIR (a.a.)</div>
            <div className="text-xl font-bold text-[#C9A84C]">{result.tir_anual_percent}%</div>
          </div>
          <div className="bg-[#162744] rounded-lg p-3 text-center">
            <div className="text-[10px] text-[#9BAFC5]">VPL (12% a.a.)</div>
            <div className="text-base font-bold text-[#C9A84C]">{formatBRL(result.vpl_12pct)}</div>
          </div>
        </div>
      )}

      {/* Comissão */}
      {commission && !commission.error && (
        <div className="flex items-center justify-center gap-6 mt-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-400 flex-wrap">
          <span>Comissão V3 ({commission.commission_total_percent}%): {formatBRL(commission.commission_total_value)}</span>
          <span className="text-[#9BAFC5]">Split: {formatBRL(commission.split_buy_value)} x 3</span>
          {commission.minimum_enforced && <span className="text-[#C9A84C]">(piso 5% aplicado)</span>}
        </div>
      )}
      {commissionPrecision && (
        <div className="flex items-center justify-center gap-6 mt-2 py-2 bg-[#162744] border border-[#9BAFC5]/10 rounded-lg text-xs text-[#F5F1E8] flex-wrap">
          <span className="text-[#9BAFC5]">Por parte ({commissionPrecision.divisao_partes}x): <strong className="text-[#F5F1E8]">{commissionPrecision.comissao_por_parte_percent}%</strong></span>
          <span className="text-[#9BAFC5]">Split por lado (compra/venda): <strong className="text-[#C9A84C]">{commissionPrecision.comissao_split_lado}%</strong></span>
        </div>
      )}
      {commission?.error && (
        <div className="mt-3 py-2 px-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
          {commission.message}
        </div>
      )}
    </div>
  );
}
