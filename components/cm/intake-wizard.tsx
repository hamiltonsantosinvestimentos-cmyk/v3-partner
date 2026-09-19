"use client";

import React, { useState, useEffect, useRef } from "react";
import { CheckCircle2, ChevronRight, ChevronLeft, Loader2, Shield, Save } from "lucide-react";
import { maskCpfCnpjInput, maskPhoneInput, isValidEmail, isValidCpfCnpj, maskCurrencyBRLInput, parseCurrencyBRLInput, formatCurrencyBRLFromNumber } from "@/lib/utils";
import { UFS, fetchMunicipios } from "@/lib/br-locations";
import { fetchCep, buildEnderecoFromCep, formatCepMask } from "@/lib/viacep";
import { Plus, Trash2 } from "lucide-react";

const STEPS = [
  { label: "Identificação Inicial", key: "identificacao_inicial" },
  { label: "NDA", key: "nda" },
  { label: "Identificação Completa", key: "identificacao_completa" },
  { label: "Intermediários", key: "intermediarios" },
  { label: "Ativo", key: "ativo" },
  { label: "Financeiro", key: "financeiro" },
  { label: "Documentos", key: "documentos" },
];

interface Intermediario {
  nome: string;
  email: string;
  whatsapp: string;
}

const CHECKLIST_ITEMS = [
  { key: "checklist_contato_direto", label: "Tenho contato direto com o cedente/detentor do ativo, não é uma indicação de terceiros sem confirmação." },
  { key: "checklist_ativo_livre_onus", label: "Pelo meu conhecimento, o ativo está livre de ônus, gravames, penhoras ou cessões anteriores." },
  { key: "checklist_regularidade_fiscal", label: "O cedente não possui, pelo meu conhecimento, pendências fiscais que impeçam a transferência." },
  { key: "checklist_intermediarios_cientes", label: "Todos os intermediários listados abaixo estão cientes de que serão contatados pela V3 Partners para qualificação." },
];

