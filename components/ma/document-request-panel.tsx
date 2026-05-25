"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText, Send, CheckCircle, XCircle, Clock, Loader2, RefreshCw,
  AlertTriangle, Package, ChevronDown, ChevronUp, Plus, Ban,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type DocItemStatus = "pending" | "received" | "processed" | "rejected";
type RequestStatus = "pending" | "sent" | "partial" | "complete" | "cancelled";
type Priority = "ALTA" | "MEDIA" | "BAIXA";

interface DocRequestItem {
  id: string;
  tipo: string;
  descricao: string;
  campos_ausentes: string[];
  priority: Priority;
  status: DocItemStatus;
  received_at: string | null;
  doc_id: string | null;
}

interface DocRequest {
  id: string;
  deal_id: string;
  status: RequestStatus;
  partner_email: string | null;
  deadline: string | null;
  notes: string | null;
  email_sent: boolean;
  email_sent_at: string | null;
  forja_snapshot_at: string | null;
  documents: DocRequestItem[];
  created_at: string;
  updated_at: string;
}

interface DocRequestStats {
  total: number;
  pending: number;
  received: number;
  processed: number;
  rejected: number;
}

interface DocRequestsResponse {
  requests: DocRequest[];
  stats: DocRequestStats;
  has_active: boolean;
  active_request: DocRequest | null;
}

interface MissingField {
  field: string;
  impact: string;
  priority: Priority;
}

interface DocumentRequestPanelProps {
  dealId: string;
  dealCode?: string;
  missingFields?: MissingField[];
  forjaSnapshotAt?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<RequestStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending:   { label: "Pendente",    color: "bg-amber-500/20 text-amber-400 border-amber-500/30",     icon: <Clock size={11} /> },
  sent:      { label: "Enviado",     color: "bg-blue-500/20 text-blue-400 border-blue-500/30",        icon: <Send size={11} /> },
  partial:   { label: "Parcial",     color: "bg-purple-500/20 text-purple-400 border-purple-500/30",  icon: <Package size={11} /> },
  complete:  { label: "Completo",    color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: <CheckCircle size={11} /> },
  cancelled: { label: "Cancelado",   color: "bg-red-500/20 text-red-400 border-red-500/30",           icon: <Ban size={11} /> },
};

const ITEM_STATUS_CFG: Record<DocItemStatus, { label: string; color: string }> = {
  pending:   { label: "Aguardando",  color: "text-amber-400" },
  received:  { label: "Recebido",    color: "text-blue-400" },
  processed: { label: "Processado",  color: "text-emerald-400" },
  rejected:  { label: "Recusado",    color: "text-red-400" },
};

