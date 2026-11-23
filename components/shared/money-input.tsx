"use client";

import { useId, type ClipboardEvent, type FocusEvent, type InputHTMLAttributes } from "react";
import {
  maskCurrencyBRLInput, parseCurrencyBRLInput, normalizePastedMoney, completeMoneyOnBlur,
  type CmCurrency,
} from "@/lib/utils";
import { valorPorExtenso } from "@/lib/utils/valor-extenso";

/** Acima deste valor o campo mostra um aviso (nao bloqueante). O teto de bloqueio e do PR-C. */
export const MONEY_WARN_ABOVE = 1_000_000_000;

export const MONEY_SUPPORT_TEXT = "Digite em reais inteiros; use vírgula só para centavos.";

export const MONEY_WARN_TEXT = "Valor acima de 1 bilhão: confira o valor por extenso antes de salvar.";

/** Nota do porque (compliance de UX): aparece no hover, no foco e no toque (title + texto de apoio). */
export const MONEY_NOTA_PORQUE =
  "Padrão único da plataforma: os dígitos que você digita são reais inteiros e a vírgula separa os centavos " +
  "(50000000 vira 50.000.000). Antes o campo tratava os dígitos como centavos e um zero a mais ou a menos mudava " +
  "o valor em 100 vezes. O valor por extenso abaixo é gerado do número lido, para você conferir antes de salvar.";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "inputMode"> & {
  value: string;
  /** Recebe sempre o texto JA mascarado. Para gravar, use parseCurrencyBRLInput(value). */
  onValueChange: (masked: string) => void;
  currency?: CmCurrency;
  /** false esconde extenso, aviso e texto de apoio (use so quando o pai ja renderiza o proprio bloco). */
  hint?: boolean;
};

/** Bloco de apoio do campo: texto de apoio, valor por extenso e aviso acima de 1 bilhao. */
export function MoneyHint({ value, currency = "BRL", id }: { value: string; currency?: CmCurrency; id?: string }) {
  const numero = parseCurrencyBRLInput(value);
  const extenso = numero > 0 ? valorPorExtenso(numero, currency) : "";
  return (
    <div id={id} className="mt-1 space-y-0.5" aria-live="polite">
      <p className="text-[11px] leading-snug text-[#9BAFC5]">{MONEY_SUPPORT_TEXT}</p>
      {extenso && (
        <p className="text-[11px] leading-snug italic text-[#F5F1E8]">
          <span className="not-italic font-bold text-[#E8C97A]">Por extenso: </span>
          {extenso}
        </p>
      )}
      {numero > MONEY_WARN_ABOVE && (
        <p role="status" className="text-[11px] font-bold leading-snug text-[#E8C97A]">{MONEY_WARN_TEXT}</p>
      )}
    </div>
  );
}

/**
 * Campo monetario padrao da plataforma (reais inteiros, virgula nos centavos): mascara unica de lib/utils.ts,
 * teclado decimal no celular, colar no padrao en-US convertido, ,00 completado ao sair, valor por extenso,
 * aviso acima de 1 bilhao e texto de apoio. Quando o campo tem prefixo posicionado em absoluto dentro de um
 * contêiner, use hint={false} e renderize <MoneyHint /> FORA do contêiner.
 */
export function MoneyInput({
  value, onValueChange, currency = "BRL", hint = true, onBlur, onPaste, title, ...rest
}: Props) {
  const hintId = useId();

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    const texto = e.clipboardData.getData("text");
    const convertido = normalizePastedMoney(texto);
    if (convertido !== texto.trim()) {
      e.preventDefault();
      onValueChange(maskCurrencyBRLInput(convertido));
    }
    onPaste?.(e);
  }

  function handleBlur(e: FocusEvent<HTMLInputElement>) {
    onValueChange(completeMoneyOnBlur(value));
    onBlur?.(e);
  }

  return (
    <>
      <input
        {...rest}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        title={title ?? MONEY_NOTA_PORQUE}
        aria-describedby={hint ? hintId : rest["aria-describedby"]}
        value={value}
        onChange={(e) => onValueChange(maskCurrencyBRLInput(e.target.value))}
        onPaste={handlePaste}
        onBlur={handleBlur}
      />
      {hint && <MoneyHint id={hintId} value={value} currency={currency} />}
    </>
  );
}
