"use client";

import { useState } from "react";
import { RefreshCw, Info } from "lucide-react";
import {
  asCurrency, formatMoney, parseCurrencyBRLInput,
  MA_CURRENCY_PREFIX, type CmCurrency,
} from "@/lib/utils";
import { valorPorExtenso } from "@/lib/utils/valor-extenso";
import {
  MoneyInput, MONEY_SUPPORT_TEXT, MONEY_WARN_TEXT, MONEY_WARN_ABOVE, MONEY_NOTA_PORQUE,
} from "@/components/shared/money-input";

/** Moedas oferecidas no interruptor da Mesa M&A. */
const SWITCH_CURRENCIES: CmCurrency[] = ["BRL", "USD"];

const NOTA_PORQUE =
  "Escolha a moeda em que o ativo é ofertado. O valor digitado fica sempre na moeda escolhida " +
  "(nada é convertido sozinho). O texto por extenso é gerado a partir do valor para você conferir " +
  "o que está sendo cadastrado antes de salvar. Se a moeda for dólar, use o botão Atualizar câmbio " +
  "no card para ver o equivalente em reais pela cotação do dia (PTAX do Banco Central). " + MONEY_NOTA_PORQUE;

/**
 * Campo de valor com interruptor de moeda (R$ / US$), máscara brasileira e valor por extenso.
 * O valor é controlado como texto mascarado ("300.000.000,00"); use parseCurrencyBRLInput para gravar.
 */
export function MoneyCurrencyField({
  label, value, currency, onChange, error, compact = false,
}: {
  label: string;
  value: string;
  currency: CmCurrency;
  onChange: (value: string, currency: CmCurrency) => void;
  error?: string;
  compact?: boolean;
}) {
  const [nota, setNota] = useState(false);
  const numero = parseCurrencyBRLInput(value);
  const extenso = numero > 0 ? valorPorExtenso(numero, currency) : "";
  const h = compact ? "h-9" : "h-10";

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-[#7A8FA8] flex items-center gap-1.5">
          {label}
          <button
            type="button"
            onClick={() => setNota(v => !v)}
            aria-label="Por que existe a escolha de moeda"
            aria-expanded={nota}
            title={NOTA_PORQUE}
            className="text-[#C9A84C] hover:text-[#E8C97A] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/50 rounded"
          >
            <Info size={12} />
          </button>
        </label>
        <div role="group" aria-label="Moeda do ativo" className="flex rounded-lg border border-[#243A66] overflow-hidden">
          {SWITCH_CURRENCIES.map(c => (
            <button
              key={c}
              type="button"
              aria-pressed={currency === c}
              onClick={() => onChange(value, c)}
              className={`px-2.5 py-1 text-[11px] font-bold transition-colors ${
                currency === c ? "bg-[#C9A84C] text-[#09081A]" : "bg-[#162744] text-[#9BAFC5] hover:text-[#F5F1E8]"
              }`}
            >
              {c === "BRL" ? "R$ Real" : "US$ Dólar"}
            </button>
          ))}
        </div>
      </div>
      {nota && <p className="text-[11px] leading-snug text-[#9BAFC5] mb-2 rounded-lg bg-[#162744] border border-[#243A66] p-2">{NOTA_PORQUE}</p>}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#C9A84C]">{MA_CURRENCY_PREFIX[currency]}</span>
        <MoneyInput
          value={value}
          onValueChange={m => onChange(m, currency)}
          hint={false}
          placeholder="0,00"
          className={`w-full ${h} rounded-lg border bg-[#162744] ${currency === "BRL" ? "pl-9" : "pl-11"} pr-3 text-sm text-[#F5F1E8] placeholder:text-[#9BAFC5] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/50 transition ${error ? "border-red-500/60" : "border-[#243A66]"}`}
        />
      </div>
      <p className="mt-1 text-[11px] leading-snug text-[#9BAFC5]">{MONEY_SUPPORT_TEXT}</p>
      {numero > MONEY_WARN_ABOVE && (
        <p role="status" className="mt-1 text-[11px] font-bold leading-snug text-[#E8C97A]">{MONEY_WARN_TEXT}</p>
      )}
      <div className="mt-2">
        <span className="block text-[11px] text-[#9BAFC5] mb-1">Valor por extenso</span>
        <p
          aria-live="polite"
          className="min-h-9 rounded-lg border border-[#243A66] bg-[#09081A] px-3 py-2 text-xs italic text-[#F5F1E8] first-letter:uppercase"
        >
          {extenso || "Digite o valor para ver o texto por extenso."}
        </p>
      </div>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

/** Equivalente em reais pelo câmbio gravado no card, ou null se não se aplica. */
export function equivalenteEmReais(
  value: number, currency: CmCurrency, fxRate: number | null | undefined,
): number | null {
  if (currency === "BRL" || !fxRate || fxRate <= 0 || !value) return null;
  return Math.round(value * fxRate * 100) / 100;
}

function dataBr(iso: string | null | undefined): string {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** Valor do ativo no padrão brasileiro completo, com o equivalente em reais quando houver câmbio. */
export function DealValueText({
  value, currency, fxRate, fxDate, className = "",
}: {
  value: number | null | undefined;
  currency?: string | null;
  fxRate?: number | null;
  fxDate?: string | null;
  className?: string;
}) {
  const moeda = asCurrency(currency);
  const eq = equivalenteEmReais(value ?? 0, moeda, fxRate);
  return (
    <span className={className}>
      <span className="block">{formatMoney(value ?? 0, moeda)}</span>
      {eq !== null && (
        <span className="block text-[10px] font-normal text-[#9BAFC5]">
          ≈ {formatMoney(eq, "BRL")} (câmbio {Number(fxRate).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}, {dataBr(fxDate)})
        </span>
      )}
    </span>
  );
}

/** Botão "Atualizar câmbio": só aparece em ativo em dólar. Grava a PTAX do dia no card. */
export function CambioButton({
  dealId, currency, onUpdated, size = "sm",
}: {
  dealId: string;
  currency?: string | null;
  onUpdated: (fx: { fx_rate_brl: number; fx_rate_date: string }) => void;
  size?: "sm" | "xs";
}) {
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  if (asCurrency(currency) !== "USD") return null;

  async function atualizar(e: React.MouseEvent) {
    e.stopPropagation();
    setBusy(true);
    setErro(null);
    try {
      const res = await fetch("/api/ma-deals/cambio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: dealId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Não foi possível atualizar o câmbio");
      onUpdated({ fx_rate_brl: json.fx_rate_brl, fx_rate_date: json.fx_rate_date });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao atualizar câmbio");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={atualizar}
        disabled={busy}
        title="Busca a cotação do dólar de hoje (PTAX do Banco Central) e mostra o equivalente em reais"
        className={`inline-flex items-center gap-1 rounded-md border border-[#C9A84C]/50 text-[#C9A84C] hover:bg-[#C9A84C]/10 disabled:opacity-50 transition-colors ${size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]"} font-bold`}
      >
        <RefreshCw size={size === "xs" ? 9 : 11} className={busy ? "animate-spin" : ""} />
        {busy ? "Atualizando..." : "Atualizar câmbio"}
      </button>
      {erro && <span role="alert" className="text-[10px] text-red-400 mt-1">{erro}</span>}
    </span>
  );
}