// Padrao V3 (19/09/2026, pedido de Joao): dropdowns sempre em ordem
// alfabetica, desktop e mobile, para facilitar a visualizacao.
const ASSET_TYPES = [
  { value: "direito_creditorio", label: "Direito Creditório" },
  { value: "icms", label: "ICMS" },
  { value: "ipi", label: "IPI" },
  { value: "outros", label: "Outros" },
  { value: "precatorio", label: "Precatório" },
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
  // Fix 17/09/2026: o anonymous_id definitivo so existe depois do POST (a
  // classificacao escolhida nesta tela e o que decide a serie/esfera do
  // codigo real, emitido no servidor). O prop anonymousId e so o placeholder
  // pre-classificacao, nunca deve aparecer na tela de confirmacao.
  const [finalAnonymousId, setFinalAnonymousId] = useState("");
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
    valor_face: prefill.valor_face ? formatCurrencyBRLFromNumber(Number(prefill.valor_face)) : "",
    valor_atualizado: prefill.valor_atualizado ? formatCurrencyBRLFromNumber(Number(prefill.valor_atualizado)) : "",
    desagio_pretendido: prefill.desagio_pretendido || "",
    prazo_estimado_meses: prefill.prazo_estimado_meses || "",
    allows_tranching: prefill.allows_tranching || false,
    tranche_valor_minimo: prefill.tranche_valor_minimo ? formatCurrencyBRLFromNumber(Number(prefill.tranche_valor_minimo)) : "",
    observacoes: "",
    nda_accepted: false,
    cep: "",
    numero: "",
    complemento: "",
    checklist_contato_direto: false,
    checklist_ativo_livre_onus: false,
    checklist_regularidade_fiscal: false,
    checklist_intermediarios_cientes: false,
  });

  const [intermediarios, setIntermediarios] = useState<Intermediario[]>([]);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");

  // Rascunho automatico (19/09/2026, pedido de Joao): formulario publico de 7
  // passos, longo o suficiente pra ser interrompido no meio (tab fechada sem
  // querer, sessao expirada, celular travou). Padrao ja estabelecido em
  // 09/09/2026 pra formularios longos deste sistema (localStorage por passo +
  // botao "Salvar Rascunho"), nunca aplicado aqui ate agora. Chave por token
  // -- cada link de intake e um cedente/parceiro diferente, nunca cruza dado
  // entre eles no mesmo navegador.
  const draftKey = `v3-intake-cm-draft-${token}`;
  const restoredRef = useRef(false);
  const [draftRestoredAt, setDraftRestoredAt] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.form) setForm((p) => ({ ...p, ...draft.form }));
      if (Array.isArray(draft.intermediarios)) setIntermediarios(draft.intermediarios);
      if (typeof draft.step === "number") setStep(draft.step);
      if (draft.savedAt) setDraftRestoredAt(draft.savedAt);
    } catch {
      // Rascunho corrompido ou localStorage indisponivel (aba anonima,
      // storage bloqueado) -- nunca quebra o formulario, so ignora e segue
      // do zero, mesmo criterio de qualquer leitura de storage do navegador.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveDraft = (silent = false) => {
    try {
      const savedAt = new Date().toISOString();
      localStorage.setItem(draftKey, JSON.stringify({ form, intermediarios, step, savedAt }));
      if (!silent) setDraftSavedAt(savedAt);
    } catch {
      // Storage indisponivel -- o botao de salvar rascunho vira um no-op
      // silencioso nesse caso, nunca um erro pro cedente/parceiro.
    }
  };

  // Autosave silencioso a cada mudanca real de passo (nao a cada tecla, pra
  // nao gravar centenas de vezes por segundo enquanto a pessoa digita).
  useEffect(() => {
    if (!restoredRef.current) return;
    saveDraft(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const upd = (field: string, value: any) => setForm((p) => ({ ...p, [field]: value }));

  const addIntermediario = () => setIntermediarios((prev) => [...prev, { nome: "", email: "", whatsapp: "" }]);
  const updIntermediario = (i: number, field: keyof Intermediario, value: string) =>
    setIntermediarios((prev) => prev.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));
  const removeIntermediario = (i: number) => setIntermediarios((prev) => prev.filter((_, idx) => idx !== i));

  const handleCepBlur = async () => {
    const digits = form.cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    setCepError("");
    try {
      const result = await fetchCep(digits);
      if (!result) {
        setCepError("CEP não encontrado, preencha o endereço manualmente abaixo.");
        return;
      }
      upd("endereco", buildEnderecoFromCep(result, form.numero, form.complemento));
      upd("_cep_logradouro", result.logradouro);
      upd("_cep_bairro", result.bairro);
      upd("_cep_cidade", result.localidade);
      upd("_cep_uf", result.uf);
    } finally {
      setCepLoading(false);
    }
  };

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
    // 10/09/2026: CPF/CNPJ passa a ser exigido e validado por digito verificador real, nao
    // so por formato -- fecha o gap real que deixou um documento invalido (091.004.234-34)
    // ser salvo sem aviso num cedente real da Bolsa de Ativos, so descoberto quando a
    // Checktudo recusou a consulta. O campo ja tinha "*" de obrigatorio na label, nunca
    // era de fato exigido.
    if (step === 2) return isValidCpfCnpj(form.seller_cpf_cnpj);
    if (step === 3) return CHECKLIST_ITEMS.every((c) => (form as any)[c.key]);
    if (step === 4) return form.asset_type && form.ente_devedor;
    if (step === 5) return form.valor_face;
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/cm/intake/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          valor_face: parseCurrencyBRLInput(form.valor_face),
          valor_atualizado: form.valor_atualizado ? parseCurrencyBRLInput(form.valor_atualizado) : "",
          tranche_valor_minimo: form.tranche_valor_minimo ? parseCurrencyBRLInput(form.tranche_valor_minimo) : "",
          intermediarios: intermediarios.filter((i) => i.nome.trim() || i.email.trim() || i.whatsapp.trim()),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar");
      setFinalAnonymousId(data.anonymous_id || anonymousId);
      setSubmitted(true);
      try { localStorage.removeItem(draftKey); } catch { /* nunca bloqueia a confirmacao de envio */ }
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
        <p className="text-xs text-[#9BAFC5]/60 mt-8">Referência: {finalAnonymousId}</p>
      </div>
    );
  }

  const inputClass = "w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-lg px-4 py-3 text-sm text-[#F5F1E8] placeholder:text-[#9BAFC5]/40 focus:border-[#C9A84C]/50 focus:outline-none transition";
  const labelClass = "block text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1.5";
  const selectClass = inputClass + " appearance-none";

  return (
    <div>
      {draftRestoredAt && (
        <div className="mb-4 p-3 bg-[#C9A84C]/10 border border-[#C9A84C]/30 rounded-lg text-xs text-[#C9A84C] flex items-center gap-2">
          <Save size={14} /> Rascunho recuperado de {new Date(draftRestoredAt).toLocaleString("pt-BR")}. Continue de onde parou.
        </div>
      )}

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
                {form.seller_cpf_cnpj && !isValidCpfCnpj(form.seller_cpf_cnpj) && (
                  <p className="text-[10px] text-red-400 mt-1">CPF/CNPJ inválido (dígito verificador não confere)</p>
                )}
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
              <div>
                <label className={labelClass}>CEP</label>
                <input
                  className={inputClass}
                  value={form.cep}
                  onChange={(e) => upd("cep", formatCepMask(e.target.value))}
                  onBlur={handleCepBlur}
                  placeholder="00000-000"
                  maxLength={9}
                />
                {cepLoading && <p className="text-[10px] text-[#9BAFC5] mt-1">Buscando endereço...</p>}
                {cepError && <p className="text-[10px] text-amber-400 mt-1">{cepError}</p>}
              </div>
              <div>
                <label className={labelClass}>Número</label>
                <input
                  className={inputClass}
                  value={form.numero}
                  onChange={(e) => {
                    upd("numero", e.target.value);
                    const logradouro = (form as any)._cep_logradouro;
                    if (logradouro) {
                      upd("endereco", buildEnderecoFromCep({
                        cep: form.cep, logradouro,
                        bairro: (form as any)._cep_bairro ?? "",
                        localidade: (form as any)._cep_cidade ?? "",
                        uf: (form as any)._cep_uf ?? "",
                      }, e.target.value, form.complemento));
                    }
                  }}
                  placeholder="Nº"
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Endereço completo</label>
                <input className={inputClass} value={(form as any).endereco ?? ""} onChange={(e) => upd("endereco", e.target.value)} placeholder="Preenchido automaticamente pelo CEP, ou digite manualmente" />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h3 className="text-lg font-bold text-[#F5F1E8] mb-1">Intermediários e Checklist Inicial</h3>
            <p className="text-xs text-[#9BAFC5] mb-6">Declare quem mais participa desta operação do seu lado. A V3 Partners enviará um link próprio de qualificação para cada um deles.</p>

            <div className="mb-6">
              <label className={labelClass}>Intermediários envolvidos (opcional)</label>
              {intermediarios.length === 0 && (
                <p className="text-xs text-[#9BAFC5]/60 mb-3">Nenhum intermediário adicionado ainda.</p>
              )}
              <div className="space-y-3">
                {intermediarios.map((it, i) => (
                  <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-start bg-[#162744] border border-[#9BAFC5]/10 rounded-lg p-3">
                    <input className={inputClass} value={it.nome} onChange={(e) => updIntermediario(i, "nome", e.target.value)} placeholder="Nome completo" />
                    <input type="email" className={inputClass} value={it.email} onChange={(e) => updIntermediario(i, "email", e.target.value)} placeholder="E-mail" />
                    <input className={inputClass} value={it.whatsapp} onChange={(e) => updIntermediario(i, "whatsapp", maskPhoneInput(e.target.value))} placeholder="WhatsApp (21) 99999-0000" />
                    <button type="button" onClick={() => removeIntermediario(i)} className="p-2.5 text-red-400 hover:bg-red-500/10 rounded-lg transition self-center">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addIntermediario} className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-[#C9A84C] border border-[#C9A84C]/30 hover:bg-[#C9A84C]/10 transition">
                <Plus size={14} /> Adicionar Intermediário
              </button>
              {intermediarios.length >= 3 && (
                <p className="text-[10px] text-amber-400 mt-3">Cadeias longas de intermediários reduzem o ganho por cota de cada participante e podem exigir aprovação adicional da Diretoria antes de seguir.</p>
              )}
            </div>

            <div>
              <label className={labelClass}>Checklist Inicial *</label>
              <div className="space-y-3 mt-2">
                {CHECKLIST_ITEMS.map((c) => (
                  <div key={c.key} className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id={c.key}
                      checked={!!(form as any)[c.key]}
                      onChange={(e) => upd(c.key, e.target.checked)}
                      className="w-5 h-5 accent-[#C9A84C] mt-0.5 flex-shrink-0"
                    />
                    <label htmlFor={c.key} className="text-sm text-[#F5F1E8]">{c.label}</label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
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

        {step === 5 && (
          <div>
            <h3 className="text-lg font-bold text-[#F5F1E8] mb-1">Dados Financeiros</h3>
            <p className="text-xs text-[#9BAFC5] mb-6">Valores e condições pretendidas</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Valor de Face (R$) *</label>
                <input inputMode="numeric" className={inputClass} value={form.valor_face} onChange={(e) => upd("valor_face", maskCurrencyBRLInput(e.target.value))} placeholder="0,00" />
              </div>
              <div>
                <label className={labelClass}>Valor Atualizado (R$)</label>
                <input inputMode="numeric" className={inputClass} value={form.valor_atualizado} onChange={(e) => upd("valor_atualizado", maskCurrencyBRLInput(e.target.value))} placeholder="Se diferente do face" />
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
                  <input inputMode="numeric" className={inputClass} value={form.tranche_valor_minimo} onChange={(e) => upd("tranche_valor_minimo", maskCurrencyBRLInput(e.target.value))} placeholder="0,00" />
                </div>
              )}
            </div>
          </div>
        )}

        {step === 6 && (
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
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-[#9BAFC5] hover:text-[#F5F1E8] disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft size={16} /> Voltar
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => saveDraft(false)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold text-[#9BAFC5] border border-[#9BAFC5]/20 hover:text-[#F5F1E8] hover:border-[#9BAFC5]/40 transition"
          >
            <Save size={14} /> Salvar Rascunho
          </button>
          {draftSavedAt && (
            <span className="text-[10px] text-emerald-400">Salvo às {new Date(draftSavedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
          )}
        </div>

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
