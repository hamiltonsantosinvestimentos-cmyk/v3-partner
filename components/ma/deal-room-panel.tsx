"use client";

import React, { useState, useEffect } from "react";
import { Shield, Plus, Send, Copy, CheckCheck, Users, Eye, Clock, Ban, RefreshCw, FileText } from "lucide-react";

// ─── Tipos ───────────────────────────────────────────────────────────────────
type Invite = {
  id: string; investor_name: string; investor_email: string; investor_company: string | null;
  status: string; source_group: string | null; access_side: string;
  access_count: number; first_accessed_at: string | null; sent_at: string | null;
  token_expires_at: string;
  nda_signatures: Array<{ signed_at: string }>;
};

type Room = {
  id: string; name: string; status: string; nda_required: boolean;
  expires_at: string | null; created_at: string;
  deal_room_invites: Invite[];
  deal_room_documents: Array<{ id: string; label: string; doc_type: string }>;
};

// ─── Paleta V3 (compatível com o projeto) ────────────────────────────────────
const C = {
  gold: "#C9A84C", goldLt: "#E8C97A",
  navy: "#09081A", navyMid: "#162744", navyBrd: "#243A66",
  cream: "#F0ECE4", muted: "#7A8FA8",
  green: "#4CAF7D", amber: "#E89B3A", red: "#E05555",
};

function statusColor(s: string) {
  if (s === "nda_signed" || s === "viewing") return C.green;
  if (s === "pending") return C.amber;
  if (s === "revoked" || s === "expired") return C.red;
  return C.muted;
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    pending: "Aguardando", nda_signed: "NDA assinado",
    viewing: "Visualizando", revoked: "Revogado", expired: "Expirado",
  };
  return map[s] ?? s;
}

interface DealRoomPanelProps { dealId: string; dealCode?: string; userRole: string }

