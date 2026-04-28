"use client";

import { useState, useMemo } from "react";
import { Home, Info, FileDown, DollarSign, Calendar, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Parâmetros HomeCash (derivados da planilha oficial) ────────────────────
const LTV = 0.60;                  // 60% do valor do imóvel
const ALUGUEL_RATE = 0.0070;       // 0,70% a.m. sobre VL
const TAXA_ENTRADA = 0.0642;       // 6,42% sobre VL (taxa entrada / saída)
const TAXA_MENSAL_F1 = 0.0179;     // 1,79% a.m. sobre VL (Fase 1)
const TAXA_MENSAL_F2 = 0.0096;     // 0,96% a.m. (Fase 2 — refinanciamento)
const PRAZO_F2 = 240;              // meses Fase 2 (padrão)

// ─── Helpers ────────────────────────────────────────────────────────────────
function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}
function fmtPct(v: number, dec = 2) {
  return `${(v * 100).toFixed(dec).replace(".", ",")}%`;
}

function pmtPrice(pv: number, r: number, n: number) {
  return (pv * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

// ─── Input de moeda ─────────────────────────────────────────────────────────
function CurrencyInput({
  label, value, onChange, hint,
}: {
  label: string; value: number; onChange: (v: number) => void; hint?: string;
}) {
  const [raw, setRaw] = useState(value.toLocaleString("pt-BR", { minimumFractionDigits: 0 }));
  const [focused, setFocused] = useState(false);

  const handleChange = (s: string) => {
    setRaw(s);
    const num = parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
    onChange(num);
  };

  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-bold text-[#C9A84C] uppercase tracking-wide">{label}</label>
      <div className={cn(
        "flex items-center gap-2 px-4 py-3 rounded-xl border transition-all",
        focused ? "border-[#C9A84C] bg-[#09081A]" : "border-[#243A66] bg-[#111F35]"
      )}>
        <span className="text-muted-foreground text-sm font-semibold">R$</span>
        <input
          type="text"
          inputMode="numeric"
          value={raw}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { setFocused(true); setRaw(value.toLocaleString("pt-BR", { minimumFractionDigits: 0 })); }}
          onBlur={() => { setFocused(false); setRaw(value.toLocaleString("pt-BR", { minimumFractionDigits: 0 })); }}
          className="flex-1 bg-transparent text-foreground text-lg font-bold focus:outline-none"
        />
      </div>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── Row de resultado ────────────────────────────────────────────────────────
function ResultRow({ label, value, highlight, gold }: { label: string; value: string; highlight?: boolean; gold?: boolean }) {
  return (
    <div className={cn(
      "flex justify-between items-center py-2.5 px-3 rounded-lg text-xs",
      highlight ? "bg-[#C9A84C]/10 border border-[#C9A84C]/20" : "border-b border-[#243A66]/40"
    )}>
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-bold", gold ? "text-[#C9A84C]" : "text-foreground")}>{value}</span>
    </div>
  );
}

// ─── Bloco de fase ───────────────────────────────────────────────────────────
function FaseCard({ title, badge, children }: { title: string; badge: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#0C1929] border border-[#1B3050] rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 bg-[#07101E] border-b border-[#1B3050]">
        <span className="text-[9px] font-bold bg-[#C9A84C]/20 text-[#C9A84C] border border-[#C9A84C]/30 px-2.5 py-1 rounded-full tracking-widest uppercase">{badge}</span>
        <span className="text-sm font-bold text-white">{title}</span>
      </div>
      <div className="p-4 space-y-1">{children}</div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export function HomeCashSimulator() {
  const [valorImovel, setValorImovel] = useState(2_267_333);
  const [prazoF2, setPrazoF2] = useState(PRAZO_F2);

  const sim = useMemo(() => {
    if (valorImovel < 100_000) return null;

    // Fase 1
    const vl = valorImovel * LTV;
    const aluguelMensal = vl * ALUGUEL_RATE;
    const vr12 = vl * (1 + TAXA_ENTRADA + TAXA_MENSAL_F1 * 12);
    const vr18 = vl * (1 + TAXA_ENTRADA + TAXA_MENSAL_F1 * 18);
    const custo12 = vr12 - vl;
    const custo18 = vr18 - vl;
    const pctTotal12 = custo12 / vl;
    const pctTotal18 = custo18 / vl;
    const pctMensal12 = pctTotal12 / 12;
    const pctMensal18 = pctTotal18 / 18;

    // Fase 2 — baseada em VR18
    const cetAnual = Math.pow(1 + TAXA_MENSAL_F2, 12) - 1;
    const parcelaMensal = pmtPrice(vr18, TAXA_MENSAL_F2, prazoF2);
    const totalF2 = parcelaMensal * prazoF2;
    const jurosTotalF2 = totalF2 - vr18;

    // Custo Final combinado
    const custoFinal12m = (aluguelMensal * 12 + parcelaMensal * prazoF2) / vl / (12 + prazoF2);
    const custoFinal18m = (aluguelMensal * 18 + parcelaMensal * prazoF2) / vl / (18 + prazoF2);

    return {
      vl, aluguelMensal, vr12, vr18,
      custo12, custo18, pctTotal12, pctTotal18, pctMensal12, pctMensal18,
      cetAnual, parcelaMensal, totalF2, jurosTotalF2,
      custoFinal12m, custoFinal18m,
    };
  }, [valorImovel, prazoF2]);

  const exportar = () => {
    if (!sim) return;
    const d = new Date().toLocaleDateString("pt-BR");
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Simulação HomeCash — V3 Partners</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a2e;font-size:11px;background:#fff}
  .page{max-width:720px;margin:0 auto;padding:32px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #c9a84c;padding-bottom:16px;margin-bottom:20px}
  h1{font-size:20px;font-weight:700;color:#09081a}
  .badge{background:#09081a;color:#c9a84c;font-size:9px;font-weight:700;letter-spacing:1px;padding:4px 10px;border-radius:20px}
  .section{background:#f9f8f6;border:1px solid #e5e0d5;border-radius:8px;padding:14px;margin-bottom:14px}
  .section-title{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#c9a84c;margin-bottom:10px;border-left:3px solid #c9a84c;padding-left:6px}
  .row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #ece8e0;font-size:11px}
  .row span:first-child{color:#666}
  .row span:last-child{font-weight:600}
  .highlight{background:#fdf8ed;border:1px solid #c9a84c;border-radius:6px;padding:10px;margin-bottom:10px}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}
  .footer{margin-top:20px;padding-top:10px;border-top:1px solid #e5e0d5;font-size:8.5px;color:#999}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head>
<body><div class="page">
  <div class="header">
    <div><h1>Simulação HomeCash</h1><p style="color:#666;font-size:10px;margin-top:3px">Fundo Compra — V3 Partners · ${d}</p></div>
    <div class="badge">V3 PARTNERS</div>
  </div>
  <div class="highlight">
    <div style="font-size:10px;color:#7a6a2e;margin-bottom:6px;font-weight:700">DADOS DE ENTRADA</div>
    <div class="row"><span>Valor do Imóvel</span><span style="color:#09081a;font-size:14px;font-weight:700">${fmtBRL(valorImovel)}</span></div>
    <div class="row"><span>Valor Líquido (VL) — 60% LTV</span><span>${fmtBRL(sim.vl)}</span></div>
  </div>
  <div class="grid2">
    <div class="section">
      <div class="section-title">Fase 1 — 12 Meses</div>
      <div class="row"><span>Aluguel Mensal</span><span>${fmtBRL(sim.aluguelMensal)}</span></div>
      <div class="row"><span>Valor de Recompra</span><span>${fmtBRL(sim.vr12)}</span></div>
      <div class="row"><span>Custo Total</span><span>${fmtBRL(sim.custo12)}</span></div>
      <div class="row"><span>% Total</span><span>${fmtPct(sim.pctTotal12)}</span></div>
      <div class="row"><span>% Mensal</span><span>${fmtPct(sim.pctMensal12)}</span></div>
      <div class="row"><span>% Aluguel / VL</span><span>${fmtPct(ALUGUEL_RATE)}</span></div>
    </div>
    <div class="section">
      <div class="section-title">Fase 1 — 18 Meses</div>
      <div class="row"><span>Aluguel Mensal</span><span>${fmtBRL(sim.aluguelMensal)}</span></div>
      <div class="row"><span>Valor de Recompra</span><span>${fmtBRL(sim.vr18)}</span></div>
      <div class="row"><span>Custo Total</span><span>${fmtBRL(sim.custo18)}</span></div>
      <div class="row"><span>% Total</span><span>${fmtPct(sim.pctTotal18)}</span></div>
      <div class="row"><span>% Mensal</span><span>${fmtPct(sim.pctMensal18)}</span></div>
      <div class="row"><span>% Aluguel / VL</span><span>${fmtPct(ALUGUEL_RATE)}</span></div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Fase 2 — Refinanciamento (${prazoF2} meses)</div>
    <div class="row"><span>Valor Financiado (VR18)</span><span>${fmtBRL(sim.vr18)}</span></div>
    <div class="row"><span>Taxa Mensal</span><span>${fmtPct(TAXA_MENSAL_F2)}</span></div>
    <div class="row"><span>CET Anual</span><span>${fmtPct(sim.cetAnual)}</span></div>
    <div class="row"><span>Prazo</span><span>${prazoF2} meses</span></div>
    <div class="row"><span>Parcela Mensal (PRICE)</span><span style="font-size:13px;font-weight:700;color:#09081a">${fmtBRL(sim.parcelaMensal)}</span></div>
    <div class="row"><span>Total a Pagar</span><span>${fmtBRL(sim.totalF2)}</span></div>
    <div class="row"><span>Total de Juros</span><span>${fmtBRL(sim.jurosTotalF2)}</span></div>
  </div>
  <div class="section">
    <div class="section-title">Custo Final Combinado</div>
    <div class="row"><span>Caminho 12m + ${prazoF2}m</span><span>${fmtPct(sim.custoFinal12m)} a.m.</span></div>
    <div class="row"><span>Caminho 18m + ${prazoF2}m</span><span>${fmtPct(sim.custoFinal18m)} a.m.</span></div>
  </div>
  <div class="footer">V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50 · v3partners.com.br<br>
  Simulação estimada com fins ilustrativos. Não constitui proposta formal de crédito.</div>
</div><script>window.onload=()=>window.print()</script></body></html>`;
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C9A84C] to-[#8B5E1A] flex items-center justify-center flex-shrink-0">
            <Home className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Simulador HomeCash</h1>
            <p className="text-xs text-muted-foreground">Fundo Compra — LTV 60% · Fase 1 até 18m + Fase 2 até 240m</p>
          </div>
        </div>
        {sim && (
          <button onClick={exportar}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] text-sm font-bold transition-colors flex-shrink-0">
            <FileDown className="w-4 h-4" /> Exportar PDF
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Inputs */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-5 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-[#243A66]">
              <Home className="w-4 h-4 text-[#C9A84C]" />
              <span className="text-sm font-bold text-foreground">Valor do Imóvel</span>
            </div>
            <CurrencyInput
              label="Valor do Imóvel"
              value={valorImovel}
              onChange={setValorImovel}
              hint="Mínimo: R$ 100.000"
            />
            {sim && (
              <div className="bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded-xl p-3 space-y-2">
                <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wide">Valor Líquido Liberado (60% LTV)</p>
                <p className="text-2xl font-bold text-white">{fmtBRL(sim.vl)}</p>
                <p className="text-[10px] text-muted-foreground">Fundo compra o imóvel — cliente recebe {fmtPct(LTV, 0)} do valor avaliado</p>
              </div>
            )}
          </div>

          <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#243A66]">
              <Calendar className="w-4 h-4 text-[#C9A84C]" />
              <span className="text-sm font-bold text-foreground">Fase 2 — Prazo Financiamento</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[120, 180, 240].map((p) => (
                <button key={p}
                  onClick={() => setPrazoF2(p)}
                  className={cn(
                    "py-2.5 rounded-xl text-xs font-bold transition-all",
                    prazoF2 === p
                      ? "bg-[#C9A84C] text-[#09081A] shadow shadow-[#C9A84C]/30"
                      : "bg-[#09081A] border border-[#243A66] text-muted-foreground hover:border-[#C9A84C]/40"
                  )}>
                  {p}m<br /><span className="text-[9px] opacity-70">{p / 12} anos</span>
                </button>
              ))}
            </div>
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[#C9A84C]/5 border border-[#C9A84C]/15">
              <Info className="w-3.5 h-3.5 text-[#C9A84C] flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-muted-foreground">Fase 2 financia o VR18 (recompra 18m) a <strong className="text-[#E8C97A]">0,96% a.m.</strong> — sistema PRICE</p>
            </div>
          </div>

          {/* Parâmetros */}
          <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-2 pb-3 border-b border-[#243A66]">
              <TrendingUp className="w-4 h-4 text-[#C9A84C]" />
              <span className="text-sm font-bold text-foreground">Parâmetros do Produto</span>
            </div>
            {[
              ["LTV máximo", fmtPct(LTV, 0)],
              ["Aluguel mensal", `${fmtPct(ALUGUEL_RATE)} do VL`],
              ["Taxa entrada (Fase 1)", `${fmtPct(TAXA_ENTRADA)} do VL`],
              ["Taxa mensal (Fase 1)", `${fmtPct(TAXA_MENSAL_F1)} a.m. do VL`],
              ["Taxa (Fase 2)", `${fmtPct(TAXA_MENSAL_F2)} a.m.`],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between text-xs py-1 border-b border-[#243A66]/30 last:border-0">
                <span className="text-muted-foreground">{l}</span>
                <span className="font-semibold text-[#E8C97A]">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Resultados */}
        <div className="lg:col-span-3 space-y-4">
          {sim ? (
            <>
              {/* Fase 1 — 12m */}
              <FaseCard badge="Fase 1" title="Recompra em 12 Meses">
                <ResultRow label="Aluguel Mensal" value={fmtBRL(sim.aluguelMensal)} />
                <ResultRow label="Valor de Recompra (VR12)" value={fmtBRL(sim.vr12)} gold highlight />
                <ResultRow label="Custo Total 12m" value={fmtBRL(sim.custo12)} />
                <ResultRow label="% Total 12m" value={fmtPct(sim.pctTotal12)} />
                <ResultRow label="% Mensal 12m" value={fmtPct(sim.pctMensal12)} />
                <ResultRow label="% Aluguel sobre VL" value={fmtPct(ALUGUEL_RATE)} />
              </FaseCard>

              {/* Fase 1 — 18m */}
              <FaseCard badge="Fase 1" title="Recompra em 18 Meses">
                <ResultRow label="Aluguel Mensal" value={fmtBRL(sim.aluguelMensal)} />
                <ResultRow label="Valor de Recompra (VR18)" value={fmtBRL(sim.vr18)} gold highlight />
                <ResultRow label="Custo Total 18m" value={fmtBRL(sim.custo18)} />
                <ResultRow label="% Total 18m" value={fmtPct(sim.pctTotal18)} />
                <ResultRow label="% Mensal 18m" value={fmtPct(sim.pctMensal18)} />
                <ResultRow label="% Aluguel sobre VL" value={fmtPct(ALUGUEL_RATE)} />
              </FaseCard>

              {/* Fase 2 */}
              <FaseCard badge="Fase 2" title={`Refinanciamento — ${prazoF2} meses`}>
                <ResultRow label="Valor Financiado (VR18)" value={fmtBRL(sim.vr18)} />
                <ResultRow label="Taxa Mensal" value={fmtPct(TAXA_MENSAL_F2)} />
                <ResultRow label="CET Anual" value={fmtPct(sim.cetAnual)} />
                <ResultRow label="Parcela Mensal (PRICE)" value={fmtBRL(sim.parcelaMensal)} gold highlight />
                <ResultRow label="Total a Pagar (Fase 2)" value={fmtBRL(sim.totalF2)} />
                <ResultRow label="Total de Juros (Fase 2)" value={fmtBRL(sim.jurosTotalF2)} />
              </FaseCard>

              {/* Custo Final */}
              <div className="bg-[#0C1929] border border-[#C9A84C]/30 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3.5 bg-[#07101E] border-b border-[#1B3050]">
                  <span className="text-[9px] font-bold bg-[#C9A84C]/20 text-[#C9A84C] border border-[#C9A84C]/30 px-2.5 py-1 rounded-full tracking-widest uppercase">Custo Final</span>
                  <span className="text-sm font-bold text-white">Custo Mensal Combinado (Fase 1 + Fase 2)</span>
                </div>
                <div className="grid grid-cols-2 gap-0 divide-x divide-[#1B3050] p-0">
                  {[
                    { label: `12m + ${prazoF2}m`, value: fmtPct(sim.custoFinal12m), total: 12 + prazoF2 },
                    { label: `18m + ${prazoF2}m`, value: fmtPct(sim.custoFinal18m), total: 18 + prazoF2 },
                  ].map((item) => (
                    <div key={item.label} className="p-5 text-center">
                      <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Total {item.label}</p>
                      <p className="text-2xl font-bold text-[#C9A84C]">{item.value}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">a.m. sobre VL · {item.total} meses</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#09081A] border border-[#243A66]">
                <Info className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Simulação estimada com base nos parâmetros padrão do produto HomeCash. Valores sujeitos à avaliação do imóvel, análise jurídica e aprovação do fundo.
                  <strong className="text-foreground"> Consulte um assessor V3 Partners para proposta formal.</strong>
                </p>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm bg-[#0C1929] border border-[#1B3050] rounded-2xl">
              Informe o valor do imóvel para simular
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
