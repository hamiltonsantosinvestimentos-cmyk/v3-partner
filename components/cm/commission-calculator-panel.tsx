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

/** Bloco de cascata de um lado, no padrao da planilha operacional "Simular
 * Grades": Grupo (Cheia) → decote da Fee V3 → Grupo Líquido → decote do
 * Mandatário → Intermediários (resto automatico, nunca digitado, pode dar
 * negativo). Todo percentual aqui e SEMPRE % DIRETO da operacao (mesma
 * escala da Comissão Total), nunca % de um sub-total do lado. */
function SideCascadeInputs({
  title,
  ladoNome,
  fieldPrefix,
  sidePct, onSidePct, sidePctAuto,
  v3Pct, onV3Pct,
  mandatarioPct, onMandatarioPct,
  breakdown,
  isRecorrente,
  mesesRecorrencia,
}: {
  title: string;
  ladoNome: "Venda" | "Compra";
  fieldPrefix: "buy" | "sell";
  sidePct: string; onSidePct: (v: string) => void; sidePctAuto: number;
  v3Pct: string; onV3Pct: (v: string) => void;
  mandatarioPct: string; onMandatarioPct: (v: string) => void;
  breakdown: SideBreakdown;
  isRecorrente: boolean;
  mesesRecorrencia: number;
}) {
  const negativo = hasNegativeResidual(breakdown);
  const cols = isRecorrente ? "grid-cols-5" : "grid-cols-3";
  return (
    <div className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-3">
      <div className="text-[10px] text-[#E8C97A] font-bold uppercase mb-2">{title}</div>
      <div className="text-[9px] text-[#9BAFC5]/70 mb-2">Todo % abaixo é direto da operação (mesma escala da Comissão Total), nunca % de um sub-total.</div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div>
          <label className="block text-[9px] text-[#9BAFC5] uppercase mb-1">Grupo {ladoNome} (Cheia) (%)</label>
          <input type="text" inputMode="decimal" name={`${fieldPrefix}_side_pct`} value={sidePct} onChange={(e) => onSidePct(sanitizeDecimalInput(e.target.value))}
            placeholder={`auto: ${sidePctAuto.toFixed(2)}`}
            className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
        </div>
        <div>
          <label className="block text-[9px] text-[#9BAFC5] uppercase mb-1">Fee V3 ({ladoNome}) (%)</label>
          <input type="text" inputMode="decimal" name={`${fieldPrefix}_fee_v3_pct`} value={v3Pct} onChange={(e) => onV3Pct(sanitizeDecimalInput(e.target.value))} placeholder="Mesa define"
            className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
        </div>
        <div>
          <label className="block text-[9px] text-[#9BAFC5] uppercase mb-1">Mandatário {ladoNome} (%)</label>
          <input type="text" inputMode="decimal" name={`${fieldPrefix}_mandatario_pct`} value={mandatarioPct} onChange={(e) => onMandatarioPct(sanitizeDecimalInput(e.target.value))}
            className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
        </div>
      </div>

      <div className={`grid ${cols} gap-2 text-[9px] text-[#9BAFC5] uppercase font-bold mb-1 px-1`}>
        <span>Papel</span>
        <span className="text-right">Mensal Bruto (R$)</span>
        <span className="text-right">Mensal Líquido (R$)</span>
        {isRecorrente && <span className="text-right">Acum. Bruto ({mesesRecorrencia}m)</span>}
        {isRecorrente && <span className="text-right">Acum. Líquido ({mesesRecorrencia}m)</span>}
      </div>
      <SideRow cols={cols} isRecorrente={isRecorrente} meses={mesesRecorrencia} label={`Fee V3 (${ladoNome})`} pct={breakdown.v3.pct} bruto={breakdown.v3.bruto} liquido={breakdown.v3.liquido} acumuladoBruto={breakdown.v3.acumulado_bruto} acumuladoLiquido={breakdown.v3.acumulado_liquido} highlight />
      <SideRow cols={cols} isRecorrente={isRecorrente} meses={mesesRecorrencia} label={`Grupo ${ladoNome} Líquido (pós V3)`} pct={breakdown.grupo_liquido.pct} bruto={breakdown.grupo_liquido.bruto} liquido={breakdown.grupo_liquido.liquido} />
      <SideRow cols={cols} isRecorrente={isRecorrente} meses={mesesRecorrencia} label={`Mandatário ${ladoNome} / Titular`} pct={breakdown.mandatario.pct} bruto={breakdown.mandatario.bruto} liquido={breakdown.mandatario.liquido} acumuladoBruto={breakdown.mandatario.acumulado_bruto} acumuladoLiquido={breakdown.mandatario.acumulado_liquido} />
      <SideRow cols={cols} isRecorrente={isRecorrente} meses={mesesRecorrencia} label="Grupo de Intermediários (resto)" pct={breakdown.intermediarios.pct} bruto={breakdown.intermediarios.bruto} liquido={breakdown.intermediarios.liquido} acumuladoBruto={breakdown.intermediarios.acumulado_bruto} acumuladoLiquido={breakdown.intermediarios.acumulado_liquido} negativo={negativo} />
      <div className="border-t border-[#9BAFC5]/15 mt-1.5 pt-1.5">
        <SideRow cols={cols} isRecorrente={isRecorrente} meses={mesesRecorrencia} label={`SOMA GRUPO ${ladoNome.toUpperCase()} (CHEIA)`} pct={breakdown.side_pct} bruto={breakdown.side_bruto} liquido={breakdown.side_liquido} highlight />
      </div>

      {negativo && (
        <div className="flex items-start gap-1.5 mt-2 text-[10px] text-red-400">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          <span>{NEGATIVE_RESIDUAL_MSG}</span>
        </div>
      )}
    </div>
  );
}

