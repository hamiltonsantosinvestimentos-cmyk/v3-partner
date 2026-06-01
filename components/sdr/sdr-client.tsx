"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";

// ─── Types ──────────────────────────────────────────────────────────────────

type QrState = { qrcode: string | null; status: string };

type Conversa = {
  id: string;
  phone: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type SdrLead = {
  phone: string;
  nome: string | null;
  tags: string[];
  responsavel_id: string | null;
  responsavel_nome: string | null;
  status: string;
  humano_ativo: boolean;
  last_message_at: string | null;
  last_message_preview: string | null;
  message_count: number;
};

type Profile = { id: string; full_name: string; role: string };

// ─── Constants ───────────────────────────────────────────────────────────────

const PRESET_TAGS = ["Hot Lead", "Qualificado", "Partner", "Investidor", "Agendado", "Em Negociação", "Sem Interesse", "Aguardando"];

const STATUS_OPTIONS = [
  { value: "ativo", label: "Ativo" },
  { value: "qualificado", label: "Qualificado" },
  { value: "agendado", label: "Agendado" },
  { value: "convertido", label: "Convertido" },
  { value: "sem_interesse", label: "Sem Interesse" },
  { value: "arquivado", label: "Arquivado" },
];

function tagColor(tag: string): { bg: string; border: string; color: string } {
  if (["Hot Lead", "Agendado"].includes(tag))
    return { bg: "#C9A84C20", border: "#C9A84C", color: "#C9A84C" };
  if (["Qualificado", "Partner", "Investidor", "Em Negociação"].includes(tag))
    return { bg: "#243A66", border: "#243A66", color: "#F0ECE4" };
  return { bg: "#111F35", border: "#243A66", color: "#7A8FA8" };
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    ativo:          { label: "Ativo",        color: "#4ade80", bg: "#4ade8015" },
    qualificado:    { label: "Qualificado",  color: "#C9A84C", bg: "#C9A84C15" },
    agendado:       { label: "Agendado",     color: "#60a5fa", bg: "#60a5fa15" },
    convertido:     { label: "Convertido",   color: "#4ade80", bg: "#4ade8030" },
    sem_interesse:  { label: "Sem Interesse",color: "#7A8FA8", bg: "#243A66" },
    arquivado:      { label: "Arquivado",    color: "#7A8FA8", bg: "#111F35" },
  };
  return map[status] ?? map.ativo;
}

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

// ─── Component ──────────────────────────────────────────────────────────────

interface SdrClientProps {
  currentUserId: string;
  currentUserName: string;
}

