"use client";

import React, { useState } from "react";
import { ChevronRight, ChevronLeft, CheckCircle2, Home, User, Building2, AlertTriangle } from "lucide-react";

const CREDIT_LINES = [
  { value: "HOME EQUITY", label: "Home Equity (Garantia de Imóvel)" },
  { value: "HE ESTRESSADO", label: "Home Equity Estressado" },
  { value: "AVAL", label: "Crédito com Aval" },
  { value: "FIDC", label: "FIDC — Fundo de Investimento" },
  { value: "CRI", label: "CRI — Certificado de Recebíveis Imobiliários" },
  { value: "CRA", label: "CRA — Certificado do Agronegócio" },
  { value: "HIGH TICKET", label: "High Ticket (R$ 5M+)" },
  { value: "PROJECT FINANCE", label: "Project Finance" },
  { value: "CGI", label: "CGI — Crédito com Garantia de Imóvel" },
  { value: "M&A", label: "M&A — Fusões e Aquisições" },
  { value: "CONSORCIO", label: "Consórcio" },
  { value: "SPLIT FISCAL", label: "Split Fiscal" },
];

const IMOVEL_LINES = ["HOME EQUITY", "HE ESTRESSADO", "CGI", "CRI"];

const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

const LGPD_TEXT = `Autorizo a V3 Partners Soluções Ltda (CNPJ 14.219.287/0001-50) a coletar, processar e armazenar meus dados pessoais e documentos para fins de análise e estruturação de operações financeiras, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018). Os dados poderão ser compartilhados com parceiros e instituições financeiras exclusivamente para a finalidade informada. Tenho ciência de que esta autorização pode ser revogada a qualquer momento mediante solicitação formal ao e-mail: compliance@v3partners.com.br.`;

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(17,31,53,0.8)",
  border: "1px solid rgba(22,39,68,0.9)",
  borderRadius: 10,
  padding: "10px 14px",
  fontSize: 13,
  color: "#F0ECE4",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "DM Sans, sans-serif",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: "#7A8FA8",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}{required && <span style={{ color: "#EF4444", marginLeft: 3 }}>*</span>}</label>
      {children}
    </div>
  );
}

interface CaptacaoFormProps {
  token: string;
  partnerName: string;
}

