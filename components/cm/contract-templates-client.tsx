"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Save, Trash2, Loader2, FileText, Eye, ChevronDown, Upload, Send, CheckCircle2, XCircle, Scale, Users, X, FilePlus2, UserPlus, Copy, Share2, RotateCcw } from "lucide-react";
import { cn, isValidEmail } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/qualification-roles";

interface RiscoLaudo {
  resumo?: string;
  pontos_criticos?: { clausula_original: string; severidade: "alto" | "medio" | "baixo"; risco: string }[];
}

interface BrechaIdentificada {
  clausula: string;
  risco: string;
  sugestao: string;
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
  contract_series?: string;
  // Documento unilateral (03/09/2026): Carta de Intenção de Compra V3 para
  // Terceiros e futuros equivalentes — só V3 assina, sem contraparte/parte.
  requires_counterparty_signature?: boolean;
  // Fast-Track de Contratos Simples (30/08/2026) + Agente Estruturador de
  // Contratos (02/09/2026)
  origem?: "manual" | "agente_ia" | "agente_ia_estruturador";
  laudo_risco?: RiscoLaudo | null;
  analysis_status?: "processando" | "concluido" | "erro" | null;
  analysis_error?: string | null;
  valor_operacao_estimado?: number | null;
  brechas_identificadas?: BrechaIdentificada[] | null;
  observacoes_para_revisor?: string | null;
}

interface QualParty {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  role_in_document: string;
  status: string;
  qualification_token: string;
}

interface QualBatch {
  id: string;
  status: string;
  consumido_por_contract_id?: string | null;
  cm_party_qualifications: QualParty[];
}

interface TemplateReview {
  id: string;
  reviewer_name: string;
  reviewer_type: "juridico" | "compliance_socio";
  decision: "aprovado" | "reprovado";
  comment: string | null;
  body_edited: boolean;
  created_at: string;
  review_round: number;
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

// Qualificação Antecipada vinculada à Minuta (02/09/2026, P1): /api/cm/qualifications
// exige document_type (um dos 6 valores fixos da rota) sempre que a origem não é
// listing_id/demand_id -- template_id cai nessa exigência. Mapeamento pela série
// V3C-* da própria minuta, único sinal confiável que já existe antes de qualquer
// contrato ser gerado (contract_series é imutável desde a criação da minuta).
// FPA não distingue venda/compra por série sozinha -- fallback honesto para
// "contrato_final" nesse caso e em qualquer série sem correspondência direta.
const SERIES_TO_DOCUMENT_TYPE: Record<string, string> = {
  "V3C-NDA": "nda_quadripartite",
  "V3C-MAN": "mandato",
  "V3C-PAR": "contrato_parceria",
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
  const highlightTemplateId = searchParams.get("template_id");

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

  // Agente Estruturador de Contratos (02/09/2026, BRIEF aprovado por
  // João): a Mesa descreve a intenção de negócio em texto livre, o agente
  // redige a minuta completa. Diferente do Fast-Track: cai e permanece em
  // "rascunho", nunca fast-track automático pra revisão jurídica.
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [draftDescricao, setDraftDescricao] = useState("");
  const [draftVertical, setDraftVertical] = useState("capital_markets");
  const [draftSeries, setDraftSeries] = useState("V3C-NDA");
  const [draftTemplateName, setDraftTemplateName] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  // "Pedir Ajuste ao Agente" (02/09/2026): compartilhado pelos dois
  // agentes (Estruturador e Revisor de Riscos), reenvia a minuta atual +
  // a instrução pro mesmo agente que a gerou.
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionInstrucao, setRevisionInstrucao] = useState("");
  const [requestingRevision, setRequestingRevision] = useState(false);
  const [revisionError, setRevisionError] = useState<string | null>(null);

  const [reviews, setReviews] = useState<TemplateReview[]>([]);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [submittingForReview, setSubmittingForReview] = useState(false);

  // Qualificação Antecipada vinculada à Minuta (02/09/2026, P1): BackOffice
  // coleta KYC enquanto o jurídico ainda revisa o texto, sem esperar o
  // primeiro contrato ser gerado. Single-use (decisão de negócio de João) --
  // /api/contracts/generate consome automaticamente o lote mais recente
  // ainda não consumido para esta minuta na primeira geração.
  const [qualBatches, setQualBatches] = useState<QualBatch[]>([]);
  const [showQualModal, setShowQualModal] = useState(false);
  const [qualParties, setQualParties] = useState<{ full_name: string; email: string; phone: string; role_in_document: string }[]>([
    { full_name: "", email: "", phone: "", role_in_document: "parte_principal" },
  ]);
  const [creatingQualification, setCreatingQualification] = useState(false);

  // "Adicionar Partner" (04/09/2026, pedido explícito de João): em vez de
  // digitar nome/e-mail à mão (risco de erro, como o caso Iuri/Ícaro
  // trocados), escolhe de uma lista dos partners já cadastrados no
  // sistema (/api/partners, mesmo endpoint já usado em seletores internos)
  // e adiciona como envolvido com papel "partner" pré-preenchido.
  const [partnersList, setPartnersList] = useState<{ id: string; full_name: string; email: string; role: string }[]>([]);
  const [showPartnerPicker, setShowPartnerPicker] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const loadPartnersList = async () => {
    if (partnersList.length > 0) return;
    try {
      const res = await fetch("/api/partners");
      const json = await res.json();
      setPartnersList(json.partners ?? []);
    } catch { setPartnersList([]); }
  };
  const addPartnerAsQualParty = () => {
    const partner = partnersList.find((p) => p.id === selectedPartnerId);
    if (!partner) return;
    setQualParties((prev) => [...prev, { full_name: partner.full_name, email: partner.email, phone: "", role_in_document: "partner" }]);
    setSelectedPartnerId("");
    setShowPartnerPicker(false);
  };

  // Adicionar Envolvido a um lote JÁ EXISTENTE (04/09/2026, P0 real: abrir
  // "Gerar Link de Qualificação Antecipada" de novo pra uma minuta que já
  // tinha lote em andamento criava um SEGUNDO lote separado, e
  // /api/contracts/generate só olha o lote mais recente -- o mais antigo,
  // com partes reais já qualificadas, ficava órfão e era ignorado na
  // geração). Corrige a causa raiz: adicionar gente a um lote existente
  // nunca mais cria lote novo.
  const [addingToBatchId, setAddingToBatchId] = useState<string | null>(null);
  const [addPartyForm, setAddPartyForm] = useState({ full_name: "", email: "", phone: "", role_in_document: "parte_principal" });
  const [addPartySubmitting, setAddPartySubmitting] = useState(false);
  const [addPartnerPickerFor, setAddPartnerPickerFor] = useState<string | null>(null);
  const [addPartnerPickerId, setAddPartnerPickerId] = useState("");

