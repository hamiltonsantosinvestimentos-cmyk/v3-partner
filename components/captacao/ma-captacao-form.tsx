"use client";

import { useState } from "react";
import { Building2, ChevronRight, Check, Loader2 } from "lucide-react";

interface Props {
  token: string;
  partnerName: string;
}

type Step = "identificacao" | "negocio" | "financeiro" | "contato" | "lgpd" | "sucesso";

const SETORES = [
  "Tecnologia / Fintech",
  "Saúde e Farmacêutica",
  "Varejo e E-commerce",
  "Indústria e Manufatura",
  "Agronegócio",
  "Construção Civil / Real Estate",
  "Logística e Transporte",
  "Energia e Infraestrutura",
  "Educação",
  "Serviços Financeiros",
  "Mineração e Commodities",
  "Outro",
];

const TIPOS_OPERACAO = [
  "Venda Total (100%)",
  "Venda Parcial",
  "Captação de Capital (Investidor)",
  "Joint Venture",
  "Fusão",
  "Aquisição Estratégica",
];

const ESTADOS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

const STEPS: { id: Step; label: string }[] = [
  { id: "identificacao", label: "Identificação" },
  { id: "negocio",       label: "Negócio" },
  { id: "financeiro",    label: "Financeiro" },
  { id: "contato",       label: "Contato" },
  { id: "lgpd",          label: "Autorização" },
];

function maskCNPJ(v: string) {
  return v.replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function maskPhone(v: string) {
  return v.replace(/\D/g, "")
    .slice(0, 11)
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{4})$/, "$1-$2");
}