export function SdrClient({ currentUserId, currentUserName }: SdrClientProps) {
  const [qr, setQr] = useState<QrState>({ qrcode: null, status: "loading" });
  const [leads, setLeads] = useState<SdrLead[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [loadingConversas, setLoadingConversas] = useState(false);
  const [search, setSearch] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [editTag, setEditTag] = useState(false);
  const [savingLead, setSavingLead] = useState(false);
  const [editNome, setEditNome] = useState(false);
  const [nomeInput, setNomeInput] = useState("");
  const [humanMsg, setHumanMsg] = useState("");
  const [sendingHuman, setSendingHuman] = useState(false);
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
    fetchLeads();
    fetchQr();
    const qrInterval = setInterval(fetchQr, 10000);
    const leadsInterval = setInterval(fetchLeads, 30000);
    return () => { clearInterval(qrInterval); clearInterval(leadsInterval); };
  }, [fetchLeads, fetchQr]);

  useEffect(() => {
    if (selectedPhone) fetchConversas(selectedPhone);
  }, [selectedPhone, fetchConversas]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversas]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelectPhone = (phone: string) => {
    setSelectedPhone(phone);
    setEditTag(false);
    setEditNome(false);
    const lead = leads.find(l => l.phone === phone);
    setNomeInput(lead?.nome ?? "");
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

  const toggleTag = (tag: string) => {
    if (!selectedLead) return;
    const current = selectedLead.tags ?? [];
    const next = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag];
    patchLead({ phone: selectedLead.phone, tags: next });
  };

  const handleResponsavel = (responsavel_id: string) => {
    if (!selectedLead) return;
    patchLead({ phone: selectedLead.phone, responsavel_id });
  };

  const handleStatus = (status: string) => {
    if (!selectedLead) return;
    patchLead({ phone: selectedLead.phone, status });
  };

  const handleSaveNome = () => {
    if (!selectedLead) return;
    patchLead({ phone: selectedLead.phone, nome: nomeInput.trim() || null as unknown as string });
    setEditNome(false);
  };

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
        body: JSON.stringify({ phone: selectedLead.phone, text: humanMsg.trim() }),
      });
      if (res.ok) {
        setHumanMsg("");
        await fetchConversas(selectedLead.phone);
      } else {
        const json = await res.json();
        alert(json.error ?? "Erro ao enviar mensagem");
      }
    } finally {
      setSendingHuman(false);
    }
  };

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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)", overflow: "hidden" }}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 24px",
        background: "#09081A",
        borderBottom: "1px solid #243A66",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div>
            <p style={{ color: "#C9A84C", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", margin: 0 }}>
              AGENTE SDR
            </p>
            <h1 style={{ color: "#F0ECE4", fontSize: 20, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
              WhatsApp SDR
            </h1>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Connection badge */}
          <div
            onClick={() => setShowQr(!showQr)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#162744", border: "1px solid #243A66",
              borderRadius: 20, padding: "6px 14px",
              cursor: "pointer",
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />
            <span style={{ color: "#F0ECE4", fontSize: 12, fontWeight: 600 }}>{statusLabel}</span>
          </div>
          <div style={{ color: "#7A8FA8", fontSize: 12 }}>
            {leads.length} lead{leads.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* ── QR Panel (dropdown) ─────────────────────────────────────────────── */}
      {showQr && (
        <div style={{
          position: "absolute", top: 120, right: 24, zIndex: 100,
          background: "#162744", border: "1px solid #243A66",
          borderRadius: 16, padding: 20, width: 300,
          boxShadow: "0 8px 32px #09081A88",
        }}>
          {qr.status === "connected" ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
              <p style={{ color: "#4ade80", fontWeight: 600, margin: 0 }}>WhatsApp Conectado!</p>
              <p style={{ color: "#7A8FA8", fontSize: 12, marginTop: 4 }}>
                Agente SDR ativo e respondendo leads.
              </p>
            </div>
          ) : qr.qrcode ? (
            <div style={{ textAlign: "center" }}>
              <p style={{ color: "#7A8FA8", fontSize: 12, marginBottom: 12 }}>
                Escaneie com seu WhatsApp Business
              </p>
              <div style={{ background: "#fff", borderRadius: 8, padding: 8, display: "inline-block" }}>
                <Image
                  src={qr.qrcode.startsWith("data:") ? qr.qrcode : `data:image/png;base64,${qr.qrcode}`}
                  alt="QR Code WhatsApp"
                  width={200} height={200}
                  style={{ display: "block" }}
                />
              </div>
              <p style={{ color: "#7A8FA8", fontSize: 11, marginTop: 8 }}>Expira em 60 segundos</p>
            </div>
          ) : (
            <div style={{ textAlign: "center", color: "#7A8FA8", fontSize: 13, padding: 16 }}>
              {qr.status === "loading" ? "Verificando conexão..." : "Nenhum QR disponível"}
            </div>
          )}
          <button
            onClick={fetchQr}
            style={{
              marginTop: 12, width: "100%", padding: "8px",
              background: "#243A66", border: "1px solid #C9A84C",
              borderRadius: 8, color: "#C9A84C", fontWeight: 600, fontSize: 13, cursor: "pointer",
            }}
          >
            Atualizar
          </button>
        </div>
      )}

      {/* ── Main WhatsApp layout ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── Left panel: lista de conversas ───────────────────────────────── */}
        <div style={{
          width: 320, flexShrink: 0,
          background: "#111F35",
          borderRight: "1px solid #243A66",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Search */}
          <div style={{ padding: "12px 12px 8px" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "#162744", border: "1px solid #243A66",
              borderRadius: 10, padding: "8px 12px",
            }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#7A8FA8" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Buscar contato..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  background: "transparent", border: "none", outline: "none",
                  color: "#F0ECE4", fontSize: 13, flex: 1,
                }}
              />
            </div>
          </div>

          {/* Lead list */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {filteredLeads.length === 0 ? (
              <div style={{ color: "#7A8FA8", textAlign: "center", padding: 32, fontSize: 13 }}>
                Nenhuma conversa ainda
              </div>
            ) : (
              filteredLeads.map(lead => {
                const isSelected = lead.phone === selectedPhone;
                const sb = statusBadge(lead.status);
                return (
                  <div
                    key={lead.phone}
                    onClick={() => handleSelectPhone(lead.phone)}
                    style={{
                      display: "flex", gap: 10, padding: "12px 14px",
                      background: isSelected ? "#162744" : "transparent",
                      borderLeft: isSelected ? "3px solid #C9A84C" : "3px solid transparent",
                      cursor: "pointer",
                      transition: "background 0.15s",
                      borderBottom: "1px solid #162744",
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                      background: isSelected ? "#C9A84C20" : "#243A66",
                      border: `2px solid ${isSelected ? "#C9A84C" : "#243A66"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: isSelected ? "#C9A84C" : "#F0ECE4",
                      fontWeight: 700, fontSize: 14,
                    }}>
                      {initials(lead.phone, lead.nome)}
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
                        <span style={{
                          color: "#F0ECE4", fontWeight: 600, fontSize: 13,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          maxWidth: 150,
                        }}>
                          {lead.nome ?? lead.phone}
                        </span>
                        <span style={{ color: "#7A8FA8", fontSize: 11, flexShrink: 0 }}>
                          {formatTime(lead.last_message_at)}
                        </span>
                      </div>
                      {lead.nome && (
                        <div style={{ color: "#7A8FA8", fontSize: 11, marginBottom: 2 }}>{lead.phone}</div>
                      )}
                      <div style={{ color: "#7A8FA8", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {lead.last_message_preview ?? "Sem mensagens"}
                      </div>
                      {/* Tags + status */}
                      <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                        {lead.humano_ativo && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
                            padding: "2px 6px", borderRadius: 4,
                            background: "#C9A84C20", color: "#C9A84C", border: "1px solid #C9A84C40",
                            textTransform: "uppercase",
                          }}>
                            👤 Humano
                          </span>
                        )}
                        {lead.status !== "ativo" && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
                            padding: "2px 6px", borderRadius: 4,
                            background: sb.bg, color: sb.color, border: `1px solid ${sb.color}30`,
                            textTransform: "uppercase",
                          }}>
                            {sb.label}
                          </span>
                        )}
                        {(lead.tags ?? []).slice(0, 2).map(tag => {
                          const tc = tagColor(tag);
                          return (
                            <span key={tag} style={{
                              fontSize: 9, fontWeight: 700, letterSpacing: 0.3,
                              padding: "2px 6px", borderRadius: 4,
                              background: tc.bg, color: tc.color,
                              border: `1px solid ${tc.border}50`,
                            }}>
                              {tag}
                            </span>
                          );
                        })}
                        {(lead.tags ?? []).length > 2 && (
                          <span style={{ fontSize: 10, color: "#7A8FA8" }}>+{lead.tags.length - 2}</span>
                        )}
                      </div>
                      {/* Responsável */}
                      {lead.responsavel_nome && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                          <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#243A66", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="8" height="8" fill="#7A8FA8" viewBox="0 0 24 24">
                              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                            </svg>
                          </div>
                          <span style={{ color: "#7A8FA8", fontSize: 10 }}>{lead.responsavel_nome}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Stats footer */}
          <div style={{
            padding: "10px 16px",
            borderTop: "1px solid #243A66",
            background: "#09081A",
            display: "flex", gap: 16,
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: "#F0ECE4", fontWeight: 700, fontSize: 16 }}>{leads.length}</div>
              <div style={{ color: "#7A8FA8", fontSize: 10 }}>Leads</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: "#F0ECE4", fontWeight: 700, fontSize: 16 }}>
                {leads.filter(l => l.status === "qualificado" || l.status === "agendado" || l.status === "convertido").length}
              </div>
              <div style={{ color: "#7A8FA8", fontSize: 10 }}>Qualificados</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: "#F0ECE4", fontWeight: 700, fontSize: 16 }}>
                {leads.filter(l => l.status === "agendado").length}
              </div>
              <div style={{ color: "#7A8FA8", fontSize: 10 }}>Agendados</div>
            </div>
          </div>
        </div>

        {/* ── Right panel: chat ────────────────────────────────────────────── */}
        {selectedLead ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#0D1B2E" }}>

            {/* Chat header */}
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              padding: "12px 20px",
              background: "#111F35",
              borderBottom: "1px solid #243A66",
              flexShrink: 0,
            }}>
              {/* Avatar */}
              <div style={{
                width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
                background: "#C9A84C20", border: "2px solid #C9A84C",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#C9A84C", fontWeight: 700, fontSize: 15,
              }}>
                {initials(selectedLead.phone, selectedLead.nome)}
              </div>

              {/* Name + phone + tags */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  {editNome ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        autoFocus
                        value={nomeInput}
                        onChange={e => setNomeInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleSaveNome(); if (e.key === "Escape") setEditNome(false); }}
                        placeholder="Nome do contato..."
                        style={{
                          background: "#162744", border: "1px solid #C9A84C", borderRadius: 6,
                          padding: "2px 8px", color: "#F0ECE4", fontSize: 14, outline: "none",
                        }}
                      />
                      <button onClick={handleSaveNome} style={{ background: "#C9A84C", border: "none", borderRadius: 6, padding: "2px 10px", color: "#09081A", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                        ✓
                      </button>
                      <button onClick={() => setEditNome(false)} style={{ background: "#243A66", border: "none", borderRadius: 6, padding: "2px 8px", color: "#7A8FA8", cursor: "pointer" }}>
                        ✕
                      </button>
                    </div>
                  ) : (
                    <span
                      onClick={() => { setEditNome(true); setNomeInput(selectedLead.nome ?? ""); }}
                      style={{ color: "#F0ECE4", fontWeight: 700, fontSize: 15, cursor: "pointer" }}
                      title="Clique para editar nome"
                    >
                      {selectedLead.nome ?? selectedLead.phone}
                    </span>
                  )}
                  {selectedLead.nome && (
                    <span style={{ color: "#7A8FA8", fontSize: 12 }}>{selectedLead.phone}</span>
                  )}
                  {/* Status dropdown */}
                  <select
                    value={selectedLead.status}
                    onChange={e => handleStatus(e.target.value)}
                    disabled={savingLead}
                    style={{
                      background: statusBadge(selectedLead.status).bg,
                      color: statusBadge(selectedLead.status).color,
                      border: `1px solid ${statusBadge(selectedLead.status).color}40`,
                      borderRadius: 20, padding: "2px 8px",
                      fontSize: 11, fontWeight: 700, cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s.value} value={s.value} style={{ background: "#162744", color: "#F0ECE4" }}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tags row */}
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                  {(selectedLead.tags ?? []).map(tag => {
                    const tc = tagColor(tag);
                    return (
                      <span
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        style={{
                          fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
                          padding: "2px 8px", borderRadius: 4,
                          background: tc.bg, color: tc.color,
                          border: `1px solid ${tc.border}`,
                          cursor: "pointer",
                        }}
                        title="Clique para remover"
                      >
                        {tag} ×
                      </span>
                    );
                  })}

                  {/* Add tag button */}
                  <div style={{ position: "relative" }}>
                    <button
                      onClick={() => setEditTag(!editTag)}
                      style={{
                        background: "#162744", border: "1px dashed #243A66",
                        borderRadius: 4, padding: "2px 8px", color: "#7A8FA8",
                        fontSize: 10, cursor: "pointer",
                      }}
                    >
                      + Tag
                    </button>
                    {editTag && (
                      <div style={{
                        position: "absolute", top: 24, left: 0, zIndex: 50,
                        background: "#162744", border: "1px solid #243A66",
                        borderRadius: 10, padding: 8, minWidth: 200,
                        boxShadow: "0 4px 20px #09081A88",
                        display: "flex", flexWrap: "wrap", gap: 4,
                      }}>
                        {PRESET_TAGS.map(tag => {
                          const active = (selectedLead.tags ?? []).includes(tag);
                          const tc = tagColor(tag);
                          return (
                            <button
                              key={tag}
                              onClick={() => toggleTag(tag)}
                              style={{
                                padding: "4px 8px", borderRadius: 4, fontSize: 11, cursor: "pointer",
                                fontWeight: 600,
                                background: active ? tc.bg : "#111F35",
                                color: active ? tc.color : "#7A8FA8",
                                border: `1px solid ${active ? tc.border : "#243A66"}`,
                              }}
                            >
                              {active ? "✓ " : ""}{tag}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Responsável */}
              <div style={{ flexShrink: 0, minWidth: 180 }}>
                <div style={{ color: "#7A8FA8", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
                  Responsável
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <select
                    value={selectedLead.responsavel_id ?? ""}
                    onChange={e => handleResponsavel(e.target.value)}
                    disabled={savingLead}
                    style={{
                      background: "#162744", border: "1px solid #243A66",
                      borderRadius: 8, padding: "4px 8px",
                      color: selectedLead.responsavel_id ? "#F0ECE4" : "#7A8FA8",
                      fontSize: 12, cursor: "pointer", outline: "none",
                      flex: 1,
                    }}
                  >
                    <option value="" style={{ background: "#162744" }}>Sem responsável</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id} style={{ background: "#162744", color: "#F0ECE4" }}>
                        {p.full_name}
                      </option>
                    ))}
                  </select>
                  {!selectedLead.responsavel_id && (
                    <button
                      onClick={handleAssignSelf}
                      title={`Atribuir a ${currentUserName}`}
                      style={{
                        background: "#C9A84C20", border: "1px solid #C9A84C",
                        borderRadius: 6, padding: "4px 8px",
                        color: "#C9A84C", fontSize: 11, cursor: "pointer", whiteSpace: "nowrap",
                      }}
                    >
                      Eu
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Messages area */}
            <div style={{
              flex: 1, overflowY: "auto", padding: "16px 20px",
              display: "flex", flexDirection: "column", gap: 2,
            }}>
              {loadingConversas ? (
                <div style={{ color: "#7A8FA8", textAlign: "center", padding: 40 }}>Carregando mensagens...</div>
              ) : conversas.length === 0 ? (
                <div style={{ color: "#7A8FA8", textAlign: "center", padding: 40 }}>Nenhuma mensagem</div>
              ) : (
                buildMessageGroups().map(group => (
                  <div key={group.date}>
                    {/* Date separator */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "12px 0" }}>
                      <div style={{ flex: 1, height: 1, background: "#243A66" }} />
                      <span style={{
                        color: "#7A8FA8", fontSize: 11, fontWeight: 600,
                        background: "#162744", padding: "2px 10px", borderRadius: 10,
                        border: "1px solid #243A66",
                      }}>
                        {group.date}
                      </span>
                      <div style={{ flex: 1, height: 1, background: "#243A66" }} />
                    </div>

                    {group.messages.map((c, idx) => {
                      const isUser = c.role === "user";
                      const prev = idx > 0 ? group.messages[idx - 1] : null;
                      const sameRole = prev?.role === c.role;
                      return (
                        <div
                          key={c.id}
                          style={{
                            display: "flex",
                            justifyContent: isUser ? "flex-start" : "flex-end",
                            marginBottom: sameRole ? 2 : 8,
                          }}
                        >
                          <div style={{
                            maxWidth: "72%",
                            background: isUser ? "#162744" : "#1A3A28",
                            border: `1px solid ${isUser ? "#243A66" : "#2A5A3A"}`,
                            borderRadius: isUser
                              ? `${sameRole ? 4 : 14}px 14px 14px 4px`
                              : `14px ${sameRole ? 4 : 14}px 4px 14px`,
                            padding: "8px 12px",
                          }}>
                            {!sameRole && (
                              <div style={{
                                fontSize: 11, fontWeight: 700, marginBottom: 4,
                                color: isUser ? "#C9A84C" : "#4ade80",
                              }}>
                                {isUser ? (selectedLead.nome ?? c.phone) : "Agente SDR (Matheus)"}
                              </div>
                            )}
                            <div style={{ color: "#F0ECE4", fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                              {c.content}
                            </div>
                            <div style={{ color: "#7A8FA8", fontSize: 10, marginTop: 4, textAlign: "right" }}>
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
            <div style={{
              background: "#111F35",
              borderTop: "1px solid #243A66",
              flexShrink: 0,
            }}>
              {/* Input humano (visível só quando humano_ativo) */}
              {selectedLead.humano_ativo && (
                <div style={{ padding: "10px 16px", display: "flex", gap: 8, borderBottom: "1px solid #243A66" }}>
                  <input
                    value={humanMsg}
                    onChange={e => setHumanMsg(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendHuman(); } }}
                    placeholder="Digite uma mensagem como operador..."
                    disabled={sendingHuman}
                    style={{
                      flex: 1, background: "#162744", border: "1px solid #243A66",
                      borderRadius: 10, padding: "8px 14px",
                      color: "#F0ECE4", fontSize: 13, outline: "none",
                    }}
                  />
                  <button
                    onClick={handleSendHuman}
                    disabled={sendingHuman || !humanMsg.trim()}
                    style={{
                      background: sendingHuman || !humanMsg.trim() ? "#243A66" : "#C9A84C",
                      border: "none", borderRadius: 10, padding: "8px 18px",
                      color: sendingHuman || !humanMsg.trim() ? "#7A8FA8" : "#09081A",
                      fontWeight: 700, fontSize: 13, cursor: "pointer",
                    }}
                  >
                    {sendingHuman ? "..." : "Enviar"}
                  </button>
                </div>
              )}

              {/* Status bar */}
              <div style={{ padding: "8px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {selectedLead.humano_ativo ? (
                    <>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#C9A84C", boxShadow: "0 0 6px #C9A84C" }} />
                      <span style={{ color: "#C9A84C", fontSize: 12, fontWeight: 600 }}>
                        Atendimento humano ativo · IA pausada
                      </span>
                    </>
                  ) : (
                    <>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade80" }} />
                      <span style={{ color: "#7A8FA8", fontSize: 12 }}>
                        Agente SDR (Matheus) respondendo automaticamente
                      </span>
                    </>
                  )}
                </div>
                <button
                  onClick={handleToggleHumano}
                  disabled={savingLead}
                  style={{
                    background: selectedLead.humano_ativo ? "#4ade8015" : "#C9A84C15",
                    border: `1px solid ${selectedLead.humano_ativo ? "#4ade80" : "#C9A84C"}`,
                    borderRadius: 8, padding: "5px 14px",
                    color: selectedLead.humano_ativo ? "#4ade80" : "#C9A84C",
                    fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                  }}
                >
                  {selectedLead.humano_ativo ? "↩ Devolver para IA" : "👤 Assumir Atendimento"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Empty state */
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: "#0D1B2E",
            gap: 16,
          }}>
            <div style={{
              width: 80, height: 80, borderRadius: "50%",
              background: "#C9A84C15", border: "2px solid #C9A84C30",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 36,
            }}>
              💬
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ color: "#F0ECE4", fontSize: 18, fontWeight: 700, margin: 0 }}>
                Selecione uma conversa
              </p>
              <p style={{ color: "#7A8FA8", fontSize: 14, marginTop: 6 }}>
                Escolha um lead no painel esquerdo para visualizar as mensagens
              </p>
            </div>
            <div style={{ display: "flex", gap: 32, marginTop: 8 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#C9A84C", fontSize: 24, fontWeight: 800 }}>{leads.length}</div>
                <div style={{ color: "#7A8FA8", fontSize: 12 }}>Leads totais</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#4ade80", fontSize: 24, fontWeight: 800 }}>
                  {leads.reduce((a, l) => a + l.message_count, 0)}
                </div>
                <div style={{ color: "#7A8FA8", fontSize: 12 }}>Mensagens</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#C9A84C", fontSize: 24, fontWeight: 800 }}>
                  {leads.filter(l => l.status === "agendado" || l.status === "convertido").length}
                </div>
                <div style={{ color: "#7A8FA8", fontSize: 12 }}>Convertidos</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
