"use client";

import { useMemo, useState } from "react";
import { Home, Wheat, FileDown, Info, Plus, X, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LINHAS_CASH, PARAMETROS_CASH, PRAZO_MAX, PRAZO_MIN,
  mediaAvaliacoes, simularCash, type LinhaCash,
} from "@/lib/simulador-cash";

// Simulador CASH HOME / CASH AGRO — mesmo demonstrativo do fundo, com a média
// das avaliações do imóvel no lugar do "Crédito" e o "Crédito Líquido"
// apresentado como valor liberado ao cliente. Cálculos em lib/simulador-cash.ts.

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
const fmtPct = (v: number, dec = 2) => `${(v * 100).toFixed(dec).replace(".", ",")}%`;

function CurrencyInput({ label, value, onChange, onRemove }: {
  label: string; value: number; onChange: (v: number) => void; onRemove?: () => void;
}) {
  const fmt = (v: number) => (v ? v.toLocaleString("pt-BR", { minimumFractionDigits: 0 }) : "");
  const [raw, setRaw] = useState(fmt(value));
  const [focused, setFocused] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-bold text-[#C9A84C] uppercase tracking-wide">{label}</label>
      <div className={cn("flex items-center gap-2 px-4 py-3 rounded-xl border transition-all",
        focused ? "border-[#C9A84C] bg-[#09081A]" : "border-[#243A66] bg-[#111F35]")}>
        <span className="text-muted-foreground text-sm font-semibold">R$</span>
        <input type="text" inputMode="numeric" value={raw} placeholder="0"
          onChange={(e) => {
            const digitos = e.target.value.replace(/\D/g, "");
            const num = digitos ? parseInt(digitos, 10) : 0;
            setRaw(fmt(num));
            onChange(num);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); setRaw(fmt(value)); }}
          className="flex-1 min-w-0 bg-transparent text-foreground text-lg font-bold focus:outline-none" />
        {onRemove && (
          <button type="button" onClick={onRemove} title="Remover avaliação"
            className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function Linha({ label, valor, sub, forte }: { label: string; valor: string; sub?: string; forte?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-4 py-3 border-b border-[#243A66]/40 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-right">
        <p className={cn("font-bold text-foreground", forte ? "text-lg" : "text-sm")}>{valor}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

export function CashSimulator() {
  const [linha, setLinha] = useState<LinhaCash>("CASH_HOME");
  const [avaliacoes, setAvaliacoes] = useState<number[]>([13_666_029]);
  const [prazo, setPrazo] = useState(188);

  const media = mediaAvaliacoes(avaliacoes);
  const sim = useMemo(() => simularCash(media, prazo), [media, prazo]);
  const tabela = useMemo(
    () => [110, 120, 130, 140, 150, 160, 170, 180, 190].map((p) => simularCash(media, p)).filter((s) => s !== null),
    [media],
  );
  const nomeLinha = LINHAS_CASH[linha].nome;

  const exportar = () => {
    if (!sim) return;
    const d = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    const linhaPdf = (l: string, v: string, s = "") =>
      `<div class="row"><span>${l}</span><span><b>${v}</b>${s ? `<small>${s}</small>` : ""}</span></div>`;
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Simulação ${nomeLinha} — V3 Partners</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'DM Sans','Helvetica Neue',Arial,sans-serif;color:#09081a;background:#fff}
.page{max-width:620px;margin:0 auto;padding:40px 32px}h1{font-size:22px}p.em{color:#7a8fa8;font-size:12px;margin:4px 0 20px}
.badge{display:inline-block;background:#09081a;color:#c9a84c;font-size:9px;font-weight:700;letter-spacing:1px;padding:4px 10px;border-radius:20px;margin-bottom:12px}
.row{display:flex;justify-content:space-between;align-items:flex-start;padding:12px 0;border-bottom:1px solid #ece8e0;font-size:13px}
.row span:first-child{color:#555}.row span:last-child{text-align:right}.row small{display:block;color:#7a8fa8;font-size:10px;font-weight:400}
.total{display:flex;justify-content:space-between;background:#f6f3ec;border:1px solid #c9a84c;border-radius:10px;padding:16px;margin-top:18px;font-size:15px;font-weight:700}
.total span:last-child{font-size:20px}.foot{margin-top:24px;font-size:9px;color:#999;text-align:center}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head>
<body><div class="page"><div class="badge">V3 PARTNERS · ${nomeLinha}</div>
<h1>Demonstrativo da Liquidez</h1><p class="em">Emitido em ${d}</p>
${linhaPdf("Média de avaliação do imóvel", fmtBRL(sim.credito), avaliacoes.filter((v) => v > 0).length > 1 ? `média de ${avaliacoes.filter((v) => v > 0).length} avaliações` : "")}
${linhaPdf("Prazo", `${sim.prazo} meses`)}
${linhaPdf("Parcela", fmtBRL(sim.parcela), `taxa média ${fmtPct(sim.taxaMensal)} a.m. + INCC`)}
${linhaPdf("Renda necessária", fmtBRL(sim.rendaNecessaria), `parcela até ${fmtPct(PARAMETROS_CASH.comprometimentoRenda, 0)} da renda`)}
<div class="total"><span>Valor liberado ao cliente</span><span>${fmtBRL(sim.valorLiberado)}</span></div>
<p class="foot">V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50 · v3partners.com.br<br>Taxa de juros + INCC: parcelas corrigidas pelo INCC, valores mostrados sem a correção. Simulação estimada com fins ilustrativos. Não constitui proposta formal de crédito; sujeita à análise e avaliação do imóvel.</p>
</div><script>window.onload=()=>window.print()</script></body></html>`;
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C9A84C] to-[#8B5E1A] flex items-center justify-center flex-shrink-0">
            {linha === "CASH_HOME" ? <Home className="w-5 h-5 text-[#09081A]" /> : <Wheat className="w-5 h-5 text-[#09081A]" />}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Simulador CASH HOME / CASH AGRO</h1>
            <p className="text-xs text-muted-foreground">Liquidez do fundo sobre a média de avaliação do imóvel · prazo de {PRAZO_MIN} a {PRAZO_MAX} meses</p>
          </div>
        </div>
        {sim && (
          <button onClick={exportar}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] text-sm font-bold transition-colors">
            <FileDown className="w-4 h-4" /> Exportar PDF
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Entradas */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-5 space-y-4">
            <label className="text-[11px] font-bold text-[#C9A84C] uppercase tracking-wide">Linha</label>
            <div className="flex gap-1 p-1 bg-[#09081A] rounded-xl">
              {(Object.keys(LINHAS_CASH) as LinhaCash[]).map((l) => (
                <button key={l} onClick={() => setLinha(l)}
                  className={cn("flex-1 py-2 text-xs font-bold rounded-lg transition-all",
                    linha === l ? "bg-[#C9A84C] text-[#09081A]" : "text-muted-foreground hover:text-foreground")}>
                  {LINHAS_CASH[l].nome}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">Garantia: {LINHAS_CASH[linha].garantia}</p>
          </div>

          <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#243A66]">
              <span className="text-sm font-bold text-foreground">Avaliações do imóvel</span>
              {avaliacoes.length < 3 && (
                <button onClick={() => setAvaliacoes((a) => [...a, 0])}
                  className="flex items-center gap-1 text-[11px] font-bold text-[#C9A84C] hover:text-[#E8C97A]">
                  <Plus className="w-3.5 h-3.5" /> Avaliação
                </button>
              )}
            </div>
            {avaliacoes.map((v, i) => (
              <CurrencyInput key={i} label={`Avaliação ${i + 1}`} value={v}
                onChange={(n) => setAvaliacoes((a) => a.map((x, j) => (j === i ? n : x)))}
                onRemove={avaliacoes.length > 1 ? () => setAvaliacoes((a) => a.filter((_, j) => j !== i)) : undefined} />
            ))}
            <div className="bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded-xl p-3">
              <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wide">Média de avaliação</p>
              <p className="text-2xl font-bold text-foreground">{fmtBRL(media)}</p>
            </div>
          </div>

          <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[11px] font-bold text-[#C9A84C] uppercase tracking-wide">
                <Calendar className="w-3.5 h-3.5" /> Prazo
              </span>
              <span className="text-sm font-bold text-foreground">{prazo} meses</span>
            </div>
            <input type="range" min={PRAZO_MIN} max={PRAZO_MAX} step={1} value={prazo}
              onChange={(e) => setPrazo(parseInt(e.target.value, 10))}
              className="w-full accent-[#C9A84C]" />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{PRAZO_MIN} meses</span><span>{PRAZO_MAX} meses</span>
            </div>
          </div>
        </div>

        {/* Demonstrativo */}
        <div className="lg:col-span-3 space-y-4">
          {sim ? (
            <>
              <div className="bg-[#0C1929] border border-[#1B3050] rounded-2xl p-5">
                <div className="flex items-baseline justify-between mb-2">
                  <h2 className="text-lg font-bold text-foreground">Demonstrativo da Liquidez</h2>
                  <span className="text-[10px] font-bold text-[#C9A84C] tracking-widest">{nomeLinha}</span>
                </div>
                <Linha label="Média de avaliação do imóvel" valor={fmtBRL(sim.credito)} forte />
                <Linha label="Prazo" valor={`${sim.prazo} meses`} />
                <Linha label="Parcela" valor={fmtBRL(sim.parcela)} sub={`taxa média ${fmtPct(sim.taxaMensal)} a.m. + INCC`} forte />
                <Linha label="Renda necessária" valor={fmtBRL(sim.rendaNecessaria)} sub={`parcela até ${fmtPct(PARAMETROS_CASH.comprometimentoRenda, 0)} da renda`} />
                <div className="flex justify-between items-center mt-4 p-4 rounded-xl bg-[#C9A84C]/10 border border-[#C9A84C]/30">
                  <span className="text-sm font-bold text-foreground">Valor liberado ao cliente</span>
                  <span className="text-2xl font-bold text-[#C9A84C]">{fmtBRL(sim.valorLiberado)}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-3">
                  Taxa média {fmtPct(sim.taxaMensal)} a.m. + INCC ({fmtPct(sim.taxaAnual)} a.a. + INCC) sobre o valor liberado · parcela em valores de hoje, corrigida pelo INCC
                </p>
              </div>

              <div className="bg-[#0C1929] border border-[#1B3050] rounded-2xl overflow-hidden">
                <p className="px-5 py-3 text-[10px] font-bold text-[#C9A84C] uppercase tracking-wide border-b border-[#1B3050]">Parcela por prazo</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#243A66] text-muted-foreground">
                        <th className="text-left px-4 py-2 font-semibold">Prazo</th>
                        <th className="text-right px-4 py-2 font-semibold">Taxa média</th>
                        <th className="text-right px-4 py-2 font-semibold">Parcela</th>
                        <th className="text-right px-4 py-2 font-semibold">Renda necessária</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tabela.map((t) => (
                        <tr key={t.prazo} onClick={() => setPrazo(t.prazo)}
                          className={cn("border-b border-[#243A66]/30 last:border-0 cursor-pointer hover:bg-[#162744]/50",
                            t.prazo === prazo && "bg-[#C9A84C]/10")}>
                          <td className="px-4 py-2.5 font-bold text-foreground">{t.prazo} meses</td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground">{fmtPct(t.taxaMensal)} a.m. + INCC</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-foreground">{fmtBRL(t.parcela)}</td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground">{fmtBRL(t.rendaNecessaria)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#09081A] border border-[#243A66]">
                <Info className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Simulação estimada. Parcelas corrigidas pelo INCC; valores mostrados sem a correção. Sujeita à análise de crédito e à avaliação do imóvel.
                  <strong className="text-foreground"> Consulte um assessor V3 Partners para proposta formal.</strong>
                </p>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm bg-[#0C1929] border border-[#1B3050] rounded-2xl">
              Informe a avaliação do imóvel para simular
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
