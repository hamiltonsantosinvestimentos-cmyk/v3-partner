"use client";

import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare, Send, ChevronDown, ChevronUp, Bot, User,
  Users, CheckCircle, Clock, AlertCircle, Zap, Plus,
} from "lucide-react";

// ─── Paleta V3 ────────────────────────────────────────────────────────────────
const V3 = {
  gold: "#C9A84C", goldLt: "#E8C97A",
  navy: "#09081A", navyMid: "#162744", navyBrd: "#243A66",
  cream: "#F0ECE4", muted: "#7A8FA8",
  green: "#4CAF7D", amber: "#E89B3A", red: "#E05555",
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Message = {
  id: string;
  sender_type: "buyer" | "seller" | "mesa" | "ai_draft" | "ai_summary";
  content: string;
  is_ai_draft: boolean;
  is_published: boolean;
  ai_confidence?: number;
  created_at: string;
  profiles?: { full_name: string } | null;
};

type Thread = {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  initiated_by: string;
  ai_summary?: string;
  thesis_impact?: string;
  created_at: string;
  deal_qa_messages?: Message[];
};

// ─── Configs ──────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  open:           { label: "Aberto",           color: `${V3.amber}20`, icon: <Clock className="w-3 h-3" style={{ color: V3.amber }} /> },
  answered:       { label: "Respondido",       color: `${V3.green}20`, icon: <CheckCircle className="w-3 h-3" style={{ color: V3.green }} /> },
  pending_seller: { label: "Aguarda Vendedor", color: `${V3.amber}20`, icon: <AlertCircle className="w-3 h-3" style={{ color: V3.amber }} /> },
  pending_buyer:  { label: "Aguarda Comprador",color: `${V3.amber}20`, icon: <AlertCircle className="w-3 h-3" style={{ color: V3.amber }} /> },
  closed:         { label: "Encerrado",        color: `${V3.muted}20`, icon: <CheckCircle className="w-3 h-3" style={{ color: V3.muted }} /> },
  escalated:      { label: "Escalado",         color: `${V3.red}20`,   icon: <AlertCircle className="w-3 h-3" style={{ color: V3.red }} /> },
};