const PRIORITY_COLOR: Record<Priority, string> = {
  ALTA:  "bg-red-500/15 text-red-400 border-red-500/30",
  MEDIA: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  BAIXA: "bg-[#1E3A5F]/40 text-[#9BAFC5] border-[#243A66]",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function DocumentRequestPanel({
  dealId,
  dealCode = "—",
  missingFields = [],
  forjaSnapshotAt,
}: DocumentRequestPanelProps) {
  const [data, setData] = useState<DocRequestsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [sendEmailOnCreate, setSendEmailOnCreate] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ma/document-requests?deal_id=${dealId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao carregar pedidos");
      setData(json);
      if (json.active_request) setExpandedRequest(json.active_request.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  async function createRequest() {
    if (!missingFields.length) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/ma/document-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deal_id: dealId,
          missing: missingFields,
          send_email: sendEmailOnCreate,
          forja_snapshot_at: forjaSnapshotAt ?? new Date().toISOString(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setError(`Já existe um pedido ativo (${json.existing_status}). ID: ${json.existing_id?.slice(0, 8)}`);
        } else {
          throw new Error(json.error ?? "Erro ao criar pedido");
        }
        return;
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }

  async function runAction(requestId: string, action: string, extra?: Record<string, unknown>) {
    const key = `${requestId}:${action}`;
    setActionLoading(key);
    setError(null);
    try {
      const res = await fetch(`/api/ma/document-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro na ação");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setActionLoading(null);
    }
  }

  // ── Render states ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-[#7A8FA8]">
        <Loader2 size={18} className="animate-spin mr-2" /> Carregando pedidos...
      </div>
    );
  }

  const altaMedia = missingFields.filter(f => f.priority === "ALTA" || f.priority === "MEDIA");
  const hasActiveRequest = data?.has_active;

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-xs">
          <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Header stats ──────────────────────────────────────────────────── */}
      {data && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Pedidos",    value: data.requests.length, color: "text-[#C9A84C]" },
            { label: "Ativos",     value: data.requests.filter(r => ["pending","sent","partial"].includes(r.status)).length, color: "text-blue-400" },
            { label: "Completos",  value: data.requests.filter(r => r.status === "complete").length, color: "text-emerald-400" },
          ].map(s => (
            <div key={s.label} className="px-3 py-2 rounded-lg bg-[#091221] border border-[#1E3A5F]">
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-[#7A8FA8] uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Create button (only when FORJA has missing fields and no active request) ── */}
      {!hasActiveRequest && altaMedia.length > 0 && (
        <Card className="border-[#243A66] bg-[#091221]">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs font-semibold text-[#E8EDF5] flex items-center gap-2">
              <Plus size={13} className="text-[#C9A84C]" />
              Novo pedido de documentos
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-3">
            <p className="text-xs text-[#7A8FA8]">
              FORJA detectou <strong className="text-[#E8EDF5]">{altaMedia.length}</strong> campos críticos ausentes.
              Crie um pedido formal para o partner.
            </p>

            <div className="flex flex-wrap gap-1.5">
              {altaMedia.slice(0, 6).map(f => (
                <span key={f.field} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${PRIORITY_COLOR[f.priority]}`}>
                  {f.field}
                </span>
              ))}
              {altaMedia.length > 6 && (
                <span className="text-[10px] text-[#7A8FA8]">+{altaMedia.length - 6} mais</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendEmailOnCreate}
                  onChange={e => setSendEmailOnCreate(e.target.checked)}
                  className="accent-[#C9A84C] w-3 h-3"
                />
                <span className="text-[11px] text-[#9BAFC5]">Enviar email ao partner agora</span>
              </label>
            </div>

            <Button
              size="sm"
              onClick={createRequest}
              disabled={creating}
              className="w-full bg-[#C9A84C]/15 hover:bg-[#C9A84C]/25 text-[#C9A84C] border border-[#C9A84C]/30 text-xs h-8"
            >
              {creating ? <Loader2 size={13} className="animate-spin mr-1.5" /> : <Send size={13} className="mr-1.5" />}
              {creating ? "Criando..." : `Criar pedido · ${dealCode}`}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Request list ─────────────────────────────────────────────────── */}
      {data?.requests.length === 0 && (
        <div className="text-center py-8 text-[#7A8FA8] text-xs">
          <FileText size={28} className="mx-auto mb-2 opacity-30" />
          Nenhum pedido de documentos registrado.
          {altaMedia.length === 0 && " Execute o FORJA primeiro para detectar campos ausentes."}
        </div>
      )}

      {data?.requests.map(req => {
        const cfg = STATUS_CFG[req.status];
        const isExpanded = expandedRequest === req.id;
        const isActive = ["pending", "sent", "partial"].includes(req.status);
        const itemsCounts = {
          pending:   req.documents.filter(d => d.status === "pending").length,
          received:  req.documents.filter(d => d.status === "received").length,
          processed: req.documents.filter(d => d.status === "processed").length,
          rejected:  req.documents.filter(d => d.status === "rejected").length,
        };

        return (
          <Card key={req.id} className={`border bg-[#091221] ${isActive ? "border-[#243A66]" : "border-[#162744] opacity-70"}`}>
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`text-[9px] px-1.5 py-0.5 h-auto border font-bold uppercase tracking-wider gap-1 ${cfg.color}`}>
                    {cfg.icon}{cfg.label}
                  </Badge>
                  <span className="text-[10px] text-[#7A8FA8]">
                    {req.documents.length} docs · criado {new Date(req.created_at).toLocaleDateString("pt-BR")}
                  </span>
                  {req.email_sent && (
                    <span className="text-[9px] text-blue-400 flex items-center gap-0.5">
                      <Send size={9} /> Email enviado
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setExpandedRequest(isExpanded ? null : req.id)}
                  className="text-[#7A8FA8] hover:text-[#C9A84C] transition-colors"
                >
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {/* Mini progress bar */}
              {req.documents.length > 0 && (
                <div className="mt-2 flex gap-1 text-[9px] text-[#7A8FA8]">
                  {itemsCounts.processed > 0 && <span className="text-emerald-400">{itemsCounts.processed} proc.</span>}
                  {itemsCounts.received > 0 && <span className="text-blue-400">{itemsCounts.received} receb.</span>}
                  {itemsCounts.pending > 0 && <span className="text-amber-400">{itemsCounts.pending} pend.</span>}
                  {itemsCounts.rejected > 0 && <span className="text-red-400">{itemsCounts.rejected} recus.</span>}
                </div>
              )}
            </CardHeader>

            {isExpanded && (
              <CardContent className="px-4 pb-4 space-y-3">
                {/* Action bar for active requests */}
                {isActive && (
                  <div className="flex flex-wrap gap-2">
                    {req.status === "pending" && (
                      <Button
                        size="sm"
                        onClick={() => runAction(req.id, "send_to_partner")}
                        disabled={actionLoading === `${req.id}:send_to_partner`}
                        className="bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 text-[11px] h-7 px-3"
                      >
                        {actionLoading === `${req.id}:send_to_partner`
                          ? <Loader2 size={11} className="animate-spin mr-1" />
                          : <Send size={11} className="mr-1" />}
                        Enviar ao Partner
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => runAction(req.id, "cancel")}
                      disabled={!!actionLoading}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 text-[11px] h-7 px-3"
                    >
                      <Ban size={11} className="mr-1" /> Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={load}
                      disabled={loading}
                      className="bg-[#162744] hover:bg-[#1E3A5F] text-[#9BAFC5] border border-[#243A66] text-[11px] h-7 px-3"
                    >
                      <RefreshCw size={11} className={`mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
                    </Button>
                  </div>
                )}

                {/* Notes / deadline */}
                {(req.notes || req.deadline) && (
                  <div className="text-[11px] text-[#7A8FA8] space-y-0.5">
                    {req.notes && <p><span className="text-[#9BAFC5] font-medium">Obs:</span> {req.notes}</p>}
                    {req.deadline && <p><span className="text-[#9BAFC5] font-medium">Prazo:</span> {new Date(req.deadline).toLocaleDateString("pt-BR")}</p>}
                  </div>
                )}

                {/* Document items list */}
                <div className="space-y-1.5">
                  {req.documents.map(item => {
                    const itemCfg = ITEM_STATUS_CFG[item.status];
                    const canMarkReceived = isActive && item.status === "pending";
                    const canMarkProcessed = isActive && item.status === "received";
                    const canReject = isActive && item.status === "pending";

                    return (
                      <div key={item.id} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-[#0D1B2E] border border-[#1E3A5F]">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${PRIORITY_COLOR[item.priority]}`}>
                              {item.priority}
                            </span>
                            <span className="text-[10px] font-semibold text-[#C9A84C]">{item.tipo}</span>
                            <span className={`text-[9px] font-medium ${itemCfg.color}`}>{itemCfg.label}</span>
                          </div>
                          <p className="text-[11px] text-[#E8EDF5] mt-0.5">{item.descricao}</p>
                          {item.campos_ausentes.length > 0 && (
                            <p className="text-[9px] text-[#7A8FA8] mt-0.5">
                              Campos: {item.campos_ausentes.slice(0, 3).join(", ")}{item.campos_ausentes.length > 3 ? "..." : ""}
                            </p>
                          )}
                          {item.received_at && (
                            <p className="text-[9px] text-[#7A8FA8] mt-0.5">
                              Recebido: {new Date(item.received_at).toLocaleDateString("pt-BR")}
                            </p>
                          )}
                        </div>

                        {/* Per-item actions */}
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          {canMarkReceived && (
                            <button
                              onClick={() => runAction(req.id, "mark_received", { item_id: item.id })}
                              disabled={!!actionLoading}
                              className="text-[9px] px-2 py-1 rounded bg-blue-500/15 text-blue-400 border border-blue-500/25 hover:bg-blue-500/25 transition-colors disabled:opacity-50 flex items-center gap-1"
                            >
                              {actionLoading === `${req.id}:mark_received` ? <Loader2 size={9} className="animate-spin" /> : <CheckCircle size={9} />}
                              Recebido
                            </button>
                          )}
                          {canMarkProcessed && (
                            <button
                              onClick={() => runAction(req.id, "mark_processed", { item_id: item.id })}
                              disabled={!!actionLoading}
                              className="text-[9px] px-2 py-1 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-colors disabled:opacity-50 flex items-center gap-1"
                            >
                              {actionLoading === `${req.id}:mark_processed` ? <Loader2 size={9} className="animate-spin" /> : <CheckCircle size={9} />}
                              Processado
                            </button>
                          )}
                          {canReject && (
                            <button
                              onClick={() => runAction(req.id, "mark_rejected", { item_id: item.id })}
                              disabled={!!actionLoading}
                              className="text-[9px] px-2 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50 flex items-center gap-1"
                            >
                              <XCircle size={9} /> Recusar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