function SideRow({
  cols, isRecorrente, meses, label, pct, bruto, liquido, acumuladoBruto, acumuladoLiquido, highlight, negativo,
}: {
  cols: string; isRecorrente: boolean; meses: number; label: string; pct: number; bruto: number; liquido: number;
  acumuladoBruto?: number; acumuladoLiquido?: number; highlight?: boolean; negativo?: boolean;
}) {
  const cor = negativo ? "text-red-400" : highlight ? "text-[#C9A84C]" : "text-[#F5F1E8]";
  // Fallback (Grupo Líquido/SOMA nao trazem acumulado pronto do motor, so
  // as 3 linhas de participante trazem): multiplica pelos meses direto.
  const accBruto = acumuladoBruto ?? bruto * meses;
  const accLiquido = acumuladoLiquido ?? liquido * meses;
  return (
    <div className={`grid ${cols} gap-2 items-center bg-[#162744] rounded px-1 py-1.5 mb-1 text-xs`}>
      <div>
        <div className={negativo ? "text-red-400 font-bold" : highlight ? "text-[#C9A84C] font-bold" : "text-[#F5F1E8]"}>{label}</div>
        <div className="text-[9px] text-[#9BAFC5]/70">{pct}%</div>
      </div>
      <div className={`text-right ${cor}`}>{formatBRL(bruto)}</div>
      <div className={`text-right font-bold ${cor}`}>{formatBRL(liquido)}</div>
      {isRecorrente && <div className={`text-right ${cor}`}>{formatBRL(accBruto)}</div>}
      {isRecorrente && <div className={`text-right font-bold ${cor}`}>{formatBRL(accLiquido)}</div>}
    </div>
  );
}