const CATEGORY_LABELS: Record<string, string> = {
  financeiro: "Financeiro", juridico: "Jurídico", operacional: "Operacional",
  estrutura: "Estrutura", due_diligence: "Due Diligence", geral: "Geral",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: V3.muted, normal: V3.goldLt, high: V3.amber, urgent: V3.red,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function SenderIcon({ type }: { type: string }) {
  if (type === "ai_draft" || type === "ai_summary") return <Bot className="w-4 h-4" style={{ color: V3.gold }} />;
  if (type === "buyer") return <Users className="w-4 h-4" style={{ color: V3.green }} />;
  return <User className="w-4 h-4" style={{ color: V3.muted }} />;
}

function SenderLabel({ type, name }: { type: string; name?: string }) {
  if (type === "ai_draft") return <span style={{ color: V3.gold }}>Draft IA</span>;
  if (type === "ai_summary") return <span style={{ color: V3.goldLt }}>Resumo IA</span>;
  if (type === "buyer") return <span style={{ color: V3.green }}>Investidor</span>;
  if (type === "seller") return <span style={{ color: V3.amber }}>Vendedor</span>;
  return <span style={{ color: V3.cream }}>{name ?? "Mesa M&A"}</span>;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface DealQAPanelProps {
  dealId: string;
  userRole: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function DealQAPanel({ dealId, userRole }: DealQAPanelProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedThread, setExpandedThread] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replyContent, setReplyContent] = useState<Record<string, string>>({});

  const newSubjectRef = useRef<HTMLInputElement>(null);
  const newContentRef = useRef<HTMLTextAreaElement>(null);

  const canManage = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(userRole);

  // ── Fetch threads ──
  const fetchThreads = async () => {
    const r = await fetch(`/api/ma/qa?deal_id=${dealId}`);
    const d = await r.json();
    setThreads(d.threads ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchThreads(); }, [dealId]);

  // ── Criar novo thread ──
  const handleCreateThread = async () => {
    const subject = newSubjectRef.current?.value?.trim();
    const content = newContentRef.current?.value?.trim();
    if (!subject || !content) return;

    setSubmitting(true);
    await fetch("/api/ma/qa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deal_id: dealId, subject, content, initiated_by: "mesa" }),
    });
    if (newSubjectRef.current) newSubjectRef.current.value = "";
    if (newContentRef.current) newContentRef.current.value = "";
    setShowNewForm(false);
    setSubmitting(false);
    fetchThreads();
  };

  // ── Publicar draft IA ──
  const handlePublishDraft = async (thread_id: string, draft_id: string) => {
    await fetch(`/api/ma/qa/${thread_id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publish_draft_id: draft_id }),
    });
    fetchThreads();
  };

  // ── Responder thread ──
  const handleReply = async (thread_id: string) => {
    const content = replyContent[thread_id]?.trim();
    if (!content) return;
    await fetch(`/api/ma/qa/${thread_id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, sender_type: "mesa" }),
    });
    setReplyContent(prev => ({ ...prev, [thread_id]: "" }));
    fetchThreads();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-24 gap-2" style={{ color: V3.muted }}>
        <MessageSquare className="w-4 h-4 animate-pulse" style={{ color: V3.gold }} />
        <span className="text-sm">Carregando Q&A...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4" style={{ color: V3.gold }} />
          <span className="text-sm font-semibold" style={{ color: V3.cream }}>Q&A do Deal</span>
          <Badge style={{ background: `${V3.gold}15`, color: V3.gold, border: `1px solid ${V3.gold}30`, fontSize: 10 }}>
            {threads.length} {threads.length === 1 ? "thread" : "threads"}
          </Badge>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setShowNewForm(!showNewForm)}
            className="text-xs gap-1.5 h-7"
            style={{ background: showNewForm ? `${V3.gold}20` : V3.gold, color: showNewForm ? V3.gold : V3.navy, border: showNewForm ? `1px solid ${V3.gold}40` : "none" }}>
            <Plus className="w-3 h-3" />
            Nova Pergunta
          </Button>
        )}
      </div>

      {/* Formulário nova pergunta */}
      {showNewForm && canManage && (
        <Card style={{ background: V3.navyMid, border: `1px solid ${V3.gold}30` }}>
          <CardContent className="p-4 space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: V3.goldLt }}>
                Assunto
              </label>
              <input ref={newSubjectRef} placeholder="Ex: Confirmar EBITDA 2024 — qual a margem operacional?"
                className="w-full text-sm px-3 py-2 rounded-lg outline-none focus:ring-1"
                style={{ background: V3.navy, border: `1px solid ${V3.navyBrd}`, color: V3.cream,
                  caretColor: V3.gold }}
                onFocus={e => (e.target.style.borderColor = V3.gold)}
                onBlur={e => (e.target.style.borderColor = V3.navyBrd)} />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: V3.goldLt }}>
                Pergunta / Contexto
              </label>
              <textarea ref={newContentRef} rows={3}
                placeholder="Descreva a dúvida ou solicitação de informação..."
                className="w-full text-sm px-3 py-2 rounded-lg outline-none resize-none focus:ring-1"
                style={{ background: V3.navy, border: `1px solid ${V3.navyBrd}`, color: V3.cream,
                  caretColor: V3.gold }}
                onFocus={e => (e.target.style.borderColor = V3.gold)}
                onBlur={e => (e.target.style.borderColor = V3.navyBrd)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowNewForm(false)}
                style={{ color: V3.muted }} className="text-xs h-7">Cancelar</Button>
              <Button size="sm" onClick={handleCreateThread} disabled={submitting}
                className="text-xs gap-1.5 h-7"
                style={{ background: V3.gold, color: V3.navy }}>
                {submitting ? "Enviando..." : <><Zap className="w-3 h-3" /> Enviar + Gerar Draft IA</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de threads */}
      {threads.length === 0 ? (
        <div className="text-sm text-center py-8" style={{ color: V3.muted }}>
          Nenhuma pergunta registrada. Use "Nova Pergunta" para iniciar um Q&A.
        </div>
      ) : (
        threads.map(thread => {
          const isExpanded = expandedThread === thread.id;
          const cfg = STATUS_CONFIG[thread.status] ?? STATUS_CONFIG.open;
          const msgs = thread.deal_qa_messages ?? [];
          const aiDraft = msgs.find(m => m.is_ai_draft && !m.is_published);

          return (
            <Card key={thread.id} style={{ background: V3.navyMid, border: `1px solid ${V3.navyBrd}` }}>
              {/* Thread header */}
              <div className="flex items-center gap-3 p-3 cursor-pointer"
                onClick={() => setExpandedThread(isExpanded ? null : thread.id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold truncate" style={{ color: V3.cream }}>
                      {thread.subject}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: `${V3.gold}15`, color: V3.goldLt }}>
                      {CATEGORY_LABELS[thread.category] ?? thread.category}
                    </span>
                    <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded" style={{ background: cfg.color, color: V3.cream }}>
                      {cfg.icon} {cfg.label}
                    </span>
                    <span className="text-xs" style={{ color: PRIORITY_COLORS[thread.priority] ?? V3.muted }}>
                      ● {thread.priority.toUpperCase()}
                    </span>
                    <span className="text-xs" style={{ color: V3.muted }}>
                      {msgs.length} {msgs.length === 1 ? "msg" : "msgs"}
                    </span>
                  </div>
                </div>
                {isExpanded
                  ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: V3.muted }} />
                  : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: V3.muted }} />
                }
              </div>

              {/* Thread body */}
              {isExpanded && (
                <div style={{ borderTop: `1px solid ${V3.navyBrd}` }}>
                  {/* Mensagens */}
                  <div className="p-3 space-y-3 max-h-64 overflow-y-auto">
                    {msgs.filter(m => m.is_published || m.is_ai_draft).map(msg => (
                      <div key={msg.id} className={`flex gap-2.5 ${msg.sender_type === "mesa" ? "flex-row-reverse" : ""}`}>
                        <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                          style={{ background: `${V3.navyBrd}` }}>
                          <SenderIcon type={msg.sender_type} />
                        </div>
                        <div className={`flex-1 max-w-[85%] ${msg.sender_type === "mesa" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold">
                              <SenderLabel type={msg.sender_type} name={(msg.profiles as { full_name?: string } | null)?.full_name} />
                            </span>
                            {msg.is_ai_draft && !msg.is_published && (
                              <Badge style={{ fontSize: 9, background: `${V3.gold}20`, color: V3.gold, border: `1px solid ${V3.gold}30` }}>
                                Draft
                              </Badge>
                            )}
                            <span className="text-[9px]" style={{ color: V3.muted }}>
                              {new Date(msg.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <div className="text-xs p-2.5 rounded-lg" style={{
                            background: msg.is_ai_draft ? `${V3.gold}10` : msg.sender_type === "mesa" ? V3.navyBrd : V3.navy,
                            border: msg.is_ai_draft ? `1px solid ${V3.gold}25` : `1px solid ${V3.navyBrd}`,
                            color: V3.cream, lineHeight: 1.6,
                          }}>
                            {msg.content}
                          </div>
                          {/* Botão publicar draft */}
                          {msg.is_ai_draft && !msg.is_published && canManage && (
                            <Button size="sm" onClick={() => handlePublishDraft(thread.id, msg.id)}
                              className="text-[10px] h-6 gap-1 mt-1"
                              style={{ background: V3.gold, color: V3.navy }}>
                              <CheckCircle className="w-3 h-3" /> Aprovar e publicar draft
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Thesis impact */}
                  {thread.thesis_impact && (
                    <div className="mx-3 mb-3 p-2.5 rounded-lg text-xs" style={{
                      background: `${V3.gold}08`, border: `1px solid ${V3.gold}20`, color: V3.muted
                    }}>
                      <span className="font-semibold" style={{ color: V3.goldLt }}>Impacto na tese: </span>
                      {thread.thesis_impact}
                    </div>
                  )}

                  {/* Reply box */}
                  {canManage && thread.status !== "closed" && (
                    <div className="p-3 flex gap-2" style={{ borderTop: `1px solid ${V3.navyBrd}` }}>
                      <textarea rows={1} value={replyContent[thread.id] ?? ""}
                        onChange={e => setReplyContent(prev => ({ ...prev, [thread.id]: e.target.value }))}
                        placeholder="Responder como Mesa M&A..."
                        className="flex-1 text-xs px-3 py-2 rounded-lg outline-none resize-none"
                        style={{ background: V3.navy, border: `1px solid ${V3.navyBrd}`, color: V3.cream, caretColor: V3.gold }} />
                      <Button size="sm" onClick={() => handleReply(thread.id)}
                        disabled={!replyContent[thread.id]?.trim()}
                        className="h-9 w-9 p-0 flex-shrink-0"
                        style={{ background: V3.gold, color: V3.navy }}>
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
