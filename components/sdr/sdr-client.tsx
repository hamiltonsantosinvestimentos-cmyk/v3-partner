"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { CampanhasClient } from "./campanhas-client";
import { CampanhasWhatsappClient } from "./campanhas-whatsapp-client";
import { SdrKanbanClient } from "./sdr-kanban-client";
import { SdrDashboardClient } from "./sdr-dashboard-client";
import { SdrLeadDetailPanel, PROSPECCAO_ETAPA_LABELS, tagClass, statusClass, type SdrLead } from "./sdr-lead-detail-panel";
import { QuickReplyOptionsEditor, DEFAULT_QUICK_REPLY_OPTIONS } from "./quick-reply-options-editor";
import type { QuickReplyOption } from "@/lib/whatsapp/quick-reply";

// ─── Types ──────────────────────────────────────────────────────────────────

type QrState = { qrcode: string | null; status: string };

type Conversa = {
  id: string;
  phone: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  quick_reply_options?: QuickReplyOption[] | null;
};

type Profile = { id: string; full_name: string; role: string };

// ─── Constants ───────────────────────────────────────────────────────────────

const QUICK_REPLY_MARKER = "Digite o número da opção:";

function initials(phone: string, nome: string | null) {
  if (nome) return nome.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
  const digits = phone.replace(/\D/g, "").slice(-4);
  return digits.slice(0, 2);
}

function formatTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return d.toLocaleDateString("pt-BR", { weekday: "short" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatDateSeparator(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

// Separa o texto normal do bloco de opções de resposta rápida (simulado por texto,
// já que o WhatsApp bloqueia botão nativo fora da API oficial da Meta) pra renderizar
// as opções como chips em vez de texto cru.
function splitQuickReplyContent(content: string): { text: string; options: string[] | null } {
  const idx = content.indexOf(QUICK_REPLY_MARKER);
  if (idx === -1) return { text: content, options: null };
  const before = content.slice(0, idx).trim();
  const block = content.slice(idx + QUICK_REPLY_MARKER.length).trim();
  const options = block.split("\n").map(l => l.trim()).filter(Boolean);
  return { text: before, options };
}

// ─── Component ──────────────────────────────────────────────────────────────

interface SdrClientProps {
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
}

type MainTab = "conversas" | "campanhas" | "envio-massa" | "kanban" | "dashboard";

export function SdrClient({ currentUserId, currentUserName, currentUserRole }: SdrClientProps) {
  const isAdminGestao = currentUserRole === "ADMIN" || currentUserRole === "GESTAO";
  const [qr, setQr] = useState<QrState>({ qrcode: null, status: "loading" });
  const [leads, setLeads] = useState<SdrLead[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [loadingConversas, setLoadingConversas] = useState(false);
  const [search, setSearch] = useState("");
  const [mainTab, setMainTab] = useState<MainTab>(isAdminGestao ? "conversas" : "kanban");
  const [showQr, setShowQr] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const [humanMsg, setHumanMsg] = useState("");
  const [sendingHuman, setSendingHuman] = useState(false);
  const [showQuickReplyEditor, setShowQuickReplyEditor] = useState(false);
  const [quickReplyDraft, setQuickReplyDraft] = useState<QuickReplyOption[]>(DEFAULT_QUICK_REPLY_OPTIONS);
  const [pendingQuickReply, setPendingQuickReply] = useState<QuickReplyOption[] | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedLead = leads.find(l => l.phone === selectedPhone) ?? null;

  // ── Fetch leads ────────────────────────────────────────────────────────────
  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch("/api/sdr/leads");
      const data = await res.json();
      setLeads(data.leads ?? []);
      setProfiles(data.profiles ?? []);
    } catch { /* ignore */ }
  }, []);

  // ── Fetch QR ──────────────────────────────────────────────────────────────
  const fetchQr = useCallback(async () => {
    try {
      const res = await fetch("/api/sdr/qrcode");
      const data = await res.json();
      setQr(data);
    } catch {
      setQr({ qrcode: null, status: "error" });
    }
  }, []);

  // ── Fetch conversas para phone selecionado ────────────────────────────────
  const fetchConversas = useCallback(async (phone: string) => {
    setLoadingConversas(true);
    try {
      const res = await fetch(`/api/sdr/conversas?phone=${encodeURIComponent(phone)}`);
      const data = await res.json();
      setConversas(data.conversas ?? []);
    } catch {
      setConversas([]);
    } finally {
      setLoadingConversas(false);
    }
  }, []);

  // ── Efeitos ────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Conversas/QR/Envio em massa são exclusivos de ADMIN/GESTAO — SDR/CLOSER só usam Kanban/Dashboard
    if (!isAdminGestao) return;
    fetchLeads();
    fetchQr();
    const qrInterval = setInterval(fetchQr, 10000);
    const leadsInterval = setInterval(fetchLeads, 30000);
    return () => { clearInterval(qrInterval); clearInterval(leadsInterval); };
  }, [fetchLeads, fetchQr, isAdminGestao]);

  useEffect(() => {
    if (selectedPhone) fetchConversas(selectedPhone);
  }, [selectedPhone, fetchConversas]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversas]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelectPhone = (phone: string) => {
    setSelectedPhone(phone);
    setShowQuickReplyEditor(false);
    setPendingQuickReply(null);
  };

  const patchLead = useCallback(async (patch: Partial<SdrLead> & { phone: string }) => {
    setSavingLead(true);
    try {
      await fetch("/api/sdr/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      await fetchLeads();
    } finally {
      setSavingLead(false);
    }
  }, [fetchLeads]);

  const handleAssignSelf = () => {
    if (!selectedLead) return;
    patchLead({ phone: selectedLead.phone, responsavel_id: currentUserId });
  };

  const handleToggleHumano = () => {
    if (!selectedLead) return;
    const next = !selectedLead.humano_ativo;
    patchLead({ phone: selectedLead.phone, humano_ativo: next });
    // Se assumindo, atribui automaticamente ao usuário atual se sem responsável
    if (next && !selectedLead.responsavel_id) {
      patchLead({ phone: selectedLead.phone, humano_ativo: next, responsavel_id: currentUserId });
    }
  };

  const handleSendHuman = async () => {
    if (!selectedLead || !humanMsg.trim()) return;
    setSendingHuman(true);
    try {
      const res = await fetch("/api/sdr/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: selectedLead.phone,
          text: humanMsg.trim(),
          quickReplyOptions: pendingQuickReply ?? undefined,
        }),
      });
      if (res.ok) {
        setHumanMsg("");
        setPendingQuickReply(null);
        await fetchConversas(selectedLead.phone);
      } else {
        const json = await res.json();
        alert(json.error ?? "Erro ao enviar mensagem");
      }
    } finally {
      setSendingHuman(false);
    }
  };

  function attachQuickReply() {
    const validas = quickReplyDraft.map(o => ({ ...o, label: o.label.trim() })).filter(o => o.label);
    if (validas.length === 0) return;
    setPendingQuickReply(validas);
    setShowQuickReplyEditor(false);
  }

  // ── QR status ─────────────────────────────────────────────────────────────
  const statusColor = ({
    connected: "#4ade80", pending: "#C9A84C", disconnected: "#f87171",
    error: "#f87171", loading: "#7A8FA8",
  } as Record<string, string>)[qr.status] ?? "#7A8FA8";

  const statusLabel = ({
    connected: "Conectado", pending: "Aguardando scan", disconnected: "Desconectado",
    error: "Erro", loading: "Verificando...",
  } as Record<string, string>)[qr.status] ?? qr.status;

  // ── Message date separators ────────────────────────────────────────────────
  function buildMessageGroups() {
    const groups: { date: string; messages: Conversa[] }[] = [];
    let currentDate = "";
    for (const c of conversas) {
      const d = new Date(c.created_at).toDateString();
      if (d !== currentDate) {
        currentDate = d;
        groups.push({ date: formatDateSeparator(c.created_at), messages: [] });
      }
      groups[groups.length - 1].messages.push(c);
    }
    return groups;
  }

  const filteredLeads = leads.filter(l =>
    l.phone.includes(search) ||
    (l.nome?.toLowerCase().includes(search.toLowerCase()))
  );

  const TABS: { key: MainTab; label: string }[] = [
    ...(isAdminGestao ? ([
      { key: "conversas", label: "💬 WhatsApp" },
      { key: "envio-massa", label: "📤 Envio em Massa" },
      { key: "campanhas", label: "📧 Campanhas" },
    ] as { key: MainTab; label: string }[]) : []),
    { key: "kanban", label: "🗂️ Kanban" },
    { key: "dashboard", label: "📊 Dashboard" },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 bg-[#09081A] border-b border-[#243A66] shrink-0">
        <div>
          <p className="text-[#C9A84C] text-[10px] font-bold tracking-[2px] uppercase">AGENTE SDR</p>
          <h1 className="text-[#F0ECE4] text-xl font-bold leading-tight">CRM do WhatsApp</h1>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-[#0D1929] border border-[#243A66] rounded-xl p-1 w-fit">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setMainTab(t.key)}
              className={mainTab === t.key
                ? "bg-[#C9A84C] text-[#09081A] px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap"
                : "text-[#7A8FA8] hover:text-[#F0ECE4] px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap"}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {isAdminGestao && (
            <div
              onClick={() => setShowQr(!showQr)}
              className="flex items-center gap-1.5 bg-[#162744] border border-[#243A66] rounded-full px-3.5 py-1.5 cursor-pointer"
            >
              <div className="w-2 h-2 rounded-full" style={{ background: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />
              <span className="text-[#F0ECE4] text-xs font-semibold">{statusLabel}</span>
            </div>
          )}
          {isAdminGestao && (
            <div className="text-[#7A8FA8] text-xs">
              {leads.length} lead{leads.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>

      {/* ── QR Panel (dropdown) ─────────────────────────────────────────────── */}
      {isAdminGestao && showQr && (
        <div className="absolute z-[100] bg-[#162744] border border-[#243A66] rounded-2xl p-5 w-[300px] shadow-2xl" style={{ top: 120, right: 24 }}>
          {qr.status === "connected" ? (
            <div className="text-center">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-emerald-400 font-semibold">WhatsApp Conectado!</p>
              <p className="text-[#7A8FA8] text-xs mt-1">Agente SDR ativo e respondendo leads.</p>
            </div>
          ) : qr.qrcode ? (
            <div className="text-center">
              <p className="text-[#7A8FA8] text-xs mb-3">Escaneie com seu WhatsApp Business</p>
              <div className="bg-white rounded-lg p-2 inline-block">
                <Image
                  src={qr.qrcode.startsWith("data:") ? qr.qrcode : `data:image/png;base64,${qr.qrcode}`}
                  alt="QR Code WhatsApp"
                  width={200} height={200}
                  className="block"
                />
              </div>
              <p className="text-[#7A8FA8] text-[11px] mt-2">Expira em 60 segundos</p>
            </div>
          ) : (
            <div className="text-center text-[#7A8FA8] text-sm py-4">
              {qr.status === "loading" ? "Verificando conexão..." : "Nenhum QR disponível"}
            </div>
          )}
          <button
            onClick={fetchQr}
            className="mt-3 w-full py-2 bg-[#243A66] border border-[#C9A84C] rounded-lg text-[#C9A84C] font-semibold text-sm"
          >
            Atualizar
          </button>
        </div>
      )}

      {/* ── Campanhas tab (e-mail) ────────────────────────────────────────────── */}
      {mainTab === "campanhas" && (
        <div className="flex-1 overflow-y-auto bg-[#0D1B2E]">
          <CampanhasClient />
        </div>
      )}

      {/* ── Envio em Massa tab ────────────────────────────────────────────────── */}
      {mainTab === "envio-massa" && (
        <div className="flex-1 overflow-hidden bg-[#0D1B2E]">
          <CampanhasWhatsappClient />
        </div>
      )}

      {/* ── Kanban tab ────────────────────────────────────────────────────────── */}
      {mainTab === "kanban" && (
        <div className="flex-1 overflow-hidden bg-[#0D1B2E]">
          <SdrKanbanClient />
        </div>
      )}

      {/* ── Dashboard tab ─────────────────────────────────────────────────────── */}
      {mainTab === "dashboard" && (
        <div className="flex-1 overflow-hidden bg-[#0D1B2E]">
          <SdrDashboardClient userName={currentUserName} role={currentUserRole} />
        </div>
      )}

      {/* ── Main WhatsApp layout (3 colunas: leads | chat | detalhes) ────────── */}
      <div className={isAdminGestao && mainTab === "conversas" ? "flex flex-1 overflow-hidden" : "hidden"}>

        {/* ── Coluna 1: lista de leads ──────────────────────────────────────── */}
        <div className="w-80 shrink-0 bg-[#111F35] border-r border-[#243A66] flex flex-col overflow-hidden">
          <div className="px-3 pt-3 pb-2">
            <div className="flex items-center gap-2 bg-[#162744] border border-[#243A66] rounded-lg px-3 py-2">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#7A8FA8" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Buscar contato..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent border-none outline-none text-[#F0ECE4] text-sm flex-1"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredLeads.length === 0 ? (
              <div className="text-[#7A8FA8] text-center py-8 text-sm">Nenhuma conversa ainda</div>
            ) : (
              filteredLeads.map(lead => {
                const isSelected = lead.phone === selectedPhone;
                const sb = statusClass(lead.status);
                const pe = lead.prospeccao_etapa ? PROSPECCAO_ETAPA_LABELS[lead.prospeccao_etapa] : null;
                return (
                  <div
                    key={lead.phone}
                    onClick={() => handleSelectPhone(lead.phone)}
                    className={`flex gap-2.5 px-3.5 py-3 cursor-pointer border-b border-[#162744] transition-colors ${isSelected ? "bg-[#162744] border-l-[3px] border-l-[#C9A84C]" : "border-l-[3px] border-l-transparent hover:bg-[#162744]/50"}`}
                  >
                    <div className={`w-11 h-11 rounded-full shrink-0 flex items-center justify-center font-bold text-sm border-2 ${isSelected ? "bg-[#C9A84C]/20 border-[#C9A84C] text-[#C9A84C]" : "bg-[#243A66] border-[#243A66] text-[#F0ECE4]"}`}>
                      {initials(lead.phone, lead.nome)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <span className="text-[#F0ECE4] font-semibold text-[13px] truncate max-w-[150px]">
                          {lead.nome ?? lead.phone}
                        </span>
                        <span className="text-[#7A8FA8] text-[11px] shrink-0">{formatTime(lead.last_message_at)}</span>
                      </div>
                      {lead.nome && <div className="text-[#7A8FA8] text-[11px] mb-0.5">{lead.phone}</div>}
                      <div className="text-[#7A8FA8] text-xs truncate">{lead.last_message_preview ?? "Sem mensagens"}</div>
                      <div className="flex gap-1 mt-1 flex-wrap items-center">
                        {lead.humano_ativo && (
                          <span className="text-[9px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/30">
                            👤 Humano
                          </span>
                        )}
                        {lead.status !== "ativo" && (
                          <span className={`text-[9px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded border ${sb.bg} ${sb.text} ${sb.border}`}>
                            {sb.label}
                          </span>
                        )}
                        {pe && (
                          <span title="Etapa vinculada na Prospecção de Partners" className={`text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded border ${pe.bg} ${pe.text} ${pe.border}`}>
                            ↗ {pe.label}
                          </span>
                        )}
                        {(lead.tags ?? []).slice(0, 2).map(tag => (
                          <span key={tag} className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${tagClass(tag)}`}>
                            {tag}
                          </span>
                        ))}
                        {(lead.tags ?? []).length > 2 && (
                          <span className="text-[10px] text-[#7A8FA8]">+{lead.tags.length - 2}</span>
                        )}
                      </div>
                      {lead.responsavel_nome && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[#7A8FA8] text-[10px]">👤 {lead.responsavel_nome}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="px-4 py-2.5 border-t border-[#243A66] bg-[#09081A] flex gap-4">
            <div className="text-center">
              <div className="text-[#F0ECE4] font-bold text-base">{leads.length}</div>
              <div className="text-[#7A8FA8] text-[10px]">Leads</div>
            </div>
            <div className="text-center">
              <div className="text-[#F0ECE4] font-bold text-base">
                {leads.filter(l => l.status === "qualificado" || l.status === "agendado" || l.status === "convertido").length}
              </div>
              <div className="text-[#7A8FA8] text-[10px]">Qualificados</div>
            </div>
            <div className="text-center">
              <div className="text-[#F0ECE4] font-bold text-base">{leads.filter(l => l.status === "agendado").length}</div>
              <div className="text-[#7A8FA8] text-[10px]">Agendados</div>
            </div>
          </div>
        </div>

        {/* ── Coluna 2 + 3: chat e detalhes do lead ────────────────────────── */}
        {selectedLead ? (
          <>
            <div className="flex-1 flex flex-col overflow-hidden bg-[#0D1B2E]">

              {/* Chat header (enxuto — detalhes completos ficam na coluna 3) */}
              <div className="flex items-center gap-3 px-5 py-3 bg-[#111F35] border-b border-[#243A66] shrink-0">
                <div className="w-10 h-10 rounded-full shrink-0 bg-[#C9A84C]/20 border-2 border-[#C9A84C] flex items-center justify-center text-[#C9A84C] font-bold text-sm">
                  {initials(selectedLead.phone, selectedLead.nome)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#F0ECE4] font-bold text-[15px] truncate">{selectedLead.nome ?? selectedLead.phone}</p>
                  <p className="text-[#7A8FA8] text-xs">{selectedLead.phone}</p>
                </div>
                {!selectedLead.responsavel_id && (
                  <button
                    onClick={handleAssignSelf}
                    title={`Atribuir a ${currentUserName}`}
                    className="text-xs font-semibold text-[#C9A84C] bg-[#C9A84C]/10 border border-[#C9A84C] rounded-md px-2.5 py-1.5 whitespace-nowrap"
                  >
                    Atribuir a mim
                  </button>
                )}
              </div>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-0.5">
                {loadingConversas ? (
                  <div className="text-[#7A8FA8] text-center py-10">Carregando mensagens...</div>
                ) : conversas.length === 0 ? (
                  <div className="text-[#7A8FA8] text-center py-10">Nenhuma mensagem</div>
                ) : (
                  buildMessageGroups().map(group => (
                    <div key={group.date}>
                      <div className="flex items-center gap-3 my-3">
                        <div className="flex-1 h-px bg-[#243A66]" />
                        <span className="text-[#7A8FA8] text-[11px] font-semibold bg-[#162744] border border-[#243A66] rounded-full px-2.5 py-0.5">
                          {group.date}
                        </span>
                        <div className="flex-1 h-px bg-[#243A66]" />
                      </div>

                      {group.messages.map((c, idx) => {
                        const isUser = c.role === "user";
                        const prev = idx > 0 ? group.messages[idx - 1] : null;
                        const sameRole = prev?.role === c.role;
                        const { text, options } = splitQuickReplyContent(c.content);
                        return (
                          <div key={c.id} className={`flex ${isUser ? "justify-start" : "justify-end"}`} style={{ marginBottom: sameRole ? 2 : 8 }}>
                            <div
                              className={`max-w-[72%] px-3 py-2 border ${isUser ? "bg-[#162744] border-[#243A66]" : "bg-[#1A3A28] border-[#2A5A3A]"}`}
                              style={{
                                borderRadius: isUser
                                  ? `${sameRole ? 4 : 14}px 14px 14px 4px`
                                  : `14px ${sameRole ? 4 : 14}px 4px 14px`,
                              }}
                            >
                              {!sameRole && (
                                <div className={`text-[11px] font-bold mb-1 ${isUser ? "text-[#C9A84C]" : "text-emerald-400"}`}>
                                  {isUser ? (selectedLead.nome ?? c.phone) : "Agente SDR (Matheus)"}
                                </div>
                              )}
                              {text && <div className="text-[#F0ECE4] text-[13px] leading-[1.55] whitespace-pre-wrap">{text}</div>}
                              {options && (
                                <div className="mt-2 flex flex-col gap-1.5">
                                  {options.map(opt => (
                                    <div key={opt} className="text-xs font-semibold text-center px-3 py-1.5 rounded-lg bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-[#C9A84C]">
                                      {opt}
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="text-[#7A8FA8] text-[10px] mt-1 text-right">
                                {new Date(c.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Footer */}
              <div className="bg-[#111F35] border-t border-[#243A66] shrink-0">
                {selectedLead.humano_ativo && (
                  <div className="px-4 py-2.5 border-b border-[#243A66] space-y-2">
                    {pendingQuickReply && (
                      <div className="flex items-center gap-2 flex-wrap bg-[#0A1628] border border-[#C9A84C]/30 rounded-lg px-2.5 py-1.5">
                        <span className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wide">Opções anexadas:</span>
                        {pendingQuickReply.map(o => (
                          <span key={o.key} className="text-[11px] text-[#F0ECE4]">{o.key}. {o.label}</span>
                        ))}
                        <button onClick={() => setPendingQuickReply(null)} className="text-[#7A8FA8] hover:text-red-400 text-xs ml-auto">✕</button>
                      </div>
                    )}
                    {showQuickReplyEditor && (
                      <div className="bg-[#0A1628] border border-[#243A66] rounded-lg p-2.5 space-y-2">
                        <QuickReplyOptionsEditor options={quickReplyDraft} onChange={setQuickReplyDraft} />
                        <div className="flex gap-2">
                          <button onClick={attachQuickReply} className="text-[11px] font-semibold bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-[#C9A84C] rounded-md px-2.5 py-1">
                            Anexar
                          </button>
                          <button onClick={() => setShowQuickReplyEditor(false)} className="text-[11px] text-[#7A8FA8] px-2.5 py-1">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowQuickReplyEditor(!showQuickReplyEditor)}
                        title="Anexar opções de resposta rápida"
                        className="shrink-0 px-2.5 rounded-lg border border-[#243A66] text-[#7A8FA8] hover:text-[#C9A84C] hover:border-[#C9A84C]/40 transition-colors text-xs"
                      >
                        + Opções
                      </button>
                      <input
                        value={humanMsg}
                        onChange={e => setHumanMsg(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendHuman(); } }}
                        placeholder="Digite uma mensagem como operador..."
                        disabled={sendingHuman}
                        className="flex-1 bg-[#162744] border border-[#243A66] rounded-lg px-3.5 py-2 text-[#F0ECE4] text-[13px] outline-none"
                      />
                      <button
                        onClick={handleSendHuman}
                        disabled={sendingHuman || !humanMsg.trim()}
                        className={`rounded-lg px-4 py-2 font-bold text-[13px] ${sendingHuman || !humanMsg.trim() ? "bg-[#243A66] text-[#7A8FA8]" : "bg-[#C9A84C] text-[#09081A]"}`}
                      >
                        {sendingHuman ? "..." : "Enviar"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="px-5 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {selectedLead.humano_ativo ? (
                      <>
                        <div className="w-2 h-2 rounded-full bg-[#C9A84C]" style={{ boxShadow: "0 0 6px #C9A84C" }} />
                        <span className="text-[#C9A84C] text-xs font-semibold">Atendimento humano ativo · IA pausada</span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 rounded-full bg-emerald-400" style={{ boxShadow: "0 0 6px #4ade80" }} />
                        <span className="text-[#7A8FA8] text-xs">Agente SDR (Matheus) respondendo automaticamente</span>
                      </>
                    )}
                  </div>
                  <button
                    onClick={handleToggleHumano}
                    disabled={savingLead}
                    className={`rounded-lg px-3.5 py-1.5 text-xs font-bold whitespace-nowrap border ${selectedLead.humano_ativo ? "bg-emerald-400/10 border-emerald-400 text-emerald-400" : "bg-[#C9A84C]/10 border-[#C9A84C] text-[#C9A84C]"}`}
                  >
                    {selectedLead.humano_ativo ? "↩ Devolver para IA" : "👤 Assumir Atendimento"}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Coluna 3: detalhes do lead ─────────────────────────────────── */}
            <SdrLeadDetailPanel
              key={selectedLead.phone}
              lead={selectedLead}
              profiles={profiles}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              savingLead={savingLead}
              onPatch={patchLead}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-[#0D1B2E]">
            <div className="w-20 h-20 rounded-full bg-[#C9A84C]/[0.08] border-2 border-[#C9A84C]/30 flex items-center justify-center text-4xl">
              💬
            </div>
            <div className="text-center">
              <p className="text-[#F0ECE4] text-lg font-bold">Selecione uma conversa</p>
              <p className="text-[#7A8FA8] text-sm mt-1.5">Escolha um lead no painel esquerdo para visualizar as mensagens</p>
            </div>
            <div className="flex gap-8 mt-2">
              <div className="text-center">
                <div className="text-[#C9A84C] text-2xl font-extrabold">{leads.length}</div>
                <div className="text-[#7A8FA8] text-xs">Leads totais</div>
              </div>
              <div className="text-center">
                <div className="text-emerald-400 text-2xl font-extrabold">{leads.reduce((a, l) => a + l.message_count, 0)}</div>
                <div className="text-[#7A8FA8] text-xs">Mensagens</div>
              </div>
              <div className="text-center">
                <div className="text-[#C9A84C] text-2xl font-extrabold">
                  {leads.filter(l => l.status === "agendado" || l.status === "convertido").length}
                </div>
                <div className="text-[#7A8FA8] text-xs">Convertidos</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