export function CommissionCalculatorPanel({ onClose }: Props) {
  const [dealLabel, setDealLabel] = useState("");
  const [valorFace, setValorFace] = useState("");
  const [desagio, setDesagio] = useState("0");
  const [titulares, setTitulares] = useState("0");
  const [isRecorrente, setIsRecorrente] = useState(false);
  const [meses, setMeses] = useState("1");
  const [comissaoTotal, setComissaoTotal] = useState("5");
  const [deducao, setDeducao] = useState("6");

  // Fatia do Lado vazia = auto (metade da Comissão Total, em % direto da
  // operação). A Mesa pode sobrescrever a qualquer momento, sem trava.
  const [buySidePct, setBuySidePct] = useState("");
  const [buyV3Pct, setBuyV3Pct] = useState("");
  const [buyMandatarioPct, setBuyMandatarioPct] = useState("");

  const [sellSidePct, setSellSidePct] = useState("");
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
  const comissaoTotalNum = parseDecimalInput(comissaoTotal);
  // Fatia do Lado vazia = auto (metade da Comissão Total, direto). Mesa pode
  // sobrescrever a qualquer momento digitando um valor.
  const sidePctAuto = comissaoTotalNum / 2;
  const buySidePctResolved = buySidePct === "" ? sidePctAuto : parseDecimalInput(buySidePct);
  const sellSidePctResolved = sellSidePct === "" ? sidePctAuto : parseDecimalInput(sellSidePct);

  // Cascata inteira roda no navegador, sem fetch, recalculada a cada tecla.
  // Nunca bloqueia, Intermediarios pode dar negativo, so afeta os botoes
  // de exportacao (ver disabled dos 3 botoes de PDF abaixo).
  const resultado = useMemo<CommissionCalculatorResult>(() => calculateCommission({
    valor_face: valorFaceNum,
    desagio_pct: parseDecimalInput(desagio),
    titulares_pct: parseDecimalInput(titulares),
    is_recorrente: isRecorrente,
    meses_recorrencia: Number(meses) || 1,
    comissao_total_pct: comissaoTotalNum,
    buy_side: {
      side_pct: buySidePctResolved,
      fee_v3_pct: parseDecimalInput(buyV3Pct),
      mandatario_pct: parseDecimalInput(buyMandatarioPct),
    },
    sell_side: {
      side_pct: sellSidePctResolved,
      fee_v3_pct: parseDecimalInput(sellV3Pct),
      mandatario_pct: parseDecimalInput(sellMandatarioPct),
    },
    deducao_bancaria_pct: parseDecimalInput(deducao) || 6,
  }), [valorFaceNum, desagio, titulares, isRecorrente, meses, comissaoTotalNum, buySidePctResolved, buyV3Pct, buyMandatarioPct, sellSidePctResolved, sellV3Pct, sellMandatarioPct, deducao]);

  const temDado = valorFaceNum > 0 && comissaoTotalNum > 0;
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
          titulares_pct: parseDecimalInput(titulares),
          is_recorrente: isRecorrente,
          meses_recorrencia: isRecorrente ? Number(meses) || 1 : 1,
          comissao_total_pct: comissaoTotalNum,
          buy_side: { side_pct: buySidePctResolved, fee_v3_pct: parseDecimalInput(buyV3Pct), mandatario_pct: parseDecimalInput(buyMandatarioPct) },
          sell_side: { side_pct: sellSidePctResolved, fee_v3_pct: parseDecimalInput(sellV3Pct), mandatario_pct: parseDecimalInput(sellMandatarioPct) },
          deducao_bancaria_pct: parseDecimalInput(deducao) || 6,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setSaveMsg(json.error ?? "Erro ao salvar"); return; }
      setSimId(json.id);
      setSaveMsg("Simulação salva.");
      setHistory((h) => [{ id: json.id, deal_label: dealLabel || null, valor_face: valorFaceNum, fee_total_pct: comissaoTotalNum, is_recorrente: isRecorrente, meses_recorrencia: isRecorrente ? Number(meses) || 1 : 1, resultado: json.resultado, created_at: json.created_at }, ...h]);
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
          {/* Base da operação: padrão planilha, todo % mostra o R$ correspondente ao lado */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
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
              <label className="block text-[10px] text-[#E8C97A] font-bold uppercase mb-1">% Titulares</label>
              <input type="text" inputMode="decimal" name="titulares_pct" value={titulares} onChange={(e) => setTitulares(sanitizeDecimalInput(e.target.value))}
                className="w-full bg-[#162744] border border-[#C9A84C]/30 rounded-md px-3 py-2 text-xs text-[#F5F1E8] font-semibold" />
            </div>
            <div>
              <label className="block text-[10px] text-[#E8C97A] font-bold uppercase mb-1">% Comissão Total</label>
              <input type="text" inputMode="decimal" name="fee_total_pct" value={comissaoTotal} onChange={(e) => setComissaoTotal(sanitizeDecimalInput(e.target.value))}
                className="w-full bg-[#162744] border border-[#C9A84C]/30 rounded-md px-3 py-2 text-xs text-[#F5F1E8] font-semibold" />
            </div>
            <div>
              <label className="block text-[10px] text-[#E8C97A] font-bold uppercase mb-1">% Deságio</label>
              <input type="text" inputMode="decimal" name="desconto_desagio_pct" value={desagio} onChange={(e) => setDesagio(sanitizeDecimalInput(e.target.value))}
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

          {/* Cascata por lado, tela sempre livre, sem trava de soma. Empilha
              em coluna unica quando recorrente (5 colunas na tabela precisam
              de largura cheia pra nao ficar espremido). */}
          <div className={`grid grid-cols-1 ${isRecorrente ? "" : "md:grid-cols-2"} gap-3 mt-4`}>
            <SideCascadeInputs
              title="Lado Compra (Buy-Side)"
              ladoNome="Compra"
              fieldPrefix="buy"
              sidePct={buySidePct} onSidePct={setBuySidePct} sidePctAuto={sidePctAuto}
              v3Pct={buyV3Pct} onV3Pct={setBuyV3Pct}
              mandatarioPct={buyMandatarioPct} onMandatarioPct={setBuyMandatarioPct}
              breakdown={resultado.buy_side}
              isRecorrente={isRecorrente}
              mesesRecorrencia={resultado.recorrencia.meses_recorrencia}
            />
            <SideCascadeInputs
              title="Lado Venda (Sell-Side)"
              ladoNome="Venda"
              fieldPrefix="sell"
              sidePct={sellSidePct} onSidePct={setSellSidePct} sidePctAuto={sidePctAuto}
              v3Pct={sellV3Pct} onV3Pct={setSellV3Pct}
              mandatarioPct={sellMandatarioPct} onMandatarioPct={setSellMandatarioPct}
              breakdown={resultado.sell_side}
              isRecorrente={isRecorrente}
              mesesRecorrencia={resultado.recorrencia.meses_recorrencia}
            />
          </div>

          {/* Resumo da operação: padrão planilha, todo % com o R$ do lado */}
          {temDado && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
              <div className="bg-[#162744] rounded-lg p-3">
                <div className="text-[10px] text-[#9BAFC5]">Valor de Face</div>
                <div className="text-sm font-bold text-[#F5F1E8]">{formatBRL(resultado.operacao.valor_face)}</div>
              </div>
              <div className="bg-[#162744] rounded-lg p-3">
                <div className="text-[10px] text-[#9BAFC5]">% Titulares</div>
                <div className="text-sm font-bold text-[#F5F1E8]">{resultado.operacao.titulares_pct}% · {formatBRL(resultado.operacao.titulares_bruto)}</div>
              </div>
              <div className="bg-[#162744] rounded-lg p-3">
                <div className="text-[10px] text-[#9BAFC5]">% Comissão Total</div>
                <div className="text-sm font-bold text-[#F5F1E8]">{resultado.fee.comissao_total_pct}% · {formatBRL(resultado.fee.comissao_total_value)}</div>
              </div>
              <div className="bg-[#162744] rounded-lg p-3">
                <div className="text-[10px] text-[#9BAFC5]">% Deságio</div>
                <div className="text-sm font-bold text-[#F5F1E8]">{resultado.operacao.desagio_pct}% · {formatBRL(resultado.operacao.desagio_bruto)}</div>
                <div className="text-[9px] text-[#9BAFC5]/70">Preço do Comprador: {formatBRL(resultado.operacao.valor_comprador)}</div>
              </div>
              <div className="bg-[#162744] rounded-lg p-3">
                <div className="text-[10px] text-[#9BAFC5]">Fee V3 Total (Compra + Venda)</div>
                <div className="text-sm font-bold text-[#C9A84C]">{resultado.fee.v3_total_pct}% · {formatBRL(resultado.fee.v3_total_bruto)}</div>
              </div>
              <div className="bg-[#162744] rounded-lg p-3">
                <div className="text-[10px] text-[#9BAFC5]">Compra + Venda (fatia direta)</div>
                <div className="text-sm font-bold text-[#F5F1E8]">{(resultado.buy_side.side_pct + resultado.sell_side.side_pct).toFixed(2)}% do valor de face</div>
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
