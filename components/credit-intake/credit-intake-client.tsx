"use client";

import { useState, useEffect, useCallback } from "react";

interface ValidateResponse {
  valid?: boolean;
  error?: string;
  subject_name_masked?: string;
  already_consented?: boolean;
  /** CPFs de sócios contratados no pedido que ainda faltam informar (só pedido de CNPJ). */
  socios_necessarios?: number;
}

// Sem etapa de envio do Registrato (23/09/2026): o SCR/BACEN já é consultado pela V3
// (CheckTudo) e entra no relatório, então o cliente não precisa mandar mais nada.
type Step = "loading" | "invalid" | "consent" | "done";

interface Socio { nome: string; cpf: string; autorizado: boolean }

function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

const inputStyle = {
  background: "#111F35",
  border: "1px solid rgba(155,175,197,.25)",
  color: "#F0ECE4",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 13,
  width: "100%",
} as const;

export function CreditIntakeClient({ token }: { token: string }) {
  const [step, setStep] = useState<Step>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [socios, setSocios] = useState<Socio[]>([]);
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
      const n = data.socios_necessarios ?? 0;
      setSocios(Array.from({ length: n }, () => ({ nome: "", cpf: "", autorizado: false })));
      setStep(data.already_consented ? "done" : "consent");
    } catch {
      setErrorMsg("Não foi possível validar o link. Tente novamente.");
      setStep("invalid");
    }
  }, [token]);

  useEffect(() => { validate(); }, [validate]);

  const sociosOk = socios.every(
    (s) => s.nome.trim().split(/\s+/).length >= 2 && s.cpf.replace(/\D/g, "").length === 11 && s.autorizado
  );

  function setSocio(i: number, patch: Partial<Socio>) {
    setSocios((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  async function handleConsent() {
    if (!accepted || !sociosOk) return;
    setSubmitting(true);
    setErrorMsg("");
    try {
      const formData = new FormData();
      formData.append("lgpd_consent", "true");
      if (socios.length > 0) formData.append("socios", JSON.stringify(socios));
      const res = await fetch(`/api/credit-engine/intake/${token}`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Erro ao registrar consentimento.");
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
                  inclui consultar dados de identificação, histórico judicial público e o histórico
                  de crédito no Sistema de Informações de Crédito do Banco Central (SCR).
                </p>
              </div>
              {socios.length > 0 && (
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#E8C97A" }}>Sócios da empresa</p>
                    <p className="text-xs mt-1" style={{ color: "#9BAFC5" }}>
                      Informe o nome completo e o CPF de cada sócio incluído na análise e confirme que ele autorizou a consulta.
                    </p>
                  </div>
                  {socios.map((s, i) => (
                    <div key={i} className="space-y-2 rounded-lg p-3" style={{ border: "1px solid rgba(201,168,76,.15)" }}>
                      <p className="text-xs font-semibold" style={{ color: "#F0ECE4" }}>Sócio {i + 1}</p>
                      <input
                        style={inputStyle}
                        placeholder="Nome completo"
                        autoComplete="off"
                        value={s.nome}
                        onChange={(e) => setSocio(i, { nome: e.target.value })}
                      />
                      <input
                        style={inputStyle}
                        placeholder="CPF"
                        inputMode="numeric"
                        autoComplete="off"
                        value={s.cpf}
                        onChange={(e) => setSocio(i, { cpf: maskCpf(e.target.value) })}
                      />
                      <label className="flex items-start gap-2 text-xs cursor-pointer" style={{ color: "#9BAFC5" }}>
                        <input type="checkbox" checked={s.autorizado} onChange={(e) => setSocio(i, { autorizado: e.target.checked })} className="mt-0.5" />
                        <span>Declaro que este sócio autorizou o tratamento dos seus dados para esta análise de crédito (LGPD, Art. 7º, inc. V).</span>
                      </label>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex items-start gap-3 text-xs cursor-pointer" style={{ color: "#9BAFC5" }}>
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5" />
                <span>Li e autorizo o tratamento dos meus dados para esta análise de crédito, nos termos da LGPD (Lei 13.709/2018, Art. 7º, inc. V).</span>
              </label>
              {errorMsg && <p className="text-xs" style={{ color: "#F59E0B" }}>{errorMsg}</p>}
              <button
                onClick={handleConsent}
                disabled={!accepted || !sociosOk || submitting}
                className="w-full py-3 rounded-lg text-sm font-bold disabled:opacity-40"
                style={{ background: "#C9A84C", color: "#09081A" }}
              >
                {submitting ? "Enviando…" : "Aceitar e enviar"}
              </button>
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
