"use client";

import { useState, useMemo } from "react";
import { Home, Info, FileDown, Calendar, TrendingUp, ChevronDown, ChevronUp, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Parâmetros HomeCash (derivados da planilha oficial) ────────────────────
const LTV            = 0.60;    // 60% do valor do imóvel
const ALUGUEL_RATE   = 0.0070;  // 0,70% a.m. sobre VL
const TAXA_ENTRADA   = 0.0642;  // 6,42% sobre VL (taxa entrada — Fase 1)
const TAXA_MENSAL_F1 = 0.0179;  // 1,79% a.m. sobre VL (Fase 1)
const TAXA_DEFAULT_F2 = 0.96;   // % a.m. padrão Financiamento Imobiliário (Fase 2)

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const fmtPct = (v: number, dec = 2) =>
  `${(v * 100).toFixed(dec).replace(".", ",")}%`;

// PRICE (parcela fixa)
function calcPRICE(pv: number, r: number, n: number) {
  const pmt = (pv * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  let saldo = pv;
  const rows = [];
  for (let i = 1; i <= n; i++) {
    const juros = saldo * r;
    const amort = pmt - juros;
    saldo = Math.max(saldo - amort, 0);
    rows.push({ parcela: pmt, amort, juros, saldo });
  }
  return { parcela: pmt, totalPago: pmt * n, totalJuros: pmt * n - pv, rows };
}

// SAC (amortização constante)
function calcSAC(pv: number, r: number, n: number) {
  const amort = pv / n;
  let saldo = pv;
  const rows = [];
  for (let i = 1; i <= n; i++) {
    const juros = saldo * r;
    const parcela = amort + juros;
    saldo = Math.max(saldo - amort, 0);
    rows.push({ parcela, amort, juros, saldo });
  }
  const totalPago = rows.reduce((s, r) => s + r.parcela, 0);
  return { primeiraParc: rows[0].parcela, ultimaParc: rows[n - 1].parcela, totalPago, totalJuros: totalPago - pv, rows };
}

// ─── CurrencyInput ────────────────────────────────────────────────────────────
function CurrencyInput({ label, value, onChange, hint }: {
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
      <div className={cn("flex items-center gap-2 px-4 py-3 rounded-xl border transition-all",
        focused ? "border-[#C9A84C] bg-[#09081A]" : "border-[#243A66] bg-[#111F35]")}>
        <span className="text-muted-foreground text-sm font-semibold">R$</span>
        <input type="text" inputMode="numeric" value={raw}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { setFocused(true); setRaw(value.toLocaleString("pt-BR", { minimumFractionDigits: 0 })); }}
          onBlur={() => { setFocused(false); setRaw(value.toLocaleString("pt-BR", { minimumFractionDigits: 0 })); }}
          className="flex-1 bg-transparent text-foreground text-lg font-bold focus:outline-none" />
      </div>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── ResultRow ───────────────────────────────────────────────────────────────
function ResultRow({ label, value, gold, highlight }: { label: string; value: string; gold?: boolean; highlight?: boolean }) {
  return (
    <div className={cn("flex justify-between items-center py-2.5 px-3 rounded-lg text-xs",
      highlight ? "bg-[#C9A84C]/10 border border-[#C9A84C]/20" : "border-b border-[#243A66]/40 last:border-0")}>
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-bold", gold ? "text-[#C9A84C]" : "text-foreground")}>{value}</span>
    </div>
  );
}

// ─── FaseCard ────────────────────────────────────────────────────────────────
function FaseCard({ badge, title, children }: { badge: string; title: string; children: React.ReactNode }) {
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

// ─── Tab ──────────────────────────────────────────────────────────────────────
function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("flex-1 py-2 text-xs font-bold rounded-lg transition-all",
      active ? "bg-[#C9A84C] text-[#09081A] shadow" : "text-muted-foreground hover:text-foreground bg-[#09081A]")}>
      {children}
    </button>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export function HomeCashSimulator() {
  const [valorImovel, setValorImovel]   = useState(2_267_333);
  const [prazoF2, setPrazoF2]           = useState(240);
  const [sistemaF2, setSistemaF2]       = useState<"PRICE" | "SAC">("PRICE");
  const [taxaF2, setTaxaF2]             = useState(TAXA_DEFAULT_F2); // % a.m.
  const [showTabela, setShowTabela]     = useState(false);
  const [prazoCustom, setPrazoCustom]   = useState("");

  const taxaF2Dec = taxaF2 / 100;
  const cetAnual  = Math.pow(1 + taxaF2Dec, 12) - 1;

  const sim = useMemo(() => {
    if (valorImovel < 100_000) return null;

    // Fase 1
    const vl           = valorImovel * LTV;
    const aluguelMensal = vl * ALUGUEL_RATE;
    const vr12         = vl * (1 + TAXA_ENTRADA + TAXA_MENSAL_F1 * 12);
    const vr18         = vl * (1 + TAXA_ENTRADA + TAXA_MENSAL_F1 * 18);
    const custo12      = vr12 - vl;
    const custo18      = vr18 - vl;
    const pctTotal12   = custo12 / vl;
    const pctTotal18   = custo18 / vl;
    const pctMensal12  = pctTotal12 / 12;
    const pctMensal18  = pctTotal18 / 18;

    // Fase 2 — Financiamento Imobiliário sobre VR18
    const price = calcPRICE(vr18, taxaF2Dec, prazoF2);
    const sac   = calcSAC(vr18, taxaF2Dec, prazoF2);

    const f2Selected = sistemaF2 === "PRICE" ? price : sac;
    const parcelaMensal = sistemaF2 === "PRICE" ? price.parcela : sac.primeiraParc;

    // Custo Final combinado: (total saído Fase1 + total saído Fase2) / VL / meses totais
    const totalSaidoF2  = f2Selected.totalPago;
    const custoFinal12m = (aluguelMensal * 12 + totalSaidoF2) / vl / (12 + prazoF2);
    const custoFinal18m = (aluguelMensal * 18 + totalSaidoF2) / vl / (18 + prazoF2);

    return { vl, aluguelMensal, vr12, vr18, custo12, custo18, pctTotal12, pctTotal18,
      pctMensal12, pctMensal18, price, sac, f2Selected, parcelaMensal, custoFinal12m, custoFinal18m };
  }, [valorImovel, prazoF2, taxaF2Dec, sistemaF2]);

  // Exportar PDF
  const exportar = () => {
    if (!sim) return;
    const d = new Date().toLocaleDateString("pt-BR");
    const sistema = sistemaF2;
    const parcelaInicial = sistemaF2 === "SAC" ? sim.sac.primeiraParc : sim.price.parcela;
    const parcelaFinal   = sistemaF2 === "SAC" ? sim.sac.ultimaParc   : sim.price.parcela;
    const totalF2        = sistemaF2 === "SAC" ? sim.sac.totalPago    : sim.price.totalPago;
    const jurosF2        = sistemaF2 === "SAC" ? sim.sac.totalJuros   : sim.price.totalJuros;

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Simulação HomeCash — V3 Partners</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a2e;font-size:11px;background:#fff}
  .page{max-width:720px;margin:0 auto;padding:32px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #c9a84c;padding-bottom:16px;margin-bottom:20px}
  h1{font-size:20px;font-weight:700;color:#09081a}.badge{background:#09081a;color:#c9a84c;font-size:9px;font-weight:700;letter-spacing:1px;padding:4px 10px;border-radius:20px}
  .section{background:#f9f8f6;border:1px solid #e5e0d5;border-radius:8px;padding:14px;margin-bottom:14px}
  .section-title{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#c9a84c;margin-bottom:10px;border-left:3px solid #c9a84c;padding-left:6px}
  .row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #ece8e0;font-size:11px}
  .row span:first-child{color:#666}.row span:last-child{font-weight:600}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}
  .highlight{background:#fdf8ed;border:1px solid #c9a84c;border-radius:6px;padding:10px;margin-bottom:10px}
  .footer{margin-top:20px;padding-top:10px;border-top:1px solid #e5e0d5;font-size:8.5px;color:#999}
  table{width:100%;border-collapse:collapse;font-size:9px}th{background:#09081a;color:#c9a84c;padding:6px 8px;text-align:right}th:first-child{text-align:center}
  td{padding:4px 8px;text-align:right;border-bottom:1px solid #ece8e0}td:first-child{text-align:center;color:#666}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head>
<body><div class="page">
  <div class="header">
    <div><h1>Simulação HomeCash</h1><p style="color:#666;font-size:10px;margin-top:3px">Fundo Compra — V3 Partners · ${d}</p></div>
    <div class="badge">V3 PARTNERS</div>
  </div>
  <div class="highlight">
    <div style="font-size:10px;color:#7a6a2e;margin-bottom:6px;font-weight:700">DADOS DE ENTRADA</div>
    <div class="row"><span>Valor do Imóvel</span><span style="font-size:14px;font-weight:700;color:#09081a">${fmtBRL(valorImovel)}</span></div>
    <div class="row"><span>Valor Líquido (VL) — 60% LTV</span><span>${fmtBRL(sim.vl)}</span></div>
    <div class="row"><span>Financiamento Imobiliário — Sistema</span><span>${sistema} · ${prazoF2} meses · ${fmtPct(taxaF2Dec)} a.m.</span></div>
  </div>
  <div class="grid2">
    <div class="section">
      <div class="section-title">Fase 1 — 12 Meses</div>
      <div class="row"><span>Aluguel Mensal</span><span>${fmtBRL(sim.aluguelMensal)}</span></div>
      <div class="row"><span>Valor de Recompra (VR12)</span><span>${fmtBRL(sim.vr12)}</span></div>
      <div class="row"><span>Custo Total</span><span>${fmtBRL(sim.custo12)}</span></div>
      <div class="row"><span>% Total / % Mensal</span><span>${fmtPct(sim.pctTotal12)} / ${fmtPct(sim.pctMensal12)}</span></div>
    </div>
    <div class="section">
      <div class="section-title">Fase 1 — 18 Meses</div>
      <div class="row"><span>Aluguel Mensal</span><span>${fmtBRL(sim.aluguelMensal)}</span></div>
      <div class="row"><span>Valor de Recompra (VR18)</span><span>${fmtBRL(sim.vr18)}</span></div>
      <div class="row"><span>Custo Total</span><span>${fmtBRL(sim.custo18)}</span></div>
      <div class="row"><span>% Total / % Mensal</span><span>${fmtPct(sim.pctTotal18)} / ${fmtPct(sim.pctMensal18)}</span></div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">Fase 2 — Financiamento Imobiliário (${sistema} · ${prazoF2} meses · ${fmtPct(taxaF2Dec)} a.m.)</div>
    <div class="row"><span>Valor Financiado (VR18)</span><span>${fmtBRL(sim.vr18)}</span></div>
    <div class="row"><span>CET Anual</span><span>${fmtPct(cetAnual)}</span></div>
    <div class="row"><span>Parcela Inicial</span><span style="font-size:13px;font-weight:700;color:#09081a">${fmtBRL(parcelaInicial)}</span></div>
    ${sistema === "SAC" ? `<div class="row"><span>Parcela Final</span><span>${fmtBRL(parcelaFinal)}</span></div>` : ""}
    <div class="row"><span>Total a Pagar</span><span>${fmtBRL(totalF2)}</span></div>
    <div class="row"><span>Total de Juros</span><span>${fmtBRL(jurosF2)}</span></div>
  </div>
  <div class="section">
    <div class="section-title">Custo Final Combinado (a.m. sobre VL)</div>
    <div class="row"><span>Caminho 12m + ${prazoF2}m</span><span>${fmtPct(sim.custoFinal12m)}</span></div>
    <div class="row"><span>Caminho 18m + ${prazoF2}m</span><span>${fmtPct(sim.custoFinal18m)}</span></div>
  </div>
  <div class="section">
    <div class="section-title">Tabela de Amortização — ${sistema} (primeiros 24 meses)</div>
    <table>
      <thead><tr><th>#</th><th>Parcela</th><th>Amortização</th><th>Juros</th><th>Saldo Devedor</th></tr></thead>
      <tbody>
        ${sim.f2Selected.rows.slice(0, 24).map((row, i) =>
          `<tr style="background:${i % 2 === 0 ? "#f9f8f6" : "#fff"}">
            <td style="text-align:center">${i + 1}</td>
            <td>${fmtBRL(row.parcela)}</td>
            <td>${fmtBRL(row.amort)}</td>
            <td>${fmtBRL(row.juros)}</td>
            <td>${fmtBRL(row.saldo)}</td>
          </tr>`
        ).join("")}
      </tbody>
    </table>
  </div>
  <div class="footer">V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50 · v3partners.com.br<br>
  Simulação estimada com fins ilustrativos. Não constitui proposta formal de crédito.</div>
</div><script>window.onload=()=>window.print()</script></body></html>`;
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
  };

  const prazoOptions = [120, 180, 240, 300, 360];

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
            <p className="text-xs text-muted-foreground">Fundo Compra — LTV 60% · Fase 1 (até 18m) + Fase 2 Financiamento Imobiliário</p>
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
        {/* ─── Inputs ─── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Imóvel */}
          <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-5 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-[#243A66]">
              <Home className="w-4 h-4 text-[#C9A84C]" />
              <span className="text-sm font-bold text-foreground">Valor do Imóvel</span>
            </div>
            <CurrencyInput label="Valor do Imóvel" value={valorImovel} onChange={setValorImovel} hint="Mínimo: R$ 100.000" />
            {sim && (
              <div className="bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded-xl p-3 space-y-1">
                <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wide">Valor Líquido Liberado (60% LTV)</p>
                <p className="text-2xl font-bold text-white">{fmtBRL(sim.vl)}</p>
                <p className="text-[10px] text-muted-foreground">Fundo compra o imóvel e libera 60% ao cliente</p>
              </div>
            )}
          </div>

          {/* Fase 2 — Financiamento Imobiliário */}
          <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#243A66]">
              <Calendar className="w-4 h-4 text-[#C9A84C]" />
              <span className="text-sm font-bold text-foreground">Fase 2 — Financiamento Imobiliário</span>
            </div>

            {/* Prazo */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-[#C9A84C] uppercase tracking-wide">Prazo</label>
              <div className="grid grid-cols-5 gap-1.5">
                {prazoOptions.map((p) => (
                  <button key={p} onClick={() => setPrazoF2(p)}
                    className={cn("py-2 rounded-xl text-[10px] font-bold transition-all",
                      prazoF2 === p
                        ? "bg-[#C9A84C] text-[#09081A] shadow shadow-[#C9A84C]/30"
                        : "bg-[#09081A] border border-[#243A66] text-muted-foreground hover:border-[#C9A84C]/40")}>
                    {p}m<br /><span className="opacity-70">{p / 12}a</span>
                  </button>
                ))}
              </div>
              {/* Prazo customizado */}
              <div className="flex items-center gap-2">
                <input
                  type="number" min={12} max={360} placeholder="Outro prazo (meses)"
                  value={prazoCustom}
                  onChange={(e) => {
                    setPrazoCustom(e.target.value);
                    const v = parseInt(e.target.value);
                    if (v >= 12 && v <= 360) setPrazoF2(v);
                  }}
                  className="flex-1 h-8 px-3 text-xs bg-[#09081A] border border-[#243A66] rounded-lg text-foreground focus:outline-none focus:border-[#C9A84C]/50 placeholder:text-muted-foreground"
                />
                <span className="text-[10px] text-muted-foreground">12–360 meses</span>
              </div>
            </div>

            {/* Taxa */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-[#C9A84C] uppercase tracking-wide">Taxa Mensal</label>
                <span className="text-sm font-bold text-foreground">{taxaF2.toFixed(2).replace(".", ",")}% a.m.</span>
              </div>
              <div className="relative h-2 bg-[#243A66] rounded-full">
                <div className="absolute h-2 rounded-full bg-gradient-to-r from-[#C9A84C] to-[#E8C97A]"
                  style={{ width: `${((taxaF2 - 0.5) / (1.8 - 0.5)) * 100}%` }} />
                <input type="range" min={0.5} max={1.8} step={0.01} value={taxaF2}
                  onChange={(e) => setTaxaF2(parseFloat(e.target.value))}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer h-2" />
                <div className="absolute w-4 h-4 rounded-full bg-[#C9A84C] border-2 border-white shadow-md top-1/2 -translate-y-1/2 -translate-x-1/2"
                  style={{ left: `${((taxaF2 - 0.5) / (1.8 - 0.5)) * 100}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0,50%</span>
                <span className="text-[#C9A84C]">CET: {fmtPct(cetAnual)} a.a.</span>
                <span>1,80%</span>
              </div>
            </div>

            {/* Sistema */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-[#C9A84C] uppercase tracking-wide">Sistema de Amortização</label>
              <div className="flex gap-1 p-1 bg-[#09081A] rounded-xl">
                <Tab active={sistemaF2 === "PRICE"} onClick={() => setSistemaF2("PRICE")}>PRICE</Tab>
                <Tab active={sistemaF2 === "SAC"} onClick={() => setSistemaF2("SAC")}>SAC</Tab>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {sistemaF2 === "PRICE"
                  ? "Parcelas fixas durante todo o contrato."
                  : "Parcelas decrescentes — amortização constante. Paga menos juros total."}
              </p>
            </div>

            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[#C9A84C]/5 border border-[#C9A84C]/15">
              <Info className="w-3.5 h-3.5 text-[#C9A84C] flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-muted-foreground">Fase 2 financia o <strong className="text-[#E8C97A]">VR18</strong> (valor de recompra em 18m) via Financiamento Imobiliário</p>
            </div>
          </div>

          {/* Parâmetros Fase 1 */}
          <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-2 pb-3 border-b border-[#243A66]">
              <TrendingUp className="w-4 h-4 text-[#C9A84C]" />
              <span className="text-sm font-bold text-foreground">Parâmetros HomeCash</span>
            </div>
            {[
              ["LTV máximo", fmtPct(LTV, 0)],
              ["Aluguel mensal (Fase 1)", `${fmtPct(ALUGUEL_RATE)} do VL`],
              ["Taxa entrada (Fase 1)", `${fmtPct(TAXA_ENTRADA)} do VL`],
              ["Taxa mensal (Fase 1)", `${fmtPct(TAXA_MENSAL_F1)} a.m. do VL`],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between text-xs py-1.5 border-b border-[#243A66]/30 last:border-0">
                <span className="text-muted-foreground">{l}</span>
                <span className="font-semibold text-[#E8C97A]">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Resultados ─── */}
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

              {/* Fase 2 — Financiamento Imobiliário */}
              <div className="bg-[#0C1929] border border-[#1B3050] rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3.5 bg-[#07101E] border-b border-[#1B3050]">
                  <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full tracking-widest uppercase">Fase 2</span>
                  <span className="text-sm font-bold text-white">Financiamento Imobiliário — {sistemaF2} · {prazoF2} meses</span>
                </div>
                <div className="p-4 space-y-1">
                  <ResultRow label="Valor Financiado (VR18)" value={fmtBRL(sim.vr18)} />
                  <ResultRow label="Taxa Mensal" value={`${fmtPct(taxaF2Dec)} a.m.`} />
                  <ResultRow label="CET Anual" value={fmtPct(cetAnual)} />
                  <ResultRow label="Prazo" value={`${prazoF2} meses (${(prazoF2 / 12).toFixed(0)} anos)`} />
                  {sistemaF2 === "PRICE" ? (
                    <ResultRow label="Parcela Fixa (PRICE)" value={fmtBRL(sim.price.parcela)} gold highlight />
                  ) : (
                    <>
                      <ResultRow label="1ª Parcela (SAC)" value={fmtBRL(sim.sac.primeiraParc)} gold highlight />
                      <ResultRow label="Última Parcela" value={fmtBRL(sim.sac.ultimaParc)} />
                    </>
                  )}
                  <ResultRow label="Total a Pagar" value={fmtBRL(sim.f2Selected.totalPago)} />
                  <ResultRow label="Total de Juros" value={fmtBRL(sim.f2Selected.totalJuros)} />
                </div>

                {/* Comparativo SAC vs PRICE */}
                <div className="px-4 pb-4">
                  <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wide mb-2">Comparativo SAC vs PRICE</p>
                  <div className="overflow-x-auto rounded-xl border border-[#243A66]">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-[#07101E] border-b border-[#243A66]">
                          <th className="text-left px-3 py-2 text-muted-foreground font-semibold">Sistema</th>
                          <th className="text-right px-3 py-2 text-muted-foreground font-semibold">1ª Parcela</th>
                          <th className="text-right px-3 py-2 text-muted-foreground font-semibold">Última</th>
                          <th className="text-right px-3 py-2 text-muted-foreground font-semibold">Total Pago</th>
                          <th className="text-right px-3 py-2 text-muted-foreground font-semibold">Total Juros</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className={cn("border-b border-[#243A66]/50", sistemaF2 === "PRICE" && "bg-[#C9A84C]/5")}>
                          <td className="px-3 py-2.5 font-bold text-foreground">PRICE {sistemaF2 === "PRICE" && "✓"}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-foreground">{fmtBRL(sim.price.parcela)}</td>
                          <td className="px-3 py-2.5 text-right text-muted-foreground">{fmtBRL(sim.price.parcela)}</td>
                          <td className="px-3 py-2.5 text-right text-muted-foreground">{fmtBRL(sim.price.totalPago)}</td>
                          <td className="px-3 py-2.5 text-right text-amber-400">{fmtBRL(sim.price.totalJuros)}</td>
                        </tr>
                        <tr className={cn(sistemaF2 === "SAC" && "bg-[#C9A84C]/5")}>
                          <td className="px-3 py-2.5 font-bold text-foreground">SAC {sistemaF2 === "SAC" && "✓"}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-foreground">{fmtBRL(sim.sac.primeiraParc)}</td>
                          <td className="px-3 py-2.5 text-right text-muted-foreground">{fmtBRL(sim.sac.ultimaParc)}</td>
                          <td className="px-3 py-2.5 text-right text-muted-foreground">{fmtBRL(sim.sac.totalPago)}</td>
                          <td className="px-3 py-2.5 text-right text-emerald-400">{fmtBRL(sim.sac.totalJuros)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Tabela de amortização expansível */}
                <div className="border-t border-[#1B3050]">
                  <button onClick={() => setShowTabela(v => !v)}
                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[#162744]/40 transition-colors">
                    <div className="flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-[#C9A84C]" />
                      <span className="text-sm font-semibold text-foreground">Tabela de Amortização — {sistemaF2}</span>
                    </div>
                    {showTabela ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  {showTabela && (
                    <div className="px-4 pb-4">
                      <div className="overflow-auto max-h-72 rounded-xl border border-[#243A66]">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-[#09081A]">
                            <tr className="border-b border-[#243A66]">
                              {["#", "Parcela", "Amortização", "Juros", "Saldo"].map(h => (
                                <th key={h} className="text-right py-2 px-3 text-muted-foreground first:text-center font-semibold">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sim.f2Selected.rows.map((row, i) => (
                              <tr key={i} className={cn("border-b border-[#243A66]/30 last:border-0", i % 2 === 0 ? "bg-[#09081A]" : "")}>
                                <td className="py-1.5 px-3 text-center text-muted-foreground">{i + 1}</td>
                                <td className="py-1.5 px-3 text-right font-semibold text-foreground">{fmtBRL(row.parcela)}</td>
                                <td className="py-1.5 px-3 text-right text-[#C9A84C]">{fmtBRL(row.amort)}</td>
                                <td className="py-1.5 px-3 text-right text-muted-foreground">{fmtBRL(row.juros)}</td>
                                <td className="py-1.5 px-3 text-right text-muted-foreground">{fmtBRL(row.saldo)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Custo Final */}
              <div className="bg-[#0C1929] border border-[#C9A84C]/30 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3.5 bg-[#07101E] border-b border-[#1B3050]">
                  <span className="text-[9px] font-bold bg-[#C9A84C]/20 text-[#C9A84C] border border-[#C9A84C]/30 px-2.5 py-1 rounded-full tracking-widest uppercase">Custo Final</span>
                  <span className="text-sm font-bold text-white">Custo Mensal Combinado (Fase 1 + Fase 2)</span>
                </div>
                <div className="grid grid-cols-2 divide-x divide-[#1B3050]">
                  {[
                    { label: `12m + ${prazoF2}m`, value: sim.custoFinal12m, total: 12 + prazoF2 },
                    { label: `18m + ${prazoF2}m`, value: sim.custoFinal18m, total: 18 + prazoF2 },
                  ].map(item => (
                    <div key={item.label} className="p-5 text-center">
                      <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Total {item.label}</p>
                      <p className="text-2xl font-bold text-[#C9A84C]">{fmtPct(item.value)}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">a.m. sobre VL · {item.total} meses</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#09081A] border border-[#243A66]">
                <Info className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Simulação estimada. Financiamento Imobiliário (Fase 2) sujeito à análise de crédito e avaliação do imóvel.
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