export function DealRoomPanel({ dealId, dealCode, userRole }: DealRoomPanelProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState<string | null>(null);
  const [inviteData, setInviteData] = useState({ name: "", email: "", company: "", group: "", side: "buyer" });
  const [sending, setSending] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const canManage = ["ADMIN", "GESTAO"].includes(userRole);

  const fetchRooms = async () => {
    const r = await fetch(`/api/ma/deal-rooms?deal_id=${dealId}`);
    const d = await r.json();
    setRooms(d.rooms ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchRooms(); }, [dealId]);

  const handleCreateRoom = async () => {
    if (!roomName.trim()) return;
    setCreating(true);
    await fetch("/api/ma/deal-rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deal_id: dealId, name: roomName, nda_required: true }),
    });
    setRoomName("");
    setShowCreateForm(false);
    setCreating(false);
    fetchRooms();
  };

  const handleInvite = async (roomId: string) => {
    if (!inviteData.name.trim() || !inviteData.email.trim()) return;
    setSending(true);
    const r = await fetch(`/api/ma/deal-rooms/${roomId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        investor_name:    inviteData.name,
        investor_email:   inviteData.email,
        investor_company: inviteData.company || undefined,
        source_group:     inviteData.group || undefined,
        access_side:      inviteData.side,
      }),
    });
    const d = await r.json();
    if (d.vdr_url) {
      await navigator.clipboard.writeText(d.vdr_url).catch(() => {});
      setCopiedToken(d.invite_id);
      setTimeout(() => setCopiedToken(null), 3000);
    }
    setInviteData({ name: "", email: "", company: "", group: "", side: "buyer" });
    setShowInviteForm(null);
    setSending(false);
    fetchRooms();
  };

  const handleUploadCIM = async (roomId: string) => {
    // Registra o CIM já existente no Storage como documento da sala
    await fetch(`/api/ma/deal-rooms/${roomId}/document`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label:        "CIM — " + (dealCode ?? "Deal"),
        doc_type:     "cim",
        storage_path: `${dealId}/cim-2026-05-20_ShoppingCenterMeier.pdf`,
        requires_nda: true,
      }),
    }).catch(() => {});
    fetchRooms();
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "24px 0", color: C.muted, fontSize: 13 }}>
      <RefreshCw style={{ width: 16, height: 16, color: C.gold, animation: "spin 1s linear infinite" }} />
      Carregando Deal Rooms...
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Shield style={{ width: 16, height: 16, color: C.gold }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: C.cream }}>Deal Room — Acesso Investidores</span>
          {rooms.length > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, background: `${C.gold}20`, color: C.gold, border: `1px solid ${C.gold}30`, borderRadius: 4, padding: "2px 8px" }}>
              {rooms.length} {rooms.length === 1 ? "sala" : "salas"}
            </span>
          )}
        </div>
        {canManage && (
          <button onClick={() => setShowCreateForm(!showCreateForm)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit", background: showCreateForm ? `${C.gold}20` : C.gold, color: showCreateForm ? C.gold : C.navy }}>
            <Plus style={{ width: 12, height: 12 }} /> Nova Sala
          </button>
        )}
      </div>

      {/* Criar sala */}
      {showCreateForm && canManage && (
        <div style={{ background: C.navyMid, border: `1px solid ${C.gold}30`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.goldLt, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Nome da Sala</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={roomName} onChange={e => setRoomName(e.target.value)}
              placeholder="Ex: CIM Rodada A — Mai/2026"
              style={{ flex: 1, background: C.navy, border: `1px solid ${C.navyBrd}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, color: C.cream, fontFamily: "inherit", outline: "none" }} />
            <button onClick={handleCreateRoom} disabled={creating || !roomName.trim()}
              style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: C.gold, color: C.navy, fontWeight: 700, fontSize: 12, fontFamily: "inherit", opacity: !roomName.trim() ? 0.5 : 1 }}>
              {creating ? "Criando..." : "Criar"}
            </button>
          </div>
        </div>
      )}

      {/* Lista de salas */}
      {rooms.length === 0 && !showCreateForm && (
        <div style={{ textAlign: "center", padding: "32px 0", color: C.muted, fontSize: 13 }}>
          Nenhuma sala criada. Clique em "Nova Sala" para criar o Deal Room e convidar investidores.
        </div>
      )}

      {rooms.map(room => {
        const totalInvites = room.deal_room_invites?.length ?? 0;
        const ndaSigned = room.deal_room_invites?.filter(i => ["nda_signed","viewing"].includes(i.status)).length ?? 0;
        const totalViews = room.deal_room_invites?.reduce((s, i) => s + (i.access_count ?? 0), 0) ?? 0;

        return (
          <div key={room.id} style={{ background: C.navyMid, border: `1px solid ${C.navyBrd}`, borderRadius: 12, marginBottom: 12, overflow: "hidden" }}>
            {/* Room header */}
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.navyBrd}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.cream }}>{room.name}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    Criada em {new Date(room.created_at).toLocaleDateString("pt-BR")} · NDA: {room.nda_required ? "Obrigatório" : "Opcional"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12, fontSize: 11, color: C.muted }}>
                  <span><strong style={{ color: C.cream }}>{totalInvites}</strong> convidados</span>
                  <span><strong style={{ color: C.green }}>{ndaSigned}</strong> NDA assinado</span>
                  <span><strong style={{ color: C.goldLt }}>{totalViews}</strong> acessos</span>
                </div>
              </div>
            </div>

            {/* Documentos da sala */}
            <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.navyBrd}`, display: "flex", alignItems: "center", gap: 8 }}>
              <FileText style={{ width: 14, height: 14, color: C.muted }} />
              {room.deal_room_documents?.length > 0 ? (
                <span style={{ fontSize: 12, color: C.muted }}>
                  {room.deal_room_documents.length} documento(s): {room.deal_room_documents.map(d => d.label).join(", ")}
                </span>
              ) : (
                <span style={{ fontSize: 12, color: C.muted }}>Nenhum documento. </span>
              )}
              {canManage && room.deal_room_documents?.length === 0 && (
                <button onClick={() => handleUploadCIM(room.id)}
                  style={{ fontSize: 11, fontWeight: 600, color: C.gold, background: "transparent", border: `1px solid ${C.gold}30`, borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontFamily: "inherit" }}>
                  + Adicionar CIM
                </button>
              )}
            </div>

            {/* Lista de convidados */}
            {(room.deal_room_invites ?? []).map(invite => (
              <div key={invite.id} style={{ padding: "10px 16px", borderBottom: `1px solid ${C.navyBrd}`, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${C.navyBrd}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Users style={{ width: 14, height: 14, color: C.muted }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.cream }}>{invite.investor_name}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{invite.investor_email}{invite.investor_company ? ` · ${invite.investor_company}` : ""}{invite.source_group ? ` · ${invite.source_group}` : ""}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {invite.access_count > 0 && (
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.muted }}>
                      <Eye style={{ width: 12, height: 12 }} /> {invite.access_count}x
                    </span>
                  )}
                  {invite.first_accessed_at && (
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.muted }}>
                      <Clock style={{ width: 12, height: 12 }} /> {new Date(invite.first_accessed_at).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, padding: "2px 8px", borderRadius: 4, border: `1px solid ${statusColor(invite.status)}40`, color: statusColor(invite.status), background: `${statusColor(invite.status)}15` }}>
                    {statusLabel(invite.status).toUpperCase()}
                  </span>
                </div>
              </div>
            ))}

            {/* Footer da sala — convidar */}
            {canManage && (
              <div style={{ padding: "10px 16px" }}>
                {showInviteForm === room.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <input value={inviteData.name} onChange={e => setInviteData(p => ({ ...p, name: e.target.value }))}
                        placeholder="Nome do investidor *"
                        style={{ background: C.navy, border: `1px solid ${C.navyBrd}`, borderRadius: 8, padding: "8px 10px", fontSize: 12, color: C.cream, fontFamily: "inherit", outline: "none" }} />
                      <input value={inviteData.email} onChange={e => setInviteData(p => ({ ...p, email: e.target.value }))}
                        placeholder="Email *"
                        style={{ background: C.navy, border: `1px solid ${C.navyBrd}`, borderRadius: 8, padding: "8px 10px", fontSize: 12, color: C.cream, fontFamily: "inherit", outline: "none" }} />
                      <input value={inviteData.company} onChange={e => setInviteData(p => ({ ...p, company: e.target.value }))}
                        placeholder="Empresa / Fundo"
                        style={{ background: C.navy, border: `1px solid ${C.navyBrd}`, borderRadius: 8, padding: "8px 10px", fontSize: 12, color: C.cream, fontFamily: "inherit", outline: "none" }} />
                      <input value={inviteData.group} onChange={e => setInviteData(p => ({ ...p, group: e.target.value }))}
                        placeholder="Grupo (ex: btg-pactual, xp)"
                        style={{ background: C.navy, border: `1px solid ${C.navyBrd}`, borderRadius: 8, padding: "8px 10px", fontSize: 12, color: C.cream, fontFamily: "inherit", outline: "none" }} />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <select value={inviteData.side} onChange={e => setInviteData(p => ({ ...p, side: e.target.value }))}
                        style={{ background: C.navy, border: `1px solid ${C.navyBrd}`, borderRadius: 8, padding: "8px 10px", fontSize: 12, color: C.cream, fontFamily: "inherit", flex: 1 }}>
                        <option value="buyer">Comprador (Buyer)</option>
                        <option value="intermediario">Intermediário</option>
                        <option value="co_advisor">Co-advisor</option>
                      </select>
                      <button onClick={() => handleInvite(room.id)} disabled={sending || !inviteData.name.trim() || !inviteData.email.trim()}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: C.gold, color: C.navy, fontWeight: 700, fontSize: 12, fontFamily: "inherit", opacity: (!inviteData.name.trim() || !inviteData.email.trim()) ? 0.5 : 1 }}>
                        {sending ? "Enviando..." : <><Send style={{ width: 12, height: 12 }} /> Gerar Link</>}
                      </button>
                      <button onClick={() => setShowInviteForm(null)}
                        style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.navyBrd}`, cursor: "pointer", background: "transparent", color: C.muted, fontSize: 12, fontFamily: "inherit" }}>
                        Cancelar
                      </button>
                    </div>
                    {copiedToken && (
                      <div style={{ fontSize: 11, color: C.green, display: "flex", alignItems: "center", gap: 4 }}>
                        <CheckCheck style={{ width: 12, height: 12 }} /> Link copiado! Email enviado ao investidor.
                      </div>
                    )}
                  </div>
                ) : (
                  <button onClick={() => setShowInviteForm(room.id)}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, border: `1px solid ${C.navyBrd}`, cursor: "pointer", background: "transparent", color: C.muted, fontSize: 12, fontFamily: "inherit" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.gold; (e.currentTarget as HTMLButtonElement).style.color = C.gold; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.navyBrd; (e.currentTarget as HTMLButtonElement).style.color = C.muted; }}>
                    <Plus style={{ width: 12, height: 12 }} /> Convidar Investidor
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
