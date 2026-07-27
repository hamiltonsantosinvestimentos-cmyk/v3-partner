"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart3, Users, Gavel, DollarSign, Play,
  Loader2, AlertTriangle, CheckCircle2, Clock,
  ArrowRight, RefreshCw, Shield, Bot, Upload, Mic,
  Link2, Copy, Plus, FileText, UserPlus, ClipboardCheck,
  ToggleLeft, ToggleRight, Save, Download, ExternalLink, Trash2, X,
} from "lucide-react";
import { cn, maskCpfCnpjInput, maskPhoneInput, isValidEmail, maskCurrencyBRLInput, parseCurrencyBRLInput, formatCurrencyBRLFromNumber, maskCurrencyInput, CM_CURRENCY_SYMBOL, type CmCurrency } from "@/lib/utils";
import { AssetAssistant } from "./asset-assistant";
import { CM_DOCUMENT_CHECKLISTS, type CmAssetType } from "@/lib/cm-checklists";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";

interface Listing {
  id: string;
  anonymous_id: string;
  apelido: string | null;
  numero_interno: string | null;
  originator_profile_id: string | null;
  originator_referral_id: string | null;
  asset_type: string;
  valor_face: number;
  currency?: CmCurrency;
  desagio_pretendido: number | null;
  listing_status: string;
  risk_score: number | null;
  created_at: string;
  cm_bids: { count: number }[];
  cm_listing_documents: { count: number }[];
  allow_public_listing?: boolean;
  public_gallery?: { storage_path: string; caption: string; order: number }[];
  inspection_requests?: InspectionRequest[];
  selected_thesis_template?: string | null;
  public_narrative?: string | null;
}

interface InspectionRequest {
  id: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone?: string | null;
  requested_at: string;
  proof_of_funds_status: "pendente" | "em_analise" | "aprovado" | "rejeitado";
  status: string;
}

interface Match {
  id: string;
  score: number;
  match_reasons: any;
  investor_demands: { nome_contato: string; email: string; empresa: string | null } | null;
  cm_asset_listings: { anonymous_id: string; asset_type: string; valor_face: number } | null;
}

interface Bid {
  id: string;
  listing_id: string;
  bid_value: number;
  desagio_oferecido: number | null;
  status: string;
  payment_type: string;
  notes: string | null;
  created_at: string;
  cm_asset_listings: { anonymous_id: string; valor_face: number } | null;
}

const STATUS_COLUMNS = [
  { key: "reuniao_validada,formulario_preenchido", label: "Intake", color: "border-blue-500", icon: Clock },
  { key: "nda_assinado,em_analise", label: "NDA / Análise", color: "border-orange-500", icon: Shield },
  { key: "aprovado_head", label: "Aguarda Head", color: "border-[#C9A84C]", icon: Gavel },
  { key: "ativo_vitrine,proposta_recebida", label: "Na Vitrine", color: "border-emerald-500", icon: BarChart3 },
  { key: "em_escrow_due_diligence", label: "Escrow / DD", color: "border-purple-500", icon: DollarSign },
  // Coluna adicionada em 27/07: ativos "cancelado" existiam no banco (deleted_at nulo,
  // continuavam contando em Total Ativos) mas nao apareciam em nenhuma coluna do Kanban,
  // ficando orfaos sem visibilidade nenhuma para a Mesa.
  { key: "cancelado", label: "Cancelado", color: "border-red-500", icon: X },
];

function formatBRL(v: number) {
  if (v >= 1_000_000_000) {
    const bi = v / 1_000_000_000;
    const casas = Number.isInteger(bi) ? 0 : 2;
    const num = bi.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
    return `R$ ${num} ${bi === 1 ? "Bilhão" : "Bilhões"}`;
  }
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
  return `R$ ${v.toLocaleString("pt-BR")}`;
}

function formatBRLFull(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Mesma logica compacta de formatBRL, mas respeitando a moeda do ativo (USD/EUR usam simbolo e notacao correspondentes). KPIs agregados (soma de varios ativos) continuam em BRL, ver formatBRL. */
function formatListingValue(v: number, currency?: CmCurrency) {
  if (!currency || currency === "BRL") return formatBRL(v);
  const symbol = CM_CURRENCY_SYMBOL[currency];
  if (v >= 1_000_000_000) {
    const bi = v / 1_000_000_000;
    const casas = Number.isInteger(bi) ? 0 : 2;
    return `${symbol} ${bi.toLocaleString("en-US", { minimumFractionDigits: casas, maximumFractionDigits: casas })}Bi`;
  }
  if (v >= 1_000_000) return `${symbol} ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${symbol} ${(v / 1_000).toFixed(0)}K`;
  return `${symbol} ${v.toLocaleString("en-US")}`;
}

function toFieldLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function confidenceStyle(score: number): string {
  if (score >= 85) return "bg-emerald-500/15 border-emerald-500/30 text-emerald-400";
  if (score >= 60) return "bg-[#C9A84C]/15 border-[#C9A84C]/30 text-[#C9A84C]";
  return "bg-red-500/15 border-red-500/30 text-red-400";
}

// Achata objetos aninhados (ex: outros_campos) em pares label/valor, ignorando nulos e vazios
function flattenExtractedFields(obj: Record<string, unknown>, prefix = ""): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  for (const [key, val] of Object.entries(obj)) {
    if (val === null || val === undefined || val === "") continue;
    if (Array.isArray(val)) {
      if (val.length === 0) continue;
      out.push({ label: toFieldLabel(prefix + key), value: val.join(", ") });
    } else if (typeof val === "object") {
      out.push(...flattenExtractedFields(val as Record<string, unknown>, ""));
    } else if (typeof val === "boolean") {
      out.push({ label: toFieldLabel(prefix + key), value: val ? "Sim" : "Não" });
    } else if (typeof val === "number") {
      out.push({ label: toFieldLabel(prefix + key), value: val.toLocaleString("pt-BR") });
    } else {
      out.push({ label: toFieldLabel(prefix + key), value: String(val) });
    }
  }
  return out;
}

// Consolida dados_extraidos de TODOS os documentos de um ativo em um unico
// resumo por campo, sinalizando divergencia quando documentos diferentes
// extraem valores diferentes para o mesmo campo (estilo FORJA multi-fonte).
function buildConsolidatedSummary(docs: any[]): { label: string; values: { value: string; source: string; confidence: number | null }[] }[] {
  const map = new Map<string, { value: string; source: string; confidence: number | null }[]>();
  for (const doc of docs) {
    const ocr = doc.ocr_result;
    const isStructured = ocr && typeof ocr === "object" && !Array.isArray(ocr) && "dados_extraidos" in ocr;
    if (!isStructured || !ocr.dados_extraidos) continue;
    const fields = flattenExtractedFields(ocr.dados_extraidos);
    const confidence = typeof ocr.confiabilidade === "number" ? ocr.confiabilidade : null;
    const source = doc.original_filename ?? "documento";
    for (const f of fields) {
      const arr = map.get(f.label) ?? [];
      arr.push({ value: f.value, source, confidence });
      map.set(f.label, arr);
    }
  }
  return Array.from(map.entries()).map(([label, values]) => ({ label, values }));
}