export function CaptacaoForm({ token, partnerName }: CaptacaoFormProps) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitCode, setSubmitCode] = useState("");
  const [error, setError] = useState("");

  // Step 1 — Identificação
  const [personType, setPersonType] = useState<"PF" | "PJ">("PF");
  const [name, setName] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Step 2 — Dados financeiros
  const [renda, setRenda] = useState("");
  const [faturamento, setFaturamento] = useState("");
  const [estadoCivil, setEstadoCivil] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [socioResponsavel, setSocioResponsavel] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [enderecoRua, setEnderecoRua] = useState("");
  const [restricao, setRestricao] = useState<"" | "SIM" | "NAO">("");

  // Step 3 — Produto
  const [creditLine, setCreditLine] = useState("");
  const [valorSolicitado, setValorSolicitado] = useState("");
  const [prazo, setPrazo] = useState("");
  const [finalidade, setFinalidade] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Step 4 — Imóvel (condicional)
  const [imovelEndereco, setImovelEndereco] = useState("");
  const [imovelCidade, setImovelCidade] = useState("");
  const [imovelEstado, setImovelEstado] = useState("");
  const [imovelValor, setImovelValor] = useState("");
  const [imovelZona, setImovelZona] = useState<"" | "URBANO" | "RURAL">("");
  const [imovelProprio, setImovelProprio] = useState(true);

  // Step 5 — LGPD
  const [lgpdConsent, setLgpdConsent] = useState(false);

  const needsImovel = IMOVEL_LINES.includes(creditLine);
  const totalSteps = needsImovel ? 5 : 4;

  function stepLabel(s: number) {
    if (s === 1) return "Identificação";
    if (s === 2) return "Dados Financeiros";
    if (s === 3) return "Produto de Interesse";
    if (needsImovel && s === 4) return "Imóvel em Garantia";
    return "Autorização";
  }

  function canNext() {
    if (step === 1) return (personType === "PF" ? name : razaoSocial).trim() && email.trim() && phone.trim();
    if (step === 2) return city.trim() && state;
    if (step === 3) return creditLine && valorSolicitado.trim();
    if (needsImovel && step === 4) return imovelCidade.trim();
    return lgpdConsent;
  }

  async function handleSubmit() {
    if (!lgpdConsent) { setError("Você precisa aceitar os termos de autorização LGPD."); return; }
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        token,
        personType,
        name: personType === "PF" ? name : razaoSocial,
        razaoSocial,
        nomeFantasia,
        cpfCnpj,
        email,
        phone,
        renda: personType === "PF" ? renda : undefined,
        faturamento: personType === "PJ" ? faturamento : undefined,
        estadoCivil: personType === "PF" ? estadoCivil : undefined,
        nascimento: personType === "PF" ? nascimento : undefined,
        socioResponsavel: personType === "PJ" ? socioResponsavel : undefined,
        city,
        state,
        enderecoRua,
        restricao,
        creditLine,
        productInterest: creditLine,
        valorSolicitado,
        prazo,
        finalidade,
        observacoes,
        imoveis: needsImovel ? [{
          endereco: imovelEndereco,
          cidade: imovelCidade,
          estado: imovelEstado,
          valor_medio: parseFloat(imovelValor.replace(/\D/g, "")) || undefined,
          zona: imovelZona || undefined,
          proprietario: imovelProprio ? "MESMO_TITULAR" : undefined,
        }] : [],
        lgpdConsent: true,
      };
      const res = await fetch("/api/captacao/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erro ao enviar. Tente novamente."); return; }
      setSubmitCode(json.code ?? "");
      setSubmitted(true);
    } catch {
      setError("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-12 px-6 rounded-2xl" style={{ background: "rgba(9,8,26,0.8)", border: "1px solid rgba(201,168,76,0.15)" }}>
        <div className="w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center"
          style={{ background: "rgba(16,185,129,0.12)", border: "2px solid rgba(16,185,129,0.4)" }}>
          <CheckCircle2 style={{ width: 36, height: 36, color: "#10B981" }} />
        </div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: "#F0ECE4" }}>Formulário Enviado!</h2>
        {submitCode && (
          <p className="text-xs font-mono mb-3 px-3 py-1.5 rounded-lg inline-block"
            style={{ background: "rgba(201,168,76,0.1)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.2)" }}>
            Protocolo: {submitCode}
          </p>
        )}
        <p className="text-sm leading-relaxed mb-2" style={{ color: "#7A8FA8" }}>
          Seus dados foram recebidos com segurança por <strong style={{ color: "#C9A84C" }}>{partnerName}</strong>.
        </p>
        <p className="text-sm" style={{ color: "#7A8FA8" }}>
          Nossa equipe analisará sua solicitação e entrará em contato em breve pelo e-mail ou telefone informado.
        </p>
        <div className="mt-6 p-4 rounded-xl text-left" style={{ background: "rgba(201,168,76,0.05)", border: "1px solid rgba(201,168,76,0.1)" }}>
          <p className="text-xs font-bold mb-1" style={{ color: "#C9A84C" }}>V3 Partners Soluções Ltda</p>
          <p className="text-xs" style={{ color: "#7A8FA8" }}>CNPJ 14.219.287/0001-50 · v3partners.com.br</p>
        </div>
      </div>
    );
  }

  const cardStyle: React.CSSProperties = {
    background: "rgba(9,8,26,0.85)",
    border: "1px solid rgba(22,39,68,0.9)",
    borderRadius: 16,
    padding: 28,
    backdropFilter: "blur(8px)",
  };

  return (
    <div>
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
          <React.Fragment key={s}>
            <div className="flex flex-col items-center gap-1">
              <div style={{
                width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700,
                background: s < step ? "#10B981" : s === step ? "rgba(201,168,76,0.2)" : "rgba(22,39,68,0.5)",
                border: s < step ? "2px solid #10B981" : s === step ? "2px solid #C9A84C" : "2px solid rgba(22,39,68,0.9)",
                color: s < step ? "#fff" : s === step ? "#C9A84C" : "#7A8FA8",
              }}>
                {s < step ? "✓" : s}
              </div>
              <span style={{ fontSize: 9, color: s === step ? "#C9A84C" : "#7A8FA8", whiteSpace: "nowrap" }}>
                {stepLabel(s)}
              </span>
            </div>
            {s < totalSteps && (
              <div style={{ flex: 1, height: 1, background: s < step ? "#10B981" : "rgba(22,39,68,0.9)", marginBottom: 16 }} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Form card */}
      <div style={cardStyle}>
        {/* ─── STEP 1: Identificação ─── */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#F0ECE4", margin: 0 }}>Quem é você?</h2>

            {/* Tipo */}
            <Field label="Tipo de pessoa" required>
              <div className="flex gap-3">
                {(["PF", "PJ"] as const).map((t) => (
                  <button key={t} onClick={() => setPersonType(t)}
                    style={{
                      flex: 1, padding: "10px 0", borderRadius: 10, border: "2px solid",
                      borderColor: personType === t ? "#C9A84C" : "rgba(22,39,68,0.9)",
                      background: personType === t ? "rgba(201,168,76,0.1)" : "rgba(17,31,53,0.5)",
                      color: personType === t ? "#C9A84C" : "#7A8FA8",
                      fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex",
                      alignItems: "center", justifyContent: "center", gap: 8,
                    }}>
                    {t === "PF" ? <User style={{ width: 14, height: 14 }} /> : <Building2 style={{ width: 14, height: 14 }} />}
                    {t === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}
                  </button>
                ))}
              </div>
            </Field>

            {personType === "PF" ? (
              <Field label="Nome completo" required>
                <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome completo" />
              </Field>
            ) : (
              <>
                <Field label="Razão Social" required>
                  <input style={inputStyle} value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} placeholder="Razão Social da empresa" />
                </Field>
                <Field label="Nome Fantasia">
                  <input style={inputStyle} value={nomeFantasia} onChange={e => setNomeFantasia(e.target.value)} placeholder="Nome fantasia (se houver)" />
                </Field>
              </>
            )}

            <Field label={personType === "PF" ? "CPF" : "CNPJ"}>
              <input style={inputStyle} value={cpfCnpj} onChange={e => setCpfCnpj(e.target.value)}
                placeholder={personType === "PF" ? "000.000.000-00" : "00.000.000/0001-00"} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="E-mail" required>
                <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
              </Field>
              <Field label="Telefone / WhatsApp" required>
                <input style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
              </Field>
            </div>
          </div>
        )}

        {/* ─── STEP 2: Dados Financeiros ─── */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#F0ECE4", margin: 0 }}>Dados Financeiros</h2>

            {personType === "PF" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Renda Mensal Bruta">
                    <input style={inputStyle} value={renda} onChange={e => setRenda(e.target.value)} placeholder="R$ 0,00" />
                  </Field>
                  <Field label="Data de Nascimento">
                    <input style={inputStyle} type="date" value={nascimento} onChange={e => setNascimento(e.target.value)} />
                  </Field>
                </div>
                <Field label="Estado Civil">
                  <select style={inputStyle} value={estadoCivil} onChange={e => setEstadoCivil(e.target.value)}>
                    <option value="">Selecione...</option>
                    {["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União Estável"].map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </Field>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Faturamento Mensal">
                    <input style={inputStyle} value={faturamento} onChange={e => setFaturamento(e.target.value)} placeholder="R$ 0,00" />
                  </Field>
                  <Field label="Sócio Responsável">
                    <input style={inputStyle} value={socioResponsavel} onChange={e => setSocioResponsavel(e.target.value)} placeholder="Nome do sócio" />
                  </Field>
                </div>
              </>
            )}

            <Field label="Endereço (rua, número)">
              <input style={inputStyle} value={enderecoRua} onChange={e => setEnderecoRua(e.target.value)} placeholder="Rua, número, bairro" />
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <div style={{ gridColumn: "span 2" }}>
                <Field label="Cidade" required>
                  <input style={inputStyle} value={city} onChange={e => setCity(e.target.value)} placeholder="Cidade" />
                </Field>
              </div>
              <Field label="UF" required>
                <select style={inputStyle} value={state} onChange={e => setState(e.target.value)}>
                  <option value="">UF</option>
                  {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Possui restrições no CPF/CNPJ?">
              <div className="flex gap-3">
                {[{ v: "NAO", label: "Não" }, { v: "SIM", label: "Sim" }].map(({ v, label }) => (
                  <button key={v} onClick={() => setRestricao(v as "SIM" | "NAO")}
                    style={{
                      flex: 1, padding: "9px 0", borderRadius: 10, border: "2px solid",
                      borderColor: restricao === v ? (v === "NAO" ? "#10B981" : "#EF4444") : "rgba(22,39,68,0.9)",
                      background: restricao === v ? (v === "NAO" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)") : "rgba(17,31,53,0.5)",
                      color: restricao === v ? (v === "NAO" ? "#10B981" : "#EF4444") : "#7A8FA8",
                      fontWeight: 700, fontSize: 13, cursor: "pointer",
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        )}

        {/* ─── STEP 3: Produto ─── */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#F0ECE4", margin: 0 }}>Produto de Interesse</h2>

            <Field label="Linha de crédito / Produto" required>
              <select style={inputStyle} value={creditLine} onChange={e => setCreditLine(e.target.value)}>
                <option value="">Selecione uma linha...</option>
                {CREDIT_LINES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor Aproximado Desejado" required>
                <input style={inputStyle} value={valorSolicitado} onChange={e => setValorSolicitado(e.target.value)}
                  placeholder="R$ 500.000,00" />
              </Field>
              <Field label="Prazo Desejado">
                <input style={inputStyle} value={prazo} onChange={e => setPrazo(e.target.value)}
                  placeholder="Ex: 60 meses" />
              </Field>
            </div>

            <Field label="Finalidade do crédito">
              <input style={inputStyle} value={finalidade} onChange={e => setFinalidade(e.target.value)}
                placeholder="Ex: Capital de giro, aquisição de imóvel, expansão..." />
            </Field>

            <Field label="Observações adicionais">
              <textarea
                style={{ ...inputStyle, resize: "none", minHeight: 80 }}
                value={observacoes}
                onChange={e => setObservacoes(e.target.value)}
                placeholder="Informações relevantes sobre sua operação..." />
            </Field>

            {IMOVEL_LINES.includes(creditLine) && (
              <div className="flex items-center gap-2 p-3 rounded-xl"
                style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.15)" }}>
                <Home style={{ width: 14, height: 14, color: "#C9A84C", flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: "#C9A84C", margin: 0 }}>
                  Esta linha requer imóvel em garantia. Você preencherá os dados no próximo passo.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ─── STEP 4: Imóvel ─── */}
        {needsImovel && step === 4 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <Home style={{ width: 18, height: 18, color: "#C9A84C" }} />
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#F0ECE4", margin: 0 }}>Imóvel em Garantia</h2>
            </div>
            <p style={{ fontSize: 12, color: "#7A8FA8", marginTop: 0 }}>
              Informe os dados do imóvel que será utilizado como garantia na operação.
            </p>

            <Field label="Endereço do Imóvel">
              <input style={inputStyle} value={imovelEndereco} onChange={e => setImovelEndereco(e.target.value)}
                placeholder="Rua, número, bairro" />
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <div style={{ gridColumn: "span 2" }}>
                <Field label="Cidade" required>
                  <input style={inputStyle} value={imovelCidade} onChange={e => setImovelCidade(e.target.value)} placeholder="Cidade" />
                </Field>
              </div>
              <Field label="UF">
                <select style={inputStyle} value={imovelEstado} onChange={e => setImovelEstado(e.target.value)}>
                  <option value="">UF</option>
                  {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor Estimado do Imóvel">
                <input style={inputStyle} value={imovelValor} onChange={e => setImovelValor(e.target.value)}
                  placeholder="R$ 800.000,00" />
              </Field>
              <Field label="Zona">
                <select style={inputStyle} value={imovelZona} onChange={e => setImovelZona(e.target.value as "" | "URBANO" | "RURAL")}>
                  <option value="">Selecione...</option>
                  <option value="URBANO">Urbano</option>
                  <option value="RURAL">Rural</option>
                </select>
              </Field>
            </div>

            <Field label="Você é o proprietário do imóvel?">
              <div className="flex gap-3">
                {[{ v: true, label: "Sim, sou proprietário" }, { v: false, label: "Não sou proprietário" }].map(({ v, label }) => (
                  <button key={String(v)} onClick={() => setImovelProprio(v)}
                    style={{
                      flex: 1, padding: "9px 0", borderRadius: 10, border: "2px solid",
                      borderColor: imovelProprio === v ? "#C9A84C" : "rgba(22,39,68,0.9)",
                      background: imovelProprio === v ? "rgba(201,168,76,0.1)" : "rgba(17,31,53,0.5)",
                      color: imovelProprio === v ? "#C9A84C" : "#7A8FA8",
                      fontWeight: 600, fontSize: 12, cursor: "pointer",
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        )}

        {/* ─── STEP FINAL: LGPD ─── */}
        {step === totalSteps && (
          <div className="space-y-5">
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#F0ECE4", margin: 0 }}>Autorização e LGPD</h2>

            {/* Resumo */}
            <div className="p-4 rounded-xl space-y-1.5" style={{ background: "rgba(17,31,53,0.6)", border: "1px solid rgba(22,39,68,0.9)" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#C9A84C", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Resumo da solicitação
              </p>
              {[
                { label: "Nome", value: personType === "PF" ? name : razaoSocial },
                { label: "E-mail", value: email },
                { label: "Telefone", value: phone },
                { label: "Produto", value: CREDIT_LINES.find(l => l.value === creditLine)?.label ?? creditLine },
                { label: "Valor", value: valorSolicitado },
                { label: "Partner", value: partnerName },
              ].map(({ label, value }) => value ? (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "#7A8FA8" }}>{label}</span>
                  <span style={{ fontSize: 11, color: "#F0ECE4", fontWeight: 600, textAlign: "right" }}>{value}</span>
                </div>
              ) : null)}
            </div>

            {/* LGPD text */}
            <div className="p-4 rounded-xl" style={{ background: "rgba(9,8,26,0.6)", border: "1px solid rgba(22,39,68,0.9)" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#7A8FA8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                Autorização de Uso de Dados — LGPD
              </p>
              <p style={{ fontSize: 12, color: "#7A8FA8", lineHeight: 1.7, margin: 0 }}>
                {LGPD_TEXT}
              </p>
            </div>

            {/* Checkbox */}
            <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={lgpdConsent}
                onChange={e => setLgpdConsent(e.target.checked)}
                style={{ width: 18, height: 18, marginTop: 2, accentColor: "#C9A84C", flexShrink: 0, cursor: "pointer" }}
              />
              <span style={{ fontSize: 12, color: lgpdConsent ? "#F0ECE4" : "#7A8FA8", lineHeight: 1.6 }}>
                <strong style={{ color: "#C9A84C" }}>Li e concordo</strong> com os termos de autorização acima para o tratamento dos meus dados pessoais pela V3 Partners Soluções Ltda conforme a LGPD.
              </span>
            </label>

            {error && (
              <div style={{ display: "flex", gap: 8, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                <AlertTriangle style={{ width: 14, height: 14, color: "#EF4444", flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: "#EF4444", margin: 0 }}>{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, gap: 12 }}>
          {step > 1 ? (
            <button onClick={() => { setStep(s => s - 1); setError(""); }}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10, border: "1px solid rgba(22,39,68,0.9)", background: "transparent", color: "#7A8FA8", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <ChevronLeft style={{ width: 16, height: 16 }} />
              Voltar
            </button>
          ) : <div />}

          {step < totalSteps ? (
            <button
              onClick={() => canNext() && setStep(s => s + 1)}
              disabled={!canNext()}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "10px 22px", borderRadius: 10,
                background: canNext() ? "linear-gradient(120deg, #C9A84C 0%, #E8C97A 100%)" : "rgba(22,39,68,0.5)",
                border: "none", color: canNext() ? "#09081A" : "#7A8FA8", fontSize: 13, fontWeight: 700,
                cursor: canNext() ? "pointer" : "not-allowed", transition: "all 0.15s",
              }}>
              Próximo
              <ChevronRight style={{ width: 16, height: 16 }} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!lgpdConsent || submitting}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "12px 24px", borderRadius: 10,
                background: lgpdConsent && !submitting ? "linear-gradient(120deg, #C9A84C 0%, #E8C97A 100%)" : "rgba(22,39,68,0.5)",
                border: "none", color: lgpdConsent && !submitting ? "#09081A" : "#7A8FA8", fontSize: 14, fontWeight: 700,
                cursor: lgpdConsent && !submitting ? "pointer" : "not-allowed", transition: "all 0.15s",
              }}>
              {submitting ? (
                <>
                  <div style={{ width: 16, height: 16, border: "2px solid #09081A", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  Enviando...
                </>
              ) : (
                <>
                  <CheckCircle2 style={{ width: 16, height: 16 }} />
                  Enviar Formulário
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
