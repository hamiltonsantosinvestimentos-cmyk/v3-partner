"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Layers, ArrowLeft, Bot, User, Send, Plus, Loader2, Sparkles,
  ChevronRight, Copy, Check, FileText, Clock
} from "lucide-react";
import type { Squad } from "@/lib/squads";

interface Message  { role: "user" | "assistant"; content: string; ts?: string; }
interface Session  { id: string; squad_id: string; title: string; messages: Message[]; updated_at: string; }
interface Workspace {
  id: string; name: string; context: string | null;
  status: string; synthesis: { text: string; sessions_count: number; generated_at: string } | null;
  created_at: string; updated_at: string;
}

interface Props {
  workspace: Workspace;
  sessions: Session[];
  squads: Squad[];
  userRole: string;
  userName: string;
}

const SQUAD_COLORS: Record<string, string> = {
  "analista-ma": "text-[#C9A84C]",
  "deal-hunter": "text-emerald-400",
  "estrategista": "text-blue-400",
  "monitor-regulatorio": "text-orange-400",
  "pesquisador": "text-purple-400",
  "market-scout": "text-pink-400",
  "executor-deals": "text-teal-400",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function buildWorkspaceContext(workspace: Workspace, sessions: Session[]): string {
  if (sessions.length === 0) {
    return workspace.context
      ? `Deal: ${workspace.name}\n${workspace.context}`
      : `Deal: ${workspace.name}`;
  }

  const squadNames: Record<string, string> = {
    "analista-ma": "Analista M&A", "deal-hunter": "Deal Hunter",
    "estrategista": "Estrategista", "monitor-regulatorio": "Monitor Regulatório",
    "pesquisador": "Pesquisador", "market-scout": "Market Scout",
    "executor-deals": "Executor de Deals",
  };

  const summaries = sessions.map(s => {
    const last = [...s.messages].reverse().find(m => m.role === "assistant");
    const squad = squadNames[s.squad_id] ?? s.squad_id;
    return last
      ? `[${squad}] ${s.title}\nPrincipal conclusão: ${last.content.substring(0, 400)}…`
      : null;
  }).filter(Boolean).join("\n\n");

  return [
    workspace.context ? `Deal: ${workspace.name}\n${workspace.context}` : `Deal: ${workspace.name}`,
    sessions.length > 0 ? `\n\nPesquisas anteriores dos squads:\n${summaries}` : "",
  ].join("");
}

export function WorkspaceRoomClient({ workspace: initialWs, sessions: initialSessions, squads }: Props) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState(initialWs);
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [activeSquad, setActiveSquad] = useState<Squad>(squads[0]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [tab, setTab] = useState<"chat" | "sessions" | "synthesis">("chat");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const workspaceContext = useCallback(
    () => buildWorkspaceContext(workspace, sessions),
    [workspace, sessions]
  );

  function selectSquad(squad: Squad) {
    setActiveSquad(squad);
    setMessages([]);
    setSessionId(null);
    setActiveSession(null);
    setInput("");
  }

  function loadSession(sess: Session) {
    setActiveSquad(squads.find(s => s.id === sess.squad_id) ?? squads[0]);
    setMessages(sess.messages);
    setSessionId(sess.id);
    setActiveSession(sess);
    setTab("chat");
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text, ts: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const res = await fetch("/api/agentes/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          squad_id: activeSquad.id,
          message: text,
          session_id: sessionId,
          history: messages,
          workspace_id: workspace.id,
          workspace_context: workspaceContext(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages(prev => [...prev, { role: "assistant", content: `Erro: ${data.error ?? "Falha"}` }]);
        return;
      }

      const assistantMsg: Message = { role: "assistant", content: data.response, ts: new Date().toISOString() };
      setMessages(prev => [...prev, assistantMsg]);

      if (data.session_id && !sessionId) {
        setSessionId(data.session_id);
        // Recarrega sessões do workspace
        const r = await fetch(`/api/workspaces/${workspace.id}`);
        const d = await r.json();
        if (d.sessions) setSessions(d.sessions);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Falha de conexão." }]);
    } finally {
      setLoading(false);
    }
  }

  async function synthesize() {
    setSynthesizing(true);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/synthesize`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.synthesis) {
        setWorkspace(prev => ({ ...prev, synthesis: data.synthesis, status: "sintetizado" }));
        setTab("synthesis");
      }
    } finally {
      setSynthesizing(false);
    }
  }

  async function copyText(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  const squadsBySessions = squads.map(sq => ({
    ...sq,
    sessionCount: sessions.filter(s => s.squad_id === sq.id).length,
  }));

  return (
    <div className="flex h-screen bg-[#09081A] overflow-hidden">

      {/* Sidebar esquerda — squads */}
      <div className="w-56 flex-shrink-0 border-r border-[#162744] flex flex-col">
        <div className="p-4 border-b border-[#162744]">
          <button
            onClick={() => router.push("/deal-rooms")}
            className="flex items-center gap-2 text-[#7A8FA8] hover:text-[#C9A84C] text-xs transition-colors mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Deal Rooms
          </button>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#C9A84C] flex-shrink-0" />
            <span className="text-[#F0ECE4] text-xs font-bold leading-tight line-clamp-2">{workspace.name}</span>
          </div>
          {workspace.context && (
            <p className="text-[#7A8FA8] text-[10px] mt-1.5 line-clamp-3 leading-relaxed">{workspace.context}</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <div className="text-[#7A8FA8] text-[9px] font-bold uppercase tracking-[2px] px-2 py-2">Squads</div>
          {squadsBySessions.map(sq => (
            <button
              key={sq.id}
              onClick={() => selectSquad(sq)}
              className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 transition-all ${
                activeSquad.id === sq.id
                  ? "bg-[#162744] border border-[#C9A84C]/30"
                  : "hover:bg-[#111F35]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold ${activeSquad.id === sq.id ? "text-[#F0ECE4]" : "text-[#7A8FA8]"}`}>
                  {sq.nome}
                </span>
                {sq.sessionCount > 0 && (
                  <span className="text-[9px] bg-[#C9A84C]/20 text-[#C9A84C] px-1.5 py-0.5 rounded-full font-bold">
                    {sq.sessionCount}
                  </span>
                )}
              </div>
              <div className="text-[#243A66] text-[9px] mt-0.5 line-clamp-1">{sq.tag}</div>
            </button>
          ))}
        </div>

        {/* Botão sintetizar */}
        <div className="p-3 border-t border-[#162744]">
          <button
            onClick={synthesize}
            disabled={synthesizing || sessions.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-[#C9A84C] text-xs font-bold py-2.5 rounded-lg hover:bg-[#C9A84C]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {synthesizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {synthesizing ? "Sintetizando…" : "Gerar Síntese"}
          </button>
          <p className="text-[#243A66] text-[9px] text-center mt-1">
            {sessions.length} conversa{sessions.length !== 1 ? "s" : ""} no workspace
          </p>
        </div>
      </div>

      {/* Área principal */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Tabs */}
        <div className="flex items-center border-b border-[#162744] px-4 pt-3 gap-1">
          {[
            { key: "chat", label: "Chat" },
            { key: "sessions", label: `Histórico (${sessions.length})` },
            { key: "synthesis", label: workspace.synthesis ? "Síntese Consolidada" : "Síntese" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key as typeof tab)}
              className={`text-xs font-semibold px-4 py-2.5 border-b-2 transition-colors ${
                tab === key
                  ? "border-[#C9A84C] text-[#C9A84C]"
                  : "border-transparent text-[#7A8FA8] hover:text-[#F0ECE4]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab: Chat */}
        {tab === "chat" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Squad header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#162744] bg-[#0d0d20]">
              <Bot className={`w-4 h-4 ${SQUAD_COLORS[activeSquad.id] ?? "text-[#C9A84C]"}`} />
              <div>
                <span className="text-[#F0ECE4] text-sm font-semibold">{activeSquad.nome}</span>
                <span className="text-[#7A8FA8] text-xs ml-2">{activeSquad.tag}</span>
              </div>
              {activeSession && (
                <span className="ml-auto text-[10px] text-[#243A66] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(activeSession.updated_at)}
                </span>
              )}
              {sessionId && (
                <button
                  onClick={() => { setMessages([]); setSessionId(null); setActiveSession(null); }}
                  className="ml-auto flex items-center gap-1.5 text-[#7A8FA8] text-[10px] hover:text-[#C9A84C] transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Nova conversa
                </button>
              )}
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className={`w-12 h-12 rounded-full bg-[#111F35] border border-[#243A66] flex items-center justify-center mb-3`}>
                    <Bot className={`w-5 h-5 ${SQUAD_COLORS[activeSquad.id] ?? "text-[#C9A84C]"}`} />
                  </div>
                  <p className="text-[#F0ECE4] text-sm font-semibold mb-1">{activeSquad.nome}</p>
                  <p className="text-[#7A8FA8] text-xs max-w-xs">{activeSquad.descricao}</p>
                  {sessions.length > 0 && (
                    <p className="text-[#C9A84C] text-[10px] mt-3 bg-[#C9A84C]/10 px-3 py-1.5 rounded-full border border-[#C9A84C]/20">
                      Contexto de {sessions.length} conversa{sessions.length > 1 ? "s" : ""} injetado automaticamente
                    </p>
                  )}
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-[#111F35] border border-[#243A66] flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className={`w-3.5 h-3.5 ${SQUAD_COLORS[activeSquad.id] ?? "text-[#C9A84C]"}`} />
                    </div>
                  )}
                  <div className={`max-w-[80%] ${msg.role === "user" ? "order-first" : ""}`}>
                    <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-[#162744] text-[#F0ECE4] rounded-br-sm"
                        : "bg-[#111F35] text-[#F0ECE4] rounded-bl-sm border border-[#162744]"
                    }`}>
                      {msg.content}
                    </div>
                    {msg.role === "assistant" && (
                      <button
                        onClick={() => copyText(msg.content, `msg-${i}`)}
                        className="mt-1 flex items-center gap-1 text-[#243A66] hover:text-[#C9A84C] text-[10px] transition-colors"
                      >
                        {copied === `msg-${i}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied === `msg-${i}` ? "Copiado" : "Copiar"}
                      </button>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-full bg-[#C9A84C]/20 border border-[#C9A84C]/30 flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="w-3.5 h-3.5 text-[#C9A84C]" />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#111F35] border border-[#243A66] flex items-center justify-center">
                    <Bot className={`w-3.5 h-3.5 ${SQUAD_COLORS[activeSquad.id] ?? "text-[#C9A84C]"}`} />
                  </div>
                  <div className="bg-[#111F35] border border-[#162744] rounded-xl px-4 py-3">
                    <Loader2 className="w-4 h-4 text-[#C9A84C] animate-spin" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-[#162744]">
              <div className="flex gap-3 items-end bg-[#111F35] border border-[#243A66] rounded-xl px-3 py-2 focus-within:border-[#C9A84C] transition-colors">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => {
                    setInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                  }}
                  placeholder={`Pergunte ao ${activeSquad.nome}…`}
                  rows={1}
                  className="flex-1 bg-transparent text-[#F0ECE4] text-sm placeholder-[#243A66] resize-none focus:outline-none leading-relaxed"
                />
                <button
                  onClick={send}
                  disabled={loading || !input.trim()}
                  className="w-8 h-8 flex items-center justify-center bg-[#C9A84C] rounded-lg hover:bg-[#E8C97A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <Send className="w-3.5 h-3.5 text-[#09081A]" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Histórico de sessões */}
        {tab === "sessions" && (
          <div className="flex-1 overflow-y-auto p-4">
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Clock className="w-8 h-8 text-[#243A66] mb-3" />
                <p className="text-[#7A8FA8] text-sm">Nenhuma conversa ainda neste workspace.</p>
                <button onClick={() => setTab("chat")} className="text-[#C9A84C] text-xs mt-2 hover:underline">
                  Começar pesquisa →
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[#7A8FA8] text-xs mb-4">
                  {sessions.length} conversa{sessions.length > 1 ? "s" : ""} registrada{sessions.length > 1 ? "s" : ""} neste deal room.
                  Clique para retomar qualquer uma.
                </p>
                {sessions.map(sess => {
                  const squad = squads.find(s => s.id === sess.squad_id);
                  const lastMsg = [...sess.messages].reverse().find(m => m.role === "assistant");
                  return (
                    <button
                      key={sess.id}
                      onClick={() => loadSession(sess)}
                      className="w-full text-left bg-[#111F35] border border-[#243A66] rounded-xl p-4 hover:border-[#C9A84C] hover:bg-[#162744] transition-all group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className={`text-xs font-bold ${SQUAD_COLORS[sess.squad_id] ?? "text-[#C9A84C]"}`}>
                          {squad?.nome ?? sess.squad_id}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[#7A8FA8] text-[10px]">{formatDate(sess.updated_at)}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-[#243A66] group-hover:text-[#C9A84C] transition-colors" />
                        </div>
                      </div>
                      <p className="text-[#F0ECE4] text-sm font-semibold mb-1 line-clamp-1">{sess.title}</p>
                      {lastMsg && (
                        <p className="text-[#7A8FA8] text-xs line-clamp-2 leading-relaxed">
                          {lastMsg.content.substring(0, 200)}
                        </p>
                      )}
                      <div className="flex items-center gap-1 mt-2 text-[#243A66] text-[10px]">
                        <FileText className="w-3 h-3" />
                        {sess.messages.length} mensagens
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab: Síntese */}
        {tab === "synthesis" && (
          <div className="flex-1 overflow-y-auto p-4">
            {!workspace.synthesis ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Sparkles className="w-8 h-8 text-[#243A66] mb-3" />
                <p className="text-[#F0ECE4] text-sm font-semibold mb-1">Síntese ainda não gerada</p>
                <p className="text-[#7A8FA8] text-xs max-w-xs mb-4">
                  Pesquise com os squads e clique em "Gerar Síntese" para consolidar toda a inteligência num deal brief.
                </p>
                {sessions.length === 0 ? (
                  <button onClick={() => setTab("chat")} className="text-[#C9A84C] text-xs hover:underline">
                    Começar pesquisa →
                  </button>
                ) : (
                  <button
                    onClick={synthesize}
                    disabled={synthesizing}
                    className="flex items-center gap-2 bg-[#C9A84C] text-[#09081A] text-xs font-bold px-4 py-2 rounded-lg hover:bg-[#E8C97A] transition-colors disabled:opacity-40"
                  >
                    {synthesizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {synthesizing ? "Gerando…" : "Gerar Síntese Agora"}
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-[#C9A84C] text-[9px] font-bold tracking-[2px] uppercase mb-1">Deal Brief Consolidado</div>
                    <p className="text-[#7A8FA8] text-xs">
                      Gerado de {workspace.synthesis.sessions_count} conversa{workspace.synthesis.sessions_count > 1 ? "s" : ""} ·{" "}
                      {formatDate(workspace.synthesis.generated_at)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyText(workspace.synthesis!.text, "synthesis")}
                      className="flex items-center gap-1.5 text-xs text-[#7A8FA8] hover:text-[#C9A84C] border border-[#243A66] hover:border-[#C9A84C] px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {copied === "synthesis" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied === "synthesis" ? "Copiado" : "Copiar"}
                    </button>
                    <button
                      onClick={synthesize}
                      disabled={synthesizing}
                      className="flex items-center gap-1.5 text-xs text-[#C9A84C] border border-[#C9A84C]/30 hover:bg-[#C9A84C]/10 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                    >
                      {synthesizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      {synthesizing ? "Regenerando…" : "Regenerar"}
                    </button>
                  </div>
                </div>
                <div className="bg-[#111F35] border border-[#162744] rounded-xl p-5 text-[#F0ECE4] text-sm leading-relaxed whitespace-pre-wrap font-mono">
                  {workspace.synthesis.text}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
