"use client";

// Campo de telefone com DDI explícito (26/09/2026, regra 1.4 do QA de
// governança). "+55" já vem preenchido e é editável: brasileiro só completa
// DDD e número; contraparte de fora troca o código do país. A linha "Número
// final" mostra o destino exato antes de qualquer envio.

import { maskPhoneIntlInput, normalizePhone, formatPhoneIntl } from "@/lib/phone";

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  id?: string;
  disabled?: boolean;
}

export function PhoneIntlInput({ value, onChange, className, placeholder = "+55 (00) 00000-0000", required, id, disabled }: Props) {
  const result = normalizePhone(value);
  const hasTypedNumber = value.replace(/\D/g, "").length > 2;
  return (
    <div>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={value}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        className={className}
        onFocus={() => { if (!value.trim()) onChange("+55"); }}
        onBlur={() => { if (value.trim() === "+55" || value.trim() === "+") onChange(""); }}
        onChange={(e) => onChange(maskPhoneIntlInput(e.target.value))}
      />
      {hasTypedNumber && (
        <p className="mt-1 text-[11px] leading-snug" style={{ color: result.ok ? "#9BAFC5" : "#E8C97A" }}>
          {result.ok ? `Número final: ${formatPhoneIntl(value)}` : result.error}
        </p>
      )}
    </div>
  );
}