  const submitAddParty = async (batchId: string) => {
    if (!addPartyForm.full_name.trim() || !addPartyForm.email.trim()) return;
    setAddPartySubmitting(true);
    try {
      const res = await fetch(`/api/cm/qualifications/${batchId}/add-party`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addPartyForm),
      });
      const json = await res.json();
      if (res.ok) {
        setAddPartyForm({ full_name: "", email: "", phone: "", role_in_document: "parte_principal" });
        setAddingToBatchId(null);
        if (selected) await loadTemplateQualifications(selected.id);
      } else alert(json.error ?? "Erro ao adicionar envolvido");
    } catch { alert("Erro de conexão"); }
    finally { setAddPartySubmitting(false); }
  };

  const submitAddPartnerToBatch = async (batchId: string) => {
    const partner = partnersList.find((p) => p.id === addPartnerPickerId);
    if (!partner) return;
    setAddPartySubmitting(true);
    try {
      const res = await fetch(`/api/cm/qualifications/${batchId}/add-party`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: partner.full_name, email: partner.email, phone: "", role_in_document: "partner" }),
      });
      const json = await res.json();
      if (res.ok) {
        setAddPartnerPickerId("");
        setAddPartnerPickerFor(null);
        if (selected) await loadTemplateQualifications(selected.id);
      } else alert(json.error ?? "Erro ao adicionar partner");
    } catch { alert("Erro de conexão"); }
    finally { setAddPartySubmitting(false); }
  };
  const [copiedToken, setCopiedToken] = useState("");

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

  // Trava de LOI Casada (BRIEF 2, 30/08/2026): só aparece quando a minuta é
  // da série V3C-LOI. Sem UI aqui, o gate do backend nunca seria acionado
  // por ninguém fora de uma chamada de API direta.
  const [genValorOperacao, setGenValorOperacao] = useState("");
  const [genLoiSide, setGenLoiSide] = useState<"compra" | "venda">("venda");
  const [genLoiMatchedId, setGenLoiMatchedId] = useState("");
  const [genLoiJustification, setGenLoiJustification] = useState("");
  // Mitigação de Erro na LOI Casada (BRIEF 30/08/2026, item residual 2): a
  // Mesa escolhe a LOI de compra casada num dropdown em vez de digitar o
  // UUID de cabeça — nunca mostra nome/documento da contraparte real
  // (decisão de negócio de João: quebraria o anti-bypass da LOI), só código,
  // título e valor.
  const [loiCandidates, setLoiCandidates] = useState<{ id: string; contract_code: string; contract_title: string; valor_operacao: number | null }[]>([]);
  const [loadingLoiCandidates, setLoadingLoiCandidates] = useState(false);

  // Variáveis Manuais (03/09/2026): seção genérica no modal "Gerar Contrato"
  // pra qualquer template com requires_counterparty_signature=false (ex:
  // Carta de Intenção de Compra V3 para Terceiros) — um input de texto por
  // chave marcada "source":"manual" em variables_map, sem hardcode por
  // template. "vigencia_prazo" tem tratamento especial (toggle dias/
  // indeterminado) em vez de textbox cru, ver renderização abaixo.
  const [genExtraData, setGenExtraData] = useState<Record<string, string>>({});
  const [genVigenciaModo, setGenVigenciaModo] = useState<"dias" | "indeterminado">("dias");
  const [genVigenciaDias, setGenVigenciaDias] = useState("");

  const requiresCounterparty = selected?.requires_counterparty_signature !== false;
  const manualVars = ((selected?.variables_map ?? []) as { key: string; label: string; source?: string }[])
    .filter((v) => v.source === "manual" && v.key !== "vigencia_prazo");
  const hasVigenciaVar = ((selected?.variables_map ?? []) as { key: string; source?: string }[])
    .some((v) => v.key === "vigencia_prazo" && v.source === "manual");

  const openGenerateModal = () => {
    setGenParties([{ name: "", email: "", doc: "", role: "indicador" }]);
    setGenCommission("");
    setGenValorOperacao("");
    setGenLoiSide(selected?.requires_counterparty_signature === false ? "compra" : "venda");
    setGenLoiMatchedId("");
    setGenLoiJustification("");
    setGenExtraData({});
    setGenVigenciaModo("dias");
    setGenVigenciaDias("");
    setGenResult(null);
    setGenError(null);
    setShowGenerateModal(true);
  };
  const addGenPartyRow = () => setGenParties((prev) => [...prev, { name: "", email: "", doc: "", role: "indicador" }]);
  const removeGenPartyRow = (i: number) => setGenParties((prev) => prev.filter((_, idx) => idx !== i));
  const updateGenPartyRow = (i: number, field: "name" | "email" | "doc" | "role", value: string) =>
    setGenParties((prev) => prev.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));

  const isLoiSeries = selected?.contract_series === "V3C-LOI";

  useEffect(() => {
    if (!showGenerateModal || !isLoiSeries || genLoiSide !== "venda") return;
    setLoadingLoiCandidates(true);
    fetch("/api/contracts/loi-candidates")
      .then((res) => res.json())
      .then((json) => setLoiCandidates(json.candidates ?? []))
      .catch(() => setLoiCandidates([]))
      .finally(() => setLoadingLoiCandidates(false));
  }, [showGenerateModal, isLoiSeries, genLoiSide]);

  // P0 real achado 04/09/2026: o modal exigia preencher "Indicadores" na
  // mão mesmo quando a minuta já tinha lote de Qualificação Antecipada
  // completo — a Mesa ficava travada tendo que digitar uma parte
  // redundante que já estava qualificada de verdade via link. Quando já
  // existe qualificação real, o backend resolve as partes sozinho via
  // effectiveQualificationBatchId (auto-detect em generate/route.ts) — nem
  // precisa, nem deve, mandar avulso_parties nesse caso.
  //
  // P0 companheiro achado no mesmo dia: o auto-detect do backend só
  // considera lote com status EXATAMENTE "completo" (nunca "coletando").
  // A primeira versão deste fix checava só "alguma parte preenchida", sem
  // olhar o status do lote — quando alguém usa "Adicionar Envolvido" pra
  // incluir mais uma pessoa num lote já completo, ele volta pra
  // "coletando" (correto), mas a tela achava que ainda podia pular os
  // Indicadores, mandava nada pro backend, e o contrato quebrava com erro
  // de banco (chk_operation_contracts_vinculo) sem nenhuma explicação
  // clara. Agora a tela distingue completo (pode gerar sozinho) de
  // incompleto (bloqueia com aviso, nunca deixa cair no erro de banco).
  const activeQualBatch = qualBatches.find((b) => !b.consumido_por_contract_id);
  const hasQualificationData = activeQualBatch?.status === "completo"
    && activeQualBatch.cm_party_qualifications.some((p) => p.status === "preenchido");
  const hasIncompleteQualBatch = !!activeQualBatch && activeQualBatch.status !== "completo";

  const handleGenerateContract = async () => {
    if (!selected) return;

    if (hasIncompleteQualBatch && activeQualBatch) {
      const pendentes = activeQualBatch.cm_party_qualifications.filter((p) => p.status !== "preenchido").map((p) => p.full_name);
      setGenError(`Lote de Qualificação Antecipada ainda não está completo (falta: ${pendentes.join(", ")}). Complete a qualificação, ou remova essa(s) parte(s) do lote se não devem entrar neste contrato, antes de gerar.`);
      return;
    }

    if (requiresCounterparty && !hasQualificationData) {
      const invalid = genParties.some((p) => !p.name.trim() || !p.email.trim());
      if (genParties.length === 0 || invalid) {
        setGenError("Preencha nome e e-mail de todos os indicadores.");
        return;
      }
    }
    const missingManual = manualVars.filter((v) => !genExtraData[v.key]?.trim());
    if (missingManual.length > 0) {
      setGenError(`Preencha: ${missingManual.map((v) => v.label).join(", ")}.`);
      return;
    }
    if (hasVigenciaVar && genVigenciaModo === "dias" && !genVigenciaDias.trim()) {
      setGenError("Informe o número de dias de vigência (ou selecione \"Prazo indeterminado\").");
      return;
    }
    if (isLoiSeries && !genValorOperacao.trim()) {
      setGenError("Valor da Operação é obrigatório para Carta de Intenção (trava de LOI casada).");
      return;
    }
    setGenerating(true);
    setGenError(null);
    try {
      const extraDataPayload: Record<string, string> = { ...genExtraData };
      if (hasVigenciaVar) {
        extraDataPayload.vigencia_prazo = genVigenciaModo === "indeterminado"
          ? "prazo indeterminado"
          : `${genVigenciaDias.trim()} dias`;
      }
      const res = await fetch("/api/contracts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: selected.id,
          ...(requiresCounterparty && !hasQualificationData ? {
            avulso_parties: genParties.map((p) => ({ name: p.name.trim(), email: p.email.trim(), doc: p.doc.trim() || undefined, role: p.role })),
          } : {}),
          extra_data: extraDataPayload,
          commission_percent: genCommission ? Number(genCommission) : undefined,
          ...(isLoiSeries ? {
            valor_operacao: Number(genValorOperacao),
            loi_side: genLoiSide,
            loi_matched_contract_id: genLoiMatchedId.trim() || undefined,
            loi_override_justification: genLoiJustification.trim() || undefined,
          } : {}),
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

  // Deep-link (BRIEF 2, 30/08/2026, notificação proativa item 1): auto
  // seleciona a minuta quando a URL vem com ?template_id=, mesmo link que
  // o e-mail/WhatsApp de notificação aos sócios manda. Só roda uma vez
  // (didAutoSelect) pra não brigar com a seleção manual do usuário depois.
  const didAutoSelectRef = React.useRef(false);
  useEffect(() => {
    if (!highlightTemplateId || didAutoSelectRef.current || templates.length === 0) return;
    const target = templates.find((t) => t.id === highlightTemplateId);
    if (target) {
      didAutoSelectRef.current = true;
      selectTemplate(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, highlightTemplateId]);

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

  // Reprocessar (04-05/09/2026): destrava uma análise que falhou (ex: JSON
  // truncado por max_tokens baixo) sem precisar reenviar o arquivo do zero
  // -- reaproveita o body_text_raw original, já salvo no upload. Só
  // disponível para origem=agente_ia (Agente Revisor de Riscos, W17).
  const [retryingAnalysisId, setRetryingAnalysisId] = useState<string | null>(null);
  const handleRetryAnalysis = async (templateId: string) => {
    setRetryingAnalysisId(templateId);
    try {
      const res = await fetch(`/api/contracts/templates/${templateId}/retry-analysis`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) { alert(json.error ?? "Erro ao reprocessar"); return; }
      await fetchTemplates();
    } catch {
      alert("Erro de conexão ao reprocessar");
    } finally {
      setRetryingAnalysisId(null);
    }
  };

  const handleDraftSubmit = async () => {
    if (!draftDescricao.trim() || draftDescricao.trim().length < 30) {
      setDraftError("Descreva a intenção de negócio com pelo menos 30 caracteres");
      return;
    }
    setDrafting(true);
    setDraftError(null);
    try {
      const res = await fetch("/api/contracts/templates/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descricao_intencao: draftDescricao.trim(),
          vertical: draftVertical,
          contract_series: draftSeries,
          template_name: draftTemplateName.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setDraftError(json.error ?? "Erro ao acionar o agente"); return; }
      setShowDraftModal(false);
      setDraftDescricao("");
      setDraftTemplateName("");
      await fetchTemplates();
      const created = (await (await fetch(`/api/contracts/templates`)).json()).templates?.find((t: Template) => t.id === json.template_id);
      if (created) selectTemplate(created);
    } catch {
      setDraftError("Erro de conexão");
    } finally {
      setDrafting(false);
    }
  };

  const handleRequestRevision = async () => {
    if (!selected) return;
    if (!revisionInstrucao.trim() || revisionInstrucao.trim().length < 5) {
      setRevisionError("Descreva o ajuste que precisa (mínimo 5 caracteres)");
      return;
    }
    setRequestingRevision(true);
    setRevisionError(null);
    try {
      const res = await fetch(`/api/contracts/templates/${selected.id}/request-revision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instrucao: revisionInstrucao.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setRevisionError(json.error ?? "Erro ao pedir ajuste"); return; }
      setShowRevisionModal(false);
      setRevisionInstrucao("");
      await fetchTemplates();
    } catch {
      setRevisionError("Erro de conexão");
    } finally {
      setRequestingRevision(false);
    }
  };

  const loadReviews = async (templateId: string) => {
    try {
      const res = await fetch(`/api/contracts/templates/${templateId}/review`);
      const json = await res.json();
      setReviews(json.reviews ?? []);
    } catch { setReviews([]); }
  };

  const loadTemplateQualifications = async (templateId: string) => {
    try {
      const res = await fetch(`/api/cm/qualifications?template_id=${templateId}`);
      const json = await res.json();
      setQualBatches(json.batches ?? []);
    } catch { setQualBatches([]); }
  };

  // "Reabrir para Correção" (04/09/2026): reseta a MESMA qualificação pra
  // pendente sem gerar link novo — a pessoa reabre o link que já recebeu.
  const [reopeningId, setReopeningId] = useState<string | null>(null);
  const reopenQualification = async (partyId: string) => {
    if (!selected) return;
    if (!confirm("Reabrir esta qualificação para correção? A pessoa vai poder reenviar os dados pelo mesmo link.")) return;
    setReopeningId(partyId);
    try {
      const res = await fetch(`/api/cm/qualifications/${partyId}/reopen`, { method: "POST" });
      const json = await res.json();
      if (res.ok) await loadTemplateQualifications(selected.id);
      else alert(json.error ?? "Erro ao reabrir qualificação");
    } catch { alert("Erro de conexão"); }
    finally { setReopeningId(null); }
  };

  const selectTemplate = (t: Template) => {
    setSelected(t);
    setIsNew(false);
    setFormName(t.template_name);
    setFormVertical(t.vertical);
    setFormBody(t.body_text_raw);
    setReviewComment("");
    loadReviews(t.id);
    loadTemplateQualifications(t.id);
  };

  const openQualModal = () => {
    setQualParties([{ full_name: "", email: "", phone: "", role_in_document: "parte_principal" }]);
    setShowPartnerPicker(false);
    setSelectedPartnerId("");
    loadPartnersList();
    setShowQualModal(true);
  };
  const addQualPartyRow = () => setQualParties((prev) => [...prev, { full_name: "", email: "", phone: "", role_in_document: "parte_principal" }]);
  const removeQualPartyRow = (index: number) => setQualParties((prev) => prev.filter((_, i) => i !== index));
  const updateQualPartyRow = (index: number, field: "full_name" | "email" | "phone" | "role_in_document", value: string) => {
    setQualParties((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const submitTemplateQualification = async () => {
    if (!selected) return;
    const invalid = qualParties.some((p) => !p.full_name.trim() || !isValidEmail(p.email));
    if (qualParties.length === 0 || invalid) {
      alert("Preencha nome e e-mail válido para todos os envolvidos");
      return;
    }
    setCreatingQualification(true);
    try {
      const documentType = SERIES_TO_DOCUMENT_TYPE[selected.contract_series ?? ""] ?? "contrato_final";
      const res = await fetch("/api/cm/qualifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: selected.id, document_type: documentType, parties: qualParties }),
      });
      const json = await res.json();
      if (res.ok) {
        setShowQualModal(false);
        loadTemplateQualifications(selected.id);
      } else {
        alert(json.error ?? "Erro ao gerar qualificação antecipada");
      }
    } catch { alert("Erro de conexão"); }
    finally { setCreatingQualification(false); }
  };

  const qualificationLink = (token: string) =>
    `${typeof window !== "undefined" ? window.location.origin : "https://app.v3partners.com.br"}/intake/qualificacao/${token}`;

  const copyQualLink = (token: string) => {
    navigator.clipboard.writeText(qualificationLink(token));
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(""), 2000);
  };

  // Direcionamento por número (03/09/2026, achado ao vivo com João e Dr.
  // Athaydes): quando a Mesa digita o WhatsApp da parte na criação do lote,
  // o link já abre direto na conversa com essa pessoa, mesmo helper de
  // contracts-panel-client.tsx.
  const sanitizePhoneForWhatsapp = (phone: string): string => {
    const digits = phone.replace(/\D/g, "");
    if (!digits) return "";
    if (digits.length === 10 || digits.length === 11) return `55${digits}`;
    return digits;
  };

  const whatsappQualLink = (party: QualParty, templateName: string) => {
    const msg = `Olá ${party.full_name}, você foi cadastrado(a) como envolvido(a) na minuta "${templateName}" da V3 Partners. Complete seus dados de qualificação para prosseguirmos: ${qualificationLink(party.qualification_token)}`;
    const targetPhone = party.phone ? sanitizePhoneForWhatsapp(party.phone) : "";
    return `https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`;
  };

  const startNew = () => {
    setSelected(null);
    setIsNew(true);
    setFormName("");
    setFormVertical("capital_markets");
    setFormSeries("V3C-PAR");
    setFormBody("");
    setReviews([]);
    setQualBatches([]);
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
          <button onClick={() => { setShowDraftModal(true); setDraftError(null); }}
            className="flex items-center gap-2 px-4 py-2 bg-[#162744] text-[#C9A84C] border border-[#C9A84C]/30 rounded-lg text-sm font-bold hover:bg-[#C9A84C]/10 transition">
            <Scale size={16} /> Estruturar Minuta com IA
          </button>
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
                    {["rascunho", "em_revisao"].includes(selected.approval_status) && (
                      <button onClick={openQualModal}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#162744] text-[#9BAFC5] border border-[#9BAFC5]/20 rounded-lg text-xs font-bold hover:text-[#F5F1E8] hover:bg-[#243A66] transition">
                        <UserPlus size={13} /> Gerar Link de Qualificação Antecipada
                      </button>
                    )}
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

              {selected && qualBatches.length > 0 && (
                <div className="mb-4 bg-[#09081A] border border-[#9BAFC5]/10 rounded-lg p-4">
                  <h3 className="text-xs font-bold text-[#F5F1E8] mb-3 flex items-center gap-2">
                    <UserPlus size={13} className="text-[#C9A84C]" /> Qualificação Antecipada
                  </h3>
                  <div className="space-y-3">
                    {qualBatches.map((batch) => (
                      <div key={batch.id} className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-bold text-[#C9A84C] uppercase">Lote de Qualificação</span>
                          <span className={cn("text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border",
                            batch.status === "completo" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-[#243A66] text-[#9BAFC5] border-[#9BAFC5]/15"
                          )}>
                            {batch.cm_party_qualifications.filter((p) => p.status === "preenchido").length}/{batch.cm_party_qualifications.length} qualificados
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {batch.cm_party_qualifications.map((p) => (
                            <div key={p.id} className="flex items-center justify-between gap-2 bg-[#162744] rounded px-2.5 py-1.5">
                              <div className="min-w-0">
                                <p className="text-xs text-[#F5F1E8] truncate">{p.full_name} <span className="text-[9px] text-[#9BAFC5]">· {ROLE_LABELS[p.role_in_document] ?? p.role_in_document}</span></p>
                              </div>
                              {p.status === "preenchido" ? (
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <span className="text-[9px] text-emerald-400 flex items-center gap-1"><CheckCircle2 size={11} /> Qualificado</span>
                                  <button onClick={() => reopenQualification(p.id)} disabled={reopeningId === p.id}
                                    className="text-[9px] font-semibold text-amber-400 px-2 py-1 rounded border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 transition-colors disabled:opacity-50">
                                    {reopeningId === p.id ? "Reabrindo..." : "Corrigir"}
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <button onClick={() => copyQualLink(p.qualification_token)}
                                    className="flex items-center gap-1 text-[9px] font-semibold text-[#C9A84C] px-2 py-1 rounded border border-[#C9A84C]/40 bg-[#C9A84C]/10 hover:bg-[#C9A84C]/20 transition-colors">
                                    <Copy size={10} /> {copiedToken === p.qualification_token ? "Copiado" : "Copiar link"}
                                  </button>
                                  <a href={whatsappQualLink(p, selected.template_name)} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-[9px] font-semibold text-emerald-400 px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors">
                                    <Share2 size={10} /> WhatsApp
                                  </a>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        {batch.status === "completo" && !batch.cm_party_qualifications.some((p) => p.status !== "preenchido") && (
                          <p className="mt-2 text-[9px] text-[#9BAFC5]">
                            Lote completo. Os dados serão herdados automaticamente no primeiro contrato gerado a partir desta minuta (single-use: não reaproveitável em outro contrato).
                          </p>
                        )}

                        {!batch.consumido_por_contract_id && (
                          <div className="mt-2 pt-2 border-t border-[#9BAFC5]/10">
                            {addingToBatchId === batch.id ? (
                              <div className="space-y-1.5">
                                <input value={addPartyForm.full_name} onChange={(e) => setAddPartyForm((f) => ({ ...f, full_name: e.target.value }))} placeholder="Nome completo *"
                                  className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
                                <input value={addPartyForm.email} onChange={(e) => setAddPartyForm((f) => ({ ...f, email: e.target.value }))} placeholder="E-mail *" type="email"
                                  className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
                                <input value={addPartyForm.phone} onChange={(e) => setAddPartyForm((f) => ({ ...f, phone: e.target.value }))} placeholder="WhatsApp (opcional)" type="tel"
                                  className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
                                <select value={addPartyForm.role_in_document} onChange={(e) => setAddPartyForm((f) => ({ ...f, role_in_document: e.target.value }))}
                                  className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]">
                                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                  ))}
                                </select>
                                <div className="flex gap-2">
                                  <button onClick={() => submitAddParty(batch.id)} disabled={addPartySubmitting}
                                    className="flex-1 px-3 py-1.5 bg-[#C9A84C] text-[#09081A] rounded text-[10px] font-bold hover:bg-[#E8C97A] transition disabled:opacity-40">
                                    {addPartySubmitting ? "Adicionando..." : "Adicionar ao Lote"}
                                  </button>
                                  <button onClick={() => setAddingToBatchId(null)} className="px-3 py-1.5 bg-[#162744] text-[#9BAFC5] rounded text-[10px] font-bold">Cancelar</button>
                                </div>
                              </div>
                            ) : addPartnerPickerFor === batch.id ? (
                              <div className="flex gap-2">
                                <select value={addPartnerPickerId} onChange={(e) => setAddPartnerPickerId(e.target.value)}
                                  className="flex-1 bg-[#09081A] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]">
                                  <option value="">{partnersList.length === 0 ? "Carregando..." : "Selecione um partner"}</option>
                                  {partnersList.map((p) => (
                                    <option key={p.id} value={p.id}>{p.full_name} · {p.role}</option>
                                  ))}
                                </select>
                                <button onClick={() => submitAddPartnerToBatch(batch.id)} disabled={!addPartnerPickerId || addPartySubmitting}
                                  className="px-3 py-1.5 bg-[#C9A84C] text-[#09081A] rounded text-[10px] font-bold hover:bg-[#E8C97A] transition disabled:opacity-40">
                                  Adicionar
                                </button>
                                <button onClick={() => setAddPartnerPickerFor(null)} className="px-2 py-1.5 bg-[#162744] text-[#9BAFC5] rounded text-[10px] font-bold">×</button>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button onClick={() => { setAddingToBatchId(batch.id); setAddPartyForm({ full_name: "", email: "", phone: "", role_in_document: "parte_principal" }); }}
                                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-[#162744] border border-[#9BAFC5]/15 rounded text-[#9BAFC5] text-[10px] font-bold hover:text-[#F5F1E8] transition">
                                  <Plus size={11} /> Adicionar Envolvido
                                </button>
                                <button onClick={() => { setAddPartnerPickerFor(batch.id); loadPartnersList(); }}
                                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-[#162744] border border-[#C9A84C]/30 rounded text-[#C9A84C] text-[10px] font-bold hover:bg-[#C9A84C]/10 transition">
                                  <UserPlus size={11} /> Adicionar Partner
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
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
                    <div>
                      <div className="text-xs text-red-400 mb-2">
                        Falha na análise: {selected.analysis_error ?? "erro não especificado"}
                      </div>
                      <button
                        onClick={() => handleRetryAnalysis(selected.id)}
                        disabled={retryingAnalysisId === selected.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#162744] text-[#F5F1E8] rounded-lg text-xs font-bold hover:bg-[#243A66] transition disabled:opacity-50"
                      >
                        {retryingAnalysisId === selected.id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                        Reprocessar
                      </button>
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

              {selected?.origem === "agente_ia_estruturador" && (
                <div className="mb-4 p-3 rounded-lg bg-[#09081A] border border-blue-500/20">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">Origem: Agente Estruturador de Contratos</span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#243A66] text-[#9BAFC5]">Sempre cai em rascunho, revise antes de enviar pro jurídico</span>
                  </div>

                  {selected.analysis_status === "processando" && (
                    <div className="flex items-center gap-2 text-xs text-[#9BAFC5]">
                      <Loader2 size={14} className="animate-spin text-blue-400" />
                      Agente Estruturador de Contratos redigindo a minuta a partir da intenção descrita...
                    </div>
                  )}

                  {selected.analysis_status === "erro" && (
                    <div className="text-xs text-red-400">
                      Falha na estruturação: {selected.analysis_error ?? "erro não especificado"}
                    </div>
                  )}

                  {selected.analysis_status === "concluido" && (
                    <div className="space-y-2">
                      {selected.observacoes_para_revisor && (
                        <p className="text-xs text-[#F5F1E8]">{selected.observacoes_para_revisor}</p>
                      )}
                      {(selected.brechas_identificadas ?? []).length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-wider">Brechas identificadas e já fechadas na minuta</span>
                          {(selected.brechas_identificadas ?? []).map((b, i) => (
                            <div key={i} className="text-[11px]">
                              <span className="text-[#F5F1E8] font-medium">{b.clausula}:</span>{" "}
                              <span className="text-[#9BAFC5]">{b.risco}, sugestão: {b.sugestao}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {selected?.origem && ["agente_ia", "agente_ia_estruturador"].includes(selected.origem) && selected.analysis_status === "concluido" && (
                <div className="mb-4">
                  <button onClick={() => { setShowRevisionModal(true); setRevisionError(null); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#162744] text-[#9BAFC5] border border-[#9BAFC5]/20 rounded-lg text-xs font-bold hover:text-[#F5F1E8] hover:bg-[#243A66] transition">
                    <Scale size={13} /> Pedir Ajuste ao Agente
                  </button>
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
                    // 04/09/2026: filtra pela rodada atual. Um voto de rodada
                    // anterior (texto já editado desde então) não conta pro
                    // quórum de agora — mesma correção do P0 de review_round.
                    const currentRoundReviews = reviews.filter(r => r.review_round === selected?.review_round);
                    const sociosAprovados = Array.from(new Set(
                      currentRoundReviews.filter(r => r.reviewer_type === "compliance_socio" && r.decision === "aprovado").map(r => r.reviewer_name)
                    ));
                    const juridicoAprovou = currentRoundReviews.some(r => r.reviewer_type === "juridico" && r.decision === "aprovado");
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
                  <span className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider">Histórico de Revisão · Rodada atual: {selected?.review_round}</span>
                  <div className="mt-2 space-y-2">
                    {reviews.map((r) => {
                      const isCurrentRound = r.review_round === selected?.review_round;
                      return (
                        <div key={r.id} className={cn("rounded-lg px-3 py-2", isCurrentRound ? "bg-[#162744]" : "bg-[#162744]/40 opacity-60")}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-[#F5F1E8] font-medium">
                              {r.reviewer_name} <span className="text-[9px] text-[#9BAFC5]">({r.reviewer_type === "juridico" ? "Jurídico" : "Compliance/Sócio"})</span>
                              {" "}{r.decision === "aprovado" ? <span className="text-emerald-400">aprovou</span> : <span className="text-red-400">reprovou</span>}
                              {r.body_edited && <span className="text-[9px] text-[#9BAFC5]"> · editou o texto</span>}
                              {!isCurrentRound && <span className="text-[9px] text-amber-400"> · rodada {r.review_round}, superada por edição de texto</span>}
                            </span>
                            <span className="text-[9px] text-[#9BAFC5]">{new Date(r.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
                          </div>
                          {r.comment && <p className="text-[11px] text-[#9BAFC5] mt-1">{r.comment}</p>}
                        </div>
                      );
                    })}
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

      {/* Modal Estruturar Minuta com IA (Agente Estruturador de Contratos,
          02/09/2026): a Mesa descreve a intenção de negócio em texto
          livre, o agente redige a minuta completa. Rota assíncrona --
          fecha o modal na hora, o resultado chega pelo polling da lista.
          Diferente do Fast-Track: cai e permanece em rascunho, nunca
          fast-track automático pra revisão jurídica. */}
      {showDraftModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60" onClick={() => !drafting && setShowDraftModal(false)}>
          <div className="w-full max-w-lg bg-[#09081A] border border-[#C9A84C]/20 rounded-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-[#C9A84C]/20 flex items-center justify-between flex-shrink-0">
              <div className="text-sm font-bold text-[#F5F1E8] flex items-center gap-2"><Scale size={14} className="text-[#C9A84C]" /> Estruturar Minuta com IA</div>
              <button onClick={() => setShowDraftModal(false)} className="text-[#9BAFC5] hover:text-[#F5F1E8] text-xl">&times;</button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-[11px] text-[#9BAFC5]">
                Descreva a intenção de negócio (partes envolvidas, tipo de operação, pontos que precisam constar). O Agente Estruturador de Contratos redige a minuta completa a partir disso, comparando com minutas já aprovadas da mesma vertical. A minuta cai em rascunho, revise antes de mandar pro jurídico.
              </p>

              <div>
                <label className="block text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1">Intenção de Negócio</label>
                <textarea value={draftDescricao} onChange={(e) => setDraftDescricao(e.target.value)}
                  placeholder="Ex: NDA entre a V3 e um fundo de investimento americano, para troca de informações sobre uma operação de M&A no setor de agronegócio, com prazo de vigência de 3 anos e cláusula de não circunvenção..."
                  className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-lg px-3 py-2 text-xs text-[#F5F1E8] focus:border-[#C9A84C]/50 focus:outline-none min-h-[110px] resize-y" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1">Vertical</label>
                  <select value={draftVertical} onChange={(e) => setDraftVertical(e.target.value)}
                    className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-lg px-3 py-2 text-xs text-[#F5F1E8]">
                    {Object.entries(VERTICAL_LABELS).map(([v, label]) => (
                      <option key={v} value={v}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1">Série V3C</label>
                  <select value={draftSeries} onChange={(e) => setDraftSeries(e.target.value)}
                    className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-lg px-3 py-2 text-xs text-[#F5F1E8]">
                    {Object.entries(SERIES_LABELS).filter(([v]) => v !== "V3C-REG").map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1">Nome da Minuta (opcional)</label>
                <input value={draftTemplateName} onChange={(e) => setDraftTemplateName(e.target.value)}
                  placeholder="Se vazio, o sistema sugere um nome"
                  className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-lg px-3 py-2 text-xs text-[#F5F1E8] focus:border-[#C9A84C]/50 focus:outline-none" />
              </div>

              {draftError && <p className="text-xs text-red-400">{draftError}</p>}
            </div>
            <div className="p-4 border-t border-[#C9A84C]/20 flex justify-end gap-2">
              <button onClick={() => setShowDraftModal(false)} disabled={drafting}
                className="px-4 py-2 text-xs text-[#9BAFC5] hover:text-[#F5F1E8] transition">Cancelar</button>
              <button onClick={handleDraftSubmit} disabled={drafting || !draftDescricao.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-[#C9A84C] text-[#09081A] rounded-lg text-xs font-bold hover:bg-[#E8C97A] disabled:opacity-40 transition">
                {drafting ? <Loader2 size={14} className="animate-spin" /> : <Scale size={14} />}
                {drafting ? "Enviando..." : "Estruturar Minuta"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pedir Ajuste ao Agente (02/09/2026): compartilhado pelos 2
          agentes, reenvia a minuta atual + a instrução pro mesmo agente
          que a gerou. Rota assíncrona, mesmo polling da lista. */}
      {showRevisionModal && selected && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60" onClick={() => !requestingRevision && setShowRevisionModal(false)}>
          <div className="w-full max-w-lg bg-[#09081A] border border-[#C9A84C]/20 rounded-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-[#C9A84C]/20 flex items-center justify-between flex-shrink-0">
              <div>
                <div className="text-sm font-bold text-[#F5F1E8] flex items-center gap-2"><Scale size={14} className="text-[#C9A84C]" /> Pedir Ajuste ao Agente</div>
                <div className="text-[10px] text-[#9BAFC5]">{selected.template_name}</div>
              </div>
              <button onClick={() => setShowRevisionModal(false)} className="text-[#9BAFC5] hover:text-[#F5F1E8] text-xl">&times;</button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-[11px] text-[#9BAFC5]">
                Descreva o que precisa mudar (ex: "aumente a multa para R$300 mil", "adicione cláusula de não solicitação de funcionários"). O mesmo agente que gerou esta minuta produz uma nova versão com o ajuste, preservando o restante do texto.
              </p>
              <textarea value={revisionInstrucao} onChange={(e) => setRevisionInstrucao(e.target.value)}
                placeholder="O que precisa mudar?"
                className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-lg px-3 py-2 text-xs text-[#F5F1E8] focus:border-[#C9A84C]/50 focus:outline-none min-h-[90px] resize-y" />
              {revisionError && <p className="text-xs text-red-400">{revisionError}</p>}
            </div>
            <div className="p-4 border-t border-[#C9A84C]/20 flex justify-end gap-2">
              <button onClick={() => setShowRevisionModal(false)} disabled={requestingRevision}
                className="px-4 py-2 text-xs text-[#9BAFC5] hover:text-[#F5F1E8] transition">Cancelar</button>
              <button onClick={handleRequestRevision} disabled={requestingRevision || !revisionInstrucao.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-[#C9A84C] text-[#09081A] rounded-lg text-xs font-bold hover:bg-[#E8C97A] disabled:opacity-40 transition">
                {requestingRevision ? <Loader2 size={14} className="animate-spin" /> : <Scale size={14} />}
                {requestingRevision ? "Enviando..." : "Pedir Ajuste"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Qualificação Antecipada (02/09/2026, P1): dispara
          /api/cm/qualifications com template_id, antes de qualquer contrato
          existir. Single-use -- o primeiro contrato gerado a partir desta
          minuta consome o lote automaticamente. */}
      {showQualModal && selected && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60" onClick={() => setShowQualModal(false)}>
          <div className="w-full max-w-lg max-h-[85vh] bg-[#09081A] border border-[#C9A84C]/20 rounded-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-[#C9A84C]/20 flex items-center justify-between flex-shrink-0">
              <div>
                <div className="text-sm font-bold text-[#F5F1E8]">Gerar Link de Qualificação Antecipada</div>
                <div className="text-[10px] text-[#9BAFC5]">{selected.template_name}</div>
              </div>
              <button onClick={() => setShowQualModal(false)} className="text-[#9BAFC5] hover:text-[#F5F1E8] text-xl">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <p className="text-[11px] text-[#9BAFC5] leading-relaxed">
                Cada envolvido recebe um link individual para preencher seus próprios dados (CPF/CNPJ, RG, endereço) antes mesmo do contrato ser gerado. Quando a Mesa gerar o primeiro contrato a partir desta minuta, os dados são herdados automaticamente. Este lote é single-use: uma vez consumido por um contrato, o próximo contrato gerado por esta mesma minuta exige uma nova qualificação (evita misturar dados de clientes/deals diferentes).
              </p>
              {qualBatches.some((b) => !b.consumido_por_contract_id) && (
                <p className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 leading-relaxed">
                  Já existe um lote em andamento pra essa minuta (veja "Qualificação Antecipada" na tela principal). Criar um lote novo aqui gera um SEGUNDO lote separado, e só o mais recente é usado ao gerar contrato. Prefira usar "Adicionar Envolvido"/"Adicionar Partner" direto no lote já existente, a menos que este seja de verdade um cliente/deal diferente.
                </p>
              )}
              <div className="space-y-2">
                {qualParties.map((row, i) => (
                  <div key={i} className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-[#9BAFC5] uppercase">Envolvido {i + 1}</span>
                      {qualParties.length > 1 && (
                        <button onClick={() => removeQualPartyRow(i)}><X size={12} className="text-red-400/70 hover:text-red-400" /></button>
                      )}
                    </div>
                    <input value={row.full_name} onChange={(e) => updateQualPartyRow(i, "full_name", e.target.value)} placeholder="Nome completo *"
                      className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
                    <input value={row.email} onChange={(e) => updateQualPartyRow(i, "email", e.target.value)} placeholder="E-mail *" type="email"
                      className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
                    <input value={row.phone} onChange={(e) => updateQualPartyRow(i, "phone", e.target.value)} placeholder="WhatsApp (opcional, ex: 21999998888)" type="tel"
                      className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
                    <select value={row.role_in_document} onChange={(e) => updateQualPartyRow(i, "role_in_document", e.target.value)}
                      className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]">
                      {Object.entries(ROLE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={addQualPartyRow}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#162744] border border-[#9BAFC5]/15 rounded text-[#9BAFC5] text-[10px] font-bold hover:text-[#F5F1E8] transition">
                  <Plus size={12} /> Adicionar Envolvido
                </button>
                <button onClick={() => setShowPartnerPicker((v) => !v)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#162744] border border-[#C9A84C]/30 rounded text-[#C9A84C] text-[10px] font-bold hover:bg-[#C9A84C]/10 transition">
                  <UserPlus size={12} /> Adicionar Partner
                </button>
              </div>
              {showPartnerPicker && (
                <div className="bg-[#12112A] border border-[#C9A84C]/20 rounded-lg p-2 flex gap-2">
                  <select value={selectedPartnerId} onChange={(e) => setSelectedPartnerId(e.target.value)}
                    className="flex-1 bg-[#09081A] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]">
                    <option value="">
                      {partnersList.length === 0 ? "Carregando partners..." : "Selecione um partner"}
                    </option>
                    {partnersList.map((p) => (
                      <option key={p.id} value={p.id}>{p.full_name} · {p.role}</option>
                    ))}
                  </select>
                  <button onClick={addPartnerAsQualParty} disabled={!selectedPartnerId}
                    className="px-3 py-1.5 bg-[#C9A84C] text-[#09081A] rounded text-[10px] font-bold hover:bg-[#E8C97A] transition disabled:opacity-40">
                    Adicionar
                  </button>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-[#C9A84C]/20 flex-shrink-0">
              <button onClick={submitTemplateQualification} disabled={creatingQualification}
                className="w-full px-3 py-2.5 bg-[#C9A84C] text-[#09081A] rounded-lg text-xs font-bold hover:bg-[#E8C97A] transition disabled:opacity-50 flex items-center justify-center gap-2">
                {creatingQualification ? <Loader2 size={14} className="animate-spin" /> : null} Enviar Links de Qualificação
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
                  {hasIncompleteQualBatch && activeQualBatch && (
                    <p className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 leading-relaxed">
                      Lote de Qualificação Antecipada ainda não está completo: {activeQualBatch.cm_party_qualifications.filter((p) => p.status !== "preenchido").map((p) => p.full_name).join(", ")} ainda não preencheu. Complete a qualificação (ou remova essa parte do lote, se não deve entrar neste contrato) antes de gerar.
                    </p>
                  )}
                  {requiresCounterparty && hasQualificationData ? (
                    <p className="text-[11px] text-emerald-400 leading-relaxed bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2.5">
                      As partes já foram qualificadas via "Qualificação Antecipada" (veja o Lote de Qualificação acima). Não é preciso preencher indicador nenhum aqui: o contrato usa automaticamente os dados já coletados.
                    </p>
                  ) : requiresCounterparty ? (
                    <>
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
                    </>
                  ) : (
                    <p className="text-[11px] text-[#9BAFC5] leading-relaxed bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-2.5">
                      Documento unilateral: só a V3 Partners (João Lemos Netto) assina. O destinatário aparece no texto da carta, não como signatário.
                    </p>
                  )}

                  {manualVars.length > 0 && (
                    <div className="border border-[#9BAFC5]/15 rounded-lg p-3 space-y-2 bg-[#09081A]">
                      <div className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider">Variáveis do Documento</div>
                      {manualVars.map((v) => (
                        <div key={v.key}>
                          <label className="block text-[9px] font-bold text-[#9BAFC5] uppercase tracking-wider mb-1">{v.label} *</label>
                          <input value={genExtraData[v.key] ?? ""} onChange={(e) => setGenExtraData((prev) => ({ ...prev, [v.key]: e.target.value }))}
                            className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
                        </div>
                      ))}
                      {hasVigenciaVar && (
                        <div>
                          <label className="block text-[9px] font-bold text-[#9BAFC5] uppercase tracking-wider mb-1">Vigência *</label>
                          <div className="flex gap-2">
                            <select value={genVigenciaModo} onChange={(e) => setGenVigenciaModo(e.target.value as "dias" | "indeterminado")}
                              className="bg-[#162744] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]">
                              <option value="dias">Nº de dias</option>
                              <option value="indeterminado">Prazo indeterminado</option>
                            </select>
                            {genVigenciaModo === "dias" && (
                              <input value={genVigenciaDias} onChange={(e) => setGenVigenciaDias(e.target.value)} placeholder="Ex: 30"
                                className="flex-1 bg-[#162744] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1">Comissão Total % (opcional)</label>
                    <input value={genCommission} onChange={(e) => setGenCommission(e.target.value)} placeholder="Ex: 5"
                      className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
                  </div>

                  {isLoiSeries && (
                    <div className="border border-blue-500/20 rounded-lg p-3 space-y-2 bg-[#09081A]">
                      <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Trava de LOI Casada</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1">Lado</label>
                          <select value={genLoiSide} onChange={(e) => setGenLoiSide(e.target.value as "compra" | "venda")}
                            className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]">
                            <option value="venda">Venda</option>
                            <option value="compra">Compra</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1">Valor da Operação (R$) *</label>
                          <input value={genValorOperacao} onChange={(e) => setGenValorOperacao(e.target.value)} placeholder="Ex: 500000"
                            className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
                        </div>
                      </div>
                      {genLoiSide === "venda" && (
                        <>
                          <div>
                            <label className="block text-[9px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1">LOI de Compra Casada (opcional)</label>
                            <select value={genLoiMatchedId} onChange={(e) => setGenLoiMatchedId(e.target.value)} disabled={loadingLoiCandidates}
                              className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8] disabled:opacity-50">
                              <option value="">
                                {loadingLoiCandidates ? "Carregando..." : loiCandidates.length === 0 ? "Nenhuma LOI de compra ativa" : "Sem par casado"}
                              </option>
                              {loiCandidates.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.contract_code} · {c.contract_title} · {c.valor_operacao != null ? `R$ ${c.valor_operacao.toLocaleString("pt-BR")}` : "valor n/d"}
                                </option>
                              ))}
                            </select>
                            <p className="text-[9px] text-[#9BAFC5] mt-1">Lista só código, título e valor — nunca a identidade da contraparte, por desenho.</p>
                          </div>
                          <div>
                            <label className="block text-[9px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1">Justificativa se emitir sem par casado</label>
                            <textarea value={genLoiJustification} onChange={(e) => setGenLoiJustification(e.target.value)} placeholder="Obrigatório se não houver LOI de compra vinculada. Exige aprovação unânime dos 3 sócios pra enviar depois."
                              className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8] min-h-[50px] resize-y" />
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {genError && <p className="text-[11px] text-red-400">{genError}</p>}
                </div>
                <div className="p-4 border-t border-[#C9A84C]/20 flex-shrink-0">
                  <button onClick={handleGenerateContract} disabled={generating || hasIncompleteQualBatch}
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
