"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, Plus, Bot, User, Copy, Check, Download, ChevronRight, Loader2, FileText } from "lucide-react";
import type { Squad } from "@/lib/squads";

interface Message { role: "user" | "assistant"; content: string; ts?: string; }
interface Session { id: string; squad_id: string; title: string; updated_at: string; }

interface Props {
  squads: Squad[];
  userRole: string;
  userName: string;
}

const SETOR_COLORS: Record<string, string> = {
  "analista-ma":        "border-[#C9A84C]",
  "deal-hunter":        "border-[#C9A84C]",
  "estrategista":       "border-[#C9A84C]",
  "monitor-regulatorio":"border-[#C9A84C]",
  "pesquisador":        "border-[#C9A84C]",
};

export function AgentesClient({ squads, userName }: Props) {
  const [activeSquad, setActiveSquad]     = useState<Squad>(squads[0]);
  const [messages, setMessages]           = useState<Message[]>([]);
  const [sessions, setSessions]           = useState<Session[]>([]);
  const [sessionId, setSessionId]         = useState<string | null>(null);
  const [input, setInput]                 = useState("");
  const [loading, setLoading]             = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [copied, setCopied]               = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen]     = useState(false);
  const [exporting, setExporting]         = useState(false);
  const [exportDone, setExportDone]       = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load sessions for active squad
  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch(`/api/agentes/sessions?squad_id=${activeSquad.id}`);
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch { /* silencioso */ }
    setLoadingSessions(false);
  }, [activeSquad.id]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Switch squad — new session
  function selectSquad(squad: Squad) {
    setActiveSquad(squad);
    setMessages([]);
    setSessionId(null);
    setInput("");
    setSidebarOpen(false);
  }

  // Load session history
  async function loadSession(sess: Session) {
    try {
      const res = await fetch(`/api/agentes/sessions?squad_id=${sess.squad_id}`);
      const data = await res.json();
      const full = data.sessions?.find((s: Session) => s.id === sess.id);
      // Full session data would need a separate endpoint — for now just switch
      setSessionId(sess.id);
      setSidebarOpen(false);
    } catch { /* silencioso */ }
  }

  // New session
  function newSession() {
    setMessages([]);
    setSessionId(null);
    setInput("");
  }

  // Send message
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
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `⚠️ Erro: ${data.error ?? "Falha na comunicação com o agente."}`,
        }]);
        return;
      }

      const assistantMsg: Message = {
        role: "assistant",
        content: data.response,
        ts: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      if (data.session_id && !sessionId) {
        setSessionId(data.session_id);
        loadSessions();
      }
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "⚠️ Falha de conexão. Verifique sua internet e tente novamente.",
      }]);
    } finally {
      setLoading(false);
    }
  }

  // Copy message
  async function copyMsg(content: string, id: string) {
    await navigator.clipboard.writeText(content);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  // Export last assistant message as deal
  async function exportAsDeal() {
    const last = [...messages].reverse().find(m => m.role === "assistant");
    if (!last) return;
    const res = await fetch("/api/hub/share-deal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dealId: sessionId ?? "novo",
        empresaNome: `[${activeSquad.nome}] ${messages[0]?.content?.substring(0, 40) ?? "Deal"}`,
        setor: "ma_cross_border",
        valorEstimado: 0,
        sugestaoTese: last.content,
        emails: [],
      }),
    });
    if (res.ok) alert("Sessão exportada com sucesso.");
  }

  // Export as V3 HTML Report
  async function exportAsV3Report() {
    const last = [...messages].reverse().find(m => m.role === "assistant");
    if (!last || exporting) return;

    setExporting(true);
    setExportDone(false);

    const title = messages[0]?.content?.substring(0, 80) ?? "Relatório V3";

    try {
      const res = await fetch("/api/agentes/export-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: last.content,
          squad_id: activeSquad.id,
          title,
          session_id: sessionId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.html) throw new Error(data.error ?? "Falha");

      // Abrir HTML em nova aba
      const blob = new Blob([data.html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      setExportDone(true);
      setTimeout(() => setExportDone(false), 3000);
    } catch (err) {
      alert("Erro ao gerar relatório: " + (err instanceof Error ? err.message : "desconhecido"));
    } finally {
      setExporting(false);
    }
  }

  // Export as text file
  function exportAsText() {
    const content = messages
      .map(m => `[${m.role === "user" ? userName || "Você" : activeSquad.nome}]\n${m.content}`)
      .join("\n\n---\n\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `v3-${activeSquad.id}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Auto-resize textarea
  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div className="flex h-[calc(100vh-64px)] bg-[#09081A] overflow-hidden">

      {/* ── Squad Sidebar ── */}
      <div className="w-64 shrink-0 bg-[#111F35] border-r border-[#243A66] flex flex-col">
        <div className="px-4 py-4 border-b border-[#243A66]">
          <span className="text-[#C9A84C] text-[9px] font-bold tracking-[2px] uppercase">Squads V3</span>
          <p className="text-[#7A8FA8] text-[10px] mt-0.5">Selecione um agente</p>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {squads.map(sq => (
            <button
              key={sq.id}
              onClick={() => selectSquad(sq)}
              className={`w-full text-left px-4 py-3 transition-colors border-l-2 ${
                activeSquad.id === sq.id
                  ? "bg-[#162744] border-[#C9A84C] text-[#F0ECE4]"
                  : "border-transparent text-[#7A8FA8] hover:bg-[#162744] hover:text-[#F0ECE4]"
              }`}
            >
              <div className="text-xs font-semibold">{sq.nome}</div>
              <div className="text-[10px] mt-0.5 opacity-70 leading-tight">{sq.descricao}</div>
            </button>
          ))}
        </div>

        {/* Session history */}
        <div className="border-t border-[#243A66] p-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-between text-[10px] text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors"
          >
            <span>Sessões anteriores ({sessions.length})</span>
            <ChevronRight className={`w-3 h-3 transition-transform ${sidebarOpen ? "rotate-90" : ""}`} />
          </button>
          {sidebarOpen && (
            <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
              {loadingSessions ? (
                <Loader2 className="w-3 h-3 animate-spin text-[#7A8FA8] mx-auto" />
              ) : sessions.length === 0 ? (
                <p className="text-[#7A8FA8] text-[10px] text-center py-2">Nenhuma sessão</p>
              ) : sessions.map(sess => (
                <button
                  key={sess.id}
                  onClick={() => loadSession(sess)}
                  className={`w-full text-left text-[10px] px-2 py-1.5 rounded transition-colors truncate ${
                    sessionId === sess.id
                      ? "bg-[#C9A84C]/20 text-[#C9A84C]"
                      : "text-[#7A8FA8] hover:bg-[#162744] hover:text-[#F0ECE4]"
                  }`}
                >
                  {sess.title}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Main Chat Area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[#243A66] bg-[#111F35] shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-[#C9A84C]" />
              <span className="text-[#F0ECE4] font-semibold text-sm">{activeSquad.nome}</span>
              <span className="text-[#C9A84C] text-[9px] font-bold tracking-[1px] uppercase bg-[#C9A84C]/10 px-2 py-0.5 rounded-full">
                {activeSquad.tag}
              </span>
            </div>
            <p className="text-[#7A8FA8] text-[10px] mt-0.5">{activeSquad.descricao}</p>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={exportAsV3Report}
                  disabled={exporting}
                  className="flex items-center gap-1.5 text-[10px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed text-[#09081A] bg-[#C9A84C] hover:bg-[#E8C97A] px-3 py-1.5 rounded-lg transition-colors"
                >
                  {exporting ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Gerando...</>
                  ) : exportDone ? (
                    <><Check className="w-3 h-3" /> Relatório gerado!</>
                  ) : (
                    <><FileText className="w-3 h-3" /> Gerar Relatório V3</>
                  )}
                </button>
                <button
                  onClick={exportAsText}
                  className="flex items-center gap-1.5 text-[10px] text-[#7A8FA8] hover:text-[#F0ECE4] px-2.5 py-1.5 rounded-lg border border-[#243A66] hover:border-[#C9A84C] transition-colors"
                >
                  <Download className="w-3 h-3" />
                  .txt
                </button>
              </div>
            )}
            <button
              onClick={newSession}
              className="flex items-center gap-1.5 text-[10px] text-[#09081A] bg-[#C9A84C] hover:bg-[#E8C97A] font-bold px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-3 h-3" />
              Nova sessão
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 ? (
            <WelcomeScreen squad={activeSquad} onSuggest={text => { setInput(text); textareaRef.current?.focus(); }} />
          ) : (
            messages.map((msg, i) => (
              <MessageBubble
                key={i}
                msg={msg}
                squad={activeSquad}
                userName={userName}
                copied={copied}
                onCopy={content => copyMsg(content, `msg-${i}`)}
                copyId={`msg-${i}`}
              />
            ))
          )}
          {loading && <ThinkingIndicator squad={activeSquad} />}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-[#243A66] bg-[#111F35] shrink-0">
          <div className="flex gap-3 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={`Pergunte ao ${activeSquad.nome}… (Enter para enviar, Shift+Enter para nova linha)`}
              rows={1}
              className="flex-1 bg-[#09081A] border border-[#243A66] focus:border-[#C9A84C] rounded-xl px-4 py-3 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8] resize-none outline-none transition-colors leading-relaxed"
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="w-11 h-11 flex items-center justify-center bg-[#C9A84C] hover:bg-[#E8C97A] disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 text-[#09081A] animate-spin" /> : <Send className="w-4 h-4 text-[#09081A]" />}
            </button>
          </div>
          <p className="text-[#7A8FA8] text-[10px] mt-2 text-center">
            Respostas geradas por IA · Valide informações críticas antes de agir · Sócio responsável: {activeSquad.id === "monitor-regulatorio" ? "Robson Lino" : "João Lemos"}
          </p>
        </div>
      </div>
    </div>
  );
}

function WelcomeScreen({ squad, onSuggest }: { squad: Squad; onSuggest: (t: string) => void }) {
  const SUGESTOES: Record<string, string[]> = {
    "analista-ma": [
      "Analise uma distribuidora de alimentos com faturamento de R$ 20M e EBITDA de 8%",
      "Qual instrumento financeiro é mais adequado para antecipar recebíveis de uma construtora?",
      "Faça um checklist de due diligence para aquisição de uma usina sucroalcooleira",
    ],
    "deal-hunter": [
      "Mapeie frigoríficos no Nordeste com potencial de venda nos próximos 12 meses",
      "Identifique empresas familiares em processo de sucessão no setor de mineração",
      "Quais sinais indicam que uma empresa está disponível para M&A?",
    ],
    "estrategista": [
      "Estruture uma operação de SLB para um galpão logístico de R$ 8M",
      "Compare CRI vs FIDC para securitização de recebíveis imobiliários",
      "Calcule o fee V3 para uma operação de captação de R$ 15M",
    ],
    "monitor-regulatorio": [
      "Resuma as principais mudanças da CVM Resolução 88 para tokenização",
      "Quais são as obrigações PLD-FT para uma securitizadora em 2026?",
      "Como estruturar uma operação cross-border dentro da regulação do Banco Central?",
    ],
    "pesquisador": [
      "Faça um relatório do mercado de mineração de lítio no Brasil em 2026",
      "Mapeie os principais players do mercado de precatórios federais",
      "Analise o setor sucroalcooleiro: oportunidades e riscos para 2026/27",
    ],
  };

  const sugestoes = SUGESTOES[squad.id] ?? [];

  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-12">
      <div className="w-16 h-16 rounded-2xl bg-[#111F35] border border-[#243A66] flex items-center justify-center mb-4">
        <Bot className="w-8 h-8 text-[#C9A84C]" />
      </div>
      <h2 className="text-[#F0ECE4] text-xl font-bold mb-1">{squad.nome}</h2>
      <p className="text-[#7A8FA8] text-sm mb-8 max-w-sm">{squad.descricao}</p>

      {sugestoes.length > 0 && (
        <div className="w-full max-w-lg space-y-2">
          <p className="text-[#7A8FA8] text-[10px] uppercase tracking-[2px] mb-3">Sugestões para começar</p>
          {sugestoes.map((s, i) => (
            <button
              key={i}
              onClick={() => onSuggest(s)}
              className="w-full text-left text-sm text-[#7A8FA8] hover:text-[#F0ECE4] bg-[#111F35] hover:bg-[#162744] border border-[#243A66] hover:border-[#C9A84C] rounded-xl px-4 py-3 transition-all"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg, squad, userName, copied, onCopy, copyId }: {
  msg: Message; squad: Squad; userName: string;
  copied: string | null; onCopy: (c: string) => void; copyId: string;
}) {
  const isUser = msg.role === "user";

  return (
    <div className={`flex gap-3 group ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        isUser ? "bg-[#243A66]" : "bg-[#C9A84C]/20"
      }`}>
        {isUser
          ? <User className="w-4 h-4 text-[#7A8FA8]" />
          : <Bot className="w-4 h-4 text-[#C9A84C]" />
        }
      </div>

      {/* Bubble */}
      <div className={`flex flex-col max-w-[75%] ${isUser ? "items-end" : "items-start"}`}>
        <span className="text-[10px] text-[#7A8FA8] mb-1 px-1">
          {isUser ? (userName || "Você") : squad.nome}
        </span>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-[#243A66] text-[#F0ECE4] rounded-tr-sm"
            : "bg-[#111F35] border border-[#243A66] text-[#F0ECE4] rounded-tl-sm"
        }`}>
          {msg.content}
        </div>
        {/* Copy button */}
        {!isUser && (
          <button
            onClick={() => onCopy(msg.content)}
            className="mt-1 flex items-center gap-1 text-[10px] text-[#7A8FA8] hover:text-[#C9A84C] opacity-0 group-hover:opacity-100 transition-all px-1"
          >
            {copied === copyId
              ? <><Check className="w-3 h-3" /> Copiado</>
              : <><Copy className="w-3 h-3" /> Copiar</>
            }
          </button>
        )}
      </div>
    </div>
  );
}

function ThinkingIndicator({ squad }: { squad: Squad }) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-[#C9A84C]/20 flex items-center justify-center shrink-0">
        <Bot className="w-4 h-4 text-[#C9A84C]" />
      </div>
      <div className="bg-[#111F35] border border-[#243A66] rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex gap-1 items-center">
          <span className="text-[#7A8FA8] text-xs">{squad.nome} está pensando</span>
          <span className="flex gap-0.5">
            {[0,1,2].map(i => (
              <span key={i} className="w-1 h-1 rounded-full bg-[#C9A84C] animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}
