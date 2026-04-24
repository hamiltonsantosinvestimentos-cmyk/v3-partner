"use client";

import { useState, useMemo } from "react";
import {
  Home, DollarSign, Calendar, TrendingUp,
  ChevronDown, ChevronUp, Info, CheckCircle2,
  AlertTriangle, Calculator, FileDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Constantes ──────────────────────────────────────────────────────────────
const LTV_MAX = 0.60;           // 60% máximo
const TAXA_BASE_MENSAL = 0.0089; // 0,89% a.m.
const IPCA_ANUAL_REF = 0.0483;  // 4,83% a.a. (projeção 2026)
const IPCA_MENSAL_REF = Math.pow(1 + IPCA_ANUAL_REF, 1 / 12) - 1;
const PRAZO_MIN = 12;
const PRAZO_MAX = 240;
const VALOR_IMOVEL_MIN = 150_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}
function fmtPct(v: number, dec = 2) {
  return `${(v * 100).toFixed(dec)}%`;
}
function fmtN(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Cálculo SAC ─────────────────────────────────────────────────────────────
function calcSAC(pv: number, taxaMensal: number, n: number) {
  const amort = pv / n;
  const rows = [];
  let saldo = pv;
  for (let i = 1; i <= n; i++) {
    const juros = saldo * taxaMensal;
    const parcela = amort + juros;
    saldo -= amort;
    rows.push({ parcela, amort, juros, saldo: Math.max(saldo, 0) });
  }
  const totalPago = rows.reduce((s, r) => s + r.parcela, 0);
  const totalJuros = rows.reduce((s, r) => s + r.juros, 0);
  return { rows, primeiraParc: rows[0].parcela, ultimaParc: rows[n - 1].parcela, totalPago, totalJuros };
}

// ─── Cálculo PRICE ───────────────────────────────────────────────────────────
function calcPRICE(pv: number, taxaMensal: number, n: number) {
  const pmt = (pv * taxaMensal * Math.pow(1 + taxaMensal, n)) / (Math.pow(1 + taxaMensal, n) - 1);
  const rows = [];
  let saldo = pv;
  for (let i = 1; i <= n; i++) {
    const juros = saldo * taxaMensal;
    const amort = pmt - juros;
    saldo -= amort;
    rows.push({ parcela: pmt, amort, juros, saldo: Math.max(saldo, 0) });
  }
  const totalPago = pmt * n;
  const totalJuros = totalPago - pv;
  return { rows, parcela: pmt, totalPago, totalJuros };
}

// ─── CET anual aproximado ────────────────────────────────────────────────────
function calcCET(pv: number, parcela: number, n: number) {
  // Newton-Raphson para encontrar taxa interna
  let r = 0.01;
  for (let iter = 0; iter < 100; iter++) {
    const f = parcela * (1 - Math.pow(1 + r, -n)) / r - pv;
    const df = parcela * (Math.pow(1 + r, -n) * n / r - (1 - Math.pow(1 + r, -n)) / (r * r));
    r = r - f / df;
  }
  return Math.pow(1 + r, 12) - 1;
}

// ─── Input com formatação ────────────────────────────────────────────────────
function CurrencyInput({
  label, value, onChange, min, max, hint,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; hint?: string;
}) {
  const [raw, setRaw] = useState(value.toLocaleString("pt-BR", { minimumFractionDigits: 0 }));
  const [focused, setFocused] = useState(false);

  const handleChange = (s: string) => {
    setRaw(s);
    const num = parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
    onChange(num);
  };

  const handleBlur = () => {
    setFocused(false);
    setRaw(value.toLocaleString("pt-BR", { minimumFractionDigits: 0 }));
  };

  const handleFocus = () => {
    setFocused(true);
    setRaw(value.toLocaleString("pt-BR", { minimumFractionDigits: 0 }));
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wide">{label}</label>
      <div className={cn(
        "flex items-center gap-2 px-4 py-3 rounded-xl border transition-all",
        focused ? "border-[#C9A84C] bg-[#09081A]" : "border-[#243A66] bg-[#111F35]"
      )}>
        <span className="text-muted-foreground text-sm">R$</span>
        <input
          type="text"
          inputMode="numeric"
          value={raw}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="flex-1 bg-transparent text-foreground text-base font-semibold focus:outline-none"
        />
      </div>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── Slider ──────────────────────────────────────────────────────────────────
function SliderInput({
  label, value, onChange, min, max, step = 1, format,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step?: number; format?: (v: number) => string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wide">{label}</label>
        <span className="text-base font-bold text-foreground">{format ? format(value) : value}</span>
      </div>
      <div className="relative h-2 bg-[#243A66] rounded-full">
        <div
          className="absolute h-2 rounded-full bg-gradient-to-r from-[#C9A84C] to-[#E8C97A]"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-2"
        />
        <div
          className="absolute w-4 h-4 rounded-full bg-[#C9A84C] border-2 border-white shadow-md top-1/2 -translate-y-1/2 -translate-x-1/2"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{format ? format(min) : min}</span>
        <span>{format ? format(max) : max}</span>
      </div>
    </div>
  );
}

// ─── Pill Tab ─────────────────────────────────────────────────────────────────
function Tab({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 py-2 text-xs font-semibold rounded-lg transition-all",
        active
          ? "bg-[#C9A84C] text-white shadow"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function HomeEquitySimulator() {
  const [valorImovel, setValorImovel] = useState(500_000);
  const [valorEmprestimo, setValorEmprestimo] = useState(200_000);
  const [prazo, setPrazo] = useState(120);
  const [sistema, setSistema] = useState<"SAC" | "PRICE">("SAC");
  const [ipcaCustom, setIpcaCustom] = useState(IPCA_ANUAL_REF * 100); // %
  const [showTabela, setShowTabela] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // ─── Derivados ──────────────────────────────────────────────────────────
  const valorMaxEmprestimo = valorImovel * LTV_MAX;
  const emprestimoClamped = Math.min(valorEmprestimo, valorMaxEmprestimo);
  const ltv = valorImovel > 0 ? emprestimoClamped / valorImovel : 0;
  const ltvPct = ltv * 100;
  const taxaMensalIPCA = Math.pow(1 + ipcaCustom / 100, 1 / 12) - 1;
  const taxaMensalTotal = TAXA_BASE_MENSAL + taxaMensalIPCA;
  const taxaAnualTotal = Math.pow(1 + taxaMensalTotal, 12) - 1;

  const resultado = useMemo(() => {
    if (emprestimoClamped <= 0 || prazo <= 0) return null;
    if (sistema === "SAC") {
      const sac = calcSAC(emprestimoClamped, taxaMensalTotal, prazo);
      const cet = calcCET(emprestimoClamped, sac.primeiraParc, prazo);
      return { ...sac, cet, sistema: "SAC" as const };
    } else {
      const price = calcPRICE(emprestimoClamped, taxaMensalTotal, prazo);
      const cet = calcCET(emprestimoClamped, price.parcela, prazo);
      return { ...price, primeiraParc: price.parcela, ultimaParc: price.parcela, cet, sistema: "PRICE" as const };
    }
  }, [emprestimoClamped, prazo, sistema, taxaMensalTotal]);

  const ltvColor = ltvPct > 55 ? "#F59E0B" : "#10B981";
  const ltvBarColor = ltvPct >= 60 ? "#EF4444" : ltvPct > 50 ? "#F59E0B" : "#10B981";

  const exportarPDF = () => {
    if (!resultado) return;
    const dataHoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

    const tabelaRows = resultado.rows.map((row, i) => `
      <tr style="background:${i % 2 === 0 ? "#f9f8f6" : "#ffffff"}">
        <td style="padding:5px 8px;text-align:center;color:#555">${i + 1}</td>
        <td style="padding:5px 8px;text-align:right;font-weight:600">${fmtBRL(row.parcela)}</td>
        <td style="padding:5px 8px;text-align:right;color:#7a6a2e">${fmtBRL(row.amort)}</td>
        <td style="padding:5px 8px;text-align:right;color:#888">${fmtBRL(row.juros)}</td>
        <td style="padding:5px 8px;text-align:right;color:#888">${fmtBRL(row.saldo)}</td>
      </tr>`).join("");

    const sacRes = calcSAC(emprestimoClamped, taxaMensalTotal, prazo);
    const priceRes = calcPRICE(emprestimoClamped, taxaMensalTotal, prazo);

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Simulação Home Equity — V3 Partners</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; font-size: 11px; background: #fff; }
  .page { max-width: 800px; margin: 0 auto; padding: 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #c9a84c; padding-bottom: 16px; margin-bottom: 20px; }
  .header h1 { font-size: 20px; font-weight: 700; color: #09081a; }
  .header p { color: #666; font-size: 10px; margin-top: 2px; }
  .badge { background: #09081a; color: #c9a84c; font-size: 9px; font-weight: 700; letter-spacing: 1px; padding: 4px 10px; border-radius: 20px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
  .card { background: #f9f8f6; border: 1px solid #e5e0d5; border-radius: 8px; padding: 12px; }
  .card-gold { background: #fdf8ed; border: 1px solid #c9a84c; border-radius: 8px; padding: 12px; }
  .label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #999; margin-bottom: 3px; }
  .label-gold { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #c9a84c; margin-bottom: 3px; }
  .value { font-size: 16px; font-weight: 700; color: #09081a; }
  .value-sm { font-size: 12px; font-weight: 600; color: #09081a; }
  .sub { font-size: 9px; color: #888; margin-top: 2px; }
  h2 { font-size: 12px; font-weight: 700; color: #09081a; margin-bottom: 10px; border-left: 3px solid #c9a84c; padding-left: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { background: #09081a; color: #c9a84c; padding: 7px 8px; text-align: right; font-size: 9px; font-weight: 700; letter-spacing: 0.5px; }
  th:first-child { text-align: center; }
  td { border-bottom: 1px solid #ece8e0; }
  .divider { border-top: 1px solid #e5e0d5; margin: 14px 0; }
  .row-detail { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f0ece4; }
  .row-detail span:first-child { color: #666; }
  .row-detail span:last-child { font-weight: 600; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e0d5; font-size: 8.5px; color: #999; line-height: 1.5; }
  .alert { background: #fdf8ed; border: 1px solid #c9a84c33; border-radius: 6px; padding: 8px 12px; font-size: 9px; color: #7a6a2e; margin-bottom: 14px; }
  section { margin-bottom: 18px; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <div>
      <h1>Simulação Home Equity</h1>
      <p>Crédito com Garantia de Imóvel · CGI — V3 Partners</p>
      <p style="margin-top:4px;color:#999">Gerado em ${dataHoje}</p>
    </div>
    <div style="text-align:right">
      <div class="badge">V3 PARTNERS</div>
      <p style="font-size:9px;color:#999;margin-top:6px">v3partners.com.br</p>
    </div>
  </div>

  <!-- KPIs -->
  <div class="grid4">
    <div class="card-gold">
      <div class="label-gold">${sistema === "SAC" ? "1ª Parcela" : "Parcela Fixa"}</div>
      <div class="value">${fmtBRL(resultado.primeiraParc)}</div>
      ${sistema === "SAC" ? `<div class="sub">Última: ${fmtBRL((resultado as ReturnType<typeof calcSAC> & { cet: number }).ultimaParc)}</div>` : ""}
    </div>
    <div class="card">
      <div class="label">Total a Pagar</div>
      <div class="value">${fmtBRL(resultado.totalPago)}</div>
      <div class="sub">Juros: ${fmtBRL(resultado.totalJuros)}</div>
    </div>
    <div class="card">
      <div class="label">CET Estimado</div>
      <div class="value">${fmtPct(resultado.cet)} a.a.</div>
      <div class="sub">Custo Efetivo Total</div>
    </div>
    <div class="card">
      <div class="label">LTV Contratado</div>
      <div class="value">${fmtPct(ltv, 1)}</div>
      <div class="sub">Máx permitido: 60%</div>
    </div>
  </div>

  <!-- Detalhes -->
  <section>
    <h2>Detalhes da Operação</h2>
    <div class="grid2">
      <div>
        ${[
          ["Valor do Imóvel", fmtBRL(valorImovel)],
          ["Valor do Empréstimo", fmtBRL(emprestimoClamped)],
          ["LTV Contratado", fmtPct(ltv, 1)],
          ["Prazo", `${prazo} meses (${Math.round(prazo / 12)} anos)`],
          ["Sistema de Amortização", sistema],
        ].map(([l, v]) => `<div class="row-detail"><span>${l}</span><span>${v}</span></div>`).join("")}
      </div>
      <div>
        ${[
          ["Taxa Base Mensal", "0,89% a.m."],
          ["IPCA Projetado (a.a.)", `${ipcaCustom.toFixed(1)}%`],
          ["IPCA Mensal (proj.)", fmtPct(taxaMensalIPCA)],
          ["Taxa Total Mensal", fmtPct(taxaMensalTotal)],
          ["Taxa Total Anual", fmtPct(taxaAnualTotal)],
        ].map(([l, v]) => `<div class="row-detail"><span>${l}</span><span>${v}</span></div>`).join("")}
      </div>
    </div>
  </section>

  <!-- Comparativo -->
  <section>
    <h2>Comparativo SAC vs PRICE</h2>
    <table>
      <thead><tr>
        <th style="text-align:left">Sistema</th>
        <th>1ª Parcela</th>
        <th>Última Parcela</th>
        <th>Total Pago</th>
        <th>Total Juros</th>
      </tr></thead>
      <tbody>
        <tr style="background:${sistema === "SAC" ? "#fdf8ed" : "#fff"}">
          <td style="padding:6px 8px;font-weight:700${sistema === "SAC" ? ";color:#7a6a2e" : ""}">SAC ${sistema === "SAC" ? "✓" : ""}</td>
          <td style="padding:6px 8px;text-align:right;font-weight:600">${fmtBRL(sacRes.primeiraParc)}</td>
          <td style="padding:6px 8px;text-align:right">${fmtBRL(sacRes.ultimaParc)}</td>
          <td style="padding:6px 8px;text-align:right">${fmtBRL(sacRes.totalPago)}</td>
          <td style="padding:6px 8px;text-align:right;color:#4a9a6a">${fmtBRL(sacRes.totalJuros)}</td>
        </tr>
        <tr style="background:${sistema === "PRICE" ? "#fdf8ed" : "#f9f8f6"}">
          <td style="padding:6px 8px;font-weight:700${sistema === "PRICE" ? ";color:#7a6a2e" : ""}">PRICE ${sistema === "PRICE" ? "✓" : ""}</td>
          <td style="padding:6px 8px;text-align:right;font-weight:600">${fmtBRL(priceRes.parcela)}</td>
          <td style="padding:6px 8px;text-align:right">${fmtBRL(priceRes.parcela)}</td>
          <td style="padding:6px 8px;text-align:right">${fmtBRL(priceRes.totalPago)}</td>
          <td style="padding:6px 8px;text-align:right;color:#b8860b">${fmtBRL(priceRes.totalJuros)}</td>
        </tr>
      </tbody>
    </table>
  </section>

  <!-- Tabela de amortização -->
  <section>
    <h2>Tabela de Amortização — ${sistema}</h2>
    <table>
      <thead><tr>
        <th>#</th><th>Parcela</th><th>Amortização</th><th>Juros</th><th>Saldo Devedor</th>
      </tr></thead>
      <tbody>${tabelaRows}</tbody>
    </table>
  </section>

  <div class="alert">
    ⚠️ Simulação estimada com fins ilustrativos. Taxa efetiva sujeita à análise de crédito, avaliação do imóvel e perfil do cliente. LTV máximo de 60% sobre o valor de avaliação. Operação regulada pela Res. CMN 4.676/2018.
  </div>

  <div class="footer">
    <strong>V3 Partners Soluções Ltda</strong> — CNPJ 14.219.287/0001-50 · v3partners.com.br<br>
    Esta simulação foi gerada pela Plataforma V3 PARTNER em ${dataHoje}. Não constitui proposta formal de crédito. Consulte um assessor V3 Partners para proposta definitiva.
  </div>
</div>
<script>window.onload = () => { window.print(); }</script>
</body></html>`;

    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C9A84C] to-[#8B5E1A] flex items-center justify-center">
            <Home className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Simulador Home Equity</h1>
            <p className="text-xs text-muted-foreground">CGI — Crédito com Garantia de Imóvel · Taxa a partir de 0,89% a.m. + IPCA</p>
          </div>
        </div>
        {resultado && (
          <button
            onClick={exportarPDF}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C9A84C] hover:bg-[#E8C97A] text-white text-sm font-semibold transition-colors shadow-lg shadow-[#C9A84C]/20"
          >
            <FileDown className="w-4 h-4" />
            Exportar PDF
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* ─── Painel de Inputs ─── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Valor do Imóvel */}
          <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-5 space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-[#243A66]">
              <Home className="w-4 h-4 text-[#C9A84C]" />
              <span className="text-sm font-semibold text-foreground">Dados do Imóvel</span>
            </div>

            <CurrencyInput
              label="Valor do Imóvel"
              value={valorImovel}
              onChange={(v) => setValorImovel(Math.max(v, VALOR_IMOVEL_MIN))}
              hint={`Mínimo: ${fmtBRL(VALOR_IMOVEL_MIN)}`}
            />

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wide">Valor Desejado</label>
                <span className="text-xs text-muted-foreground">Máx: {fmtBRL(valorMaxEmprestimo)}</span>
              </div>
              <div className={cn(
                "flex items-center gap-2 px-4 py-3 rounded-xl border transition-all",
                "border-[#243A66] bg-[#111F35]"
              )}>
                <span className="text-muted-foreground text-sm">R$</span>
                <input
                  type="number"
                  value={valorEmprestimo}
                  onChange={(e) => setValorEmprestimo(Math.max(0, Math.min(Number(e.target.value), valorMaxEmprestimo)))}
                  className="flex-1 bg-transparent text-foreground text-base font-semibold focus:outline-none"
                />
              </div>

              {/* LTV bar */}
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">LTV (Loan-to-Value)</span>
                  <span className="font-bold" style={{ color: ltvBarColor }}>{fmtPct(ltv, 1)}</span>
                </div>
                <div className="h-2 bg-[#243A66] rounded-full overflow-hidden">
                  <div
                    className="h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(ltvPct, 100)}%`, background: ltvBarColor }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>0%</span>
                  <span className="text-amber-400 font-semibold">Máx 60%</span>
                </div>
                {ltv >= LTV_MAX && (
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-400 bg-amber-900/20 border border-amber-800/30 rounded-lg px-2.5 py-1.5 mt-1">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                    Valor ajustado ao limite máximo de 60% do imóvel
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Prazo e sistema */}
          <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-5 space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-[#243A66]">
              <Calendar className="w-4 h-4 text-[#C9A84C]" />
              <span className="text-sm font-semibold text-foreground">Condições</span>
            </div>

            <SliderInput
              label="Prazo"
              value={prazo}
              onChange={setPrazo}
              min={PRAZO_MIN}
              max={PRAZO_MAX}
              step={12}
              format={(v) => `${v} meses (${(v / 12).toFixed(0)} anos)`}
            />

            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wide">Sistema de Amortização</label>
              <div className="flex gap-1 p-1 bg-[#09081A] rounded-xl">
                <Tab active={sistema === "SAC"} onClick={() => setSistema("SAC")}>SAC</Tab>
                <Tab active={sistema === "PRICE"} onClick={() => setSistema("PRICE")}>PRICE</Tab>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {sistema === "SAC"
                  ? "Parcelas decrescentes — amortização constante. Mais comum em Home Equity."
                  : "Parcelas fixas ao longo do contrato. Juros maiores no início."}
              </p>
            </div>
          </div>

          {/* IPCA customizável */}
          <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-5 space-y-4">
            <button
              onClick={() => setShowConfig((v) => !v)}
              className="w-full flex items-center justify-between text-sm font-semibold text-foreground"
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#C9A84C]" />
                Projeção IPCA
              </div>
              {showConfig ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
            {showConfig && (
              <SliderInput
                label="IPCA anual projetado"
                value={ipcaCustom}
                onChange={setIpcaCustom}
                min={2}
                max={12}
                step={0.5}
                format={(v) => `${v.toFixed(1)}% a.a.`}
              />
            )}
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[#C9A84C]/8 border border-[#C9A84C]/20">
              <Info className="w-3.5 h-3.5 text-[#C9A84C] flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-muted-foreground">
                Taxa contratada: <strong className="text-[#E8C97A]">0,89% a.m. + IPCA</strong>. O saldo devedor é corrigido mensalmente pelo IPCA. Projeção atual: <strong className="text-[#E8C97A]">{ipcaCustom.toFixed(1)}% a.a.</strong>
              </p>
            </div>
          </div>
        </div>

        {/* ─── Painel de Resultados ─── */}
        <div className="lg:col-span-3 space-y-4">
          {resultado ? (
            <>
              {/* Cards principais */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-[#C9A84C]/15 to-[#C9A84C]/5 border border-[#C9A84C]/30 rounded-2xl p-5">
                  <p className="text-[10px] text-[#C9A84C] font-semibold uppercase tracking-wide mb-1">
                    {sistema === "SAC" ? "1ª Parcela" : "Parcela Fixa"}
                  </p>
                  <p className="text-3xl font-bold text-foreground">{fmtBRL(resultado.primeiraParc)}</p>
                  {sistema === "SAC" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Última: {fmtBRL((resultado as ReturnType<typeof calcSAC> & { cet: number }).ultimaParc)}
                    </p>
                  )}
                </div>

                <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-5">
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1">Total a Pagar</p>
                  <p className="text-3xl font-bold text-foreground">{fmtBRL(resultado.totalPago)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Juros: {fmtBRL(resultado.totalJuros)}
                  </p>
                </div>
              </div>

              {/* Detalhes */}
              <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Detalhes da Simulação</h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  {[
                    { label: "Valor do empréstimo", value: fmtBRL(emprestimoClamped) },
                    { label: "LTV contratado", value: fmtPct(ltv, 1) },
                    { label: "Taxa base mensal", value: "0,89% a.m." },
                    { label: "IPCA mensal (proj.)", value: fmtPct(taxaMensalIPCA) },
                    { label: "Taxa total mensal", value: fmtPct(taxaMensalTotal) },
                    { label: "Taxa total anual", value: fmtPct(taxaAnualTotal) },
                    { label: "CET estimado (a.a.)", value: fmtPct(resultado.cet) },
                    { label: "Prazo", value: `${prazo} meses` },
                    { label: "Sistema", value: sistema },
                    { label: "Garantia mín. imóvel", value: fmtBRL(valorImovel) },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between text-xs border-b border-[#243A66]/50 pb-2">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-semibold text-foreground">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Comparativo SAC vs PRICE */}
              <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Comparativo SAC vs PRICE</h3>
                {(() => {
                  const sac = calcSAC(emprestimoClamped, taxaMensalTotal, prazo);
                  const price = calcPRICE(emprestimoClamped, taxaMensalTotal, prazo);
                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[#243A66]">
                            <th className="text-left py-2 text-muted-foreground">Sistema</th>
                            <th className="text-right py-2 text-muted-foreground">1ª Parcela</th>
                            <th className="text-right py-2 text-muted-foreground">Última Parc.</th>
                            <th className="text-right py-2 text-muted-foreground">Total Pago</th>
                            <th className="text-right py-2 text-muted-foreground">Total Juros</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className={cn("border-b border-[#243A66]/50", sistema === "SAC" && "bg-[#C9A84C]/5")}>
                            <td className="py-2.5 font-semibold text-foreground flex items-center gap-1.5">
                              SAC {sistema === "SAC" && <CheckCircle2 className="w-3 h-3 text-[#C9A84C]" />}
                            </td>
                            <td className="py-2.5 text-right font-semibold text-foreground">{fmtBRL(sac.primeiraParc)}</td>
                            <td className="py-2.5 text-right text-muted-foreground">{fmtBRL(sac.ultimaParc)}</td>
                            <td className="py-2.5 text-right text-muted-foreground">{fmtBRL(sac.totalPago)}</td>
                            <td className="py-2.5 text-right text-emerald-400">{fmtBRL(sac.totalJuros)}</td>
                          </tr>
                          <tr className={cn(sistema === "PRICE" && "bg-[#C9A84C]/5")}>
                            <td className="py-2.5 font-semibold text-foreground flex items-center gap-1.5">
                              PRICE {sistema === "PRICE" && <CheckCircle2 className="w-3 h-3 text-[#C9A84C]" />}
                            </td>
                            <td className="py-2.5 text-right font-semibold text-foreground">{fmtBRL(price.parcela)}</td>
                            <td className="py-2.5 text-right text-muted-foreground">{fmtBRL(price.parcela)}</td>
                            <td className="py-2.5 text-right text-muted-foreground">{fmtBRL(price.totalPago)}</td>
                            <td className="py-2.5 text-right text-amber-400">{fmtBRL(price.totalJuros)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>

              {/* Tabela de amortização (expansível) */}
              <div className="bg-[#111F35] border border-[#243A66] rounded-2xl overflow-hidden">
                <button
                  onClick={() => setShowTabela((v) => !v)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#162744]/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-[#C9A84C]" />
                    <span className="text-sm font-semibold text-foreground">Tabela de Amortização ({sistema})</span>
                  </div>
                  {showTabela ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                {showTabela && (
                  <div className="px-5 pb-5">
                    <div className="overflow-auto max-h-80 rounded-lg border border-[#243A66]">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-[#09081A]">
                          <tr className="border-b border-[#243A66]">
                            <th className="text-right py-2 px-3 text-muted-foreground">#</th>
                            <th className="text-right py-2 px-3 text-muted-foreground">Parcela</th>
                            <th className="text-right py-2 px-3 text-muted-foreground">Amortização</th>
                            <th className="text-right py-2 px-3 text-muted-foreground">Juros</th>
                            <th className="text-right py-2 px-3 text-muted-foreground">Saldo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resultado.rows.map((row, i) => (
                            <tr
                              key={i}
                              className={cn(
                                "border-b border-[#243A66]/30 last:border-0",
                                i % 2 === 0 ? "bg-[#09081A]" : ""
                              )}
                            >
                              <td className="py-1.5 px-3 text-right text-muted-foreground">{i + 1}</td>
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

              {/* Aviso regulatório */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#09081A] border border-[#243A66]">
                <Info className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Simulação estimada. Taxa efetiva sujeita à análise de crédito, avaliação do imóvel e perfil do cliente.
                  LTV máximo de 60% sobre o valor de avaliação. Operação regulada pela Res. CMN 4.676/2018.
                  <strong className="text-foreground"> Consulte um assessor V3 Partners para proposta formal.</strong>
                </p>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              Preencha os campos para simular
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
