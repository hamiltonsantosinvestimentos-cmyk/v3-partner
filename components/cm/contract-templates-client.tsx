"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Save, Trash2, Loader2, FileText, Eye, ChevronDown, Upload, Send, CheckCircle2, XCircle, Scale, Users, X, FilePlus2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RiscoLaudo {
  resumo?: string;
  pontos_criticos?: { clausula_original: string; severidade: "alto" | "medio" | "baixo"; risco: string }[];
}

interface Template {
  id: string;
  template_name: string;
  vertical: string;
  body_text_raw: string;
  variables_map: any[];
  version: number;
  is_active: boolean;
  created_at: string;
  approval_status: "rascunho" | "em_revisao" | "aprovado" | "reprovado";
  review_round: number;
  // Fast-Track de Contratos Simples (30/08/2026)
  origem?: "manual" | "agente_ia";
  laudo_risco?: RiscoLaudo | null;
  analysis_status?: "processando" | "concluido" | "erro" | null;
  analysis_error?: string | null;
  valor_operacao_estimado?: number | null;
}

interface TemplateReview {
  id: string;
  reviewer_name: string;
  reviewer_type: "juridico" | "compliance_socio";
  decision: "aprovado" | "reprovado";
  comment: string | null;
  body_edited: boolean;
  created_at: string;
}

const SERIES_LABELS: Record<string, string> = {
  "V3C-ORG": "V3C-ORG · Originação",
  "V3C-MAN": "V3C-MAN · Mandato",
  "V3C-PAR": "V3C-PAR · Adesão de Partner",
  "V3C-CES": "V3C-CES · Cessão / Compra-e-Venda de Ativo",
  "V3C-NDA": "V3C-NDA · NDA",
  "V3C-LOI": "V3C-LOI · Carta de Intenção",
  "V3C-FPA": "V3C-FPA · Proteção de Honorários",
  "V3C-FOR": "V3C-FOR · Fornecedor",
  "V3C-FUN": "V3C-FUN · Fundo",
  "V3C-REG": "V3C-REG · Regularização de Contrato Manual",
};

const APPROVAL_STATUS_MAP: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-[#243A66] text-[#9BAFC5]" },
  em_revisao: { label: "Em Revisão Jurídica", color: "bg-amber-500/20 text-amber-400" },
  aprovado: { label: "Aprovada", color: "bg-emerald-500/20 text-emerald-400" },
  reprovado: { label: "Reprovada", color: "bg-red-500/20 text-red-400" },
};

const VERTICAL_LABELS: Record<string, string> = {
  capital_markets: "Bolsa de Ativos",
  credito: "Mesa de Crédito",
  ma: "M&A",
  institucional: "Institucional",
  clientes: "Clientes / Partners",
  talent_pool: "Talent Pool",
  colaboradores: "Colaboradores",
};

const VERTICAL_COLORS: Record<string, string> = {
  capital_markets: "bg-[#C9A84C] text-[#09081A]",
  credito: "bg-emerald-500 text-white",
  ma: "bg-blue-500 text-white",
  institucional: "bg-purple-500 text-white",
  clientes: "bg-orange-500 text-white",
  talent_pool: "bg-cyan-500 text-[#09081A]",
  colaboradores: "bg-pink-500 text-white",
};

const SAMPLE_VARS = `Variáveis disponíveis (use entre {{chaves}}):

CEDENTE: {{nome_cedente}}, {{cpf_cnpj_cedente}}
ATIVO: {{tipo_ativo}}, {{anonymous_id}}, {{ente_devedor}}, {{esfera}}, {{tribunal}}, {{natureza}}, {{numero_processo}}
FINANCEIRO: {{valor_face}}, {{valor_atualizado}}, {{desagio_pretendido}}, {{prazo_estimado_meses}}
OFERTA: {{valor_oferta}}, {{desagio_oferecido}}, {{tipo_pagamento}}
COMISSAO: {{comissao_total}}, {{comissao_v3}}, {{comissao_partner}}, {{comissao_intermediario}}
M&A: {{nome_ativo}}, {{valor_deal}}, {{setor}}, {{v3_code}}
SISTEMA: {{data_geracao}}, {{data_geracao_extenso}}`;

