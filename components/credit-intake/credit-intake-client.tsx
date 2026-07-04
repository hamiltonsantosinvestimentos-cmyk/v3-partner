"use client";

import { useState, useEffect, useCallback } from "react";

interface ValidateResponse {
  valid?: boolean;
  error?: string;
  subject_name_masked?: string;
  already_consented?: boolean;
  registrato_uploaded?: boolean;
}

type Step = "loading" | "invalid" | "consent" | "upload" | "done";

export function CreditIntakeClient({ token }: { token: string }) {
  const [step, setStep] = useState<Step>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validate = useCallback(async () => {
    try {
      const res = await fetch(`/api/credit-engine/intake/${token}`);
      const data = (await res.json()) as ValidateResponse;
      if (!res.ok || !data.valid) {
        setErrorMsg(data.error ?? "Link inválido.");
        setStep("invalid");
        return;
      }
      setSubjectName(data.subject_name_masked ?? "");
      if (data.registrato_uploaded) {
        setStep("done");
      } else if (data.already_consented) {
        setStep("upload");
      } else {
        setStep("consent");
      }
    } catch {
      setErrorMsg("Não foi possível validar o link. Tente novamente.");
      setStep("invalid");
    }
  }, [token]);

  useEffect(() => { validate(); }, [validate]);

  async function handleConsent() {
    if (!accepted) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("lgpd_consent", "true");
      const res = await fetch(`/api/credit-engine/intake/${token}`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Erro ao registrar consentimento.");
        return;
      }
      setStep("upload");
    } catch {
      setErrorMsg("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpload() {
    if (!file) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("lgpd_consent", "true");
      formData.append("file", file);
      const res = await fetch(`/api/credit-engine/intake/${token}`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Erro ao enviar arquivo.");
        return;
      }
      setStep("done");
    } catch {
      setErrorMsg("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#09081A", fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-md w-full">
        <div className="flex justify-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners" className="h-10 w-auto" />
        </div>

        <div style={{ background: "#162744", border: "1px solid rgba(201,168,76,.15)", borderRadius: 16, padding: 32 }}>
          {step === "loading" && (
            <p className="text-center text-sm" style={{ color: "#9BAFC5" }}>Validando link…</p>
          )}

          {step === "invalid" && (
            <div className="text-center space-y-3">
              <p className="text-sm" style={{ color: "#F5F1E8" }}>{errorMsg}</p>
              <p className="text-xs" style={{ color: "#9BAFC5" }}>Solicite um novo link à equipe V3 Partners.</p>
            </div>
          )}

          {step === "consent" && (
            <div className="space-y-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#E8C97A" }}>Análise de Crédito V3</p>
                <h1 className="text-lg font-bold" style={{ color: "#F5F1E8" }}>Olá, {subjectName || "titular"}</h1>
                <p className="text-sm mt-2" style={{ color: "#9BAFC5" }}>
                  A V3 Partners solicita sua autorização para realizar a análise de crédito conforme
                  os procedimentos preliminares do contrato do qual você é parte interessada. Isso
                  inclui consultar dados de identificação, histórico judicial público e, opcionalmente,
                  o Registrato do Banco Central que você pode enviar em seguida.
                </p>
              </div>
              <label className="flex items-start gap-3 text-xs cursor-pointer" style={{ color: "#9BAFC5" }}>
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5" />
                <span>Li e autorizo o tratamento dos meus dados para esta análise de crédito, nos termos da LGPD (Lei 13.709/2018, Art. 7º, inc. V).</span>
              </label>
              {errorMsg && <p className="text-xs" style={{ color: "#F59E0B" }}>{errorMsg}</p>}
              <button
                onClick={handleConsent}
                disabled={!accepted || submitting}
                className="w-full py-3 rounded-lg text-sm font-bold disabled:opacity-40"
                style={{ background: "#C9A84C", color: "#09081A" }}
              >
                {submitting ? "Enviando…" : "Aceitar e continuar"}
              </button>
            </div>
          )}

          {step === "upload" && (
            <div className="space-y-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#E8C97A" }}>Passo 2 de 2 — Opcional</p>
                <h1 className="text-lg font-bold" style={{ color: "#F5F1E8" }}>Envie o seu Registrato</h1>
                <p className="text-sm mt-2" style={{ color: "#9BAFC5" }}>
                  Gere o relatório gratuitamente em{" "}
                  <a href="https://www.bcb.gov.br/cidadaniafinanceira/registrato" target="_blank" rel="noopener noreferrer" style={{ color: "#C9A84C", textDecoration: "underline" }}>
                    registrato.bcb.gov.br
                  </a>{" "}
                  (login gov.br) e envie o PDF abaixo. Isso acelera sua análise, mas é opcional — você pode pular esta etapa.
                </p>
              </div>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-xs"
                style={{ color: "#9BAFC5" }}
              />
              {errorMsg && <p className="text-xs" style={{ color: "#F59E0B" }}>{errorMsg}</p>}
              <div className="flex gap-3">
                <button
                  onClick={() => setStep("done")}
                  className="flex-1 py-3 rounded-lg text-sm font-semibold"
                  style={{ background: "transparent", border: "1px solid rgba(155,175,197,.3)", color: "#9BAFC5" }}
                >
                  Pular por agora
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!file || submitting}
                  className="flex-1 py-3 rounded-lg text-sm font-bold disabled:opacity-40"
                  style={{ background: "#C9A84C", color: "#09081A" }}
                >
                  {submitting ? "Enviando…" : "Enviar PDF"}
                </button>
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="text-center space-y-3">
              <p className="text-lg font-bold" style={{ color: "#F5F1E8" }}>Recebido!</p>
              <p className="text-sm" style={{ color: "#9BAFC5" }}>
                Sua autorização foi registrada. Nossa mesa de crédito dará continuidade à análise
                e entrará em contato em breve.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
