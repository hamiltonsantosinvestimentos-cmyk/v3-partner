"use client";

import React, { useState } from "react";
import { CheckCircle2, ChevronRight, ChevronLeft, Loader2, Shield } from "lucide-react";
import { maskCpfCnpjInput, maskPhoneInput, isValidEmail } from "@/lib/utils";
import { UFS, fetchMunicipios } from "@/lib/br-locations";

const STEPS = [
  { label: "Identificação Inicial", key: "identificacao_inicial" },
  { label: "NDA", key: "nda" },
  { label: "Identificação Completa", key: "identificacao_completa" },
  { label: "Ativo", key: "ativo" },
  { label: "Financeiro", key: "financeiro" },
  { label: "Documentos", key: "documentos" },
];

const ASSET_TYPES = [
  { value: "precatorio", label: "Precatório" },
  { value: "direito_creditorio", label: "Direito Creditório" },
  { value: "cgi", label: "CGI" },
  { value: "cri", label: "CRI" },
  { value: "fidc", label: "FIDC" },
  { value: "outros", label: "Outros" },
];

interface IntakeWizardProps {
  token: string;
  prefill: Record<string, any>;
  anonymousId: string;
}

export function IntakeWizard({ token, prefill, anonymousId }: IntakeWizardProps) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [municipios, setMunicipios] = useState<string[]>([]);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);

  const [form, setForm] = useState({
    seller_name: prefill.seller_name || "",
    seller_cpf_cnpj: prefill.seller_cpf_cnpj || "",
    contato_nome: prefill.contato_nome || "",
    contato_email: prefill.contato_email || "",
    contato_telefone: prefill.contato_telefone || "",
    asset_type: prefill.asset_type || "precatorio",
    ente_devedor: prefill.ente_devedor || "",
    uf_ente_devedor: prefill.uf_ente_devedor || "",
    municipio_ente_devedor: prefill.municipio_ente_devedor || "",
    esfera: prefill.esfera || "",
    tribunal: prefill.tribunal || "",
    natureza: prefill.natureza || "",
    numero_processo: prefill.numero_processo || "",
    valor_face: prefill.valor_face || "",
    valor_atualizado: prefill.valor_atualizado || "",
    desagio_pretendido: prefill.desagio_pretendido || "",
    prazo_estimado_meses: prefill.prazo_estimado_meses || "",
    allows_tranching: prefill.allows_tranching || false,
    tranche_valor_minimo: prefill.tranche_valor_minimo || "",
    observacoes: "",
    nda_accepted: false,
  });

  const upd = (field: string, value: any) => setForm((p) => ({ ...p, [field]: value }));

  const selectUf = async (uf: string) => {
    upd("uf_ente_devedor", uf);
    upd("municipio_ente_devedor", "");
    setMunicipios([]);
    if (!uf) return;
    setLoadingMunicipios(true);
    try {
      setMunicipios(await fetchMunicipios(uf));
    } finally {
      setLoadingMunicipios(false);
    }
  };

  const canAdvance = () => {
    if (step === 0) return form.seller_name.trim() && isValidEmail(form.contato_email);
    if (step === 1) return form.nda_accepted;
    if (step === 2) return true;
    if (step === 3) return form.asset_type && form.ente_devedor;
    if (step === 4) return form.valor_face;
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/cm/intake/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
        <h2 className="text-2xl font-bold text-[#F5F1E8] mb-3">Formulário enviado</h2>
        <p className="text-[#9BAFC5] max-w-md">
          Seus dados foram recebidos pela equipe V3 Partners. Entraremos em contato para dar andamento à análise do seu ativo.
        </p>
        <p className="text-xs text-[#9BAFC5]/60 mt-8">Referência: {anonymousId}</p>
      </div>
    );
  }

  const inputClass = "w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-lg px-4 py-3 text-sm text-[#F5F1E8] placeholder:text-[#9BAFC5]/40 focus:border-[#C9A84C]/50 focus:outline-none transition";
  const labelClass = "block text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1.5";
  const selectClass = inputClass + " appearance-none";

  return (
    <div>
      {/* Stepper */}
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

      {/* Step Content */}
      <div className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-xl p-6 sm:p-8 mb-6">
        {step === 0 && (
          <div>
            <h3 className="text-lg font-bold text-[#F5F1E8] mb-1">Identificação Inicial</h3>
            <p className="text-xs text-[#9BAFC5] mb-6">Antes do Termo de Confidencialidade, precisamos saber quem é você — o NDA será gerado com esses dados</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Nome completo / Razão Social *</label>
                <input className={inputClass} value={form.seller_name} onChange={(e) => upd("seller_name", e.target.value)} placeholder="Nome completo ou razão social" />
              </div>
              <div>
                <label className={labelClass}>Email *</label>
                <input type="email" className={inputClass} value={form.contato_email} onChange={(e) => upd("contato_email", e.target.value)} placeholder="email@empresa.com" />
                {form.contato_email && !isValidEmail(form.contato_email) && (
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
              <p className="mb-3">Pelo presente termo, <strong className="text-[#F5F1E8]">{form.seller_name || "o cedente"}</strong> declara que as informações fornecidas são verdadeiras e autoriza a V3 Partners Soluções Ltda (CNPJ 14.219.287/0001-50) a utilizar os dados exclusivamente para fins de análise, estruturação e intermediação da operação de cessão do ativo descrito neste formulário.</p>
              <p className="mb-3">Os dados pessoais e financeiros serão tratados conforme a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018), com base legal na execução contratual (Art. 7, inc. V).</p>
              <p className="mb-3">As informações do ativo serão exibidas de forma anonimizada na vitrine da plataforma. Dados identificáveis (nome, CPF/CNPJ, número de processo) são acessíveis apenas à equipe interna V3 Partners e nunca publicados.</p>
              <p>Em caso de dúvidas: privacidade@v3partners.com.br</p>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="nda" checked={form.nda_accepted} onChange={(e) => upd("nda_accepted", e.target.checked)} className="w-5 h-5 accent-[#C9A84C]" />
              <label htmlFor="nda" className="text-sm text-[#F5F1E8]">Li e aceito o Termo de Confidencialidade e o tratamento dos dados conforme LGPD</label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 className="text-lg font-bold text-[#F5F1E8] mb-1">Identificação Completa</h3>
            <p className="text-xs text-[#9BAFC5] mb-6">Dados complementares de quem detém o ativo</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>CPF / CNPJ *</label>
                <input className={inputClass} value={form.seller_cpf_cnpj} onChange={(e) => upd("seller_cpf_cnpj", maskCpfCnpjInput(e.target.value))} placeholder="000.000.000-00" />
              </div>
              <div>
                <label className={labelClass}>Telefone (com DDD)</label>
                <input className={inputClass} value={form.contato_telefone} onChange={(e) => upd("contato_telefone", maskPhoneInput(e.target.value))} placeholder="(21) 99999-0000" />
              </div>
              <div>
                <label className={labelClass}>Nacionalidade</label>
                <input className={inputClass} value={(form as any).nacionalidade ?? ""} onChange={(e) => upd("nacionalidade", e.target.value)} placeholder="Brasileira" />
              </div>
              <div>
                <label className={labelClass}>Profissão</label>
                <input className={inputClass} value={(form as any).profissao ?? ""} onChange={(e) => upd("profissao", e.target.value)} placeholder="Advogado, Empresário, etc." />
              </div>
              <div>
                <label className={labelClass}>Estado Civil</label>
                <select className={selectClass} value={(form as any).estado_civil ?? ""} onChange={(e) => upd("estado_civil", e.target.value)}>
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
                <input className={inputClass} value={(form as any).identidade_orgao ?? ""} onChange={(e) => upd("identidade_orgao", e.target.value)} placeholder="Ex: 12.345.678-9 SSP/RJ" />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Endereço completo</label>
                <input className={inputClass} value={(form as any).endereco ?? ""} onChange={(e) => upd("endereco", e.target.value)} placeholder="Rua, número, complemento, bairro, cidade, UF, CEP" />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h3 className="text-lg font-bold text-[#F5F1E8] mb-1">Dados do Ativo</h3>
            <p className="text-xs text-[#9BAFC5] mb-6">Classificação e detalhes do direito creditório</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Tipo de Ativo *</label>
                <select className={selectClass} value={form.asset_type} onChange={(e) => upd("asset_type", e.target.value)}>
                  {ASSET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Ente Devedor *</label>
                <input className={inputClass} value={form.ente_devedor} onChange={(e) => upd("ente_devedor", e.target.value)} placeholder="Ex: União Federal, Estado do RJ" />
              </div>
              <div>
                <label className={labelClass}>UF do Ente Devedor</label>
                <select className={selectClass} value={form.uf_ente_devedor} onChange={(e) => selectUf(e.target.value)}>
                  <option value="">Selecione</option>
                  {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Município do Ente Devedor</label>
                <select className={selectClass} value={form.municipio_ente_devedor} onChange={(e) => upd("municipio_ente_devedor", e.target.value)} disabled={!form.uf_ente_devedor || loadingMunicipios}>
                  <option value="">{loadingMunicipios ? "Carregando..." : "Selecione a UF primeiro"}</option>
                  {municipios.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Esfera Judicial</label>
                <select className={selectClass} value={form.esfera} onChange={(e) => upd("esfera", e.target.value)}>
                  <option value="">Selecione</option>
                  <option value="Federal">Federal</option>
                  <option value="Estadual">Estadual</option>
                  <option value="Municipal">Municipal</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Tribunal</label>
                <input className={inputClass} value={form.tribunal} onChange={(e) => upd("tribunal", e.target.value)} placeholder="Ex: TRF-1, TJRJ, TJSP" />
              </div>
              <div>
                <label className={labelClass}>Natureza</label>
                <select className={selectClass} value={form.natureza} onChange={(e) => upd("natureza", e.target.value)}>
                  <option value="">Selecione</option>
                  <option value="Alimentar">Alimentar</option>
                  <option value="Comum">Comum</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Número do Processo (opcional)</label>
                <input className={inputClass} value={form.numero_processo} onChange={(e) => upd("numero_processo", e.target.value)} placeholder="0000000-00.0000.0.00.0000" />
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h3 className="text-lg font-bold text-[#F5F1E8] mb-1">Dados Financeiros</h3>
            <p className="text-xs text-[#9BAFC5] mb-6">Valores e condições pretendidas</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Valor de Face (R$) *</label>
                <input type="number" className={inputClass} value={form.valor_face} onChange={(e) => upd("valor_face", e.target.value)} placeholder="0,00" />
              </div>
              <div>
                <label className={labelClass}>Valor Atualizado (R$)</label>
                <input type="number" className={inputClass} value={form.valor_atualizado} onChange={(e) => upd("valor_atualizado", e.target.value)} placeholder="Se diferente do face" />
              </div>
              <div>
                <label className={labelClass}>Deságio Pretendido (%)</label>
                <input type="number" className={inputClass} value={form.desagio_pretendido} onChange={(e) => upd("desagio_pretendido", e.target.value)} placeholder="Ex: 30" />
              </div>
              <div>
                <label className={labelClass}>Prazo Estimado (meses)</label>
                <input type="number" className={inputClass} value={form.prazo_estimado_meses} onChange={(e) => upd("prazo_estimado_meses", e.target.value)} placeholder="Ex: 18" />
              </div>
              <div className="sm:col-span-2 flex items-center gap-3">
                <input type="checkbox" id="tranching" checked={form.allows_tranching} onChange={(e) => upd("allows_tranching", e.target.checked)} className="w-4 h-4 accent-[#C9A84C]" />
                <label htmlFor="tranching" className="text-sm text-[#9BAFC5]">Aceito fracionamento do ativo em tranches</label>
              </div>
              {form.allows_tranching && (
                <div>
                  <label className={labelClass}>Valor Mínimo por Fração (R$)</label>
                  <input type="number" className={inputClass} value={form.tranche_valor_minimo} onChange={(e) => upd("tranche_valor_minimo", e.target.value)} placeholder="Ex: 100000" />
                </div>
              )}
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <h3 className="text-lg font-bold text-[#F5F1E8] mb-1">Documentos</h3>
            <p className="text-xs text-[#9BAFC5] mb-6">Após o envio, a equipe V3 Partners solicitará os documentos necessários por email</p>
            <div className="bg-[#162744] border border-[#9BAFC5]/10 rounded-lg p-6 text-center">
              <p className="text-sm text-[#9BAFC5] mb-3">Documentos típicos solicitados:</p>
              <ul className="text-xs text-[#9BAFC5]/70 space-y-1">
                <li>Certidão de crédito / ofício requisitório</li>
                <li>Contrato de cessão (se houver cessão prévia)</li>
                <li>CND / certidões negativas</li>
                <li>Procuração (se representante)</li>
                <li>Documentos societários (PJ)</li>
              </ul>
              <p className="text-xs text-[#C9A84C] mt-4">O upload será habilitado após validação do cadastro.</p>
            </div>
            <div className="mt-4">
              <label className={labelClass}>Observações</label>
              <textarea className={inputClass + " min-h-[80px]"} value={form.observacoes} onChange={(e) => upd("observacoes", e.target.value)} placeholder="Informações adicionais sobre o ativo..." />
            </div>
          </div>
        )}

      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">{error}</div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-[#9BAFC5] hover:text-[#F5F1E8] disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft size={16} /> Voltar
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvance()}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold bg-[#C9A84C] text-[#09081A] hover:bg-[#E8C97A] disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Próximo <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!canAdvance() || submitting}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
            {submitting ? "Enviando..." : "Enviar Formulário"}
          </button>
        )}
      </div>
    </div>
  );
}