export function ContractTemplatesClient() {
  const searchParams = useSearchParams();
  const initialVertical = searchParams.get("vertical") ?? "";

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Template | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [filterVertical, setFilterVertical] = useState(initialVertical);

  const [formName, setFormName] = useState("");
  const [formVertical, setFormVertical] = useState("capital_markets");
  const [formSeries, setFormSeries] = useState("V3C-PAR");
  const [formBody, setFormBody] = useState("");
  const [showVars, setShowVars] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Fast-Track de Contratos Simples (30/08/2026): upload de contrato
  // recebido para o Agente Revisor de Riscos analisar.
  const [showAnalyzeModal, setShowAnalyzeModal] = useState(false);
  const [analyzeFile, setAnalyzeFile] = useState<File | null>(null);
  const [analyzeVertical, setAnalyzeVertical] = useState("capital_markets");
  const [analyzeSeries, setAnalyzeSeries] = useState("V3C-NDA");
  const [analyzeTemplateName, setAnalyzeTemplateName] = useState("");
  const [analyzeValor, setAnalyzeValor] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const analyzeFileInputRef = React.useRef<HTMLInputElement>(null);
  const [reviews, setReviews] = useState<TemplateReview[]>([]);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [submittingForReview, setSubmittingForReview] = useState(false);

  // Gerar Contrato a partir de minuta aprovada (19/08/2026, itens 1 e 3 dos
  // ajustes de governança pedidos por João): reaproveita a origem "avulso"
  // de /api/contracts/generate, sem depender de listing/bid/deal/ticket.
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [genParties, setGenParties] = useState<{ name: string; email: string; doc: string; role: string }[]>([
    { name: "", email: "", doc: "", role: "indicador" },
  ]);
  const [genCommission, setGenCommission] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<{ contract_code: string | null; contract_title: string } | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const openGenerateModal = () => {
    setGenParties([{ name: "", email: "", doc: "", role: "indicador" }]);
    setGenCommission("");
    setGenResult(null);
    setGenError(null);
    setShowGenerateModal(true);
  };
  const addGenPartyRow = () => setGenParties((prev) => [...prev, { name: "", email: "", doc: "", role: "indicador" }]);
  const removeGenPartyRow = (i: number) => setGenParties((prev) => prev.filter((_, idx) => idx !== i));
  const updateGenPartyRow = (i: number, field: "name" | "email" | "doc" | "role", value: string) =>
    setGenParties((prev) => prev.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));

  const handleGenerateContract = async () => {
    if (!selected) return;
    const invalid = genParties.some((p) => !p.name.trim() || !p.email.trim());
    if (genParties.length === 0 || invalid) {
      setGenError("Preencha nome e e-mail de todos os indicadores.");
      return;
    }
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/contracts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: selected.id,
          avulso_parties: genParties.map((p) => ({ name: p.name.trim(), email: p.email.trim(), doc: p.doc.trim() || undefined, role: p.role })),
          commission_percent: genCommission ? Number(genCommission) : undefined,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setGenResult({ contract_code: json.contract.contract_code, contract_title: json.contract.contract_title });
      } else {
        setGenError(json.error ?? "Erro ao gerar contrato");
      }
    } catch { setGenError("Erro de conexão"); }
    finally { setGenerating(false); }
  };

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterVertical ? `?vertical=${filterVertical}` : "";
      const res = await fetch(`/api/contracts/templates${params}`);
      const json = await res.json();
      setTemplates(json.templates ?? []);
    } catch { }
    finally { setLoading(false); }
  }, [filterVertical]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  // Polling: enquanto alguma minuta estiver com analysis_status=processando
  // (Agente Revisor de Riscos rodando em background via n8n), re-busca a
  // lista a cada 10s. Mesmo padrão já usado em components/ma/forja-panel.tsx
  // para extração de documentos.
  useEffect(() => {
    const hasProcessing = templates.some((t) => t.analysis_status === "processando");
    if (!hasProcessing) return;
    const interval = setInterval(fetchTemplates, 10_000);
    return () => clearInterval(interval);
  }, [templates, fetchTemplates]);

  // Mantém o painel de detalhe sincronizado quando o polling acima traz o
  // resultado da análise (laudo_risco + minuta saneada) para a minuta
  // atualmente selecionada.
  useEffect(() => {
    if (!selected) return;
    const fresh = templates.find((t) => t.id === selected.id);
    if (fresh && fresh.analysis_status !== selected.analysis_status) {
      setSelected(fresh);
      setFormBody(fresh.body_text_raw);
    }
  }, [templates, selected]);

  const handleAnalyzeUpload = async () => {
    if (!analyzeFile) { setAnalyzeError("Selecione um arquivo"); return; }
    if (!analyzeValor.trim()) { setAnalyzeError("Valor da Operação estimado é obrigatório"); return; }
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const fd = new FormData();
      fd.append("file", analyzeFile);
      fd.append("vertical", analyzeVertical);
      fd.append("contract_series", analyzeSeries);
      if (analyzeTemplateName.trim()) fd.append("template_name", analyzeTemplateName.trim());
      fd.append("valor_operacao_estimado", analyzeValor);
      const res = await fetch("/api/contracts/templates/analyze-upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { setAnalyzeError(json.error ?? "Erro ao enviar para análise"); return; }
      setShowAnalyzeModal(false);
      setAnalyzeFile(null);
      setAnalyzeTemplateName("");
      setAnalyzeValor("");
      await fetchTemplates();
      const created = (await (await fetch(`/api/contracts/templates`)).json()).templates?.find((t: Template) => t.id === json.template_id);
      if (created) selectTemplate(created);
    } catch {
      setAnalyzeError("Erro de conexão");
    } finally {
      setAnalyzing(false);
      if (analyzeFileInputRef.current) analyzeFileInputRef.current.value = "";
    }
  };

  const loadReviews = async (templateId: string) => {
    try {
      const res = await fetch(`/api/contracts/templates/${templateId}/review`);
      const json = await res.json();
      setReviews(json.reviews ?? []);
    } catch { setReviews([]); }
  };

  const selectTemplate = (t: Template) => {
    setSelected(t);
    setIsNew(false);
    setFormName(t.template_name);
    setFormVertical(t.vertical);
    setFormBody(t.body_text_raw);
    setReviewComment("");
    loadReviews(t.id);
  };

  const startNew = () => {
    setSelected(null);
    setIsNew(true);
    setFormName("");
    setFormVertical("capital_markets");
    setFormSeries("V3C-PAR");
    setFormBody("");
    setReviews([]);
  };

  const handleSubmitForReview = async () => {
    if (!selected) return;
    setSubmittingForReview(true);
    try {
      const res = await fetch(`/api/contracts/templates/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submit_for_review: true }),
      });
      const json = await res.json();
      if (res.ok) { fetchTemplates(); selectTemplate(json.template); }
      else alert(json.error);
    } catch { alert("Erro de conexão"); }
    finally { setSubmittingForReview(false); }
  };

  const handleReviewDecision = async (decision: "aprovado" | "reprovado") => {
    if (!selected) return;
    if (decision === "reprovado" && !reviewComment.trim()) {
      alert("Reprovação exige comentário explicando o motivo");
      return;
    }
    setSubmittingReview(true);
    try {
      const res = await fetch(`/api/contracts/templates/${selected.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment: reviewComment.trim() || undefined, body_text_raw: formBody }),
      });
      const json = await res.json();
      if (res.ok) {
        alert(json.message ?? "Revisão registrada");
        setReviewComment("");
        fetchTemplates();
        loadReviews(selected.id);
      } else {
        alert(json.error);
      }
    } catch { alert("Erro de conexão"); }
    finally { setSubmittingReview(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/contracts/templates/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { alert(json.error); return; }
      setSelected(null);
      setIsNew(true);
      setFormName(json.suggested_name);
      setFormVertical("capital_markets");
      setFormBody(json.body_text);
    } catch { alert("Erro ao fazer upload"); }
    finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!formName || !formBody) return;
    setSaving(true);
    try {
      if (isNew) {
        const res = await fetch("/api/contracts/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ template_name: formName, vertical: formVertical, contract_series: formSeries, body_text_raw: formBody }),
        });
        if (res.ok) { setIsNew(false); fetchTemplates(); }
        else { const j = await res.json(); alert(j.error); }
      } else if (selected) {
        const res = await fetch(`/api/contracts/templates/${selected.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ template_name: formName, body_text_raw: formBody }),
        });
        if (res.ok) fetchTemplates();
        else { const j = await res.json(); alert(j.error); }
      }
    } catch { alert("Erro de conexão"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Desativar este template?")) return;
    await fetch(`/api/contracts/templates/${id}`, { method: "DELETE" });
    setSelected(null);
    fetchTemplates();
  };

  const detectedVars = (formBody.match(/\{\{([^}]+)\}\}/g) || []).map(v => v.replace(/\{\{|\}\}/g, "").trim());

  return (
    <div className="min-h-screen p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F1E8]">Central de Contratos</h1>
          <p className="text-sm text-[#9BAFC5]">Biblioteca de minutas com injeção automática de variáveis</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowAnalyzeModal(true); setAnalyzeError(null); }}
            className="flex items-center gap-2 px-4 py-2 bg-[#162744] text-[#C9A84C] border border-[#C9A84C]/30 rounded-lg text-sm font-bold hover:bg-[#C9A84C]/10 transition">
            <FileText size={16} /> Analisar Contrato Recebido
          </button>
          <button onClick={startNew} className="flex items-center gap-2 px-4 py-2 bg-[#C9A84C] text-[#09081A] rounded-lg text-sm font-bold hover:bg-[#E8C97A] transition">
            <Plus size={16} /> Nova Minuta
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {["", "capital_markets", "credito", "ma", "institucional", "clientes", "talent_pool", "colaboradores"].map((v) => (
          <button key={v} onClick={() => setFilterVertical(v)}
            className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition",
              filterVertical === v ? "bg-[#C9A84C] text-[#09081A]" : "bg-[#162744] text-[#9BAFC5] hover:text-[#F5F1E8]"
            )}>
            {v ? VERTICAL_LABELS[v] : "Todas"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Lista de templates */}
        <div className="col-span-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#C9A84C]" /></div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12 text-[#9BAFC5] text-sm">Nenhuma minuta cadastrada</div>
          ) : templates.map((t) => (
            <div key={t.id} onClick={() => selectTemplate(t)}
              className={cn("bg-[#12112A] border rounded-lg p-4 cursor-pointer transition",
                selected?.id === t.id ? "border-[#C9A84C]/50" : "border-[#9BAFC5]/10 hover:border-[#C9A84C]/20"
              )}>
              <div className="flex items-center justify-between mb-2">
                <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded", VERTICAL_COLORS[t.vertical])}>
                  {VERTICAL_LABELS[t.vertical]}
                </span>
                <span className="text-[9px] text-[#9BAFC5]">v{t.version}</span>
              </div>
              <div className="text-sm font-bold text-[#F5F1E8]">{t.template_name}</div>
              <div className="text-[10px] text-[#9BAFC5] mt-1 mb-2">
                {(t.variables_map?.length ?? 0)} variáveis · {new Date(t.created_at).toLocaleDateString("pt-BR")}
              </div>
              <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded", (APPROVAL_STATUS_MAP[t.approval_status] ?? APPROVAL_STATUS_MAP.rascunho).color)}>
                {(APPROVAL_STATUS_MAP[t.approval_status] ?? APPROVAL_STATUS_MAP.rascunho).label}
              </span>
            </div>
          ))}
        </div>

        {/* Editor */}
        <div className="col-span-8">
          {!isNew && !selected ? (
            <div className="flex items-center justify-center h-64 text-[#9BAFC5] text-sm">
              Selecione uma minuta ou clique em "Nova Minuta"
            </div>
          ) : (
            <div className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-6">
              {selected && (
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-[#9BAFC5]/10">
                  <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded", (APPROVAL_STATUS_MAP[selected.approval_status] ?? APPROVAL_STATUS_MAP.rascunho).color)}>
                    {(APPROVAL_STATUS_MAP[selected.approval_status] ?? APPROVAL_STATUS_MAP.rascunho).label}
                  </span>
                  <div className="flex items-center gap-2">
                    {["rascunho", "reprovado"].includes(selected.approval_status) && (
                      <button onClick={handleSubmitForReview} disabled={submittingForReview}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#162744] text-[#C9A84C] border border-[#C9A84C]/30 rounded-lg text-xs font-bold hover:bg-[#C9A84C]/10 transition disabled:opacity-50">
                        {submittingForReview ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Enviar para Revisão Jurídica
                      </button>
                    )}
                    {selected.approval_status === "aprovado" && (
                      <button onClick={openGenerateModal}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#C9A84C]/15 text-[#C9A84C] border border-[#C9A84C]/40 rounded-lg text-xs font-bold hover:bg-[#C9A84C]/25 transition">
                        <FilePlus2 size={13} /> Gerar Contrato
                      </button>
                    )}
                  </div>
                </div>
              )}

              {selected?.origem === "agente_ia" && (
                <div className="mb-4 p-3 rounded-lg bg-[#09081A] border border-blue-500/20">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">Origem: Agente Revisor de Riscos</span>
                    {typeof selected.valor_operacao_estimado === "number" && (
                      <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded",
                        selected.valor_operacao_estimado > 50000 ? "bg-amber-500/20 text-amber-400" : "bg-[#243A66] text-[#9BAFC5]")}>
                        Valor declarado: {selected.valor_operacao_estimado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        {selected.valor_operacao_estimado > 50000 ? " · exige jurídico" : " · fast-track (2/3 sócios)"}
                      </span>
                    )}
                  </div>

                  {selected.analysis_status === "processando" && (
                    <div className="flex items-center gap-2 text-xs text-[#9BAFC5]">
                      <Loader2 size={14} className="animate-spin text-blue-400" />
                      Agente Revisor de Riscos analisando o contrato recebido, comparando com precedentes já aprovados...
                    </div>
                  )}

                  {selected.analysis_status === "erro" && (
                    <div className="text-xs text-red-400">
                      Falha na análise: {selected.analysis_error ?? "erro não especificado"}
                    </div>
                  )}

                  {selected.analysis_status === "concluido" && selected.laudo_risco && (
                    <div>
                      {selected.laudo_risco.resumo && (
                        <p className="text-xs text-[#F5F1E8] mb-2">{selected.laudo_risco.resumo}</p>
                      )}
                      {(selected.laudo_risco.pontos_criticos ?? []).length > 0 && (
                        <div className="space-y-1.5">
                          {(selected.laudo_risco.pontos_criticos ?? []).map((p, i) => (
                            <div key={i} className="flex items-start gap-2 text-[11px]">
                              <span className={cn("shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase",
                                p.severidade === "alto" ? "bg-red-500/20 text-red-400" :
                                p.severidade === "medio" ? "bg-amber-500/20 text-amber-400" :
                                "bg-[#243A66] text-[#9BAFC5]")}>
                                {p.severidade}
                              </span>
                              <div>
                                <span className="text-[#F5F1E8] font-medium">{p.clausula_original}:</span>{" "}
                                <span className="text-[#9BAFC5]">{p.risco}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1">Nome da Minuta</label>
                  <input value={formName} onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-lg px-4 py-2.5 text-sm text-[#F5F1E8] focus:border-[#C9A84C]/50 focus:outline-none"
                    placeholder="Ex: Termo de Cessão de Crédito" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1">Vertical</label>
                  <select value={formVertical} onChange={(e) => setFormVertical(e.target.value)}
                    disabled={!isNew}
                    className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-lg px-4 py-2.5 text-sm text-[#F5F1E8] disabled:opacity-50">
                    <option value="capital_markets">Bolsa de Ativos</option>
                    <option value="credito">Mesa de Crédito</option>
                    <option value="ma">M&A</option>
                    <option value="institucional">Institucional</option>
                    <option value="clientes">Clientes / Partners</option>
                    <option value="talent_pool">Talent Pool</option>
                    <option value="colaboradores">Colaboradores</option>
                  </select>
                </div>
                {isNew && (
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1">Série V3C (numeração do contrato)</label>
                    <select value={formSeries} onChange={(e) => setFormSeries(e.target.value)}
                      className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-lg px-4 py-2.5 text-sm text-[#F5F1E8]">
                      {Object.entries(SERIES_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="mb-3 flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.docx,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 px-3 py-2 bg-[#162744] text-[#F5F1E8] border border-[#9BAFC5]/20 rounded-lg text-xs font-medium hover:bg-[#243A66] disabled:opacity-40 transition"
                >
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploading ? "Processando..." : "Importar documento (.txt, .docx, .pdf)"}
                </button>
                <span className="text-[10px] text-[#9BAFC5]">Anexe um arquivo para preencher o corpo da minuta automaticamente</span>
              </div>

              <div className="mb-2 flex items-center justify-between">
                <label className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider">Corpo da Minuta</label>
                <button onClick={() => setShowVars(!showVars)} className="flex items-center gap-1 text-[10px] text-[#9BAFC5] hover:text-[#C9A84C] transition">
                  <ChevronDown size={12} className={showVars ? "rotate-180" : ""} /> Variaveis
                </button>
              </div>

              {showVars && (
                <div className="bg-[#09081A] border border-[#9BAFC5]/10 rounded-lg p-3 mb-3 text-[10px] text-[#9BAFC5] whitespace-pre-wrap font-mono">
                  {SAMPLE_VARS}
                </div>
              )}

              <textarea value={formBody} onChange={(e) => setFormBody(e.target.value)}
                className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-lg px-4 py-3 text-sm text-[#F5F1E8] focus:border-[#C9A84C]/50 focus:outline-none font-mono min-h-[350px] resize-y"
                placeholder="Digite o texto da minuta usando {{variáveis}} entre chaves..." />

              {detectedVars.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {detectedVars.map((v, i) => (
                    <span key={i} className="text-[9px] bg-[#C9A84C]/10 text-[#C9A84C] px-2 py-0.5 rounded border border-[#C9A84C]/20">
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between mt-4">
                <div>
                  {selected && (
                    <button onClick={() => handleDelete(selected.id)}
                      className="flex items-center gap-2 px-3 py-2 text-red-400 text-xs hover:bg-red-500/10 rounded-lg transition">
                      <Trash2 size={14} /> Desativar
                    </button>
                  )}
                </div>
                <button onClick={handleSave} disabled={saving || !formName || !formBody}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#C9A84C] text-[#09081A] rounded-lg text-sm font-bold hover:bg-[#E8C97A] disabled:opacity-40 transition">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {isNew ? "Criar Minuta" : "Salvar Alterações"}
                </button>
              </div>

              {selected?.approval_status === "em_revisao" && (
                <div className="mt-5 pt-5 border-t border-[#9BAFC5]/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Scale size={14} className="text-[#C9A84C]" />
                    <span className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider">Revisão Jurídica</span>
                  </div>
                  <p className="text-[10px] text-[#9BAFC5] mb-2">
                    Jurídico ou compliance/sócio: se precisar ajustar o texto, edite direto no campo acima antes de decidir — a edição é salva junto com a aprovação/reprovação.
                  </p>
                  <textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Comentário (obrigatório para reprovar, opcional para aprovar)"
                    className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-lg px-3 py-2 text-xs text-[#F5F1E8] focus:border-[#C9A84C]/50 focus:outline-none min-h-[60px] resize-y mb-2" />
                  <div className="flex gap-2">
                    <button onClick={() => handleReviewDecision("aprovado")} disabled={submittingReview}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-500/30 transition disabled:opacity-50">
                      {submittingReview ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Aprovar e Liberar
                    </button>
                    <button onClick={() => handleReviewDecision("reprovado")} disabled={submittingReview}
                      className="flex items-center gap-1.5 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-xs font-bold hover:bg-red-500/30 transition disabled:opacity-50">
                      {submittingReview ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />} Reprovar
                    </button>
                  </div>
                </div>
              )}

              {reviews.length > 0 && (
                <div className="mt-5 pt-5 border-t border-[#9BAFC5]/10">
                  {/* 17/08/2026: indicador de quórum, pedido explícito de
                      João ("não tenho um painel pra poder justificar") —
                      mostra o placar em tempo real sem precisar contar
                      linha por linha do histórico abaixo. */}
                  {(() => {
                    const sociosAprovados = Array.from(new Set(
                      reviews.filter(r => r.reviewer_type === "compliance_socio" && r.decision === "aprovado").map(r => r.reviewer_name)
                    ));
                    const juridicoAprovou = reviews.some(r => r.reviewer_type === "juridico" && r.decision === "aprovado");
                    // Trava dos R$50 mil (30/08/2026): acima do valor
                    // declarado no upload, maioria de sócios sozinha não
                    // fecha quórum, precisa do jurídico.
                    const valorBloqueiaMaioria = (selected?.valor_operacao_estimado ?? 0) > 50000;
                    const maioriaValida = sociosAprovados.length >= 2 && !valorBloqueiaMaioria;
                    return (
                      <div className="flex flex-wrap items-center gap-2 mb-3 p-3 rounded-lg bg-[#09081A] border border-[#9BAFC5]/10">
                        <span className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mr-1">Quórum</span>
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded", maioriaValida ? "bg-emerald-500/20 text-emerald-400" : "bg-[#243A66] text-[#9BAFC5]")}>
                          {sociosAprovados.length}/3 sócios {sociosAprovados.length > 0 ? `(${sociosAprovados.join(", ")})` : ""}
                        </span>
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded", juridicoAprovou ? "bg-emerald-500/20 text-emerald-400" : "bg-[#243A66] text-[#9BAFC5]")}>
                          Jurídico {juridicoAprovou ? "✓ aprovou" : "pendente"}
                        </span>
                        <span className="text-[9px] text-[#9BAFC5]">
                          {maioriaValida ? "Fechado por maioria de sócios"
                            : juridicoAprovou && sociosAprovados.length > 0 ? "Fechado por jurídico + sócio"
                            : valorBloqueiaMaioria && sociosAprovados.length >= 2 ? "Maioria atingida, mas valor > R$50 mil exige jurídico"
                            : "Falta jurídico + 1 sócio, ou 2 sócios"}
                        </span>
                      </div>
                    );
                  })()}
                  <span className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider">Histórico de Revisão</span>
                  <div className="mt-2 space-y-2">
                    {reviews.map((r) => (
                      <div key={r.id} className="bg-[#162744] rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[#F5F1E8] font-medium">
                            {r.reviewer_name} <span className="text-[9px] text-[#9BAFC5]">({r.reviewer_type === "juridico" ? "Jurídico" : "Compliance/Sócio"})</span>
                            {" "}{r.decision === "aprovado" ? <span className="text-emerald-400">aprovou</span> : <span className="text-red-400">reprovou</span>}
                            {r.body_edited && <span className="text-[9px] text-[#9BAFC5]"> · editou o texto</span>}
                          </span>
                          <span className="text-[9px] text-[#9BAFC5]">{new Date(r.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
                        </div>
                        {r.comment && <p className="text-[11px] text-[#9BAFC5] mt-1">{r.comment}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal Analisar Contrato Recebido (Fast-Track, 30/08/2026): upload
          de um contrato já recebido (WhatsApp/e-mail) para o Agente
          Revisor de Riscos analisar e redigir a minuta saneada. Rota
          assíncrona — fecha o modal na hora, o resultado chega pelo
          polling da lista. */}
      {showAnalyzeModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60" onClick={() => !analyzing && setShowAnalyzeModal(false)}>
          <div className="w-full max-w-lg bg-[#09081A] border border-[#C9A84C]/20 rounded-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-[#C9A84C]/20 flex items-center justify-between flex-shrink-0">
              <div className="text-sm font-bold text-[#F5F1E8] flex items-center gap-2"><FileText size={14} className="text-[#C9A84C]" /> Analisar Contrato Recebido</div>
              <button onClick={() => setShowAnalyzeModal(false)} className="text-[#9BAFC5] hover:text-[#F5F1E8] text-xl">&times;</button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-[11px] text-[#9BAFC5]">
                Envie um contrato recebido por WhatsApp/e-mail. O Agente Revisor de Riscos aponta os pontos críticos e redige uma minuta adaptada, pronta para revisão. O quórum humano continua obrigatório.
              </p>

              <div>
                <input ref={analyzeFileInputRef} type="file" accept=".txt,.docx,.pdf"
                  onChange={(e) => setAnalyzeFile(e.target.files?.[0] ?? null)}
                  className="hidden" id="analyze-file-input" />
                <button onClick={() => analyzeFileInputRef.current?.click()}
                  className="w-full flex items-center gap-2 px-3 py-2.5 bg-[#162744] text-[#F5F1E8] border border-[#9BAFC5]/20 rounded-lg text-xs font-medium hover:bg-[#243A66] transition">
                  <Upload size={14} /> {analyzeFile ? analyzeFile.name : "Selecionar arquivo (.txt, .docx, .pdf)"}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1">Vertical</label>
                  <select value={analyzeVertical} onChange={(e) => setAnalyzeVertical(e.target.value)}
                    className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-lg px-3 py-2 text-xs text-[#F5F1E8]">
                    {Object.entries(VERTICAL_LABELS).map(([v, label]) => (
                      <option key={v} value={v}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1">Série V3C</label>
                  <select value={analyzeSeries} onChange={(e) => setAnalyzeSeries(e.target.value)}
                    className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-lg px-3 py-2 text-xs text-[#F5F1E8]">
                    {Object.entries(SERIES_LABELS).filter(([v]) => v !== "V3C-REG").map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1">Nome da Minuta (opcional)</label>
                <input value={analyzeTemplateName} onChange={(e) => setAnalyzeTemplateName(e.target.value)}
                  placeholder="Se vazio, usa o nome do arquivo"
                  className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-lg px-3 py-2 text-xs text-[#F5F1E8] focus:border-[#C9A84C]/50 focus:outline-none" />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1">
                  Valor da Operação Estimado (R$) <span className="text-red-400">*</span>
                </label>
                <input value={analyzeValor} onChange={(e) => setAnalyzeValor(e.target.value)}
                  placeholder="Ex: 15000"
                  className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-lg px-3 py-2 text-xs text-[#F5F1E8] focus:border-[#C9A84C]/50 focus:outline-none" />
                <p className="text-[9px] text-[#9BAFC5] mt-1">
                  Trava temporária: acima de R$50.000, o quórum exige o jurídico (Dr. Athaydes), não permite fechar só com 2/3 sócios.
                </p>
              </div>

              {analyzeError && <p className="text-xs text-red-400">{analyzeError}</p>}
            </div>
            <div className="p-4 border-t border-[#C9A84C]/20 flex justify-end gap-2">
              <button onClick={() => setShowAnalyzeModal(false)} disabled={analyzing}
                className="px-4 py-2 text-xs text-[#9BAFC5] hover:text-[#F5F1E8] transition">Cancelar</button>
              <button onClick={handleAnalyzeUpload} disabled={analyzing || !analyzeFile}
                className="flex items-center gap-2 px-4 py-2 bg-[#C9A84C] text-[#09081A] rounded-lg text-xs font-bold hover:bg-[#E8C97A] disabled:opacity-40 transition">
                {analyzing ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                {analyzing ? "Enviando..." : "Enviar para Análise"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Gerar Contrato (19/08/2026): dispara /api/contracts/generate
          com origem "avulso": não depende de listing/bid/deal/credit_proposal/
          ticket, cada indicador é digitado direto aqui. */}
      {showGenerateModal && selected && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60" onClick={() => setShowGenerateModal(false)}>
          <div className="w-full max-w-lg max-h-[85vh] bg-[#09081A] border border-[#C9A84C]/20 rounded-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-[#C9A84C]/20 flex items-center justify-between flex-shrink-0">
              <div>
                <div className="text-sm font-bold text-[#F5F1E8] flex items-center gap-2"><Users size={14} className="text-[#C9A84C]" /> Gerar Contrato</div>
                <div className="text-[10px] text-[#9BAFC5]">{selected.template_name}</div>
              </div>
              <button onClick={() => setShowGenerateModal(false)} className="text-[#9BAFC5] hover:text-[#F5F1E8] text-xl">&times;</button>
            </div>
            {genResult ? (
              <div className="p-6 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400"><CheckCircle2 size={16} /> <span className="text-sm font-bold">Contrato gerado</span></div>
                <p className="text-xs text-[#9BAFC5]">
                  {genResult.contract_code ?? genResult.contract_title}. Vá em Central de Contratos &gt; Contratos Gerados para revisar, aprovar e enviar para assinatura.
                </p>
                <button onClick={() => setShowGenerateModal(false)}
                  className="w-full px-3 py-2 bg-[#162744] text-[#F5F1E8] rounded-lg text-xs font-bold hover:bg-[#243A66] transition">Fechar</button>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  <p className="text-[11px] text-[#9BAFC5] leading-relaxed">
                    Cada indicador/parceiro do grupo entra como signatário do contrato, junto com a V3 Partners. Nome e e-mail são obrigatórios (a ClickSign exige e-mail válido para enviar o link de assinatura).
                  </p>
                  <div className="space-y-2">
                    {genParties.map((row, i) => (
                      <div key={i} className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] text-[#9BAFC5] uppercase">Indicador {i + 1}</span>
                          {genParties.length > 1 && (
                            <button onClick={() => removeGenPartyRow(i)}><X size={12} className="text-red-400/70 hover:text-red-400" /></button>
                          )}
                        </div>
                        <input value={row.name} onChange={(e) => updateGenPartyRow(i, "name", e.target.value)} placeholder="Nome completo *"
                          className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
                        <input value={row.email} onChange={(e) => updateGenPartyRow(i, "email", e.target.value)} placeholder="E-mail *" type="email"
                          className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
                        <input value={row.doc} onChange={(e) => updateGenPartyRow(i, "doc", e.target.value)} placeholder="CPF/CNPJ (opcional)"
                          className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
                      </div>
                    ))}
                  </div>
                  <button onClick={addGenPartyRow}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-[#162744] border border-[#9BAFC5]/15 rounded text-[#9BAFC5] text-[10px] font-bold hover:text-[#F5F1E8] transition">
                    <Plus size={12} /> Adicionar Indicador
                  </button>
                  <div>
                    <label className="block text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1">Comissão Total % (opcional)</label>
                    <input value={genCommission} onChange={(e) => setGenCommission(e.target.value)} placeholder="Ex: 5"
                      className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
                  </div>
                  {genError && <p className="text-[11px] text-red-400">{genError}</p>}
                </div>
                <div className="p-4 border-t border-[#C9A84C]/20 flex-shrink-0">
                  <button onClick={handleGenerateContract} disabled={generating}
                    className="w-full px-3 py-2.5 bg-[#C9A84C] text-[#09081A] rounded-lg text-xs font-bold hover:bg-[#E8C97A] transition disabled:opacity-50 flex items-center justify-center gap-2">
                    {generating ? <Loader2 size={14} className="animate-spin" /> : <FilePlus2 size={14} />} Gerar Contrato
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
