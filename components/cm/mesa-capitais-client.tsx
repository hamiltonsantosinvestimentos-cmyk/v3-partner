"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart3, Users, Gavel, DollarSign, Play,
  Loader2, AlertTriangle, CheckCircle2, Clock,
  ArrowRight, RefreshCw, Shield, Bot, Upload, Mic,
  Link2, Copy, Plus, FileText, UserPlus, ClipboardCheck,
  ToggleLeft, ToggleRight, Save, Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AssetAssistant } from "./asset-assistant";
import { CM_DOCUMENT_CHECKLISTS, type CmAssetType } from "@/lib/cm-checklists";

interface Listing {
  id: string;
  anonymous_id: string;
  asset_type: string;
  valor_face: number;
  desagio_pretendido: number | null;
  listing_status: string;
  risk_score: number | null;
  created_at: string;
  cm_bids: { count: number }[];
  cm_listing_documents: { count: number }[];
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
];

function formatBRL(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
  return `R$ ${v.toLocaleString("pt-BR")}`;
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

export function MesaCapitaisClient({ userRole = "GESTAO" }: { userRole?: string }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningMatch, setRunningMatch] = useState(false);
  const [tab, setTab] = useState<"kanban" | "matches" | "bids">("kanban");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [assistantListing, setAssistantListing] = useState<{ id: string; anonymous_id: string } | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
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
  const [checklistsLoading, setChecklistsLoading] = useState(false);
  const [checklistTab, setChecklistTab] = useState<"pre_aceite" | "pre_fechamento" | "pos_cessao">("pre_fechamento");
  const [askPriceFloor, setAskPriceFloor] = useState<string>("");
  const [autoAcceptEnabled, setAutoAcceptEnabled] = useState(false);
  const [valorFaceNegociado, setValorFaceNegociado] = useState<string>("");
  const [valorAtualizadoNegociado, setValorAtualizadoNegociado] = useState<string>("");
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
      const formData = new FormData();
      formData.append("file", file);
      const isAudio = /\.(mp3|ogg|wav|m4a|webm)$/i.test(file.name);
      formData.append("document_type", isAudio ? "AUDIO" : "OUTRO");
      if (checklistItemId) formData.append("checklist_item_id", checklistItemId);
      const res = await fetch(`/api/cm/listings/${listingId}/documents`, { method: "POST", body: formData });
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
    setIntakeUrl(null);
    setDealRoomUrl(null);
    setRoomInvites([]);
    setContractResult(null);
    setAskPriceFloor((listing as any).ask_price_floor?.toString() ?? "");
    setAutoAcceptEnabled((listing as any).auto_accept_enabled ?? false);
    setValorFaceNegociado(listing.valor_face?.toString() ?? "");
    setValorAtualizadoNegociado((listing as any).valor_atualizado?.toString() ?? "");
    loadRoomInvites(listing.id);
    loadContractTemplates();
    loadChecklists(listing.id);
    loadDocs(listing.id);
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
        setIntakeUrl(json.url);
        if (!listingId) fetchAll();
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
          ask_price_floor: askPriceFloor ? Number(askPriceFloor) : null,
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
        : "Motivo da solicitação de exclusão (obrigatório — será enviado por email aos sócios):"
    );
    if (!reason || reason.trim().length < 5) {
      if (reason !== null) alert("Motivo obrigatório — mínimo 5 caracteres");
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
          alert("Ativo excluído — disponível na Lixeira por 30 dias.");
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
        alert(decision === "aprovado" ? "Qualificação aprovada — Tier 2 liberado" : "Qualificação reprovada");
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
            onClick={generateBuyLink} disabled={generatingBuyLink}
            className="flex items-center gap-2 px-4 py-2 border border-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/10 transition disabled:opacity-50"
          >
            {generatingBuyLink ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            Novo Comprador
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
              <div className="text-sm font-bold text-[#F5F1E8]">Lixeira — Ativos Excluídos (30 dias)</div>
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
                        <div className="text-[10px] text-[#9BAFC5]">{formatBRL(Number(item.valor_face))} · excluído por {item.profiles?.full_name ?? "—"}</div>
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
            key={t} onClick={() => setTab(t)}
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
        <div className="grid grid-cols-5 gap-3">
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
                      <div className="text-xs text-[#F5F1E8] font-semibold">{formatBRL(Number(l.valor_face))}</div>
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
                        <div className="text-[8px] text-[#C9A84C] font-bold uppercase mt-1 px-1.5 py-0.5 bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded inline-block">NDA Pendente</div>
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
                  <div className="text-xs font-bold text-[#C9A84C]">{m.cm_asset_listings?.anonymous_id ?? "—"}</div>
                  <div className="text-xs text-[#F5F1E8]">{formatBRL(Number(m.cm_asset_listings?.valor_face ?? 0))}</div>
                </div>
                <ArrowRight size={16} className="text-[#9BAFC5]" />
                <div>
                  <div className="text-xs font-bold text-[#F5F1E8]">{m.investor_demands?.nome_contato ?? "—"}</div>
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
                  <div className="text-[10px] text-[#C9A84C] font-bold">{(b.cm_asset_listings as any)?.anonymous_id ?? "—"}</div>
                  <div className="text-sm font-bold text-[#F5F1E8]">
                    Oferta: {formatBRL(Number(b.bid_value))}
                    {b.desagio_oferecido && <span className="text-[#9BAFC5] font-normal ml-2">({b.desagio_oferecido}% deságio)</span>}
                  </div>
                  <div className="text-[10px] text-[#9BAFC5] mt-1">
                    Pagamento: {b.payment_type === "a_vista" ? "À Vista" : b.payment_type === "parcelado" ? "Parcelado" : "Escrow"}
                    {b.notes && ` — ${b.notes}`}
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

      {/* Painel Lateral — Detalhe do Listing */}
      {selectedListing && (
        <div className="fixed inset-0 z-[110] flex justify-end bg-black/50" onClick={() => setSelectedListing(null)}>
          <div className="w-full max-w-md bg-[#09081A] border-l border-[#C9A84C]/20 h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-[#C9A84C]/20 flex items-center justify-between flex-shrink-0">
              <div>
                <div className="text-[10px] text-[#C9A84C] font-bold tracking-wider">{selectedListing.anonymous_id}</div>
                <div className="text-lg font-bold text-[#F5F1E8]">{formatBRL(Number(selectedListing.valor_face))}</div>
                <div className="text-xs text-[#9BAFC5] mt-1">Status: <span className="text-[#F5F1E8]">{selectedListing.listing_status.replace(/_/g, " ")}</span></div>
              </div>
              <button onClick={() => setSelectedListing(null)} className="w-8 h-8 flex items-center justify-center rounded-full text-[#9BAFC5] hover:text-[#F5F1E8] hover:bg-[#F5F1E8]/10 transition text-xl">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto">

            {/* KPIs do Ativo */}
            <div className="grid grid-cols-3 gap-2 p-4">
              <div className="bg-[#12112A] rounded-lg p-3 text-center">
                <div className={cn("text-lg font-bold", selectedListing.risk_score && selectedListing.risk_score >= 70 ? "text-emerald-400" : selectedListing.risk_score && selectedListing.risk_score >= 50 ? "text-[#C9A84C]" : "text-red-400")}>{selectedListing.risk_score ?? "—"}</div>
                <div className="text-[8px] text-[#9BAFC5] uppercase">Score</div>
              </div>
              <div className="bg-[#12112A] rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-[#C9A84C]">{selectedListing.desagio_pretendido ?? "—"}%</div>
                <div className="text-[8px] text-[#9BAFC5] uppercase">Deságio</div>
              </div>
              <div className="bg-[#12112A] rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-[#F5F1E8]">{(selectedListing.cm_bids?.[0] as any)?.count ?? 0}</div>
                <div className="text-[8px] text-[#9BAFC5] uppercase">Propostas</div>
              </div>
            </div>

            {/* Valores — OCR vs Negociado */}
            <div className="px-4 pb-4">
              <div className="text-[10px] text-[#C9A84C] font-bold uppercase tracking-wider mb-2">
                Valores — OCR vs Negociado
              </div>
              <div className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-3 space-y-3">
                {([
                  { key: "valor_face", label: "Valor de Face", value: valorFaceNegociado, setValue: setValorFaceNegociado },
                  { key: "valor_atualizado", label: "Valor Atualizado", value: valorAtualizadoNegociado, setValue: setValorAtualizadoNegociado },
                ] as const).map(({ key, label, value, setValue }) => {
                  const history: any[] = ((selectedListing as any).valores_ocr?.[key] ?? []).slice().reverse();
                  return (
                    <div key={key}>
                      <label className="text-[9px] text-[#9BAFC5] uppercase">{label} — Negociado (manual)</label>
                      <input
                        type="number" value={value} onChange={(e) => setValue(e.target.value)}
                        className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-3 py-2 text-xs text-[#F5F1E8] mt-1 focus:border-[#C9A84C]/50 focus:outline-none"
                      />
                      {history.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="text-[8px] text-[#9BAFC5]/70 uppercase tracking-wide">
                            {history.length > 1 ? `${history.length} extrações via OCR (divergência entre documentos)` : "Extraído via OCR"}
                          </div>
                          {history.map((h, i) => (
                            <div key={i} className="flex items-center justify-between gap-2 bg-[#09081A] rounded px-2 py-1.5">
                              <div className="min-w-0">
                                <div className="text-[11px] text-[#F5F1E8]">{formatBRL(Number(h.valor))}</div>
                                <div className="text-[8px] text-[#9BAFC5] truncate" title={h.documento}>{h.documento ?? "documento"} · {typeof h.confiabilidade === "number" ? `${h.confiabilidade}%` : "—"}</div>
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
                  Salvar Valores Negociados
                </button>
              </div>
            </div>

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
            </div>

            {/* NDA Retroativo — Autorização de Diretor */}
            <div className="px-4 mt-4">
              <div className="text-[10px] text-[#C9A84C] font-bold uppercase tracking-wider mb-2">NDA Retroativo (fora do sistema)</div>
              <div className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-3">
                {(selectedListing as any).nda_authorization_status === "pending_director" ? (
                  <div className="text-[11px] text-[#F5F1E8]">
                    <div className="text-[#C9A84C] font-bold mb-1">NDA marcado — aguardando autorização de diretor</div>
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
                      <p className="text-[9px] text-[#9BAFC5]">Exige autorização de João, Hamilton ou Robson — enviado por email aos diretores.</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Zona de Risco — Exclusão */}
            <div className="px-4 mt-4">
              <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider mb-2">Zona de Risco</div>
              <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                {(selectedListing as any).deletion_status === "pending_governance" ? (
                  <div className="text-[11px] text-[#F5F1E8]">
                    <div className="text-red-400 font-bold mb-1">Exclusão solicitada — aguardando aprovação</div>
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
                  <p className="text-[9px] text-[#9BAFC5] mt-2">Exige aprovação de João, Hamilton ou Robson — motivo é enviado por email aos sócios.</p>
                )}
              </div>
            </div>

            {/* Ask Price Floor + Auto-Aceite */}
            <div className="px-4 mt-4">
              <div className="text-[10px] text-[#C9A84C] font-bold uppercase tracking-wider mb-2">Order Book</div>
              <div className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-3 space-y-3">
                <div>
                  <label className="text-[9px] text-[#9BAFC5] uppercase">Ask Price Floor (R$)</label>
                  <input
                    type="number" value={askPriceFloor} onChange={(e) => setAskPriceFloor(e.target.value)}
                    placeholder="Ex: 1200000"
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

            {/* Documentos */}
            <div className="px-4 mt-4 pb-6">
              <div className="text-[10px] text-[#C9A84C] font-bold uppercase tracking-wider mb-2">Documentos ({listingDocs.length})</div>
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
