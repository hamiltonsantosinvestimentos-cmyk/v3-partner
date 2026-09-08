"use client";

// Primitivos de wizard passo a passo, no mesmo padrão visual do Simulador Home
// Equity (components/simulador/home-equity-publico-client.tsx). Extraídos aqui
// para o quiz "Seja Partner" — o simulador pode adotar estes depois.

import type React from "react";
import { ArrowRight, Clock3, Loader2 } from "lucide-react";

export const GOLD = "#C9A84C";
export const GOLD_LIGHT = "#E8C97A";
export const NAVY = "#09081A";
export const NAVY_CARD = "#162744";
export const NAVY_BASE = "#111F35";
export const MUTED = "#7A8FA8";

export const ESTADOS_BR = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

export function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim().replace(/-$/, "");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim().replace(/-$/, "");
}
export function maskCEP(v: string) {
  return v.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d{1,3})/, "$1-$2");
}
export function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);
}
function fmtCentavos(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function digitsToCentavos(raw: string) {
  return parseInt(raw.replace(/\D/g, ""), 10) || 0;
}

export const inputCls = "w-full px-3.5 py-2.5 rounded-xl border text-sm text-white outline-none bg-transparent";
export const inputStyle = { background: NAVY, borderColor: "rgba(201,168,76,0.25)" } as const;

// ─── Barra de progresso fixa ────────────────────────────────────────────────
export function TopProgress({ pct }: { pct: number }) {
  return (
    <div className="h-1 w-full sticky top-0 z-10" style={{ background: "rgba(255,255,255,0.06)" }}>
      <div className="h-1 transition-all duration-300" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})` }} />
    </div>
  );
}

// ─── Campo com label ────────────────────────────────────────────────────────
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 text-left">
      <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: GOLD }}>{label}</label>
      {children}
    </div>
  );
}

// ─── Input monetário com máscara BRL (dígitos = centavos) ───────────────────
export function LabeledCurrencyInput({
  label, value, onChange, autoFocus, helper,
}: { label: string; value: number; onChange: (v: number) => void; autoFocus?: boolean; helper?: string }) {
  const display = value > 0 ? fmtCentavos(Math.round(value * 100)) : "";
  return (
    <Field label={label}>
      <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border" style={inputStyle}>
        <span className="text-sm font-semibold" style={{ color: MUTED }}>R$</span>
        <input
          type="text" inputMode="numeric" autoFocus={autoFocus}
          value={display}
          onChange={(e) => onChange(digitsToCentavos(e.target.value) / 100)}
          placeholder="0,00"
          className="flex-1 bg-transparent text-lg font-bold text-white outline-none"
        />
      </div>
      {helper && <p className="text-xs" style={{ color: MUTED }}>{helper}</p>}
    </Field>
  );
}

// ─── Grade de opções (auto-avança ao clicar) ───────────────────────────────
export function ChoiceGrid({
  columns, options, onSelect, selected,
}: {
  columns: number;
  options: { value: string; label: string; hint?: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }[];
  onSelect: (v: string) => void;
  selected?: string;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))`, gap: 10 }}>
      {options.map((o) => {
        const active = selected === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onSelect(o.value)}
            className="flex flex-col items-center gap-2 py-4 px-2 rounded-xl border transition-colors hover:border-[#C9A84C]/50"
            style={{ background: NAVY, borderColor: active ? GOLD : "rgba(255,255,255,0.08)" }}
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}18` }}>
              <o.icon className="w-4 h-4" style={{ color: GOLD }} />
            </div>
            <span className="text-xs font-semibold text-white text-center leading-tight">{o.label}</span>
            {o.hint && <span className="text-[10px] text-center leading-tight" style={{ color: MUTED }}>{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ─── Card de etapa ──────────────────────────────────────────────────────────
export function StepCard({
  stepNum, totalSteps, title, titleHighlight, subtitle, children,
  onBack, onNext, nextLabel = "Continuar", nextDisabled, nextLoading, hint, wide,
}: {
  stepNum: number; totalSteps: number; title: string; titleHighlight?: string; subtitle?: string;
  children?: React.ReactNode;
  onBack?: () => void; onNext?: () => void; nextLabel?: string; nextDisabled?: boolean; nextLoading?: boolean; hint?: string; wide?: boolean;
}) {
  return (
    <div className={`w-full mx-auto space-y-4 animate-fade-in ${wide ? "max-w-xl" : "max-w-md"}`}>
      <div className="rounded-2xl border p-6 sm:p-7 space-y-5" style={{ background: NAVY_CARD, borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>Passo {stepNum} de {totalSteps}</p>
          <h2 className="text-xl sm:text-2xl font-bold text-white leading-snug">
            {title} {titleHighlight && <span style={{ color: GOLD }}>{titleHighlight}</span>}
          </h2>
          {subtitle && <p className="text-sm" style={{ color: MUTED }}>{subtitle}</p>}
        </div>

        {children}

        {onNext && (
          <button
            onClick={onNext}
            disabled={nextDisabled || nextLoading}
            className="w-full py-3.5 rounded-xl font-bold text-sm text-black flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity hover:opacity-90"
            style={{ background: GOLD }}
          >
            {nextLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{nextLabel} <ArrowRight className="w-4 h-4" /></>}
          </button>
        )}
      </div>

      {hint && (
        <div className="flex items-start gap-2.5 rounded-xl border px-4 py-3" style={{ background: `${GOLD}0d`, borderColor: `${GOLD}30` }}>
          <Clock3 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: GOLD }} />
          <p className="text-xs" style={{ color: "#D8CCA8" }}>{hint}</p>
        </div>
      )}

      {onBack && (
        <div className="flex justify-center">
          <button onClick={onBack} className="px-5 py-2 rounded-full text-xs font-semibold" style={{ background: NAVY_CARD, color: MUTED }}>
            Voltar
          </button>
        </div>
      )}
    </div>
  );
}