export function MesaCapitaisClient({ userRole = "GESTAO" }: { userRole?: string }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [partners, setPartners] = useState<{ id: string; full_name: string }[]>([]);
  const [referralPartners, setReferralPartners] = useState<{ id: string; full_name: string; contact: string | null }[]>([]);
  const [showNewReferralPartner, setShowNewReferralPartner] = useState(false);
  const [newReferralName, setNewReferralName] = useState("");
  const [newReferralContact, setNewReferralContact] = useState("");
  const [savingReferralPartner, setSavingReferralPartner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [runningMatch, setRunningMatch] = useState(false);
  const [tab, setTab] = useState<"kanban" | "matches" | "bids">("kanban");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [assistantListing, setAssistantListing] = useState<{ id: string; anonymous_id: string } | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [generatingNarrative, setGeneratingNarrative] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<"geral" | "documentos" | "orderbook" | "governanca" | "notas">("geral");
  const [listingDocs, setListingDocs] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [intakeUrl, setIntakeUrl] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [dealRoomUrl, setDealRoomUrl] = useState<string | null>(null);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [roomInvites, setRoomInvites] = useState<any[]>([]);
  const [contractTemplates, setContractTemplates] = useState<any[]>([]);
  const [generatingContract, setGeneratingContract] = useState(false);
  const [contractResult, setContractResult] = useState<any>(null);
  const [buyLinkUrl, setBuyLinkUrl] = useState<string | null>(null);
  const [generatingBuyLink, setGeneratingBuyLink] = useState(false);
  const [checklists, setChecklists] = useState<any[]>([]);
  const [kycDocs, setKycDocs] = useState<any[]>([]);
  const [kycPartyType, setKycPartyType] = useState<"comprador" | "vendedor">("vendedor");
  const [kycPartyName, setKycPartyName] = useState("");
  const [kycDocType, setKycDocType] = useState("");
  const [uploadingKyc, setUploadingKyc] = useState(false);
  const [kycActionLoading, setKycActionLoading] = useState<string | null>(null);
  const [dealNotes, setDealNotes] = useState<any[]>([]);
  const [mesaUsers, setMesaUsers] = useState<{ id: string; full_name: string }[]>([]);
  const [noteContent, setNoteContent] = useState("");
  const [noteMentionedIds, setNoteMentionedIds] = useState<string[]>([]);
  const [submittingNote, setSubmittingNote] = useState(false);
  const [intermediaries, setIntermediaries] = useState<any[]>([]);
  const [partnersList, setPartnersList] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [interSide, setInterSide] = useState<"compra" | "venda">("venda");
  const [interName, setInterName] = useState("");
  const [interDoc, setInterDoc] = useState("");
  const [interPercentage, setInterPercentage] = useState("");
  const [interMandatarioId, setInterMandatarioId] = useState("");
  const [addingIntermediary, setAddingIntermediary] = useState(false);
  const [generatingAnnex, setGeneratingAnnex] = useState<string | null>(null);
  const [generatingFillLink, setGeneratingFillLink] = useState<string | null>(null);
  const [showQuickPartner, setShowQuickPartner] = useState(false);
  const [qpName, setQpName] = useState("");
  const [qpEmail, setQpEmail] = useState("");
  const [qpPhone, setQpPhone] = useState("");
  const [qpDoc, setQpDoc] = useState("");
  const [creatingQuickPartner, setCreatingQuickPartner] = useState(false);
  const [checklistsLoading, setChecklistsLoading] = useState(false);
  const [checklistTab, setChecklistTab] = useState<"pre_aceite" | "pre_fechamento" | "pos_cessao">("pre_fechamento");
  const [askPriceFloor, setAskPriceFloor] = useState<string>("");
  const [autoAcceptEnabled, setAutoAcceptEnabled] = useState(false);
  const [valorFaceNegociado, setValorFaceNegociado] = useState<string>("");
  const [valorAtualizadoNegociado, setValorAtualizadoNegociado] = useState<string>("");
  const [desagioNegociado, setDesagioNegociado] = useState<string>("");
  const [apelidoNegociado, setApelidoNegociado] = useState<string>("");
  const [originatorNegociado, setOriginatorNegociado] = useState<string>("");
  const [savingValores, setSavingValores] = useState(false);
  const [deletingListing, setDeletingListing] = useState(false);
  const [showLixeira, setShowLixeira] = useState(false);
  const [lixeiraItems, setLixeiraItems] = useState<any[]>([]);
  const [lixeiraLoading, setLixeiraLoading] = useState(false);
  const [savingFloor, setSavingFloor] = useState(false);
  const [showNdaForm, setShowNdaForm] = useState(false);
  const [ndaFile, setNdaFile] = useState<File | null>(null);
  const [ndaDate, setNdaDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [ndaReason, setNdaReason] = useState("");
  const [submittingNda, setSubmittingNda] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [submittingManual, setSubmittingManual] = useState(false);
  const [manualForm, setManualForm] = useState({
    asset_type: "" as CmAssetType | "",
    currency: "BRL" as CmCurrency,
    apelido: "",
    originator_profile_id: "",
    seller_name: "",
    seller_cpf_cnpj: "",
    ente_devedor: "",
    esfera: "",
    tribunal: "",
    natureza: "",
    numero_processo: "",
    valor_face: "",
    valor_atualizado: "",
    desagio_pretendido: "",
    prazo_estimado_meses: "",
    allows_tranching: false,
    tranche_valor_minimo: "",
  });

  const [showManualBuyerForm, setShowManualBuyerForm] = useState(false);
  const [submittingManualBuyer, setSubmittingManualBuyer] = useState(false);
  const [manualBuyerForm, setManualBuyerForm] = useState({
    nome_contato: "",
    email: "",
    telefone: "",
    empresa: "",
    cpf_cnpj: "",
    ticket_min: "",
    ticket_max: "",
    desagio_min: "",
    asset_types_preferidos: [] as string[],
    criterios: "",
  });

  const submitManualBuyer = async () => {
    if (!manualBuyerForm.nome_contato.trim() || !isValidEmail(manualBuyerForm.email)) {
      alert("Nome e email válido são obrigatórios");
      return;
    }
    setSubmittingManualBuyer(true);
    try {
      const isCnpj = manualBuyerForm.cpf_cnpj.replace(/\D/g, "").length > 11;
      const res = await fetch("/api/cm/investor-demands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome_contato: manualBuyerForm.nome_contato.trim(),
          email: manualBuyerForm.email.trim(),
          telefone: manualBuyerForm.telefone || undefined,
          empresa: manualBuyerForm.empresa || undefined,
          cpf: !isCnpj ? manualBuyerForm.cpf_cnpj || undefined : undefined,
          cnpj: isCnpj ? manualBuyerForm.cpf_cnpj || undefined : undefined,
          ticket_min: manualBuyerForm.ticket_min ? parseCurrencyBRLInput(manualBuyerForm.ticket_min) : undefined,
          ticket_max: manualBuyerForm.ticket_max ? parseCurrencyBRLInput(manualBuyerForm.ticket_max) : undefined,
          desagio_min: manualBuyerForm.desagio_min || undefined,
          asset_types_preferidos: manualBuyerForm.asset_types_preferidos,
          criterios: manualBuyerForm.criterios || undefined,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        alert("Comprador cadastrado");
        setShowManualBuyerForm(false);
        setManualBuyerForm({
          nome_contato: "", email: "", telefone: "", empresa: "", cpf_cnpj: "",
          ticket_min: "", ticket_max: "", desagio_min: "", asset_types_preferidos: [], criterios: "",
        });
        fetchAll();
      } else {
        alert(json.error ?? "Erro ao cadastrar comprador");
      }
    } catch {
      alert("Erro de conexão");
    } finally {
      setSubmittingManualBuyer(false);
    }
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, matchRes, bidRes] = await Promise.all([
        fetch("/api/cm/listings"),
        fetch("/api/cm/matches"),
        fetch("/api/cm/bids?status=pendente"),
      ]);
      const [listJson, matchJson, bidJson] = await Promise.all([
        listRes.json(), matchRes.json(), bidRes.json(),
      ]);
      setListings(listJson.listings ?? []);
      setMatches(matchJson.matches ?? []);
      setBids(bidJson.bids ?? []);
    } catch (err) {
      console.error("[Mesa CM]", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Polling leve enquanto a aba "Propostas" fica aberta — corrige bug de propostas
  // novas nao aparecendo sem reload manual (Mesa Operacional 2026-07-15)
  useEffect(() => {
    if (tab !== "bids") return;
    const interval = setInterval(() => fetchAll(), 20000);
    return () => clearInterval(interval);
  }, [tab, fetchAll]);

  useEffect(() => {
    fetch("/api/partners")
      .then((res) => res.json())
      .then((json) => setPartners(json.partners ?? []))
      .catch(() => setPartners([]));
  }, []);

  const loadReferralPartners = useCallback(() => {
    fetch("/api/cm/referral-partners")
      .then((res) => res.json())
      .then((json) => setReferralPartners(json.partners ?? []))
      .catch(() => setReferralPartners([]));
  }, []);

  useEffect(() => { loadReferralPartners(); }, [loadReferralPartners]);

  useEffect(() => {
    fetch("/api/cm/mesa-users")
      .then((res) => res.json())
      .then((json) => setMesaUsers(json.users ?? []))
      .catch(() => setMesaUsers([]));
  }, []);

  useEffect(() => {
    fetch("/api/cm/partners-list")
      .then((res) => res.json())
      .then((json) => setPartnersList(json.partners ?? []))
      .catch(() => setPartnersList([]));
  }, []);

  const loadDealNotes = async (listingId: string) => {
    try {
      const res = await fetch(`/api/cm/deal-notes?listing_id=${listingId}`);
      const json = await res.json();
      setDealNotes(json.notes ?? []);
    } catch { setDealNotes([]); }
  };

  const toggleMention = (userId: string, fullName: string) => {
    if (noteMentionedIds.includes(userId)) {
      setNoteMentionedIds((prev) => prev.filter((id) => id !== userId));
      setNoteContent((prev) => prev.replace(`@${fullName} `, ""));
    } else {
      setNoteMentionedIds((prev) => [...prev, userId]);
      setNoteContent((prev) => `${prev}${prev && !prev.endsWith(" ") ? " " : ""}@${fullName} `);
    }
  };

  const submitDealNote = async (listingId: string) => {
    if (!noteContent.trim()) { alert("Escreva uma nota antes de enviar"); return; }
    setSubmittingNote(true);
    try {
      const res = await fetch("/api/cm/deal-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listingId, content: noteContent.trim(), mentioned_user_ids: noteMentionedIds }),
      });
      const json = await res.json();
      if (res.ok) {
        setDealNotes((prev) => [json.note, ...prev]);
        setNoteContent("");
        setNoteMentionedIds([]);
      } else {
        alert(json.error ?? "Erro ao salvar nota");
      }
    } catch { alert("Erro de conexão"); }
    finally { setSubmittingNote(false); }
  };

  const loadIntermediaries = async (listingId: string) => {
    try {
      const res = await fetch(`/api/cm/deal-intermediaries?listing_id=${listingId}`);
      const json = await res.json();
      setIntermediaries(json.intermediaries ?? []);
    } catch { setIntermediaries([]); }
  };

  const addIntermediary = async (listingId: string) => {
    if (!interName.trim() || !interPercentage || !interMandatarioId) {
      alert("Nome, percentual e Mandatário são obrigatórios");
      return;
    }
    setAddingIntermediary(true);
    try {
      const res = await fetch("/api/cm/deal-intermediaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: listingId,
          side: interSide,
          mandatario_partner_id: interMandatarioId,
          intermediary_name: interName.trim(),
          intermediary_document: interDoc.trim() || null,
          percentage: Number(interPercentage),
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setIntermediaries((prev) => [...prev, json.intermediary]);
        setInterName(""); setInterDoc(""); setInterPercentage("");
      } else {
        alert(json.error ?? "Erro ao adicionar intermediário");
      }
    } catch { alert("Erro de conexão"); }
    finally { setAddingIntermediary(false); }
  };

  const removeIntermediary = async (id: string) => {
    if (!confirm("Remover este intermediário da cadeia?")) return;
    await fetch(`/api/cm/deal-intermediaries/${id}`, { method: "DELETE" });
    setIntermediaries((prev) => prev.filter((i) => i.id !== id));
  };

  const generateAnnex = async (listingId: string, side: "compra" | "venda") => {
    setGeneratingAnnex(side);
    try {
      const res = await fetch("/api/cm/deal-intermediaries/generate-annex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listingId, side }),
      });
      const json = await res.json();
      if (res.ok) {
        alert(`Anexo gerado e enviado para assinatura do Mandatário.\nLink: ${json.signing_url}`);
      } else {
        alert(json.error ?? "Erro ao gerar Anexo");
      }
    } catch { alert("Erro de conexão"); }
    finally { setGeneratingAnnex(null); }
  };

  const generateFillLink = async (listingId: string, side: "compra" | "venda") => {
    if (!interMandatarioId) {
      alert("Selecione o Mandatário deste lado antes de gerar o link de preenchimento");
      return;
    }
    setGeneratingFillLink(side);
    try {
      const res = await fetch("/api/cm/deal-intermediaries/generate-fill-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listingId, side, mandatario_partner_id: interMandatarioId }),
      });
      const json = await res.json();
      if (res.ok) {
        navigator.clipboard.writeText(json.url);
        alert(`Link copiado e enviado por email ao Mandatário.\n${json.url}`);
      } else {
        alert(json.error ?? "Erro ao gerar link");
      }
    } catch { alert("Erro de conexão"); }
    finally { setGeneratingFillLink(null); }
  };

  const createQuickPartner = async () => {
    if (!qpName.trim() || !qpEmail.trim()) {
      alert("Nome e email são obrigatórios");
      return;
    }
    setCreatingQuickPartner(true);
    try {
      const res = await fetch("/api/cm/deal-intermediaries/quick-partner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: qpName.trim(), email: qpEmail.trim(), phone: qpPhone.trim() || null, document_cpf: qpDoc.trim() || null }),
      });
      const json = await res.json();
      if (res.ok) {
        setPartnersList((prev) => [...prev, json.partner]);
        setInterMandatarioId(json.partner.id);
        setShowQuickPartner(false);
        setQpName(""); setQpEmail(""); setQpPhone(""); setQpDoc("");
      } else {
        alert(json.error ?? "Erro ao cadastrar Partner");
      }
    } catch { alert("Erro de conexão"); }
    finally { setCreatingQuickPartner(false); }
  };

  const createReferralPartner = async (): Promise<string | null> => {
    if (!newReferralName.trim()) { alert("Nome é obrigatório"); return null; }
    setSavingReferralPartner(true);
    try {
      const res = await fetch("/api/cm/referral-partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: newReferralName.trim(), contact: newReferralContact.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error ?? "Erro ao criar partner"); return null; }
      setReferralPartners((prev) => [...prev, json.partner]);
      setShowNewReferralPartner(false);
      setNewReferralName("");
      setNewReferralContact("");
      return `ref:${json.partner.id}`;
    } catch {
      alert("Erro de conexão");
      return null;
    } finally {
      setSavingReferralPartner(false);
    }
  };

  const runMatchmaking = async () => {
    setRunningMatch(true);
    try {
      const res = await fetch("/api/cm/matches/run", { method: "POST" });
      const json = await res.json();
      alert(json.message ?? `${json.matches_created} match(es) criado(s)`);
      fetchAll();
    } catch { alert("Erro ao executar matchmaking"); }
    finally { setRunningMatch(false); }
  };

  const handleUploadDoc = async (listingId: string, file: File, checklistItemId?: string) => {
    setUploadingDoc(listingId);
    try {
      const isAudio = /\.(mp3|ogg|wav|m4a|webm)$/i.test(file.name);
      const documentType = isAudio ? "AUDIO" : "OUTRO";

      // 1. Pede uma signed upload URL — contorna o limite de body do Vercel
      //    serverless (~4.5MB) para documentos grandes (múltiplos sub-documentos anexados)
      const urlRes = await fetch(
        `/api/cm/listings/${listingId}/documents/upload-url?file_name=${encodeURIComponent(file.name)}`
      );
      const urlJson = await urlRes.json();
      if (!urlRes.ok) {
        alert(urlJson.error ?? "Erro ao preparar upload");
        return;
      }

      // 2. Sobe o arquivo direto para o Storage, sem passar pela function
      const { token, storagePath, bucket } = urlJson;
      const { error: uploadError } = await createBrowserSupabaseClient()
        .storage.from(bucket)
        .uploadToSignedUrl(storagePath, token, file);

      if (uploadError) {
        alert(`Falha ao enviar arquivo ao Storage: ${uploadError.message}`);
        return;
      }

      // 3. Registra o metadado em cm_listing_documents e dispara o webhook de OCR
      const res = await fetch(`/api/cm/listings/${listingId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storage_path: storagePath,
          original_filename: file.name,
          file_size_bytes: file.size,
          content_type: file.type,
          document_type: documentType,
          checklist_item_id: checklistItemId ?? null,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        loadDocs(listingId);
      } else {
        alert(json.error ?? "Erro no upload");
      }
    } catch { alert("Erro de conexão"); }
    finally { setUploadingDoc(null); }
  };

  const createDealRoom = async (listingId: string) => {
    setCreatingRoom(true);
    setDealRoomUrl(null);
    try {
      const res = await fetch("/api/cm/deal-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listingId, expires_days: 30 }),
      });
      const json = await res.json();
      if (res.ok) {
        setDealRoomUrl(json.url);
        loadRoomInvites(listingId);
      } else {
        alert(json.error ?? "Erro ao criar Deal Room");
      }
    } catch { alert("Erro de conexão"); }
    finally { setCreatingRoom(false); }
  };

  const togglePublicListing = async (listingId: string, next: boolean) => {
    try {
      const res = await fetch(`/api/cm/listings/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allow_public_listing: next }),
      });
      const json = await res.json();
      if (res.ok) setSelectedListing((prev) => (prev ? { ...prev, ...json.listing } : prev));
      else alert(json.error ?? "Erro ao atualizar vitrine pública");
    } catch { alert("Erro de conexão"); }
  };

  const uploadGalleryImage = async (listingId: string, file: File) => {
    setUploadingGallery(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/cm/listings/${listingId}/gallery`, { method: "POST", body: formData });
      const json = await res.json();
      if (res.ok) setSelectedListing((prev) => (prev ? { ...prev, public_gallery: json.gallery } : prev));
      else alert(json.error ?? "Erro no upload da imagem");
    } catch { alert("Erro de conexão"); }
    finally { setUploadingGallery(false); }
  };

  const deleteGalleryImage = async (listingId: string, storagePath: string) => {
    try {
      const res = await fetch(`/api/cm/listings/${listingId}/gallery?storage_path=${encodeURIComponent(storagePath)}`, { method: "DELETE" });
      const json = await res.json();
      if (res.ok) setSelectedListing((prev) => (prev ? { ...prev, public_gallery: json.gallery } : prev));
      else alert(json.error ?? "Erro ao remover imagem");
    } catch { alert("Erro de conexão"); }
  };

  const decideInspection = async (listingId: string, requestId: string, action: "aprovar" | "rejeitar") => {
    try {
      const res = await fetch(`/api/cm/listings/${listingId}/inspection/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (res.ok) setSelectedListing((prev) => (prev ? { ...prev, inspection_requests: json.inspection_requests } : prev));
      else alert(json.error ?? "Erro ao atualizar pedido de vistoria");
    } catch { alert("Erro de conexão"); }
  };

  const generateNarrative = async (listingId: string, thesisId: string) => {
    setGeneratingNarrative(true);
    try {
      const res = await fetch(`/api/cm/listings/${listingId}/narrative`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected_thesis_template: thesisId }),
      });
      const json = await res.json();
      if (res.ok) setSelectedListing((prev) => (prev ? { ...prev, ...json.listing } : prev));
      else alert(json.error ?? "Erro ao gerar narrativa");
    } catch { alert("Erro de conexão"); }
    finally { setGeneratingNarrative(false); }
  };

  const loadRoomInvites = async (listingId: string) => {
    try {
      const res = await fetch(`/api/cm/deal-room?listing_id=${listingId}`);
      const json = await res.json();
      setRoomInvites(json.invites ?? []);
    } catch { setRoomInvites([]); }
  };

  const loadContractTemplates = async () => {
    try {
      const res = await fetch("/api/contracts/templates?vertical=capital_markets");
      const json = await res.json();
      setContractTemplates(json.templates ?? []);
    } catch { setContractTemplates([]); }
  };

  const generateContract = async (listingId: string, templateId: string) => {
    setGeneratingContract(true);
    setContractResult(null);
    try {
      const res = await fetch("/api/contracts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: templateId, listing_id: listingId, commission_percent: 7 }),
      });
      const json = await res.json();
      if (res.ok) {
        setContractResult(json);
        alert(`Contrato "${json.contract.contract_title}" gerado (${json.variables_resolved} variáveis injetadas)`);
      } else {
        alert(json.error ?? "Erro ao gerar contrato");
      }
    } catch { alert("Erro de conexão"); }
    finally { setGeneratingContract(false); }
  };

  const loadDocs = async (listingId: string) => {
    setDocsLoading(true);
    try {
      const res = await fetch(`/api/cm/listings/${listingId}/documents`);
      const json = await res.json();
      setListingDocs(json.documents ?? []);
    } catch { setListingDocs([]); }
    finally { setDocsLoading(false); }
  };

  const openListingDetail = async (listing: Listing) => {
    setSelectedListing(listing);
    setActiveDetailTab("geral");
    setIntakeUrl(null);
    setDealRoomUrl(null);
    setRoomInvites([]);
    setContractResult(null);
    setAskPriceFloor(formatCurrencyBRLFromNumber((listing as any).ask_price_floor));
    setAutoAcceptEnabled((listing as any).auto_accept_enabled ?? false);
    setValorFaceNegociado(listing.valor_face?.toString() ?? "");
    setValorAtualizadoNegociado((listing as any).valor_atualizado?.toString() ?? "");
    setDesagioNegociado(listing.desagio_pretendido?.toString() ?? "");
    setApelidoNegociado(listing.apelido ?? "");
    setOriginatorNegociado(listing.originator_referral_id ? `ref:${listing.originator_referral_id}` : (listing.originator_profile_id ?? ""));
    setShowNewReferralPartner(false);
    loadRoomInvites(listing.id);
    loadContractTemplates();
    loadChecklists(listing.id);
    loadDocs(listing.id);
    loadKycDocs(listing.id);
    loadDealNotes(listing.id);
    setNoteContent("");
    setNoteMentionedIds([]);
    loadIntermediaries(listing.id);
  };

  const handleStatusTransition = async (listingId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/cm/listings/${listingId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_status: newStatus }),
      });
      const json = await res.json();
      if (res.ok) { alert("Status atualizado"); fetchAll(); setSelectedListing(null); }
      else alert(json.error ?? "Erro ao transicionar status");
    } catch { alert("Erro de conexão"); }
  };

  const handleBidAction = async (bidId: string, action: string, commissionPercent = 7) => {
    setActionLoading(bidId);
    try {
      const res = await fetch(`/api/cm/bids/${bidId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, commission_percent: commissionPercent }),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error ?? "Erro"); return; }
      fetchAll();
    } catch { alert("Erro de conexão"); }
    finally { setActionLoading(null); }
  };

  const generateIntakeLink = async (listingId?: string) => {
    setGeneratingLink(true);
    setIntakeUrl(null);
    try {
      const res = await fetch("/api/cm/intake/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(listingId ? { listing_id: listingId } : {}),
      });
      const json = await res.json();
      if (res.ok) {
        if (!listingId && json.listing) {
          // Novo Ativo: abre o painel do ativo recem-criado direto, pronto para nomear (Apelido) e enviar o link
          await openListingDetail(json.listing);
          setIntakeUrl(json.url);
          setListings((prev) => [json.listing, ...prev]);
        } else {
          setIntakeUrl(json.url);
        }
      } else {
        alert(json.error ?? "Erro ao gerar link");
      }
    } catch { alert("Erro de conexão"); }
    finally { setGeneratingLink(false); }
  };

  const copyLink = () => {
    if (intakeUrl) {
      navigator.clipboard.writeText(intakeUrl);
      alert("Link copiado!");
    }
  };

  const loadChecklists = async (listingId: string) => {
    setChecklistsLoading(true);
    try {
      const res = await fetch(`/api/cm/checklists?listing_id=${listingId}`);
      const json = await res.json();
      setChecklists(json.checklists ?? []);
    } catch { setChecklists([]); }
    finally { setChecklistsLoading(false); }
  };

  const loadKycDocs = async (listingId: string) => {
    try {
      const res = await fetch(`/api/cm/kyc-documents?listing_id=${listingId}`);
      const json = await res.json();
      setKycDocs(json.documents ?? []);
    } catch { setKycDocs([]); }
  };

  const uploadKycDoc = async (listingId: string, file: File) => {
    if (!kycDocType.trim()) { alert("Informe o tipo de documento"); return; }
    setUploadingKyc(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("listing_id", listingId);
      fd.append("party_type", kycPartyType);
      fd.append("party_name", kycPartyName);
      fd.append("document_type", kycDocType);
      const res = await fetch("/api/cm/kyc-documents", { method: "POST", body: fd });
      const json = await res.json();
      if (res.ok) {
        setKycDocs((prev) => [json.document, ...prev]);
        setKycPartyName("");
        setKycDocType("");
      } else {
        alert(json.error ?? "Erro no upload");
      }
    } catch { alert("Erro de conexão"); }
    finally { setUploadingKyc(false); }
  };

  const handleKycDecision = async (kycId: string, action: "approve" | "reject") => {
    setKycActionLoading(kycId);
    try {
      const reason = action === "reject" ? prompt("Motivo da rejeição (opcional):") ?? "" : undefined;
      const res = await fetch(`/api/cm/kyc-documents/${kycId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rejection_reason: reason }),
      });
      const json = await res.json();
      if (res.ok) {
        setKycDocs((prev) => prev.map((d) => (d.id === kycId ? json.document : d)));
      } else {
        alert(json.error ?? "Erro ao processar decisão");
      }
    } catch { alert("Erro de conexão"); }
    finally { setKycActionLoading(null); }
  };

  const createChecklist = async (listingId: string, type: string) => {
    const res = await fetch("/api/cm/checklists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listing_id: listingId, checklist_type: type }),
    });
    if (res.ok) loadChecklists(listingId);
    else {
      const json = await res.json();
      if (res.status === 409 && json.checklist_id) loadChecklists(listingId);
      else alert(json.error ?? "Erro ao criar checklist");
    }
  };

  const toggleCheckItem = async (checklistId: string, itemId: string, isChecked: boolean) => {
    await fetch(`/api/cm/checklists/${checklistId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "check_item", item_id: itemId, is_checked: isChecked }),
    });
    if (selectedListing) loadChecklists(selectedListing.id);
  };

  const saveAskPrice = async (listingId: string) => {
    setSavingFloor(true);
    try {
      const res = await fetch(`/api/cm/listings/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ask_price_floor: askPriceFloor ? parseCurrencyBRLInput(askPriceFloor) : null,
          auto_accept_enabled: autoAcceptEnabled,
        }),
      });
      if (res.ok) alert("Ask price salvo");
      else alert("Erro ao salvar");
    } catch { alert("Erro de conexão"); }
    finally { setSavingFloor(false); }
  };

  const saveValoresNegociados = async (listingId: string) => {
    setSavingValores(true);
    try {
      const res = await fetch(`/api/cm/listings/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          valor_face: valorFaceNegociado ? Number(valorFaceNegociado) : undefined,
          valor_atualizado: valorAtualizadoNegociado ? Number(valorAtualizadoNegociado) : null,
          desagio_pretendido: desagioNegociado ? Number(desagioNegociado) : null,
          apelido: apelidoNegociado.trim() || null,
          originator_profile_id: originatorNegociado.startsWith("ref:") ? null : (originatorNegociado || null),
          originator_referral_id: originatorNegociado.startsWith("ref:") ? originatorNegociado.slice(4) : null,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setListings((prev) => prev.map((l) => (l.id === listingId ? { ...l, ...json.listing } : l)));
        setSelectedListing((prev) => (prev ? { ...prev, ...json.listing } : prev));
      } else {
        alert("Erro ao salvar valores negociados");
      }
    } catch { alert("Erro de conexão"); }
    finally { setSavingValores(false); }
  };

  const handleDeleteAsset = async (listingId: string) => {
    const reason = window.prompt(
      userRole === "ADMIN"
        ? "Motivo da exclusão (obrigatório):"
        : "Motivo da solicitação de exclusão (obrigatório, será enviado por email aos sócios):"
    );
    if (!reason || reason.trim().length < 5) {
      if (reason !== null) alert("Motivo obrigatório: mínimo 5 caracteres");
      return;
    }
    setDeletingListing(true);
    try {
      const res = await fetch(`/api/cm/listings/${listingId}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const json = await res.json();
      if (res.ok) {
        if (json.mode === "deleted") {
          alert("Ativo excluído. Disponível na Lixeira por 30 dias.");
          setListings((prev) => prev.filter((l) => l.id !== listingId));
          setSelectedListing(null);
        } else {
          alert("Solicitação enviada aos sócios por email. O ativo continua ativo até a decisão.");
          setListings((prev) => prev.map((l) => (l.id === listingId ? { ...l, ...json.listing } : l)));
          setSelectedListing((prev) => (prev ? { ...prev, ...json.listing } : prev));
        }
      } else {
        alert(json.error ?? "Erro ao processar exclusão");
      }
    } catch { alert("Erro de conexão"); }
    finally { setDeletingListing(false); }
  };

  const handleGovernanceDecision = async (listingId: string, action: "approve" | "reject") => {
    setDeletingListing(true);
    try {
      const res = await fetch(`/api/cm/listings/${listingId}/delete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (res.ok) {
        if (action === "approve") {
          setListings((prev) => prev.filter((l) => l.id !== listingId));
          setSelectedListing(null);
        } else {
          setListings((prev) => prev.map((l) => (l.id === listingId ? { ...l, ...json.listing } : l)));
        }
      } else {
        alert(json.error ?? "Erro ao processar decisão");
      }
    } catch { alert("Erro de conexão"); }
    finally { setDeletingListing(false); }
  };

  const submitNdaAuthorization = async (listingId: string) => {
    if (!ndaFile) { alert("Anexe o PDF do NDA assinado"); return; }
    if (!ndaReason || ndaReason.trim().length < 5) { alert("Motivo/contexto obrigatório (mínimo 5 caracteres)"); return; }

    setSubmittingNda(true);
    try {
      const formData = new FormData();
      formData.append("file", ndaFile);
      formData.append("document_type", "NDA_ASSINADO_RETROATIVO");
      const uploadRes = await fetch(`/api/cm/listings/${listingId}/documents`, { method: "POST", body: formData });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok) { alert(uploadJson.error ?? "Erro ao anexar NDA"); return; }

      const res = await fetch(`/api/cm/listings/${listingId}/nda-authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nda_signed_at: new Date(ndaDate).toISOString(),
          nda_document_url: uploadJson.document.storage_path,
          reason: ndaReason.trim(),
        }),
      });
      const json = await res.json();
      if (res.ok) {
        alert(json.mode === "approved"
          ? "NDA marcado como assinado."
          : "Solicitação enviada aos diretores por email. Aguardando autorização.");
        setListings((prev) => prev.map((l) => (l.id === listingId ? { ...l, ...json.listing } : l)));
        setSelectedListing((prev) => (prev ? { ...prev, ...json.listing } : prev));
        setShowNdaForm(false);
        setNdaFile(null);
        setNdaReason("");
        loadDocs(listingId);
      } else {
        alert(json.error ?? "Erro ao registrar autorização");
      }
    } catch { alert("Erro de conexão"); }
    finally { setSubmittingNda(false); }
  };

  const handleNdaGovernanceDecision = async (listingId: string, action: "approve" | "reject") => {
    try {
      const res = await fetch(`/api/cm/listings/${listingId}/nda-authorize`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (res.ok) {
        setListings((prev) => prev.map((l) => (l.id === listingId ? { ...l, ...json.listing } : l)));
        setSelectedListing((prev) => (prev ? { ...prev, ...json.listing } : prev));
      } else {
        alert(json.error ?? "Erro ao processar decisão");
      }
    } catch { alert("Erro de conexão"); }
  };

  const submitManualListing = async () => {
    if (!manualForm.asset_type) {
      alert("Selecione a classe do ativo antes de continuar");
      return;
    }
    if (!manualForm.seller_name.trim() || !manualForm.valor_face) {
      alert("Preencha ao menos: nome do cedente e valor de face");
      return;
    }
    setSubmittingManual(true);
    try {
      const res = await fetch("/api/cm/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_type: manualForm.asset_type,
          currency: manualForm.currency,
          apelido: manualForm.apelido.trim() || undefined,
          originator_profile_id: manualForm.originator_profile_id.startsWith("ref:") ? undefined : (manualForm.originator_profile_id || undefined),
          originator_referral_id: manualForm.originator_profile_id.startsWith("ref:") ? manualForm.originator_profile_id.slice(4) : undefined,
          seller_name: manualForm.seller_name.trim(),
          seller_cpf_cnpj: manualForm.seller_cpf_cnpj.trim() || undefined,
          ente_devedor: manualForm.ente_devedor.trim() || undefined,
          esfera: manualForm.esfera || undefined,
          tribunal: manualForm.tribunal.trim() || undefined,
          natureza: manualForm.natureza.trim() || undefined,
          numero_processo: manualForm.numero_processo.trim() || undefined,
          valor_face: parseCurrencyBRLInput(manualForm.valor_face),
          valor_atualizado: manualForm.valor_atualizado ? parseCurrencyBRLInput(manualForm.valor_atualizado) : undefined,
          desagio_pretendido: manualForm.desagio_pretendido ? Number(manualForm.desagio_pretendido) : undefined,
          prazo_estimado_meses: manualForm.prazo_estimado_meses ? Number(manualForm.prazo_estimado_meses) : undefined,
          allows_tranching: manualForm.allows_tranching,
          tranche_valor_minimo: manualForm.allows_tranching && manualForm.tranche_valor_minimo ? parseCurrencyBRLInput(manualForm.tranche_valor_minimo) : undefined,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        alert(`Ativo cadastrado: ${json.listing.anonymous_id}`);
        setShowManualForm(false);
        setManualForm({
          asset_type: "", currency: "BRL", apelido: "", originator_profile_id: "", seller_name: "", seller_cpf_cnpj: "", ente_devedor: "",
          esfera: "", tribunal: "", natureza: "", numero_processo: "",
          valor_face: "", valor_atualizado: "", desagio_pretendido: "", prazo_estimado_meses: "",
          allows_tranching: false, tranche_valor_minimo: "",
        });
        fetchAll();
      } else {
        alert(json.error ?? "Erro ao cadastrar ativo");
      }
    } catch { alert("Erro de conexão"); }
    finally { setSubmittingManual(false); }
  };

  const loadLixeira = async () => {
    setLixeiraLoading(true);
    try {
      const res = await fetch("/api/cm/lixeira");
      const json = await res.json();
      setLixeiraItems(json.items ?? []);
    } catch { setLixeiraItems([]); }
    finally { setLixeiraLoading(false); }
  };

  const restoreFromLixeira = async (listingId: string) => {
    try {
      const res = await fetch("/api/cm/lixeira", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listingId }),
      });
      if (res.ok) {
        setLixeiraItems((prev) => prev.filter((i) => i.id !== listingId));
        fetchAll();
      } else {
        alert("Erro ao restaurar ativo");
      }
    } catch { alert("Erro de conexão"); }
  };

  const approveQualification = async (accessId: string, decision: "aprovado" | "reprovado") => {
    try {
      const res = await fetch(`/api/cm/deal-room/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_id: accessId, decision }),
      });
      if (res.ok) {
        alert(decision === "aprovado" ? "Qualificação aprovada: Tier 2 liberado" : "Qualificação reprovada");
        if (selectedListing) loadRoomInvites(selectedListing.id);
      } else {
        const json = await res.json();
        alert(json.error ?? "Erro");
      }
    } catch { alert("Erro de conexão"); }
  };

  const generateBuyLink = async () => {
    setGeneratingBuyLink(true);
    setBuyLinkUrl(null);
    try {
      const res = await fetch("/api/cm/intake/buy/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const json = await res.json();
      if (res.ok) { setBuyLinkUrl(json.url); navigator.clipboard.writeText(json.url); alert("Link do comprador copiado!"); }
      else alert(json.error ?? "Erro ao gerar link");
    } catch { alert("Erro de conexão"); }
    finally { setGeneratingBuyLink(false); }
  };

  const totalVolume = listings.reduce((s, l) => s + Number(l.valor_face), 0);
  const naVitrine = listings.filter((l) => ["ativo_vitrine", "proposta_recebida"].includes(l.listing_status)).length;
  const propostas = bids.length;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-[#C9A84C]" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F1E8]">Mesa de Capitais</h1>
          <p className="text-sm text-[#9BAFC5]">Painel do Head de Ativos</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => generateIntakeLink()} disabled={generatingLink}
            className="flex items-center gap-2 px-4 py-2 border border-[#C9A84C]/30 text-[#C9A84C] rounded-lg text-sm font-medium hover:bg-[#C9A84C]/10 transition disabled:opacity-50"
          >
            {generatingLink ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Novo Ativo
          </button>
          <button
            onClick={() => setShowManualForm(true)}
            className="flex items-center gap-2 px-4 py-2 border border-[#9BAFC5]/20 text-[#9BAFC5] rounded-lg text-sm font-medium hover:bg-[#9BAFC5]/10 hover:text-[#F5F1E8] transition"
          >
            <FileText size={16} /> Cadastro Manual
          </button>
          <button
            onClick={() => setShowManualBuyerForm(true)}
            className="flex items-center gap-2 px-4 py-2 border border-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/10 transition"
          >
            <UserPlus size={16} /> Novo Comprador
          </button>
          <button
            onClick={generateBuyLink} disabled={generatingBuyLink}
            className="flex items-center gap-2 px-4 py-2 border border-[#9BAFC5]/20 text-[#9BAFC5] rounded-lg text-sm font-medium hover:bg-[#9BAFC5]/10 hover:text-[#F5F1E8] transition disabled:opacity-50"
          >
            {generatingBuyLink ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
            Link Comprador
          </button>
          <button
            onClick={runMatchmaking} disabled={runningMatch}
            className="flex items-center gap-2 px-4 py-2 bg-[#C9A84C] text-[#09081A] rounded-lg text-sm font-bold hover:bg-[#D4B96A] transition disabled:opacity-50"
          >
            {runningMatch ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            Executar Matchmaking
          </button>
          {userRole === "ADMIN" && (
            <button
              onClick={() => { setShowLixeira(true); loadLixeira(); }}
              className="flex items-center gap-2 px-4 py-2 border border-[#9BAFC5]/20 text-[#9BAFC5] rounded-lg text-sm font-medium hover:bg-[#9BAFC5]/10 hover:text-[#F5F1E8] transition"
            >
              <ClipboardCheck size={16} /> Lixeira
            </button>
          )}
        </div>
      </div>

      {/* Modal Lixeira */}
      {showLixeira && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60" onClick={() => setShowLixeira(false)}>
          <div className="w-full max-w-lg max-h-[80vh] bg-[#09081A] border border-[#C9A84C]/20 rounded-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-[#C9A84C]/20 flex items-center justify-between flex-shrink-0">
              <div className="text-sm font-bold text-[#F5F1E8]">Lixeira · Ativos Excluídos (30 dias)</div>
              <button onClick={() => setShowLixeira(false)} className="text-[#9BAFC5] hover:text-[#F5F1E8] text-xl">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {lixeiraLoading ? (
                <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-[#C9A84C]" /></div>
              ) : lixeiraItems.length === 0 ? (
                <div className="text-center text-xs text-[#9BAFC5] py-8">Lixeira vazia</div>
              ) : (
                lixeiraItems.map((item: any) => (
                  <div key={item.id} className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-[#F5F1E8]">{item.anonymous_id}</div>
                        <div className="text-[10px] text-[#9BAFC5]">{formatBRL(Number(item.valor_face))} · excluído por {item.profiles?.full_name ?? "N/D"}</div>
                        <div className="text-[10px] text-red-400 mt-1">{item.deletion_reason}</div>
                        <div className="text-[9px] text-[#9BAFC5]/70 mt-1">{item.days_remaining} dias restantes na lixeira</div>
                      </div>
                      <button onClick={() => restoreFromLixeira(item.id)}
                        className="flex-shrink-0 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-400 text-[10px] font-bold hover:bg-emerald-500/20 transition">
                        Restaurar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Cadastro Manual */}
      {showManualForm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg max-h-[85vh] bg-[#09081A] border border-[#C9A84C]/20 rounded-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-[#C9A84C]/20 flex items-center justify-between flex-shrink-0">
              <div>
                <div className="text-sm font-bold text-[#F5F1E8]">Cadastro Manual de Ativo</div>
                <div className="text-[10px] text-[#9BAFC5]">Para deals já qualificados internamente pela Mesa, sem intake público</div>
              </div>
              <button onClick={() => setShowManualForm(false)} className="text-[#9BAFC5] hover:text-[#F5F1E8] text-xl">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-[#9BAFC5] uppercase">Tipo de Ativo *</label>
                  <select name="asset_type" value={manualForm.asset_type}
                    onChange={(e) => setManualForm((f) => ({ ...f, asset_type: e.target.value as CmAssetType }))}
                    className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1">
                    <option value="">Selecione a classe do ativo</option>
                    <option value="precatorio">Precatório</option>
                    <option value="direito_creditorio">Direito Creditório</option>
                    <option value="ipi">IPI</option>
                    <option value="icms">ICMS</option>
                    <option value="imovel">Imóvel / Ativo Alternativo</option>
                    <option value="outros">Outros</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] text-[#9BAFC5] uppercase">Moeda</label>
                  <select name="currency" value={manualForm.currency}
                    onChange={(e) => setManualForm((f) => ({ ...f, currency: e.target.value as CmCurrency }))}
                    className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1">
                    <option value="BRL">BRL (R$)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>
              {manualForm.asset_type && (
                <div className="bg-[#12112A] border border-[#C9A84C]/15 rounded-lg px-3 py-2">
                  <div className="text-[8px] text-[#E8C97A] font-bold uppercase tracking-wide mb-1">Documentos obrigatórios para este tipo</div>
                  <div className="text-[10px] text-[#9BAFC5] leading-relaxed">
                    {(CM_DOCUMENT_CHECKLISTS[manualForm.asset_type as CmAssetType] ?? CM_DOCUMENT_CHECKLISTS.outros)
                      .filter((item) => item.required).map((item) => item.label).join(" · ")}
                  </div>
                </div>
              )}
              <fieldset disabled={!manualForm.asset_type} className={cn("space-y-3", !manualForm.asset_type && "opacity-40 pointer-events-none")}>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-[#9BAFC5] uppercase">Apelido</label>
                  <input value={manualForm.apelido} onChange={(e) => setManualForm((f) => ({ ...f, apelido: e.target.value }))}
                    placeholder="Ex: Tunep"
                    className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1" />
                </div>
                <div>
                  <label className="text-[9px] text-[#9BAFC5] uppercase">Partner de Origem</label>
                  <select
                    value={manualForm.originator_profile_id}
                    onChange={(e) => { if (e.target.value === "__new__") setShowNewReferralPartner(true); else setManualForm((f) => ({ ...f, originator_profile_id: e.target.value })); }}
                    className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1"
                  >
                    <option value="">Selecionar</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>{p.full_name}</option>
                    ))}
                    {referralPartners.length > 0 && (
                      <optgroup label="Sem conta no portal">
                        {referralPartners.map((p) => (
                          <option key={p.id} value={`ref:${p.id}`}>{p.full_name}</option>
                        ))}
                      </optgroup>
                    )}
                    <option value="__new__">+ Novo partner (sem conta)</option>
                  </select>
                  {showNewReferralPartner && (
                    <div className="mt-2 p-2 bg-[#09081A] border border-[#C9A84C]/20 rounded space-y-2">
                      <input value={newReferralName} onChange={(e) => setNewReferralName(e.target.value)}
                        placeholder="Nome do partner *"
                        className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
                      <input value={newReferralContact} onChange={(e) => setNewReferralContact(e.target.value)}
                        placeholder="Contato (telefone/email)"
                        className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
                      <div className="flex gap-2">
                        <button
                          onClick={async () => { const v = await createReferralPartner(); if (v) setManualForm((f) => ({ ...f, originator_profile_id: v })); }}
                          disabled={savingReferralPartner}
                          className="flex-1 px-2 py-1.5 bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded text-[#C9A84C] text-[10px] font-bold disabled:opacity-50">
                          {savingReferralPartner ? "Salvando..." : "Salvar"}
                        </button>
                        <button onClick={() => { setShowNewReferralPartner(false); setNewReferralName(""); setNewReferralContact(""); }}
                          className="px-2 py-1.5 border border-[#9BAFC5]/20 rounded text-[#9BAFC5] text-[10px]">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-[#9BAFC5] uppercase">Nome do Cedente *</label>
                  <input value={manualForm.seller_name} onChange={(e) => setManualForm((f) => ({ ...f, seller_name: e.target.value }))}
                    className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1" />
                </div>
                <div>
                  <label className="text-[9px] text-[#9BAFC5] uppercase">CPF/CNPJ Cedente</label>
                  <input value={manualForm.seller_cpf_cnpj} onChange={(e) => setManualForm((f) => ({ ...f, seller_cpf_cnpj: e.target.value }))}
                    className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-[#9BAFC5] uppercase">Valor de Face ({CM_CURRENCY_SYMBOL[manualForm.currency]}) *</label>
                  <input inputMode="numeric" value={manualForm.valor_face} onChange={(e) => setManualForm((f) => ({ ...f, valor_face: maskCurrencyInput(e.target.value, f.currency) }))}
                    placeholder="0,00"
                    className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1" />
                </div>
                <div>
                  <label className="text-[9px] text-[#9BAFC5] uppercase">Valor Atualizado ({CM_CURRENCY_SYMBOL[manualForm.currency]})</label>
                  <input inputMode="numeric" value={manualForm.valor_atualizado} onChange={(e) => setManualForm((f) => ({ ...f, valor_atualizado: maskCurrencyInput(e.target.value, f.currency) }))}
                    placeholder="0,00"
                    className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-[#9BAFC5] uppercase">Deságio Pretendido (%)</label>
                  <input type="number" value={manualForm.desagio_pretendido} onChange={(e) => setManualForm((f) => ({ ...f, desagio_pretendido: e.target.value }))}
                    className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1" />
                </div>
                <div>
                  <label className="text-[9px] text-[#9BAFC5] uppercase">Prazo Estimado (meses)</label>
                  <input type="number" value={manualForm.prazo_estimado_meses} onChange={(e) => setManualForm((f) => ({ ...f, prazo_estimado_meses: e.target.value }))}
                    className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-[#9BAFC5] uppercase">Ente Devedor</label>
                  <input value={manualForm.ente_devedor} onChange={(e) => setManualForm((f) => ({ ...f, ente_devedor: e.target.value }))}
                    className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1" />
                </div>
                <div>
                  <label className="text-[9px] text-[#9BAFC5] uppercase">Esfera</label>
                  <select value={manualForm.esfera} onChange={(e) => setManualForm((f) => ({ ...f, esfera: e.target.value }))}
                    className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1">
                    <option value="">Selecionar</option>
                    <option value="Federal">Federal</option>
                    <option value="Estadual">Estadual</option>
                    <option value="Municipal">Municipal</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-[#9BAFC5] uppercase">Tribunal</label>
                  <input value={manualForm.tribunal} onChange={(e) => setManualForm((f) => ({ ...f, tribunal: e.target.value }))}
                    className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1" />
                </div>
                <div>
                  <label className="text-[9px] text-[#9BAFC5] uppercase">Natureza</label>
                  <input value={manualForm.natureza} onChange={(e) => setManualForm((f) => ({ ...f, natureza: e.target.value }))}
                    className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1" />
                </div>
              </div>
              <div>
                <label className="text-[9px] text-[#9BAFC5] uppercase">Número do Processo</label>
                <input value={manualForm.numero_processo} onChange={(e) => setManualForm((f) => ({ ...f, numero_processo: e.target.value }))}
                  className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={manualForm.allows_tranching}
                  onChange={(e) => setManualForm((f) => ({ ...f, allows_tranching: e.target.checked }))}
                  className="accent-[#C9A84C]" />
                <span className="text-xs text-[#9BAFC5]">Permite tranching (fracionamento entre compradores)</span>
              </label>
              {manualForm.allows_tranching && (
                <div>
                  <label className="text-[9px] text-[#9BAFC5] uppercase">Valor Mínimo por Fração ({CM_CURRENCY_SYMBOL[manualForm.currency]})</label>
                  <input inputMode="numeric" value={manualForm.tranche_valor_minimo} onChange={(e) => setManualForm((f) => ({ ...f, tranche_valor_minimo: maskCurrencyInput(e.target.value, f.currency) }))}
                    placeholder="0,00"
                    className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1" />
                </div>
              )}
              </fieldset>
              <button onClick={submitManualListing} disabled={submittingManual}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-[#C9A84C] text-[#09081A] rounded-lg text-sm font-bold hover:bg-[#D4B96A] transition disabled:opacity-50">
                {submittingManual ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Cadastrar Ativo
              </button>
              <p className="text-[9px] text-[#9BAFC5] text-center">Entra direto no pipeline em &quot;Reunião Validada&quot;, mesmo ponto de partida do intake público.</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cadastro Manual de Comprador — sem depender do link publico (correcao Mesa Operacional 2026-07-15) */}
      {showManualBuyerForm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60" onClick={() => setShowManualBuyerForm(false)}>
          <div className="w-full max-w-lg max-h-[85vh] bg-[#09081A] border border-[#C9A84C]/20 rounded-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-[#C9A84C]/20 flex items-center justify-between flex-shrink-0">
              <div>
                <div className="text-sm font-bold text-[#F5F1E8]">Cadastro Manual de Comprador</div>
                <div className="text-[10px] text-[#9BAFC5]">Mandato de busca inserido direto pela Mesa, sem link externo de captação</div>
              </div>
              <button onClick={() => setShowManualBuyerForm(false)} className="text-[#9BAFC5] hover:text-[#F5F1E8] text-xl">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div>
                <label className="text-[9px] text-[#9BAFC5] uppercase">Nome / Razão Social *</label>
                <input value={manualBuyerForm.nome_contato} onChange={(e) => setManualBuyerForm((f) => ({ ...f, nome_contato: e.target.value }))}
                  className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-[#9BAFC5] uppercase">Email *</label>
                  <input type="email" value={manualBuyerForm.email} onChange={(e) => setManualBuyerForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1" />
                </div>
                <div>
                  <label className="text-[9px] text-[#9BAFC5] uppercase">Telefone</label>
                  <input value={manualBuyerForm.telefone} onChange={(e) => setManualBuyerForm((f) => ({ ...f, telefone: maskPhoneInput(e.target.value) }))}
                    placeholder="(21) 99999-0000"
                    className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-[#9BAFC5] uppercase">Empresa / Fundo</label>
                  <input value={manualBuyerForm.empresa} onChange={(e) => setManualBuyerForm((f) => ({ ...f, empresa: e.target.value }))}
                    className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1" />
                </div>
                <div>
                  <label className="text-[9px] text-[#9BAFC5] uppercase">CPF / CNPJ</label>
                  <input value={manualBuyerForm.cpf_cnpj} onChange={(e) => setManualBuyerForm((f) => ({ ...f, cpf_cnpj: maskCpfCnpjInput(e.target.value) }))}
                    placeholder="000.000.000-00 ou 00.000.000/0001-00"
                    className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1" />
                </div>
              </div>
              <div>
                <label className="text-[9px] text-[#9BAFC5] uppercase">Tipos de ativo de interesse</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {["precatorio", "direito_creditorio", "ipi", "icms", "outros"].map((t) => {
                    const active = manualBuyerForm.asset_types_preferidos.includes(t);
                    return (
                      <button key={t} type="button"
                        onClick={() => setManualBuyerForm((f) => ({
                          ...f,
                          asset_types_preferidos: active
                            ? f.asset_types_preferidos.filter((v) => v !== t)
                            : [...f.asset_types_preferidos, t],
                        }))}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold ${active ? "bg-[#C9A84C] text-[#09081A]" : "bg-[#12112A] border border-[#9BAFC5]/15 text-[#9BAFC5]"}`}>
                        {t === "precatorio" ? "Precatório" : t === "direito_creditorio" ? "Dir. Creditório" : t.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[9px] text-[#9BAFC5] uppercase">Ticket Mín. (R$)</label>
                  <input inputMode="numeric" value={manualBuyerForm.ticket_min} onChange={(e) => setManualBuyerForm((f) => ({ ...f, ticket_min: maskCurrencyBRLInput(e.target.value) }))}
                    placeholder="0,00"
                    className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1" />
                </div>
                <div>
                  <label className="text-[9px] text-[#9BAFC5] uppercase">Ticket Máx. (R$)</label>
                  <input inputMode="numeric" value={manualBuyerForm.ticket_max} onChange={(e) => setManualBuyerForm((f) => ({ ...f, ticket_max: maskCurrencyBRLInput(e.target.value) }))}
                    placeholder="0,00"
                    className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1" />
                </div>
                <div>
                  <label className="text-[9px] text-[#9BAFC5] uppercase">Deságio Mín. (%)</label>
                  <input type="number" value={manualBuyerForm.desagio_min} onChange={(e) => setManualBuyerForm((f) => ({ ...f, desagio_min: e.target.value }))}
                    className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1" />
                </div>
              </div>
              <div>
                <label className="text-[9px] text-[#9BAFC5] uppercase">Critérios adicionais</label>
                <textarea value={manualBuyerForm.criterios} onChange={(e) => setManualBuyerForm((f) => ({ ...f, criterios: e.target.value }))}
                  className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1 min-h-[60px]" />
              </div>
              <button onClick={submitManualBuyer} disabled={submittingManualBuyer}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-500 text-white rounded-lg text-sm font-bold hover:bg-emerald-400 transition disabled:opacity-50">
                {submittingManualBuyer ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                Cadastrar Comprador
              </button>
              <p className="text-[9px] text-[#9BAFC5] text-center">Entra direto ativo no motor de matchmaking. Documentos KYC (LOI/MOU, Procuração) ficam pendentes até anexo posterior pela Mesa (aba Governança do ativo).</p>
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          { label: "Total Ativos", value: listings.length, color: "text-[#F5F1E8]" },
          { label: "Na Vitrine", value: naVitrine, color: "text-[#C9A84C]" },
          { label: "Propostas", value: propostas, color: "text-orange-400" },
          { label: "Volume Pipeline", value: formatBRL(totalVolume), color: "text-emerald-400" },
          { label: "Matches", value: matches.length, color: "text-[#C9A84C]" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-[#12112A] rounded-lg p-4 text-center">
            <div className={cn("text-2xl font-bold", kpi.color)}>{kpi.value}</div>
            <div className="text-[9px] text-[#9BAFC5] uppercase mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[#9BAFC5]/10">
        {(["kanban", "matches", "bids"] as const).map((t) => (
          <button
            key={t} onClick={() => { setTab(t); if (t === "bids") fetchAll(); }}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition",
              tab === t ? "border-[#C9A84C] text-[#C9A84C]" : "border-transparent text-[#9BAFC5] hover:text-[#F5F1E8]"
            )}
          >
            {t === "kanban" ? "Pipeline" : t === "matches" ? `Matches (${matches.length})` : `Propostas (${bids.length})`}
          </button>
        ))}
      </div>

      {/* Kanban */}
      {tab === "kanban" && (
        <div className="grid grid-cols-6 gap-3">
          {STATUS_COLUMNS.map((col) => {
            const statuses = col.key.split(",");
            const items = listings.filter((l) => statuses.includes(l.listing_status));
            const Icon = col.icon;
            return (
              <div key={col.key}>
                <div className={cn("text-center text-[10px] font-bold uppercase text-[#9BAFC5] p-2 bg-[#12112A] rounded-t-lg border-b-2", col.color)}>
                  {col.label} ({items.length})
                </div>
                <div className="bg-[#09081A]/50 rounded-b-lg p-2 min-h-[200px] space-y-2">
                  {items.map((l) => (
                    <div key={l.id} onClick={() => openListingDetail(l)} className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-md p-3 cursor-pointer hover:border-[#C9A84C]/30 transition">
                      <div className="text-[9px] text-[#C9A84C] font-bold">{l.anonymous_id}</div>
                      {l.apelido && <div className="text-[10px] text-[#F5F1E8] font-semibold truncate">{l.apelido}</div>}
                      <div className="text-xs text-[#F5F1E8] font-semibold">{formatListingValue(Number(l.valor_face), l.currency)}</div>
                      {l.risk_score && (
                        <div className={cn("text-[9px] font-bold mt-1",
                          l.risk_score >= 70 ? "text-emerald-400" : l.risk_score >= 50 ? "text-[#C9A84C]" : "text-red-400"
                        )}>Score {l.risk_score}</div>
                      )}
                      {(l.cm_bids?.[0] as any)?.count > 0 && (
                        <div className="text-[9px] text-orange-400 mt-1">{(l.cm_bids[0] as any).count} proposta(s)</div>
                      )}
                      {(l as any).deletion_status === "pending_governance" && (
                        <div className="text-[8px] text-red-400 font-bold uppercase mt-1 px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 rounded inline-block">Exclusão Solicitada</div>
                      )}
                      {(l as any).nda_authorization_status === "pending_director" && (
                        <div className="text-[8px] text-[#C9A84C] font-bold uppercase mt-1 px-1.5 py-0.5 bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded inline-block">Enviado: Aguardando Diretoria</div>
                      )}
                      {Number((l.cm_listing_documents?.[0] as any)?.count) > 0 && (
                        <div className="text-[9px] text-[#9BAFC5] mt-1">{(l.cm_listing_documents[0] as any).count} doc(s)</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Matches */}
      {tab === "matches" && (
        <div className="space-y-3">
          {matches.length === 0 ? (
            <div className="text-center py-12 text-[#9BAFC5]">Nenhum match encontrado. Execute o matchmaking.</div>
          ) : matches.map((m) => (
            <div key={m.id} className="bg-[#12112A] border border-[#C9A84C]/15 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className={cn("text-2xl font-bold",
                    m.score >= 70 ? "text-emerald-400" : m.score >= 50 ? "text-[#C9A84C]" : "text-red-400"
                  )}>{m.score}</div>
                  <div className="text-[9px] text-[#9BAFC5]">Score</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-[#C9A84C]">{m.cm_asset_listings?.anonymous_id ?? "N/D"}</div>
                  <div className="text-xs text-[#F5F1E8]">{formatBRL(Number(m.cm_asset_listings?.valor_face ?? 0))}</div>
                </div>
                <ArrowRight size={16} className="text-[#9BAFC5]" />
                <div>
                  <div className="text-xs font-bold text-[#F5F1E8]">{m.investor_demands?.nome_contato ?? "N/D"}</div>
                  <div className="text-[10px] text-[#9BAFC5]">{m.investor_demands?.empresa ?? m.investor_demands?.email ?? ""}</div>
                </div>
              </div>
              <div className="flex gap-1">
                {(m.match_reasons as any[])?.map((r: any, i: number) => (
                  <span key={i} className="text-[9px] bg-[#162744] text-[#9BAFC5] px-2 py-0.5 rounded">{r.criterio} +{r.peso}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bids */}
      {tab === "bids" && (
        <div className="space-y-3">
          {bids.length === 0 ? (
            <div className="text-center py-12 text-[#9BAFC5]">Nenhuma proposta pendente.</div>
          ) : bids.map((b) => (
            <div key={b.id} className="bg-[#12112A] border border-[#C9A84C]/15 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-[#C9A84C] font-bold">{(b.cm_asset_listings as any)?.anonymous_id ?? "N/D"}</div>
                  <div className="text-sm font-bold text-[#F5F1E8]">
                    Oferta: {formatBRL(Number(b.bid_value))}
                    {b.desagio_oferecido && <span className="text-[#9BAFC5] font-normal ml-2">({b.desagio_oferecido}% deságio)</span>}
                  </div>
                  <div className="text-[10px] text-[#9BAFC5] mt-1">
                    Pagamento: {b.payment_type === "a_vista" ? "À Vista" : b.payment_type === "parcelado" ? "Parcelado" : "Escrow"}
                    {b.notes && ` · ${b.notes}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleBidAction(b.id, "aceitar")}
                    disabled={actionLoading === b.id}
                    className="flex items-center gap-1 px-3 py-2 bg-emerald-600 text-white rounded-md text-xs font-bold hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {actionLoading === b.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                    Aceitar
                  </button>
                  <button
                    onClick={() => handleBidAction(b.id, "recusar")}
                    disabled={actionLoading === b.id}
                    className="px-3 py-2 border border-red-500/30 text-red-400 rounded-md text-xs font-bold hover:bg-red-500/10 disabled:opacity-50"
                  >
                    Recusar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Painel Lateral: Detalhe do Listing */}
      {selectedListing && (
        <div className="fixed inset-0 z-[110] bg-[#09081A] flex flex-col">
            <div className="p-5 border-b border-[#C9A84C]/20 flex items-center justify-between flex-shrink-0">
              <div>
                <div className="text-[10px] text-[#C9A84C] font-bold tracking-wider">
                  {selectedListing.anonymous_id}
                  {selectedListing.apelido && <span className="text-[#F5F1E8]"> · {selectedListing.apelido}</span>}
                </div>
                <div className="text-lg font-bold text-[#F5F1E8]">{formatListingValue(Number(selectedListing.valor_face), selectedListing.currency)}</div>
                <div className="text-xs text-[#9BAFC5] mt-1">Status: <span className="text-[#F5F1E8]">{selectedListing.listing_status.replace(/_/g, " ")}</span></div>
              </div>
              <button onClick={() => setSelectedListing(null)} className="w-8 h-8 flex items-center justify-center rounded-full text-[#9BAFC5] hover:text-[#F5F1E8] hover:bg-[#F5F1E8]/10 transition text-xl">&times;</button>
            </div>

            {/* Navegação por abas */}
            <div className="flex border-b border-[#C9A84C]/10 flex-shrink-0 overflow-x-auto">
              {([
                { id: "geral" as const, label: "Visão Geral" },
                { id: "documentos" as const, label: "Documentos" },
                { id: "orderbook" as const, label: "Order Book" },
                { id: "governanca" as const, label: "Governança" },
                { id: "notas" as const, label: "Notas" },
              ]).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveDetailTab(tab.id)}
                  className={cn(
                    "px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-colors flex-shrink-0",
                    activeDetailTab === tab.id
                      ? "border-[#C9A84C] text-[#C9A84C]"
                      : "border-transparent text-[#9BAFC5] hover:text-[#F5F1E8]"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto w-full">

            {/* ══ ABA: VISÃO GERAL ══ */}
            {activeDetailTab === "geral" && (<>
            {/* KPIs do Ativo */}
            <div className="grid grid-cols-3 gap-2 p-4">
              <div className="bg-[#12112A] rounded-lg p-3 text-center">
                <div className={cn("text-lg font-bold", selectedListing.risk_score && selectedListing.risk_score >= 70 ? "text-emerald-400" : selectedListing.risk_score && selectedListing.risk_score >= 50 ? "text-[#C9A84C]" : "text-red-400")}>{selectedListing.risk_score ?? "N/D"}</div>
                <div className="text-[8px] text-[#9BAFC5] uppercase">Score</div>
              </div>
              <div className="bg-[#12112A] rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-[#C9A84C]">{selectedListing.desagio_pretendido ?? "N/D"}%</div>
                <div className="text-[8px] text-[#9BAFC5] uppercase">Deságio</div>
              </div>
              <div className="bg-[#12112A] rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-[#F5F1E8]">{(selectedListing.cm_bids?.[0] as any)?.count ?? 0}</div>
                <div className="text-[8px] text-[#9BAFC5] uppercase">Propostas</div>
              </div>
            </div>

            {/* Identificação do Ativo */}
            <div className="px-4 pb-4">
              <div className="text-[10px] text-[#C9A84C] font-bold uppercase tracking-wider mb-2">
                Identificação do Ativo
              </div>
              <div className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-3 space-y-3">
                <div>
                  <label className="text-[9px] text-[#9BAFC5] uppercase">Apelido</label>
                  <input
                    type="text" value={apelidoNegociado} onChange={(e) => setApelidoNegociado(e.target.value)}
                    placeholder="Ex: Tunep"
                    className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1 focus:border-[#C9A84C]/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-[#9BAFC5] uppercase">Número Interno (gerado automaticamente)</label>
                  <div className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#C9A84C] font-bold mt-1">
                    {(selectedListing as any).numero_interno ?? "N/D"}
                  </div>
                </div>
                <div>
                  <label className="text-[9px] text-[#9BAFC5] uppercase">Partner de Origem</label>
                  <select
                    value={originatorNegociado}
                    onChange={(e) => { if (e.target.value === "__new__") setShowNewReferralPartner(true); else setOriginatorNegociado(e.target.value); }}
                    className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1 focus:border-[#C9A84C]/50 focus:outline-none"
                  >
                    <option value="">Selecionar</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>{p.full_name}</option>
                    ))}
                    {referralPartners.length > 0 && (
                      <optgroup label="Sem conta no portal">
                        {referralPartners.map((p) => (
                          <option key={p.id} value={`ref:${p.id}`}>{p.full_name}</option>
                        ))}
                      </optgroup>
                    )}
                    <option value="__new__">+ Novo partner (sem conta)</option>
                  </select>
                  {showNewReferralPartner && (
                    <div className="mt-2 p-2 bg-[#09081A] border border-[#C9A84C]/20 rounded space-y-2">
                      <input value={newReferralName} onChange={(e) => setNewReferralName(e.target.value)}
                        placeholder="Nome do partner *"
                        className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
                      <input value={newReferralContact} onChange={(e) => setNewReferralContact(e.target.value)}
                        placeholder="Contato (telefone/email)"
                        className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
                      <div className="flex gap-2">
                        <button
                          onClick={async () => { const v = await createReferralPartner(); if (v) setOriginatorNegociado(v); }}
                          disabled={savingReferralPartner}
                          className="flex-1 px-2 py-1.5 bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded text-[#C9A84C] text-[10px] font-bold disabled:opacity-50">
                          {savingReferralPartner ? "Salvando..." : "Salvar"}
                        </button>
                        <button onClick={() => { setShowNewReferralPartner(false); setNewReferralName(""); setNewReferralContact(""); }}
                          className="px-2 py-1.5 border border-[#9BAFC5]/20 rounded text-[#9BAFC5] text-[10px]">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-[9px] text-[#9BAFC5] uppercase">Deságio Pretendido (%)</label>
                  <input
                    type="number" value={desagioNegociado} onChange={(e) => setDesagioNegociado(e.target.value)}
                    className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1 focus:border-[#C9A84C]/50 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Valores: OCR vs Negociado */}
            <div className="px-4 pb-4">
              <div className="text-[10px] text-[#C9A84C] font-bold uppercase tracking-wider mb-2">
                Valores: OCR vs Negociado
              </div>
              <div className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-3 space-y-3">
                {([
                  { key: "valor_face", label: "Valor de Face", value: valorFaceNegociado, setValue: setValorFaceNegociado },
                  { key: "valor_atualizado", label: "Valor Atualizado", value: valorAtualizadoNegociado, setValue: setValorAtualizadoNegociado },
                ] as const).map(({ key, label, value, setValue }) => {
                  const history: any[] = ((selectedListing as any).valores_ocr?.[key] ?? []).slice().reverse();
                  const latestOcr = history[0];
                  const numValue = value ? Number(value) : null;
                  const divergeFromOcr =
                    latestOcr && numValue !== null && Number.isFinite(numValue) && Number(latestOcr.valor) !== 0
                      ? Math.round((numValue / Number(latestOcr.valor) - 1) * 1000) / 10
                      : null;
                  return (
                    <div key={key}>
                      <label className="text-[9px] text-[#9BAFC5] uppercase">{label}: Negociado (manual)</label>
                      <input
                        type="number" value={value} onChange={(e) => setValue(e.target.value)}
                        className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1 focus:border-[#C9A84C]/50 focus:outline-none"
                      />
                      {numValue !== null && Number.isFinite(numValue) && (
                        <div className="text-[9px] text-[#9BAFC5] mt-1">{formatBRLFull(numValue)}</div>
                      )}
                      {divergeFromOcr !== null && divergeFromOcr !== 0 && (
                        <div className="flex items-center gap-1 mt-1 px-2 py-1 bg-orange-500/10 border border-orange-500/20 rounded text-orange-400 text-[9px] font-bold">
                          <AlertTriangle size={11} className="flex-shrink-0" />
                          {divergeFromOcr > 0 ? `${divergeFromOcr}% acima` : `${Math.abs(divergeFromOcr)}% abaixo`} do valor lido no OCR ({formatBRLFull(Number(latestOcr.valor))})
                        </div>
                      )}
                      {history.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="text-[8px] text-[#9BAFC5]/70 uppercase tracking-wide">
                            {history.length > 1 ? `${history.length} extrações via OCR (divergência entre documentos)` : "Extraído via OCR"}
                          </div>
                          {history.map((h, i) => (
                            <div key={i} className="flex items-center justify-between gap-2 bg-[#09081A] rounded px-2 py-1.5">
                              <div className="min-w-0">
                                <div className="text-[11px] text-[#F5F1E8]">{formatBRL(Number(h.valor))}</div>
                                <div className="text-[8px] text-[#9BAFC5] truncate" title={h.documento}>{h.documento ?? "documento"} · {typeof h.confiabilidade === "number" ? `${h.confiabilidade}%` : "N/D"}</div>
                              </div>
                              <button
                                onClick={() => setValue(String(h.valor))}
                                className="flex-shrink-0 px-2 py-1 bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded text-[#C9A84C] text-[9px] font-bold hover:bg-[#C9A84C]/20 transition"
                              >
                                Usar
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                <button onClick={() => saveValoresNegociados(selectedListing.id)} disabled={savingValores}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded text-[#C9A84C] text-xs font-bold hover:bg-[#C9A84C]/20 transition disabled:opacity-50">
                  {savingValores ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Salvar Identificação e Valores Negociados
                </button>
              </div>
            </div>

            {/* Vitrine Pública: exclusivo para a classe "imovel" (Fase 1 · Bolsa de Grandes Ativos) */}
            {selectedListing.asset_type === "imovel" && (
              <div className="px-4 pb-4">
                <div className="text-[10px] text-[#C9A84C] font-bold uppercase tracking-wider mb-2">
                  Vitrine Pública (sem login)
                </div>
                <div className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-3 space-y-3">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs text-[#F5F1E8]">Publicar em /bolsa/imoveis</span>
                    <input
                      type="checkbox"
                      checked={selectedListing.allow_public_listing ?? false}
                      onChange={(e) => togglePublicListing(selectedListing.id, e.target.checked)}
                      className="w-4 h-4 accent-[#C9A84C]"
                    />
                  </label>
                  <p className="text-[9px] text-[#9BAFC5]">
                    Quando ativo, este ativo aparece anonimizado na vitrine pública, sem exigir login do visitante.
                  </p>

                  <div>
                    <label className="text-[9px] text-[#9BAFC5] uppercase">Galeria de imagens (higienizadas)</label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {(selectedListing.public_gallery ?? []).map((img) => (
                        <div key={img.storage_path} className="relative aspect-square bg-[#09081A] rounded overflow-hidden group">
                          <button
                            onClick={() => deleteGalleryImage(selectedListing.id, img.storage_path)}
                            className="absolute top-1 right-1 z-10 w-5 h-5 flex items-center justify-center bg-[#09081A]/80 rounded-full text-red-400 text-[10px] opacity-0 group-hover:opacity-100 transition"
                            title="Remover"
                          >
                            &times;
                          </button>
                          <div className="w-full h-full flex items-center justify-center text-[8px] text-[#9BAFC5]/50 px-1 text-center">
                            {img.storage_path.split("/").pop()}
                          </div>
                        </div>
                      ))}
                      <label className="aspect-square flex items-center justify-center border border-dashed border-[#9BAFC5]/25 rounded cursor-pointer hover:border-[#C9A84C]/40 transition">
                        {uploadingGallery ? (
                          <Loader2 size={16} className="animate-spin text-[#C9A84C]" />
                        ) : (
                          <span className="text-[9px] text-[#9BAFC5]">+ Foto</span>
                        )}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadGalleryImage(selectedListing.id, file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                    <p className="text-[9px] text-[#9BAFC5]/70 mt-1.5">
                      Nunca envie fotos com marca d&apos;água, logotipo ou qualquer identificador do vendedor.
                    </p>
                  </div>

                  <div>
                    <label className="text-[9px] text-[#9BAFC5] uppercase">Tese Comercial (Switcher de Teses)</label>
                    <select
                      value={selectedListing.selected_thesis_template ?? ""}
                      onChange={(e) => setSelectedListing((prev) => (prev ? { ...prev, selected_thesis_template: e.target.value } : prev))}
                      className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1 focus:border-[#C9A84C]/50 focus:outline-none"
                    >
                      <option value="">Selecionar tese</option>
                      <option value="despacho_imediato">Despacho Imediato</option>
                      <option value="rendimento_longo_prazo">Rendimento de Longo Prazo</option>
                      <option value="retrofit_incorporacao">Retrofit / Incorporação</option>
                    </select>
                    <button
                      onClick={() => selectedListing.selected_thesis_template && generateNarrative(selectedListing.id, selectedListing.selected_thesis_template)}
                      disabled={generatingNarrative || !selectedListing.selected_thesis_template}
                      className="w-full flex items-center justify-center gap-2 mt-2 px-3 py-2 bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded text-[#C9A84C] text-xs font-bold hover:bg-[#C9A84C]/20 transition disabled:opacity-40"
                    >
                      {generatingNarrative ? <Loader2 size={12} className="animate-spin" /> : null}
                      {selectedListing.public_narrative ? "Regenerar Narrativa" : "Gerar Narrativa"}
                    </button>
                    {selectedListing.public_narrative && (
                      <p className="text-[10px] text-[#9BAFC5] leading-relaxed mt-2 bg-[#09081A] border border-[#9BAFC5]/10 rounded p-2">
                        {selectedListing.public_narrative}
                      </p>
                    )}
                    <p className="text-[9px] text-[#9BAFC5]/70 mt-1.5">
                      A narrativa e o Chat IA do ativo se ajustam automaticamente ao ângulo comercial escolhido aqui.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Pedidos de Vistoria Técnica: gate manual de Prova de Fundos */}
            {selectedListing.asset_type === "imovel" && (selectedListing.inspection_requests?.length ?? 0) > 0 && (
              <div className="px-4 pb-4">
                <div className="text-[10px] text-[#C9A84C] font-bold uppercase tracking-wider mb-2">
                  Pedidos de Vistoria Técnica
                </div>
                <div className="space-y-2">
                  {(selectedListing.inspection_requests ?? []).map((req) => (
                    <div key={req.id} className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-[#F5F1E8] font-bold">{req.buyer_name}</span>
                        <span
                          className={cn(
                            "text-[8px] font-bold uppercase px-2 py-0.5 rounded-full",
                            req.proof_of_funds_status === "aprovado" && "bg-emerald-500/10 text-emerald-400",
                            req.proof_of_funds_status === "rejeitado" && "bg-red-500/10 text-red-400",
                            req.proof_of_funds_status === "pendente" && "bg-orange-500/10 text-orange-400",
                            req.proof_of_funds_status === "em_analise" && "bg-[#C9A84C]/10 text-[#C9A84C]"
                          )}
                        >
                          {req.proof_of_funds_status === "pendente" ? "Prova de Fundos pendente" : req.proof_of_funds_status}
                        </span>
                      </div>
                      <p className="text-[9px] text-[#9BAFC5] mb-2">{req.buyer_email}{req.buyer_phone ? ` · ${req.buyer_phone}` : ""}</p>
                      {req.proof_of_funds_status === "pendente" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => decideInspection(selectedListing.id, req.id, "aprovar")}
                            className="flex-1 px-2 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-400 text-[10px] font-bold hover:bg-emerald-500/20 transition"
                          >
                            Aprovar Prova de Fundos
                          </button>
                          <button
                            onClick={() => decideInspection(selectedListing.id, req.id, "rejeitar")}
                            className="flex-1 px-2 py-1.5 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-[10px] font-bold hover:bg-red-500/20 transition"
                          >
                            Rejeitar
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ações */}
            <div className="px-4 space-y-2">
              <div className="text-[10px] text-[#C9A84C] font-bold uppercase tracking-wider mb-2">Ações</div>
              <button
                onClick={() => { generateIntakeLink(selectedListing.id); }}
                disabled={generatingLink}
                className="w-full flex items-center gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition disabled:opacity-50"
              >
                {generatingLink ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
                Gerar Link Cedente
              </button>
              {intakeUrl && (
                <div className="bg-[#162744] border border-[#C9A84C]/20 rounded-lg p-3">
                  <div className="text-[9px] text-[#C9A84C] font-bold uppercase mb-1">Link para o Cedente</div>
                  <div className="flex items-center gap-2">
                    <input readOnly value={intakeUrl} className="flex-1 bg-[#09081A] border border-[#9BAFC5]/10 rounded px-2 py-1.5 text-[10px] text-[#F5F1E8] truncate" />
                    <button onClick={copyLink} className="p-1.5 bg-[#C9A84C]/10 rounded hover:bg-[#C9A84C]/20 transition">
                      <Copy size={12} className="text-[#C9A84C]" />
                    </button>
                  </div>
                  <p className="text-[9px] text-[#9BAFC5] mt-1.5">Envie este link ao cedente. Formulário público, sem login.</p>
                </div>
              )}
              <div className="mb-2">
                <div className="text-[10px] text-[#C9A84C] font-bold uppercase tracking-wider mb-2">
                  Checklist de Documentos Obrigatórios
                </div>
                <div className="space-y-1.5">
                  {(CM_DOCUMENT_CHECKLISTS[selectedListing.asset_type as CmAssetType] ?? CM_DOCUMENT_CHECKLISTS.outros).map((item) => {
                    const uploaded = listingDocs.find((d: any) => d.checklist_item_id === item.id);
                    return (
                      <div key={item.id} className="flex items-center justify-between gap-2 bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg px-3 py-2">
                        <div className="min-w-0 flex items-center gap-2">
                          {uploaded ? <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" /> : <Clock size={13} className="text-[#9BAFC5]/50 flex-shrink-0" />}
                          <div className="min-w-0">
                            <div className="text-[11px] text-[#F5F1E8] truncate">{item.label}</div>
                            {item.required && !uploaded && (
                              <div className="text-[8px] text-[#E8C97A] font-bold uppercase tracking-wide">Obrigatório</div>
                            )}
                          </div>
                        </div>
                        {uploaded ? (
                          <span className="text-[9px] text-emerald-400 font-bold flex-shrink-0">Enviado</span>
                        ) : (
                          <label className="flex items-center gap-1 px-2 py-1 bg-[#162744] border border-[#9BAFC5]/15 rounded text-[#9BAFC5] text-[9px] font-bold hover:border-[#C9A84C]/30 hover:text-[#C9A84C] transition cursor-pointer flex-shrink-0">
                            {uploadingDoc === selectedListing.id ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                            Enviar
                            <input type="file" className="hidden" accept=".pdf,.jpg,.png,.jpeg"
                              onChange={(e) => { if (e.target.files?.[0]) handleUploadDoc(selectedListing.id, e.target.files[0], item.id); }}
                            />
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <label className="w-full flex items-center gap-3 px-4 py-3 bg-[#162744] border border-[#9BAFC5]/15 rounded-lg text-[#9BAFC5] text-xs font-bold hover:bg-[#162744]/80 transition cursor-pointer">
                {uploadingDoc === selectedListing.id ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                Outro Documento / Áudio
                <input type="file" className="hidden" accept=".pdf,.mp3,.ogg,.wav,.m4a,.webm,.jpg,.png,.jpeg"
                  onChange={(e) => { if (e.target.files?.[0]) handleUploadDoc(selectedListing.id, e.target.files[0]); }}
                />
              </label>
              <button
                onClick={() => { setAssistantListing({ id: selectedListing.id, anonymous_id: selectedListing.anonymous_id }); }}
                className="w-full flex items-center gap-3 px-4 py-3 bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded-lg text-[#C9A84C] text-xs font-bold hover:bg-[#C9A84C]/20 transition"
              >
                <Bot size={16} /> Assistente do Ativo (IA)
              </button>
              <button
                onClick={() => createDealRoom(selectedListing.id)}
                disabled={creatingRoom}
                className="w-full flex items-center gap-3 px-4 py-3 bg-[#162744] border border-[#9BAFC5]/15 rounded-lg text-[#F5F1E8] text-xs font-bold hover:bg-[#162744]/80 transition disabled:opacity-50"
              >
                {creatingRoom ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
                Criar Deal Room (Comprador)
              </button>
              {dealRoomUrl && (
                <div className="bg-[#162744] border border-emerald-500/20 rounded-lg p-3">
                  <div className="text-[9px] text-emerald-400 font-bold uppercase mb-1">Link Deal Room</div>
                  <div className="flex items-center gap-2">
                    <input readOnly value={dealRoomUrl} className="flex-1 bg-[#09081A] border border-[#9BAFC5]/10 rounded px-2 py-1.5 text-[10px] text-[#F5F1E8] truncate" />
                    <button onClick={() => { navigator.clipboard.writeText(dealRoomUrl); alert("Link copiado!"); }} className="p-1.5 bg-emerald-500/10 rounded hover:bg-emerald-500/20 transition">
                      <Copy size={12} className="text-emerald-400" />
                    </button>
                  </div>
                  <p className="text-[9px] text-[#9BAFC5] mt-1.5">Comprador precisa aceitar NDA antes de ver documentos. Expira em 30 dias.</p>
                </div>
              )}
              {roomInvites.length > 0 && (
                <div className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-3">
                  <div className="text-[9px] text-[#C9A84C] font-bold uppercase mb-2">Convites Ativos ({roomInvites.length})</div>
                  {roomInvites.slice(0, 10).map((inv: any) => (
                    <div key={inv.id} className="py-2 border-b border-[#9BAFC5]/5 last:border-0">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-[#F5F1E8] font-medium">{inv.buyer_name || inv.buyer_email || "Sem nome"}</span>
                        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded",
                          inv.access_tier === "full_dd" ? "bg-emerald-500/20 text-emerald-400" :
                          inv.access_tier === "qualified" ? "bg-[#C9A84C]/20 text-[#C9A84C]" :
                          inv.nda_accepted ? "bg-blue-500/20 text-blue-400" :
                          "bg-[#162744] text-[#9BAFC5]"
                        )}>
                          {inv.access_tier === "full_dd" ? "Full DD" :
                           inv.access_tier === "qualified" ? "Qualificado" :
                           inv.nda_accepted ? "NDA aceito" : "Pendente"}
                        </span>
                      </div>
                      {inv.buyer_company && <div className="text-[9px] text-[#9BAFC5] mt-0.5">{inv.buyer_company}</div>}
                      {inv.qualification_status === "pendente" && inv.proof_of_funds_path && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[9px] text-orange-400">Qualificacao pendente</span>
                          <button onClick={() => approveQualification(inv.id, "aprovado")}
                            className="text-[9px] px-2 py-0.5 bg-emerald-600/20 text-emerald-400 rounded font-bold hover:bg-emerald-600/30 transition">
                            Aprovar
                          </button>
                          <button onClick={() => approveQualification(inv.id, "reprovado")}
                            className="text-[9px] px-2 py-0.5 bg-red-500/10 text-red-400 rounded font-bold hover:bg-red-500/20 transition">
                            Reprovar
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {contractTemplates.length > 0 && (
                <div className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-3">
                  <div className="text-[9px] text-[#C9A84C] font-bold uppercase mb-2">Gerar Contrato</div>
                  {contractTemplates.map((t: any) => (
                    <button key={t.id} onClick={() => generateContract(selectedListing.id, t.id)}
                      disabled={generatingContract}
                      className="w-full flex items-center gap-2 px-3 py-2 mb-1 bg-[#162744] border border-[#9BAFC5]/10 rounded-md text-[#F5F1E8] text-[11px] font-medium hover:border-[#C9A84C]/30 transition disabled:opacity-50">
                      {generatingContract ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} className="text-[#C9A84C]" />}
                      {t.template_name}
                    </button>
                  ))}
                  {contractResult && (
                    <div className="mt-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded text-[10px] text-emerald-400">
                      Contrato gerado: {contractResult.contract?.contract_title} · Status: {contractResult.contract?.status_signature}
                    </div>
                  )}
                </div>
              )}
            </div>
            </>)}

            {/* ══ ABA: GOVERNANÇA ══ */}
            {activeDetailTab === "governanca" && (<>
            {/* Atalho Central de Contratos: minuta real do NDA usada na Deal Room */}
            <div className="px-4 mt-4">
              <a
                href="/juridico/contratos?vertical=capital_markets"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 px-3 py-2.5 bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg text-[10px] text-[#9BAFC5] hover:border-[#C9A84C]/30 hover:text-[#F5F1E8] transition"
              >
                <span className="flex items-center gap-2">
                  <FileText size={13} className="text-[#C9A84C]" />
                  Template NDA (Central de Contratos): minuta usada de verdade na Deal Room
                </span>
                <ExternalLink size={12} />
              </a>
            </div>

            {/* Cadeia de Intermediários: Anexo FPA/NCND (Single Payout) */}
            <div className="px-4 mt-4">
              <div className="text-[10px] text-[#C9A84C] font-bold uppercase tracking-wider mb-2">Cadeia de Intermediários (FPA/NCND)</div>
              <div className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-3 space-y-3">
                <p className="text-[10px] text-[#9BAFC5]">V3 paga um único Mandatário por lado. Ele assume, via Anexo assinado, a obrigação de repassar aos demais intermediários conforme os percentuais abaixo.</p>

                <div className="grid grid-cols-2 gap-2">
                  <select value={interSide} onChange={(e) => setInterSide(e.target.value as any)}
                    className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]">
                    <option value="venda">Lado Venda</option>
                    <option value="compra">Lado Compra</option>
                  </select>
                  <div className="flex gap-1">
                    <select value={interMandatarioId} onChange={(e) => setInterMandatarioId(e.target.value)}
                      className="flex-1 bg-[#09081A] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]">
                      <option value="">Mandatário</option>
                      {partnersList.map((p) => (
                        <option key={p.id} value={p.id}>{p.full_name}</option>
                      ))}
                    </select>
                    {userRole === "ADMIN" && (
                      <button onClick={() => setShowQuickPartner((v) => !v)}
                        className="px-2 bg-[#162744] border border-[#9BAFC5]/15 rounded text-[#C9A84C] text-[9px] font-bold hover:bg-[#243A66] transition flex-shrink-0">
                        + Partner
                      </button>
                    )}
                  </div>
                </div>

                {showQuickPartner && (
                  <div className="bg-[#09081A] border border-[#C9A84C]/20 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-[#C9A84C] font-bold uppercase">Cadastrar Novo Partner</span>
                      <button onClick={() => setShowQuickPartner(false)}><X size={12} className="text-[#9BAFC5]" /></button>
                    </div>
                    <input value={qpName} onChange={(e) => setQpName(e.target.value)} placeholder="Nome completo *"
                      className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
                    <input value={qpEmail} onChange={(e) => setQpEmail(e.target.value)} placeholder="Email *" type="email"
                      className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
                    <div className="grid grid-cols-2 gap-2">
                      <input value={qpPhone} onChange={(e) => setQpPhone(e.target.value)} placeholder="Telefone"
                        className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
                      <input value={qpDoc} onChange={(e) => setQpDoc(e.target.value)} placeholder="CPF/CNPJ"
                        className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
                    </div>
                    <button onClick={createQuickPartner} disabled={creatingQuickPartner}
                      className="w-full px-3 py-2 bg-[#C9A84C]/20 border border-[#C9A84C]/30 rounded text-[#E8C97A] text-[10px] font-bold hover:bg-[#C9A84C]/30 transition disabled:opacity-50">
                      {creatingQuickPartner ? <Loader2 size={12} className="animate-spin inline" /> : "Criar Partner e Usar como Mandatário"}
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <input value={interName} onChange={(e) => setInterName(e.target.value)} placeholder="Nome do intermediário *"
                    className="col-span-2 w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
                  <input value={interPercentage} onChange={(e) => setInterPercentage(e.target.value)} placeholder="% *" type="number"
                    className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
                </div>
                <div className="flex gap-2">
                  <input value={interDoc} onChange={(e) => setInterDoc(e.target.value)} placeholder="CPF/CNPJ (opcional)"
                    className="flex-1 bg-[#09081A] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
                  <button onClick={() => addIntermediary(selectedListing.id)} disabled={addingIntermediary}
                    className="px-3 py-1.5 bg-[#162744] border border-[#9BAFC5]/15 rounded text-[#C9A84C] text-[10px] font-bold hover:bg-[#243A66] transition disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0">
                    {addingIntermediary ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Adicionar
                  </button>
                </div>

                {(["venda", "compra"] as const).map((side) => {
                  const sideRows = intermediaries.filter((i) => i.side === side);
                  if (sideRows.length === 0) return null;
                  return (
                    <div key={side} className="pt-2 border-t border-[#9BAFC5]/10">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] text-[#9BAFC5] font-bold uppercase">Lado {side === "venda" ? "Venda" : "Compra"}</span>
                        <div className="flex gap-1.5">
                          <button onClick={() => generateFillLink(selectedListing.id, side)} disabled={generatingFillLink === side}
                            className="px-2 py-1 bg-[#162744] border border-[#9BAFC5]/15 rounded text-[#9BAFC5] text-[9px] font-bold hover:text-[#F5F1E8] transition disabled:opacity-50 flex items-center gap-1">
                            {generatingFillLink === side ? <Loader2 size={11} className="animate-spin" /> : null} Gerar Link p/ Preenchimento
                          </button>
                          <button onClick={() => generateAnnex(selectedListing.id, side)} disabled={generatingAnnex === side}
                            className="px-2 py-1 bg-[#C9A84C]/20 border border-[#C9A84C]/30 rounded text-[#E8C97A] text-[9px] font-bold hover:bg-[#C9A84C]/30 transition disabled:opacity-50 flex items-center gap-1">
                            {generatingAnnex === side ? <Loader2 size={11} className="animate-spin" /> : null} Gerar Anexo e Enviar
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {sideRows.map((i) => (
                          <div key={i.id} className="flex items-center justify-between gap-2 bg-[#09081A] rounded px-2 py-1.5">
                            <div className="min-w-0">
                              <div className="text-[10px] text-[#F5F1E8] truncate">{i.intermediary_name} · {i.percentage}%</div>
                              <div className="text-[8px] text-[#9BAFC5] truncate">Mandatário: {i.profiles?.full_name ?? "N/D"}</div>
                            </div>
                            <button onClick={() => removeIntermediary(i.id)} className="flex-shrink-0">
                              <Trash2 size={12} className="text-red-400/70 hover:text-red-400" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* NDA Retroativo: Autorização de Diretor */}
            <div className="px-4 mt-4">
              <div className="text-[10px] text-[#C9A84C] font-bold uppercase tracking-wider mb-2">NDA Retroativo (fora do sistema)</div>
              <div className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-3">
                {(selectedListing as any).nda_authorization_status === "pending_director" ? (
                  <div className="text-[11px] text-[#F5F1E8]">
                    <div className="text-[#C9A84C] font-bold mb-1">Enviado: Aguardando Diretoria</div>
                    <div className="text-[#9BAFC5] text-[10px] mb-1">A ação da Mesa foi concluída. O gargalo agora é a autorização de um diretor (João, Hamilton ou Robson).</div>
                    <div className="text-[#9BAFC5] text-[10px] mb-2">{(selectedListing as any).nda_authorization_reason}</div>
                    {userRole === "ADMIN" && (
                      <div className="flex gap-2">
                        <button onClick={() => handleNdaGovernanceDecision(selectedListing.id, "approve")}
                          className="flex-1 px-3 py-2 bg-emerald-600/20 border border-emerald-500/30 rounded text-emerald-400 text-[10px] font-bold hover:bg-emerald-600/30 transition">
                          Autorizar
                        </button>
                        <button onClick={() => handleNdaGovernanceDecision(selectedListing.id, "reject")}
                          className="flex-1 px-3 py-2 bg-[#162744] border border-[#9BAFC5]/15 rounded text-[#9BAFC5] text-[10px] font-bold hover:text-[#F5F1E8] transition">
                          Rejeitar
                        </button>
                      </div>
                    )}
                  </div>
                ) : (selectedListing as any).nda_authorization_status === "approved" ? (
                  <div className="text-[11px] text-emerald-400 font-bold">NDA autorizado {(selectedListing as any).nda_signed_at ? `em ${new Date((selectedListing as any).nda_signed_at).toLocaleDateString("pt-BR")}` : ""}</div>
                ) : !showNdaForm ? (
                  <button onClick={() => setShowNdaForm(true)}
                    className="w-full px-3 py-2 bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded text-[#C9A84C] text-xs font-bold hover:bg-[#C9A84C]/20 transition">
                    Marcar NDA como Já Assinado
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <label className="text-[9px] text-[#9BAFC5] uppercase">Data da assinatura</label>
                      <input type="date" value={ndaDate} onChange={(e) => setNdaDate(e.target.value)}
                        className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1" />
                    </div>
                    <div>
                      <label className="text-[9px] text-[#9BAFC5] uppercase">PDF do NDA assinado</label>
                      <input type="file" accept=".pdf,.jpg,.png,.jpeg" onChange={(e) => setNdaFile(e.target.files?.[0] ?? null)}
                        className="w-full text-[10px] text-[#9BAFC5] mt-1" />
                    </div>
                    <div>
                      <label className="text-[9px] text-[#9BAFC5] uppercase">Motivo / contexto</label>
                      <textarea value={ndaReason} onChange={(e) => setNdaReason(e.target.value)} rows={2}
                        placeholder="Ex: deal antigo, NDA assinado em papel em reunião presencial"
                        className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => submitNdaAuthorization(selectedListing.id)} disabled={submittingNda}
                        className="flex-1 px-3 py-2 bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded text-[#C9A84C] text-[10px] font-bold hover:bg-[#C9A84C]/20 transition disabled:opacity-50">
                        {submittingNda ? <Loader2 size={12} className="animate-spin inline" /> : (userRole === "ADMIN" ? "Confirmar" : "Enviar p/ Autorização")}
                      </button>
                      <button onClick={() => setShowNdaForm(false)}
                        className="px-3 py-2 bg-[#162744] border border-[#9BAFC5]/15 rounded text-[#9BAFC5] text-[10px] font-bold hover:text-[#F5F1E8] transition">
                        Cancelar
                      </button>
                    </div>
                    {userRole !== "ADMIN" && (
                      <p className="text-[9px] text-[#9BAFC5]">Exige autorização de João, Hamilton ou Robson, enviado por email aos diretores.</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Painel KYC Segregado: retido ate validacao da Mesa */}
            <div className="px-4 mt-4">
              <div className="text-[10px] text-[#C9A84C] font-bold uppercase tracking-wider mb-2">Documentos KYC (retidos p/ validação)</div>
              <div className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-3 space-y-3">
                <p className="text-[10px] text-[#9BAFC5]">Documentos de KYC de comprador/vendedor ficam retidos aqui até a Mesa aprovar, só depois disso aparecem no repositório público do Deal Room.</p>

                <div className="grid grid-cols-2 gap-2">
                  <select value={kycPartyType} onChange={(e) => setKycPartyType(e.target.value as any)}
                    className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]">
                    <option value="vendedor">Vendedor (cedente)</option>
                    <option value="comprador">Comprador</option>
                  </select>
                  <input value={kycPartyName} onChange={(e) => setKycPartyName(e.target.value)} placeholder="Nome (opcional)"
                    className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
                </div>
                <div className="flex gap-2">
                  <input value={kycDocType} onChange={(e) => setKycDocType(e.target.value)} placeholder="Tipo de documento (ex: RG, Contrato Social)"
                    className="flex-1 bg-[#09081A] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
                  <label className="flex items-center gap-1.5 px-3 py-1.5 bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded text-[#C9A84C] text-[10px] font-bold cursor-pointer hover:bg-[#C9A84C]/20 transition flex-shrink-0">
                    {uploadingKyc ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                    Enviar
                    <input type="file" className="hidden" accept=".pdf,.jpg,.png,.jpeg"
                      onChange={(e) => { if (e.target.files?.[0]) uploadKycDoc(selectedListing.id, e.target.files[0]); }} />
                  </label>
                </div>

                {kycDocs.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-[#9BAFC5]/10">
                    {kycDocs.map((d) => (
                      <div key={d.id} className="flex items-center justify-between gap-2 bg-[#09081A] rounded px-2 py-1.5">
                        <div className="min-w-0">
                          <div className="text-[10px] text-[#F5F1E8] truncate">{d.party_type === "vendedor" ? "Vendedor" : "Comprador"}{d.party_name ? `: ${d.party_name}` : ""} · {d.document_type}
                            {d.source === "buyer_intake" && <span className="ml-1.5 text-[8px] text-[#C9A84C] font-bold uppercase">via Wizard</span>}
                          </div>
                          <div className="text-[8px] text-[#9BAFC5] truncate">{d.original_filename}</div>
                        </div>
                        {d.source === "buyer_intake" ? (
                          <span className="text-[9px] font-bold text-[#9BAFC5] flex-shrink-0">Enviado pelo comprador</span>
                        ) : d.status === "pendente" ? (
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => handleKycDecision(d.id, "approve")} disabled={kycActionLoading === d.id}
                              className="px-2 py-1 bg-emerald-600/20 border border-emerald-500/30 rounded text-emerald-400 text-[9px] font-bold hover:bg-emerald-600/30 transition disabled:opacity-50">
                              Aprovar
                            </button>
                            <button onClick={() => handleKycDecision(d.id, "reject")} disabled={kycActionLoading === d.id}
                              className="px-2 py-1 bg-[#162744] border border-[#9BAFC5]/15 rounded text-[#9BAFC5] text-[9px] font-bold hover:text-[#F5F1E8] transition disabled:opacity-50">
                              Rejeitar
                            </button>
                          </div>
                        ) : (
                          <span className={cn("text-[9px] font-bold flex-shrink-0", d.status === "aprovado" ? "text-emerald-400" : "text-red-400")}>
                            {d.status === "aprovado" ? "Aprovado" : "Rejeitado"}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Zona de Risco: Exclusão */}
            <div className="px-4 mt-4">
              <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider mb-2">Zona de Risco</div>
              <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                {(selectedListing as any).deletion_status === "pending_governance" ? (
                  <div className="text-[11px] text-[#F5F1E8]">
                    <div className="text-red-400 font-bold mb-1">Exclusão solicitada: aguardando aprovação</div>
                    <div className="text-[#9BAFC5] text-[10px] mb-2">{(selectedListing as any).deletion_reason}</div>
                    {userRole === "ADMIN" && (
                      <div className="flex gap-2">
                        <button onClick={() => handleGovernanceDecision(selectedListing.id, "approve")} disabled={deletingListing}
                          className="flex-1 px-3 py-2 bg-red-600/20 border border-red-500/30 rounded text-red-400 text-[10px] font-bold hover:bg-red-600/30 transition disabled:opacity-50">
                          Aprovar Exclusão
                        </button>
                        <button onClick={() => handleGovernanceDecision(selectedListing.id, "reject")} disabled={deletingListing}
                          className="flex-1 px-3 py-2 bg-[#162744] border border-[#9BAFC5]/15 rounded text-[#9BAFC5] text-[10px] font-bold hover:text-[#F5F1E8] transition disabled:opacity-50">
                          Rejeitar
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => handleDeleteAsset(selectedListing.id)}
                    disabled={deletingListing}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs font-bold hover:bg-red-500/20 transition disabled:opacity-50"
                  >
                    {deletingListing ? <Loader2 size={14} className="animate-spin" /> : null}
                    {userRole === "ADMIN" ? "Excluir Ativo" : "Solicitar Exclusão"}
                  </button>
                )}
                {userRole !== "ADMIN" && (selectedListing as any).deletion_status !== "pending_governance" && (
                  <p className="text-[9px] text-[#9BAFC5] mt-2">Exige aprovação de João, Hamilton ou Robson, motivo é enviado por email aos sócios.</p>
                )}
              </div>
            </div>
            </>)}

            {/* ══ ABA: NOTAS ══ */}
            {activeDetailTab === "notas" && (<>
            <div className="px-4 mt-4">
              <div className="text-[10px] text-[#C9A84C] font-bold uppercase tracking-wider mb-2">Bloco de Anotações do Ativo</div>
              <div className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-3 space-y-3">
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Escreva uma nota... use @ para marcar um gestor ou operador"
                  rows={3}
                  className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded px-3 py-2 text-[11px] text-[#F5F1E8] placeholder:text-[#9BAFC5]/50 focus:outline-none focus:border-[#C9A84C]/40 resize-none"
                />
                <div>
                  <div className="text-[9px] text-[#9BAFC5] uppercase tracking-wider mb-1.5">Marcar na Mesa</div>
                  <div className="flex flex-wrap gap-1.5">
                    {mesaUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => toggleMention(u.id, u.full_name)}
                        className={cn(
                          "px-2 py-1 rounded text-[9px] font-bold transition border",
                          noteMentionedIds.includes(u.id)
                            ? "bg-[#C9A84C]/20 border-[#C9A84C]/40 text-[#E8C97A]"
                            : "bg-[#162744] border-[#9BAFC5]/15 text-[#9BAFC5] hover:text-[#F5F1E8]"
                        )}
                      >
                        @{u.full_name}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => submitDealNote(selectedListing.id)}
                  disabled={submittingNote || !noteContent.trim()}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#C9A84C]/20 border border-[#C9A84C]/30 rounded text-[#E8C97A] text-[10px] font-bold hover:bg-[#C9A84C]/30 transition disabled:opacity-50"
                >
                  {submittingNote ? <Loader2 size={14} className="animate-spin" /> : null}
                  Publicar Nota
                </button>
              </div>
            </div>

            <div className="px-4 mt-4">
              <div className="text-[10px] text-[#9BAFC5] font-bold uppercase tracking-wider mb-2">Histórico</div>
              {dealNotes.length === 0 ? (
                <p className="text-[10px] text-[#9BAFC5]/70 italic">Nenhuma nota registrada para este ativo ainda.</p>
              ) : (
                <div className="space-y-2">
                  {dealNotes.map((n) => (
                    <div key={n.id} className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-[#F5F1E8]">{n.profiles?.full_name ?? "Usuário"}</span>
                        <span className="text-[9px] text-[#9BAFC5]">{new Date(n.created_at).toLocaleString("pt-BR")}</span>
                      </div>
                      <p className="text-[11px] text-[#9BAFC5] whitespace-pre-wrap">{n.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </>)}

            {/* ══ ABA: ORDER BOOK ══ */}
            {activeDetailTab === "orderbook" && (<>
            {/* Ask Price Floor + Auto-Aceite */}
            <div className="px-4 mt-4">
              <div className="text-[10px] text-[#C9A84C] font-bold uppercase tracking-wider mb-2">Order Book</div>
              <div className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-3 space-y-3">
                <div>
                  <label className="text-[9px] text-[#9BAFC5] uppercase">Ask Price Floor (R$)</label>
                  <input
                    inputMode="numeric" value={askPriceFloor} onChange={(e) => setAskPriceFloor(maskCurrencyBRLInput(e.target.value))}
                    placeholder="0,00"
                    className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1 focus:border-[#C9A84C]/50 focus:outline-none"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#9BAFC5]">Auto-aceite (oferta &ge; floor)</span>
                  <button onClick={() => setAutoAcceptEnabled(!autoAcceptEnabled)} className="text-[#C9A84C]">
                    {autoAcceptEnabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} className="text-[#9BAFC5]" />}
                  </button>
                </div>
                <button onClick={() => saveAskPrice(selectedListing.id)} disabled={savingFloor}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded text-[#C9A84C] text-xs font-bold hover:bg-[#C9A84C]/20 transition disabled:opacity-50">
                  {savingFloor ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Salvar
                </button>
              </div>
            </div>

            {/* Checklists Operacionais */}
            <div className="px-4 mt-4">
              <div className="text-[10px] text-[#C9A84C] font-bold uppercase tracking-wider mb-2">
                <ClipboardCheck size={12} className="inline mr-1" /> Checklists Operacionais
              </div>
              <div className="flex gap-1 mb-2">
                {(["pre_aceite", "pre_fechamento", "pos_cessao"] as const).map((t) => (
                  <button key={t} onClick={() => setChecklistTab(t)}
                    className={cn("px-2 py-1 rounded text-[9px] font-bold transition",
                      checklistTab === t ? "bg-[#C9A84C] text-[#09081A]" : "bg-[#162744] text-[#9BAFC5] hover:text-[#F5F1E8]"
                    )}>
                    {t === "pre_aceite" ? "Pré-Aceite" : t === "pre_fechamento" ? "Pré-Fechamento" : "Pós-Cessão"}
                  </button>
                ))}
              </div>
              {checklistsLoading ? (
                <div className="flex justify-center py-4"><Loader2 size={14} className="animate-spin text-[#C9A84C]" /></div>
              ) : (() => {
                const cl = checklists.find((c: any) => c.checklist_type === checklistTab);
                if (!cl) return (
                  <button onClick={() => createChecklist(selectedListing.id, checklistTab)}
                    className="w-full py-3 border border-dashed border-[#9BAFC5]/20 rounded-lg text-[10px] text-[#9BAFC5] hover:border-[#C9A84C]/30 hover:text-[#C9A84C] transition">
                    + Criar checklist {checklistTab === "pre_aceite" ? "Pré-Aceite" : checklistTab === "pre_fechamento" ? "Pré-Fechamento" : "Pós-Cessão"}
                  </button>
                );
                const items = cl.cm_checklist_items?.sort((a: any, b: any) => a.sort_order - b.sort_order) ?? [];
                const checked = items.filter((i: any) => i.is_checked).length;
                return (
                  <div className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded",
                        cl.status === "concluido" ? "bg-emerald-500/20 text-emerald-400" :
                        cl.status === "em_andamento" ? "bg-[#C9A84C]/20 text-[#C9A84C]" :
                        "bg-[#162744] text-[#9BAFC5]"
                      )}>{cl.status === "concluido" ? "Concluído" : cl.status === "em_andamento" ? "Em Andamento" : "Pendente"}</span>
                      <span className="text-[9px] text-[#9BAFC5]">{checked}/{items.length}</span>
                    </div>
                    <div className="space-y-1.5">
                      {items.map((item: any) => (
                        <label key={item.id} className="flex items-start gap-2 cursor-pointer group">
                          <input type="checkbox" checked={item.is_checked}
                            onChange={(e) => toggleCheckItem(cl.id, item.id, e.target.checked)}
                            className="mt-0.5 accent-[#C9A84C]" />
                          <span className={cn("text-[11px] leading-tight", item.is_checked ? "text-[#9BAFC5] line-through" : "text-[#F5F1E8]")}>
                            {item.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Transicoes de Status */}
            <div className="px-4 mt-4 space-y-2">
              <div className="text-[10px] text-[#C9A84C] font-bold uppercase tracking-wider mb-2">Transição de Status</div>
              <div className="flex flex-wrap gap-2">
                {[
                  { from: "reuniao_validada", to: "formulario_preenchido", label: "Formulário OK" },
                  { from: "formulario_preenchido", to: "nda_assinado", label: "NDA Assinado" },
                  { from: "nda_assinado", to: "em_analise", label: "Iniciar Análise" },
                  { from: "em_analise", to: "aprovado_head", label: "Aprovar (Head)" },
                  { from: "aprovado_head", to: "ativo_vitrine", label: "Publicar Vitrine" },
                ].filter((t) => t.from === selectedListing.listing_status).map((t) => (
                  <button key={t.to} onClick={() => handleStatusTransition(selectedListing.id, t.to)}
                    className="px-3 py-2 bg-emerald-600/20 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs font-bold hover:bg-emerald-600/30 transition">
                    {t.label} &rarr;
                  </button>
                ))}
                <button onClick={() => handleStatusTransition(selectedListing.id, "cancelado")}
                  className="px-3 py-2 bg-red-600/10 border border-red-500/20 rounded-lg text-red-400 text-xs hover:bg-red-600/20 transition">
                  Cancelar
                </button>
              </div>
            </div>
            </>)}

            {/* ══ ABA: DOCUMENTOS ══ */}
            {activeDetailTab === "documentos" && (<>
            {/* Resumo Consolidado: Multi-Documento (estilo FORJA) */}
            {(() => {
              const consolidated = buildConsolidatedSummary(listingDocs);
              if (consolidated.length === 0) return null;
              return (
                <div className="px-4 pt-4">
                  <div className="text-[10px] text-[#C9A84C] font-bold uppercase tracking-wider mb-2">
                    Resumo Consolidado · Todos os Documentos ({listingDocs.length})
                  </div>
                  <div className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-3 divide-y divide-[#9BAFC5]/5 max-h-72 overflow-y-auto">
                    {consolidated.map((f, i) => {
                      const uniqueValues = Array.from(new Set(f.values.map((v) => v.value)));
                      const hasConflict = uniqueValues.length > 1;
                      return (
                        <div key={i} className="flex items-start justify-between gap-3 py-1.5 first:pt-0 last:pb-0">
                          <div className="min-w-0 flex-1">
                            <div className="text-[9px] text-[#9BAFC5]/70 uppercase tracking-wide">{f.label}</div>
                            {hasConflict ? (
                              <div className="space-y-0.5 mt-0.5">
                                {f.values.map((v, j) => (
                                  <div key={j} className="text-[11px] text-[#F5F1E8]">
                                    {v.value} <span className="text-[9px] text-[#9BAFC5]" title={v.source}>· {v.source}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[11px] text-[#F5F1E8]">{f.values[0].value}</div>
                            )}
                          </div>
                          {hasConflict ? (
                            <span className="flex-shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 border border-red-500/30 text-red-400">DIVERGÊNCIA</span>
                          ) : f.values.length > 1 ? (
                            <span className="flex-shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">{f.values.length}x confirmado</span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Documentos */}
            <div className="px-4 mt-4 pb-6">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] text-[#C9A84C] font-bold uppercase tracking-wider">Documentos ({listingDocs.length})</div>
                <button
                  onClick={() => loadDocs(selectedListing.id)}
                  disabled={docsLoading}
                  title="Atualizar lista de documentos"
                  className="flex items-center gap-1 px-2 py-1 bg-[#162744] border border-[#9BAFC5]/15 rounded text-[#9BAFC5] text-[9px] font-bold hover:border-[#C9A84C]/30 hover:text-[#C9A84C] transition disabled:opacity-50"
                >
                  <RefreshCw size={11} className={docsLoading ? "animate-spin" : ""} /> Atualizar
                </button>
              </div>

              {listingDocs.length > 0 && (
                <div className="mb-3 overflow-x-auto">
                  <table className="w-full text-[10px] border-collapse">
                    <thead>
                      <tr className="text-left text-[#9BAFC5]/70 uppercase tracking-wide text-[8px]">
                        <th className="py-1 pr-2">Documento</th>
                        <th className="py-1 pr-2">Confiabilidade</th>
                        <th className="py-1 pr-2">Status</th>
                        <th className="py-1">Erro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#9BAFC5]/10">
                      {listingDocs.map((doc: any) => {
                        const ocrQ = doc.ocr_result;
                        const conf = ocrQ && typeof ocrQ === "object" && typeof ocrQ.confiabilidade === "number" ? ocrQ.confiabilidade : null;
                        const isError = doc.validation_status === "erro";
                        const statusStyle = isError
                          ? "bg-red-500/15 border-red-500/30 text-red-400"
                          : doc.validation_status === "processing"
                          ? "bg-[#E8C97A]/15 border-[#E8C97A]/30 text-[#E8C97A]"
                          : doc.validation_status === "needs_review"
                          ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                          : doc.validation_status === "validado" || doc.validation_status === "transcrito"
                          ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                          : "bg-[#162744] border-[#9BAFC5]/20 text-[#9BAFC5]";
                        return (
                          <tr key={doc.id} className={cn(isError && "bg-red-500/5")}>
                            <td className="py-1.5 pr-2 text-[#F5F1E8] max-w-[180px] truncate" title={doc.original_filename ?? ""}>
                              {doc.original_filename ?? "Documento"}
                            </td>
                            <td className="py-1.5 pr-2">
                              {conf !== null ? (
                                <span className={cn("font-bold px-1.5 py-0.5 rounded border text-[9px]", confidenceStyle(conf))}>{conf}%</span>
                              ) : (
                                <span className="text-[#9BAFC5]/50">-</span>
                              )}
                            </td>
                            <td className="py-1.5 pr-2">
                              <span className={cn("font-bold px-1.5 py-0.5 rounded border text-[9px]", statusStyle)}>
                                {doc.validation_status}
                              </span>
                            </td>
                            <td className="py-1.5 text-red-400/90 max-w-[220px] truncate" title={doc.error_message ?? ""}>
                              {doc.error_message ?? "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {docsLoading ? (
                <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-[#C9A84C]" /></div>
              ) : listingDocs.length === 0 ? (
                <div className="text-xs text-[#9BAFC5] py-4 text-center">Nenhum documento anexado</div>
              ) : (
                <div className="space-y-2">
                  {listingDocs.map((doc: any) => {
                    const ocr = doc.ocr_result;
                    const isStructured = ocr && typeof ocr === "object" && !Array.isArray(ocr) && ("dados_extraidos" in ocr || "confiabilidade" in ocr || "resumo" in ocr);
                    const transcription = ocr && typeof ocr === "object" ? ocr.transcription : null;
                    const extractedFields = isStructured && ocr.dados_extraidos ? flattenExtractedFields(ocr.dados_extraidos) : [];

                    return (
                      <div key={doc.id} className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs text-[#F5F1E8] font-medium truncate">{doc.original_filename ?? "Documento"}</div>
                            <div className="text-[10px] text-[#9BAFC5]">{doc.document_type} &middot; {doc.validation_status}</div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isStructured && typeof ocr.confiabilidade === "number" && (
                              <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border", confidenceStyle(ocr.confiabilidade))}>
                                {ocr.confiabilidade}% OCR
                              </span>
                            )}
                            {doc.document_type === "AUDIO" && <Mic size={14} className="text-[#C9A84C]" />}
                            {doc.download_url && (
                              <a href={doc.download_url} target="_blank" rel="noopener noreferrer"
                                title="Baixar documento original"
                                className="flex items-center gap-1 px-2 py-1 bg-[#162744] border border-[#9BAFC5]/15 rounded text-[#9BAFC5] text-[9px] font-bold hover:border-[#C9A84C]/30 hover:text-[#C9A84C] transition">
                                <Download size={11} /> Baixar
                              </a>
                            )}
                          </div>
                        </div>

                        {isStructured ? (
                          <div className="mt-2 space-y-2">
                            {ocr.tipo_documento && (
                              <div className="text-[9px] text-[#9BAFC5] uppercase tracking-wide">
                                Tipo identificado: <span className="text-[#E8C97A] font-bold">{toFieldLabel(String(ocr.tipo_documento))}</span>
                              </div>
                            )}
                            {ocr.resumo && (
                              <div className="p-2 bg-[#09081A] rounded text-[10px] text-[#9BAFC5] leading-relaxed max-h-40 overflow-y-auto">
                                {ocr.resumo}
                              </div>
                            )}
                            {extractedFields.length > 0 && (
                              <div className="p-2 bg-[#09081A] rounded max-h-56 overflow-y-auto">
                                <div className="text-[9px] text-[#C9A84C] font-bold uppercase tracking-wider mb-1.5">
                                  Campos Extraídos ({extractedFields.length})
                                </div>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                                  {extractedFields.map((f, i) => (
                                    <div key={i} className="min-w-0">
                                      <div className="text-[8px] text-[#9BAFC5]/70 truncate">{f.label}</div>
                                      <div className="text-[10px] text-[#F5F1E8] truncate" title={f.value}>{f.value}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : transcription ? (
                          <div className="mt-2 p-2 bg-[#09081A] rounded text-[10px] text-[#9BAFC5] leading-relaxed max-h-40 overflow-y-auto">
                            {transcription}
                          </div>
                        ) : ocr ? (
                          <div className="mt-2 p-2 bg-[#09081A] rounded text-[10px] text-[#9BAFC5] leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                            {typeof ocr === "string" ? ocr : JSON.stringify(ocr, null, 2)}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            </>)}

            </div>
            </div>
        </div>
      )}

      {/* Assistente do Ativo */}
      {assistantListing && (
        <AssetAssistant
          listingId={assistantListing.id}
          anonymousId={assistantListing.anonymous_id}
          onClose={() => setAssistantListing(null)}
        />
      )}
    </div>
  );
}