function maskMoney(v: string) {
  const n = v.replace(/\D/g, "");
  if (!n) return "";
  return "R$ " + (parseInt(n, 10) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

const input = (extra?: React.CSSProperties): React.CSSProperties => ({
  width: "100%",
  background: "#091221",
  border: "1px solid #1E3A5F",
  borderRadius: 8,
  padding: "10px 14px",
  color: "#F0ECE4",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "'DM Sans', sans-serif",
  ...extra,
});

const label: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#7A8FA8",
  marginBottom: 6,
  letterSpacing: "0.05em",
};

const fieldGroup = (cols?: number): React.CSSProperties => ({
  display: "grid",
  gridTemplateColumns: cols ? `repeat(${cols}, 1fr)` : "1fr",
  gap: 16,
  marginBottom: 16,
});

export function MaCaptacaoForm({ token, partnerName }: Props) {
  const [step, setStep] = useState<Step>("identificacao");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    empresa:          "",
    cnpj:             "",
    setor:            "",
    cidade:           "",
    estado:           "",
    tipoOperacao:     "",
    descricao:        "",
    diferenciais:     "",
    faturamento:      "",
    ebitda:           "",
    valorPretendido:  "",
    nome:             "",
    email:            "",
    telefone:         "",
    cargo:            "",
    lgpdConsent:      false,
  });

  function set(field: keyof typeof form, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  const stepIndex = STEPS.findIndex(s => s.id === step);

  function nextStep() {
    setError("");
    if (step === "identificacao") {
      if (!form.empresa.trim()) { setError("Nome/Empresa é obrigatório."); return; }
      if (!form.setor)           { setError("Selecione o setor de atuação."); return; }
      setStep("negocio");
    } else if (step === "negocio") {
      if (!form.tipoOperacao) { setError("Selecione o tipo de operação."); return; }
      setStep("financeiro");
    } else if (step === "financeiro") {
      if (!form.faturamento) { setError("Informe o faturamento anual."); return; }
      setStep("contato");
    } else if (step === "contato") {
      if (!form.nome.trim())  { setError("Nome do responsável é obrigatório."); return; }
      if (!form.email.trim()) { setError("E-mail é obrigatório."); return; }
      if (!form.telefone.trim()) { setError("Telefone é obrigatório."); return; }
      setStep("lgpd");
    }
  }

  async function handleSubmit() {
    if (!form.lgpdConsent) { setError("Você precisa autorizar o tratamento dos dados para continuar."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ma-captacao/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...form }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erro ao enviar. Tente novamente."); return; }
      setStep("sucesso");
    } catch {
      setError("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "sucesso") {
    return (
      <div style={{ textAlign: "center", padding: "48px 24px" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(201,168,76,0.12)", border: "2px solid rgba(201,168,76,0.4)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <Check style={{ width: 32, height: 32, color: "#C9A84C" }} />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#F0ECE4", marginBottom: 10 }}>
          Formulário enviado com sucesso!
        </h2>
        <p style={{ fontSize: 14, color: "#7A8FA8", lineHeight: 1.6, maxWidth: 440, margin: "0 auto" }}>
          Suas informações foram recebidas e encaminhadas ao parceiro <strong style={{ color: "#C9A84C" }}>{partnerName}</strong>.
          A equipe V3 Partners entrará em contato em breve.
        </p>
        <div style={{ marginTop: 28, padding: "16px 20px", borderRadius: 12, background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.15)", maxWidth: 380, margin: "28px auto 0" }}>
          <p style={{ fontSize: 12, color: "#7A8FA8", margin: 0 }}>
            Seus dados estão protegidos pela LGPD e serão utilizados exclusivamente para fins de análise e contato.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Progress */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= stepIndex ? "#C9A84C" : "rgba(201,168,76,0.15)", transition: "background 0.3s" }} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "#C9A84C", fontWeight: 700 }}>
            {STEPS[stepIndex]?.label}
          </span>
          <span style={{ fontSize: 12, color: "#7A8FA8" }}>
            {stepIndex + 1} de {STEPS.length}
          </span>
        </div>
      </div>

      {/* ── STEP 1: IDENTIFICAÇÃO ── */}
      {step === "identificacao" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <Building2 style={{ width: 18, height: 18, color: "#C9A84C" }} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#F0ECE4" }}>Identificação da Empresa</h3>
          </div>
          <div style={fieldGroup()}>
            <label style={label}>
              Razão Social / Nome da Empresa *
              <input
                style={input({ marginTop: 6 })}
                value={form.empresa}
                onChange={e => set("empresa", e.target.value)}
                placeholder="Ex: Empresa ABC Ltda"
              />
            </label>
          </div>
          <div style={fieldGroup(2)}>
            <label style={label}>
              CNPJ
              <input
                style={input({ marginTop: 6 })}
                value={form.cnpj}
                onChange={e => set("cnpj", maskCNPJ(e.target.value))}
                placeholder="00.000.000/0000-00"
              />
            </label>
            <label style={label}>
              Setor de Atuação *
              <select style={{ ...input({ marginTop: 6 }), color: form.setor ? "#F0ECE4" : "#7A8FA8" }} value={form.setor} onChange={e => set("setor", e.target.value)}>
                <option value="">Selecione...</option>
                {SETORES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <div style={fieldGroup(2)}>
            <label style={label}>
              Cidade
              <input style={input({ marginTop: 6 })} value={form.cidade} onChange={e => set("cidade", e.target.value)} placeholder="Cidade" />
            </label>
            <label style={label}>
              Estado
              <select style={{ ...input({ marginTop: 6 }), color: form.estado ? "#F0ECE4" : "#7A8FA8" }} value={form.estado} onChange={e => set("estado", e.target.value)}>
                <option value="">UF</option>
                {ESTADOS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </label>
          </div>
        </div>
      )}

      {/* ── STEP 2: NEGÓCIO ── */}
      {step === "negocio" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <Building2 style={{ width: 18, height: 18, color: "#C9A84C" }} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#F0ECE4" }}>Sobre o Negócio</h3>
          </div>
          <div style={fieldGroup()}>
            <label style={label}>
              Tipo de Operação Desejada *
              <select style={{ ...input({ marginTop: 6 }), color: form.tipoOperacao ? "#F0ECE4" : "#7A8FA8" }} value={form.tipoOperacao} onChange={e => set("tipoOperacao", e.target.value)}>
                <option value="">Selecione...</option>
                {TIPOS_OPERACAO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>
          <div style={fieldGroup()}>
            <label style={label}>
              Descrição do Negócio
              <textarea
                style={{ ...input({ marginTop: 6 }), height: 100, resize: "vertical" } as React.CSSProperties}
                value={form.descricao}
                onChange={e => set("descricao", e.target.value)}
                placeholder="Descreva brevemente a empresa, produtos/serviços e modelo de negócio..."
              />
            </label>
          </div>
          <div style={fieldGroup()}>
            <label style={label}>
              Diferenciais Competitivos
              <textarea
                style={{ ...input({ marginTop: 6 }), height: 80, resize: "vertical" } as React.CSSProperties}
                value={form.diferenciais}
                onChange={e => set("diferenciais", e.target.value)}
                placeholder="Quais são os principais diferenciais da empresa no mercado?"
              />
            </label>
          </div>
        </div>
      )}

      {/* ── STEP 3: FINANCEIRO ── */}
      {step === "financeiro" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <Building2 style={{ width: 18, height: 18, color: "#C9A84C" }} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#F0ECE4" }}>Dados Financeiros</h3>
          </div>
          <p style={{ fontSize: 13, color: "#7A8FA8", marginBottom: 20 }}>
            Informações aproximadas do último exercício fiscal.
          </p>
          <div style={fieldGroup()}>
            <label style={label}>
              Faturamento Anual (R$) *
              <input
                style={input({ marginTop: 6 })}
                value={form.faturamento}
                onChange={e => set("faturamento", maskMoney(e.target.value))}
                placeholder="R$ 0,00"
              />
            </label>
          </div>
          <div style={fieldGroup(2)}>
            <label style={label}>
              EBITDA Anual (R$)
              <input
                style={input({ marginTop: 6 })}
                value={form.ebitda}
                onChange={e => set("ebitda", maskMoney(e.target.value))}
                placeholder="R$ 0,00"
              />
            </label>
            <label style={label}>
              Valor Pretendido (R$)
              <input
                style={input({ marginTop: 6 })}
                value={form.valorPretendido}
                onChange={e => set("valorPretendido", maskMoney(e.target.value))}
                placeholder="R$ 0,00"
              />
            </label>
          </div>
        </div>
      )}

      {/* ── STEP 4: CONTATO ── */}
      {step === "contato" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <Building2 style={{ width: 18, height: 18, color: "#C9A84C" }} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#F0ECE4" }}>Dados do Responsável</h3>
          </div>
          <div style={fieldGroup()}>
            <label style={label}>
              Nome Completo *
              <input style={input({ marginTop: 6 })} value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Seu nome completo" />
            </label>
          </div>
          <div style={fieldGroup(2)}>
            <label style={label}>
              E-mail *
              <input style={input({ marginTop: 6 })} type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@empresa.com.br" />
            </label>
            <label style={label}>
              Telefone / WhatsApp *
              <input style={input({ marginTop: 6 })} value={form.telefone} onChange={e => set("telefone", maskPhone(e.target.value))} placeholder="(11) 99999-9999" />
            </label>
          </div>
          <div style={fieldGroup()}>
            <label style={label}>
              Cargo / Função
              <input style={input({ marginTop: 6 })} value={form.cargo} onChange={e => set("cargo", e.target.value)} placeholder="Ex: CEO, Diretor, Sócio" />
            </label>
          </div>
        </div>
      )}

      {/* ── STEP 5: LGPD ── */}
      {step === "lgpd" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <Building2 style={{ width: 18, height: 18, color: "#C9A84C" }} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#F0ECE4" }}>Autorização de Dados</h3>
          </div>
          <div style={{ padding: "20px 20px", background: "rgba(255,255,255,0.02)", border: "1px solid #1E3A5F", borderRadius: 10, marginBottom: 20, fontSize: 13, color: "#7A8FA8", lineHeight: 1.7 }}>
            <p style={{ margin: "0 0 12px" }}>
              Ao enviar este formulário, você autoriza a <strong style={{ color: "#F0ECE4" }}>V3 Partners Soluções Ltda</strong> (CNPJ 14.219.287/0001-50) a coletar e tratar os dados fornecidos para fins de análise de oportunidades de M&A e contato comercial.
            </p>
            <p style={{ margin: 0 }}>
              As informações serão tratadas em conformidade com a <strong style={{ color: "#F0ECE4" }}>Lei Geral de Proteção de Dados (LGPD · Lei nº 13.709/2018)</strong> e poderão ser compartilhadas com o parceiro {partnerName} exclusivamente para os fins descritos.
            </p>
          </div>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={form.lgpdConsent}
              onChange={e => set("lgpdConsent", e.target.checked)}
              style={{ width: 18, height: 18, marginTop: 2, accentColor: "#C9A84C", flexShrink: 0 }}
            />
            <span style={{ fontSize: 13, color: "#F0ECE4", lineHeight: 1.5 }}>
              Li e <strong>concordo</strong> com o tratamento dos meus dados pessoais e corporativos conforme descrito acima.
            </span>
          </label>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#F87171", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28, gap: 12 }}>
        {step !== "identificacao" ? (
          <button
            onClick={() => {
              const idx = STEPS.findIndex(s => s.id === step);
              if (idx > 0) setStep(STEPS[idx - 1].id);
            }}
            style={{ padding: "10px 22px", borderRadius: 8, border: "1px solid #1E3A5F", background: "transparent", color: "#7A8FA8", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
          >
            Voltar
          </button>
        ) : <div />}

        {step !== "lgpd" ? (
          <button
            onClick={nextStep}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 28px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #C9A84C, #E8C97A)", color: "#09081A", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
          >
            Continuar <ChevronRight style={{ width: 16, height: 16 }} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading || !form.lgpdConsent}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 28px", borderRadius: 8, border: "none", background: loading || !form.lgpdConsent ? "#243A66" : "linear-gradient(135deg, #C9A84C, #E8C97A)", color: loading || !form.lgpdConsent ? "#7A8FA8" : "#09081A", fontSize: 14, fontWeight: 700, cursor: loading || !form.lgpdConsent ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif" }}
          >
            {loading ? <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> : <Check style={{ width: 16, height: 16 }} />}
            {loading ? "Enviando..." : "Enviar Formulário"}
          </button>
        )}
      </div>
    </div>
  );
}
