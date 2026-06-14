"use client";

import { useState, useMemo } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import type { IntakeSchema, IntakeField } from "@/lib/ma/bp-intake/engine/schema-registry";
import { getVisibleSections, deriveActiveTags } from "@/lib/ma/bp-intake/engine/conditional-logic";

const C = {
  nd: "#09081A", nc: "#162744", nm: "#243A66",
  go: "#C9A84C", gl: "#E8C97A", cr: "#F5F1E8", mu: "#9BAFC5",
};

interface FxSnapshot {
  usd_brl: number;
  source: string;
  date: string;
}

interface Props {
  token: string;
  schema: IntakeSchema;
  fxSnapshot: FxSnapshot | null;
  expiresAt?: string;
}

type FormState = Record<string, string>;
type Errors = Record<string, string>;

function formatUsdBrl(usd: string, fx: number): string {
  const n = parseFloat(usd.replace(",", "."));
  if (isNaN(n) || n === 0) return "";
  return `≈ R$ ${(n * fx).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

function FieldInput({
  field,
  value,
  error,
  fxRate,
  onChange,
}: {
  field: IntakeField;
  value: string;
  error?: string;
  fxRate: number;
  onChange: (key: string, val: string) => void;
}) {
  const isUsd = field.type === "currency_usd";
  const isCurrency = field.type === "currency" || isUsd;
  const currencySymbol = isUsd ? "USD" : "R$";

  return (
    <div className="space-y-1">
      <label className="block text-[10px] font-semibold" style={{ color: C.gl }}>
        {field.label}
        {field.required && <span style={{ color: "#ef4444" }}> *</span>}
      </label>

      {field.type === "select" ? (
        <select
          value={value}
          onChange={(e) => onChange(field.key, e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-xs outline-none"
          style={{
            background: C.nd,
            borderColor: error ? "#ef4444" : C.nm,
            color: value ? C.cr : C.mu,
          }}
        >
          <option value="">{field.placeholder ?? "Selecione..."}</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : field.type === "text" ? (
        <textarea
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.key, e.target.value)}
          rows={2}
          className="w-full rounded-lg border px-3 py-2 text-xs outline-none resize-none"
          style={{
            background: C.nd,
            borderColor: error ? "#ef4444" : C.nm,
            color: C.cr,
          }}
        />
      ) : (
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            {isCurrency && (
              <span className="text-[10px] font-bold flex-shrink-0" style={{ color: C.go }}>
                {currencySymbol}
              </span>
            )}
            <input
              type="number"
              value={value}
              placeholder={field.placeholder}
              min={field.min}
              max={field.max}
              onChange={(e) => onChange(field.key, e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-xs outline-none"
              style={{
                background: C.nd,
                borderColor: error ? "#ef4444" : C.nm,
                color: C.cr,
              }}
            />
            {field.type === "percentage" && (
              <span className="text-[10px] text-gray-400 flex-shrink-0">%</span>
            )}
          </div>
          {isUsd && value && fxRate > 0 && (
            <p className="text-[9px]" style={{ color: C.mu }}>
              {formatUsdBrl(value, fxRate)}
            </p>
          )}
        </div>
      )}

      {field.hint && !error && (
        <p className="text-[9px]" style={{ color: C.mu }}>{field.hint}</p>
      )}
      {error && (
        <p className="text-[9px]" style={{ color: "#ef4444" }}>{error}</p>
      )}
    </div>
  );
}

export function IntakeFormRenderer({ token, schema, fxSnapshot, expiresAt }: Props) {
  const [formState, setFormState] = useState<FormState>({});
  const [errors, setErrors] = useState<Errors>({});
  const [respondentEmail, setRespondentEmail] = useState("");
  const [lgpdConsent, setLgpdConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fxRate = fxSnapshot?.usd_brl ?? 0;

  const activeTags = useMemo(
    () => deriveActiveTags(schema.tags, formState),
    [schema.tags, formState]
  );

  const visibleSections = useMemo(
    () => getVisibleSections(schema.sections, formState, activeTags),
    [schema.sections, formState, activeTags]
  );

  function handleChange(key: string, val: string) {
    setFormState((prev) => ({ ...prev, [key]: val }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validate(): boolean {
    const newErrors: Errors = {};
    for (const section of visibleSections) {
      for (const field of section.fields) {
        if (field.required && !formState[field.key]?.trim()) {
          newErrors[field.key] = "Campo obrigatório";
        }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    if (!lgpdConsent) {
      setErrors((prev) => ({ ...prev, lgpd: "Consentimento LGPD obrigatório" }));
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/ma/bp-intake/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responses: formState,
          lgpd_consent: true,
          respondent_email: respondentEmail || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error ?? "Erro ao enviar. Tente novamente.");
        return;
      }
      setSubmitted(true);
    } catch {
      setSubmitError("Falha de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: C.nd }}>
        <div className="max-w-md w-full text-center space-y-4">
          <CheckCircle2 size={40} style={{ color: C.go, margin: "0 auto" }} />
          <h1 className="text-xl font-bold" style={{ color: C.cr }}>Dados recebidos</h1>
          <p className="text-sm" style={{ color: C.mu }}>
            Obrigado. A equipe V3 Partners processará as informações e entrará em contato.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8" style={{ background: C.nd }}>
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/v3-logo-flat-gold-alpha.png"
              alt="V3 Partners"
              className="h-8 w-auto"
            />
          </div>
          <h1 className="text-lg font-bold" style={{ color: C.cr }}>
            {schema.label} — Captação de KPIs
          </h1>
          <p className="text-xs" style={{ color: C.mu }}>
            Preencha os dados abaixo para que a equipe V3 Partners possa estruturar o Business Plan do ativo.
            {expiresAt && (
              <> · Link válido até {new Date(expiresAt).toLocaleDateString("pt-BR")}.</>
            )}
          </p>
          {fxSnapshot && (
            <p className="text-[9px]" style={{ color: C.mu }}>
              Câmbio de referência: USD/BRL {fxSnapshot.usd_brl.toFixed(4)} ({fxSnapshot.source} · {fxSnapshot.date})
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {visibleSections.map((section) => (
            <div
              key={section.id}
              className="rounded-2xl border p-4 space-y-4"
              style={{ background: C.nc, borderColor: C.nm }}
            >
              <div>
                <h2 className="text-sm font-semibold" style={{ color: C.cr }}>{section.title}</h2>
                {section.description && (
                  <p className="text-[10px] mt-0.5" style={{ color: C.mu }}>{section.description}</p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {section.fields.map((field) => (
                  <FieldInput
                    key={field.key}
                    field={field}
                    value={formState[field.key] ?? ""}
                    error={errors[field.key]}
                    fxRate={fxRate}
                    onChange={handleChange}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* E-mail do respondente */}
          <div className="rounded-2xl border p-4 space-y-3" style={{ background: C.nc, borderColor: C.nm }}>
            <h2 className="text-sm font-semibold" style={{ color: C.cr }}>Confirmação de recebimento</h2>
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold" style={{ color: C.gl }}>
                E-mail para comprovante (opcional)
              </label>
              <input
                type="email"
                value={respondentEmail}
                placeholder="seuemail@empresa.com.br"
                onChange={(e) => setRespondentEmail(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-xs outline-none"
                style={{ background: C.nd, borderColor: C.nm, color: C.cr }}
              />
            </div>

            {/* LGPD consent */}
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={lgpdConsent}
                onChange={(e) => setLgpdConsent(e.target.checked)}
                className="mt-0.5 flex-shrink-0"
              />
              <span className="text-[9px]" style={{ color: C.mu }}>
                Concordo com o armazenamento e uso dos dados fornecidos para fins de análise e estruturação
                desta operação pela V3 Partners Soluções Ltda (CNPJ 14.219.287/0001-50), nos termos da LGPD
                Art. 7, inc. V. Contato: privacidade@v3partners.com.br.
              </span>
            </label>
            {errors.lgpd && (
              <p className="text-[9px]" style={{ color: "#ef4444" }}>{errors.lgpd}</p>
            )}
          </div>

          {submitError && (
            <p className="text-xs px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10" style={{ color: "#ef4444" }}>
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-opacity"
            style={{
              background: C.go,
              color: C.nd,
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? "Enviando..." : "Enviar Dados"}
          </button>
        </form>

        <p className="text-center text-[9px]" style={{ color: C.mu }}>
          V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50 · privacidade@v3partners.com.br
        </p>
      </div>
    </div>
  );
}
