"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle2, ChevronRight, ChevronLeft, Loader2, Shield, Search, Upload } from "lucide-react";
import { maskCpfCnpjInput, maskPhoneInput, isValidEmail, maskCurrencyBRLInput, parseCurrencyBRLInput, formatCurrencyBRLFromNumber } from "@/lib/utils";

const STEPS = [
  { label: "Identificação Inicial", key: "identificacao_inicial" },
  { label: "NDA", key: "nda" },
  { label: "Identificação Completa", key: "identificacao_completa" },
  { label: "Mandato de Busca", key: "mandato" },
  { label: "Envio", key: "envio" },
];

interface BuyIntakeWizardProps {
  token: string;
  prefill: Record<string, any>;
  originPartnerId?: string;
  /** Formulário principal já travado (intake_locked=true) — renderiza só o
   *  upload de documentos, sem os passos de identificação/NDA/mandato. */
  lockedFollowUp?: boolean;
}

const DOC_TYPES = [
  { type: "loi_mou", label: "Carta de Intenções (LOI) ou Memorando de Entendimento (MOU)" },
  { type: "procuracao", label: "Procuração / autorização" },
] as const;

export function BuyIntakeWizard({ token, prefill, originPartnerId, lockedFollowUp }: BuyIntakeWizardProps) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [docs, setDocs] = useState<{ id: string; document_type: string }[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/cm/intake/buy/${token}/documents`)
      .then((res) => res.json())
      .then((json) => setDocs(json.documents ?? []))
      .catch(() => setDocs([]));
  }, [token]);

  const hasDoc = (type: string) => docs.some((d) => d.document_type === type);

  const uploadDoc = async (file: File, documentType: string) => {
    setUploadingDoc(documentType);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_type", documentType);
      const res = await fetch(`/api/cm/intake/buy/${token}/documents`, { method: "POST", body: formData });
      const json = await res.json();
      if (res.ok) {
        setDocs((prev) => [...prev, json.document]);
      } else {
        alert(json.error ?? "Erro no upload");
      }
    } catch {
      alert("Erro de conexão");
    } finally {
      setUploadingDoc(null);
    }
  };

  if (lockedFollowUp) {
    return (
      <div className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-xl p-6 sm:p-8">
        <h3 className="text-lg font-bold text-[#F5F1E8] mb-1">Envio de documentos</h3>
        <p className="text-xs text-[#9BAFC5] mb-6">
          Seu cadastro já foi registrado. Você ainda pode enviar ou completar os documentos abaixo — eles ficam retidos para validação da Mesa V3 antes de liberar o Full DD.
        </p>
        <div className="space-y-2">
          {DOC_TYPES.map(({ type, label }) => (
            <div key={type} className="flex items-center justify-between gap-3 bg-[#162744] border border-[#9BAFC5]/10 rounded-lg px-4 py-3">
              <span className="text-xs text-[#F5F1E8]">{label}</span>
              {hasDoc(type) ? (
                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 size={12} /> Enviado</span>
              ) : (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] text-[#9BAFC5] font-bold uppercase tracking-wider">Pendente</span>
                  <label className="flex items-center gap-1.5 px-3 py-1.5 bg-[#12112A] border border-[#9BAFC5]/15 rounded text-[#9BAFC5] text-[10px] font-bold hover:border-[#C9A84C]/30 hover:text-[#C9A84C] transition cursor-pointer">
                    {uploadingDoc === type ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                    Enviar
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.png"
                      onChange={(e) => { if (e.target.files?.[0]) uploadDoc(e.target.files[0], type); }} />
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const [form, setForm] = useState({
    nome_contato: prefill.nome_contato || "",
    email: prefill.email || "",
    telefone: prefill.telefone || "",
    empresa: prefill.empresa || "",
    cnpj: prefill.cnpj || "",
    cpf: prefill.cpf || "",
    nacionalidade: prefill.nacionalidade || "",
    profissao: prefill.profissao || "",
    estado_civil: prefill.estado_civil || "",
    identidade_orgao: prefill.identidade_orgao || "",
    endereco: prefill.endereco || "",
    asset_types_preferidos: prefill.asset_types_preferidos || [],
    jurisdicao_alvo: prefill.jurisdicao_alvo || [],
    natureza_preferida: prefill.natureza_preferida || [],
    ticket_min: prefill.ticket_min ? formatCurrencyBRLFromNumber(Number(prefill.ticket_min)) : "",
    ticket_max: prefill.ticket_max ? formatCurrencyBRLFromNumber(Number(prefill.ticket_max)) : "",
    desagio_min: prefill.desagio_min || "",
    criterios: prefill.criterios || "",
    nda_accepted: false,
    purchase_frequency_type: prefill.purchase_frequency_type || "SINGLE_PURCHASE",
    recurrence_months: prefill.recurrence_months ? String(prefill.recurrence_months) : "",
  });

  const upd = (field: string, value: any) => setForm((p) => ({ ...p, [field]: value }));

  const toggleArray = (field: string, value: string) => {
    const arr = (form as any)[field] || [];
    upd(field, arr.includes(value) ? arr.filter((v: string) => v !== value) : [...arr, value]);
  };

  const canAdvance = () => {
    if (step === 0) return form.nome_contato.trim() && isValidEmail(form.email);
    if (step === 1) return form.nda_accepted;
    if (step === 2) return true; // Documentos KYC nao bloqueiam mais o avanco — ficam "Pendente" na Mesa (correcao Mesa Operacional 2026-07-15)
    if (step === 3) return form.asset_types_preferidos.length > 0;
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/cm/intake/buy/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          ticket_min: form.ticket_min ? parseCurrencyBRLInput(form.ticket_min) : "",
          ticket_max: form.ticket_max ? parseCurrencyBRLInput(form.ticket_max) : "",
          recurrence_months: form.purchase_frequency_type === "RECURRENT_MONTHLY" && form.recurrence_months
            ? Number(form.recurrence_months)
            : null,
          origin_partner_id: originPartnerId ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar");
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-[#F5F1E8] mb-3">Cadastro recebido</h2>
        <p className="text-[#9BAFC5] max-w-md">
          Seu interesse foi registrado. A equipe V3 Partners entrará em contato quando ativos compatíveis com seu perfil estiverem disponíveis na vitrine.
        </p>
        <p className="text-xs text-[#9BAFC5]/60 mt-8">Alertas automáticos ativados para seu perfil.</p>
      </div>
    );
  }

  const inputClass = "w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-lg px-4 py-3 text-sm text-[#F5F1E8] placeholder:text-[#9BAFC5]/40 focus:border-[#C9A84C]/50 focus:outline-none transition";
  const labelClass = "block text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1.5";
  const selectClass = inputClass + " appearance-none";
  const chipClass = (active: boolean) => `px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition ${active ? "bg-[#C9A84C] text-[#09081A]" : "bg-[#162744] text-[#9BAFC5] hover:text-[#F5F1E8]"}`;

  return (
    <div>
      <div className="flex items-center justify-center gap-2 mb-10 flex-wrap">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.key}>
            {i > 0 && <div className={`hidden sm:block w-8 h-px ${i <= step ? "bg-[#C9A84C]/50" : "bg-[#9BAFC5]/15"}`} />}
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                i < step ? "bg-emerald-500 text-white" :
                i === step ? "bg-[#C9A84C] text-[#09081A]" :
                "border border-[#9BAFC5]/30 text-[#9BAFC5]"
              }`}>
                {i < step ? <CheckCircle2 size={14} /> : i + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:inline ${
                i === step ? "text-[#C9A84C]" : "text-[#9BAFC5]/60"
              }`}>{s.label}</span>
            </div>
          </React.Fragment>
        ))}
      </div>

      <div className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-xl p-6 sm:p-8 mb-6">
        {step === 0 && (
          <div>
            <h3 className="text-lg font-bold text-[#F5F1E8] mb-1">Identificação Inicial</h3>
            <p className="text-xs text-[#9BAFC5] mb-6">Antes do Termo de Confidencialidade, precisamos saber quem é você — o NDA será gerado com esses dados</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Nome completo / Razão Social *</label>
                <input className={inputClass} value={form.nome_contato} onChange={(e) => upd("nome_contato", e.target.value)} placeholder="Nome completo ou razão social" />
              </div>
              <div>
                <label className={labelClass}>Email *</label>
                <input type="email" className={inputClass} value={form.email} onChange={(e) => upd("email", e.target.value)} placeholder="email@empresa.com" />
                {form.email && !isValidEmail(form.email) && (
                  <p className="text-[10px] text-red-400 mt-1">Email inválido</p>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h3 className="text-lg font-bold text-[#F5F1E8] mb-1">Termo de Confidencialidade</h3>
            <p className="text-xs text-[#9BAFC5] mb-6">Leia e aceite os termos antes de prosseguir</p>
            <div className="bg-[#162744] border border-[#9BAFC5]/10 rounded-lg p-6 mb-6 max-h-[200px] overflow-y-auto text-xs text-[#9BAFC5]/80 leading-relaxed">
              <p className="mb-3">Pelo presente termo, <strong className="text-[#F5F1E8]">{form.nome_contato || "o comprador"}</strong> declara que manterá em sigilo absoluto todas as informações acessadas na plataforma V3 Partners, incluindo dados de ativos, valores, condições de negociação e identidade das partes envolvidas.</p>
              <p className="mb-3">Compromete-se a não divulgar, compartilhar ou utilizar as informações para qualquer finalidade diferente da análise de viabilidade de aquisição dos ativos disponibilizados pela V3 Partners Soluções Ltda (CNPJ 14.219.287/0001-50).</p>
              <p className="mb-3">O descumprimento deste termo sujeita o infrator às penalidades previstas em lei, incluindo indenização por perdas e danos, além de vedação de negociação direta com cedentes identificados através da plataforma (cláusula de não circunvenção).</p>
              <p>Os dados pessoais serão tratados conforme LGPD (Lei 13.709/2018), Art. 7, inc. V. Contato: privacidade@v3partners.com.br</p>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="nda" checked={form.nda_accepted} onChange={(e) => upd("nda_accepted", e.target.checked)} className="w-5 h-5 accent-[#C9A84C]" />
              <label htmlFor="nda" className="text-sm text-[#F5F1E8]">Li e aceito o Termo de Confidencialidade, o Acordo de Não Circunvenção e o tratamento dos dados conforme LGPD</label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 className="text-lg font-bold text-[#F5F1E8] mb-1">Identificação Completa</h3>
            <p className="text-xs text-[#9BAFC5] mb-6">Dados complementares de quem busca adquirir ativos</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>CPF</label>
                <input className={inputClass} value={form.cpf} onChange={(e) => upd("cpf", maskCpfCnpjInput(e.target.value))} placeholder="000.000.000-00" />
              </div>
              <div>
                <label className={labelClass}>CNPJ (se PJ)</label>
                <input className={inputClass} value={form.cnpj} onChange={(e) => upd("cnpj", maskCpfCnpjInput(e.target.value))} placeholder="00.000.000/0001-00" />
              </div>
              <div>
                <label className={labelClass}>Empresa</label>
                <input className={inputClass} value={form.empresa} onChange={(e) => upd("empresa", e.target.value)} placeholder="Nome da empresa ou fundo" />
              </div>
              <div>
                <label className={labelClass}>Telefone (com DDD)</label>
                <input className={inputClass} value={form.telefone} onChange={(e) => upd("telefone", maskPhoneInput(e.target.value))} placeholder="(21) 99999-0000" />
              </div>
              <div>
                <label className={labelClass}>Nacionalidade</label>
                <input className={inputClass} value={form.nacionalidade} onChange={(e) => upd("nacionalidade", e.target.value)} placeholder="Brasileira" />
              </div>
              <div>
                <label className={labelClass}>Profissão</label>
                <input className={inputClass} value={form.profissao} onChange={(e) => upd("profissao", e.target.value)} placeholder="Advogado, Gestor de Fundos, etc." />
              </div>
              <div>
                <label className={labelClass}>Estado Civil</label>
                <select className={selectClass} value={form.estado_civil} onChange={(e) => upd("estado_civil", e.target.value)}>
                  <option value="">Selecione</option>
                  <option value="Solteiro(a)">Solteiro(a)</option>
                  <option value="Casado(a)">Casado(a)</option>
                  <option value="Divorciado(a)">Divorciado(a)</option>
                  <option value="Viúvo(a)">Viúvo(a)</option>
                  <option value="União Estável">União Estável</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Identidade / Órgão Expedidor</label>
                <input className={inputClass} value={form.identidade_orgao} onChange={(e) => upd("identidade_orgao", e.target.value)} placeholder="Ex: 12.345.678-9 SSP/RJ" />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Endereço completo</label>
                <input className={inputClass} value={form.endereco} onChange={(e) => upd("endereco", e.target.value)} placeholder="Rua, número, complemento, bairro, cidade, UF, CEP" />
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-[#9BAFC5]/10">
              <label className={labelClass}>Documentos (KYC)</label>
              <p className="text-[11px] text-[#9BAFC5]/70 mb-2">Você pode enviar agora ou depois, o cadastro não fica bloqueado. Documentos pendentes ficam retidos para validação da Mesa V3 antes de liberar o Full DD.</p>
              <div className="space-y-2 mt-2">
                {DOC_TYPES.map(({ type, label }) => (
                  <div key={type} className="flex items-center justify-between gap-3 bg-[#162744] border border-[#9BAFC5]/10 rounded-lg px-4 py-3">
                    <span className="text-xs text-[#F5F1E8]">{label}</span>
                    {hasDoc(type) ? (
                      <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 size={12} /> Enviado</span>
                    ) : (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] text-[#9BAFC5] font-bold uppercase tracking-wider">Pendente</span>
                        <label className="flex items-center gap-1.5 px-3 py-1.5 bg-[#12112A] border border-[#9BAFC5]/15 rounded text-[#9BAFC5] text-[10px] font-bold hover:border-[#C9A84C]/30 hover:text-[#C9A84C] transition cursor-pointer">
                          {uploadingDoc === type ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                          Enviar
                          <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.png"
                            onChange={(e) => { if (e.target.files?.[0]) uploadDoc(e.target.files[0], type); }} />
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h3 className="text-lg font-bold text-[#F5F1E8] mb-1">Mandato de Busca</h3>
            <p className="text-xs text-[#9BAFC5] mb-6">Defina o perfil de ativos que você procura</p>
            <div className="space-y-5">
              <div>
                <label className={labelClass}>Tipos de ativo de interesse *</label>
                <div className="flex flex-wrap gap-2">
                  {["precatorio", "direito_creditorio", "ipi", "icms", "outros"].map((t) => (
                    <button key={t} type="button" onClick={() => toggleArray("asset_types_preferidos", t)}
                      className={chipClass(form.asset_types_preferidos.includes(t))}>
                      {t === "precatorio" ? "Precatório" : t === "direito_creditorio" ? "Dir. Creditório" : t.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>Jurisdição de interesse</label>
                <div className="flex flex-wrap gap-2">
                  {["Federal", "Estadual", "Municipal"].map((j) => (
                    <button key={j} type="button" onClick={() => toggleArray("jurisdicao_alvo", j)}
                      className={chipClass((form.jurisdicao_alvo || []).includes(j))}>
                      {j}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>Natureza preferida</label>
                <div className="flex flex-wrap gap-2">
                  {["Alimentar", "Comum"].map((n) => (
                    <button key={n} type="button" onClick={() => toggleArray("natureza_preferida", n)}
                      className={chipClass((form.natureza_preferida || []).includes(n))}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Ticket mínimo (R$)</label>
                  <input inputMode="numeric" className={inputClass} value={form.ticket_min} onChange={(e) => upd("ticket_min", maskCurrencyBRLInput(e.target.value))} placeholder="0,00" />
                </div>
                <div>
                  <label className={labelClass}>Ticket máximo (R$)</label>
                  <input inputMode="numeric" className={inputClass} value={form.ticket_max} onChange={(e) => upd("ticket_max", maskCurrencyBRLInput(e.target.value))} placeholder="0,00" />
                </div>
                <div>
                  <label className={labelClass}>Deságio mínimo (%)</label>
                  <input type="number" className={inputClass} value={form.desagio_min} onChange={(e) => upd("desagio_min", e.target.value)} placeholder="Ex: 25" />
                </div>
              </div>
              <div>
                <label className={labelClass}>Frequência de Compra</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  <button type="button" onClick={() => upd("purchase_frequency_type", "SINGLE_PURCHASE")}
                    className={chipClass(form.purchase_frequency_type === "SINGLE_PURCHASE")}>
                    Compra Única
                  </button>
                  <button type="button" onClick={() => upd("purchase_frequency_type", "RECURRENT_MONTHLY")}
                    className={chipClass(form.purchase_frequency_type === "RECURRENT_MONTHLY")}>
                    Recorrência Mensal
                  </button>
                </div>
                {form.purchase_frequency_type === "RECURRENT_MONTHLY" && (
                  <div className="max-w-[180px]">
                    <label className={labelClass}>Por quantos meses?</label>
                    <input type="number" min={1} max={60} className={inputClass} value={form.recurrence_months}
                      onChange={(e) => upd("recurrence_months", e.target.value)} placeholder="Ex: 12" />
                  </div>
                )}
              </div>
              <div>
                <label className={labelClass}>Critérios adicionais</label>
                <textarea className={inputClass + " min-h-[80px]"} value={form.criterios} onChange={(e) => upd("criterios", e.target.value)} placeholder="Preferências específicas, restrições, prazos de interesse..." />
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="text-center py-8">
            <Search className="w-12 h-12 text-[#C9A84C] mx-auto mb-4" />
            <h3 className="text-lg font-bold text-[#F5F1E8] mb-2">Confirmar envio</h3>
            <p className="text-sm text-[#9BAFC5] max-w-md mx-auto mb-6">
              Ao enviar, seu perfil de comprador será ativado no motor de matchmaking da V3 Partners. Você receberá alertas automáticos por email quando ativos compatíveis forem publicados na vitrine.
            </p>
            <div className="bg-[#162744] rounded-lg p-4 text-left max-w-sm mx-auto text-xs text-[#9BAFC5] space-y-1">
              <div>Nome: <span className="text-[#F5F1E8]">{form.nome_contato}</span></div>
              <div>Email: <span className="text-[#F5F1E8]">{form.email}</span></div>
              <div>Tipos: <span className="text-[#F5F1E8]">{form.asset_types_preferidos.join(", ") || "—"}</span></div>
              <div>Ticket: <span className="text-[#F5F1E8]">R$ {form.ticket_min || "0"} — R$ {form.ticket_max || "ilimitado"}</span></div>
              <div>Frequência: <span className="text-[#F5F1E8]">
                {form.purchase_frequency_type === "RECURRENT_MONTHLY"
                  ? `Recorrência Mensal (${form.recurrence_months || "?"} meses)`
                  : "Compra Única"}
              </span></div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">{error}</div>
      )}

      <div className="flex items-center justify-between">
        <button onClick={() => setStep((s) => s - 1)} disabled={step === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-[#9BAFC5] hover:text-[#F5F1E8] disabled:opacity-30 disabled:cursor-not-allowed transition">
          <ChevronLeft size={16} /> Voltar
        </button>
        {step < STEPS.length - 1 ? (
          <button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance()}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold bg-[#C9A84C] text-[#09081A] hover:bg-[#E8C97A] disabled:opacity-40 disabled:cursor-not-allowed transition">
            Próximo <ChevronRight size={16} />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition">
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            {submitting ? "Enviando..." : "Ativar mandato de busca"}
          </button>
        )}
      </div>
    </div>
  );
}
