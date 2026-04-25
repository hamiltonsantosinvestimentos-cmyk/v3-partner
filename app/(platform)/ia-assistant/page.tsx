"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  BrainCircuit,
  Send,
  User,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Building2,
  PieChart,
  Landmark,
  BookOpen,
  Scale,
  History,
  X,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ConversationSession {
  id: string;
  title: string;
  messages: Message[];
  updated_at: string;
}

const SUGGESTED_QUESTIONS = [
  {
    icon: <TrendingUp className="w-4 h-4" />,
    category: "Meu Desempenho",
    question: "Como está meu desempenho este mês? Estou batendo as metas?",
  },
  {
    icon: <Building2 className="w-4 h-4" />,
    category: "Meus Deals",
    question: "Quais são meus deals M&A ativos? Algum parado há muito tempo?",
  },
  {
    icon: <Landmark className="w-4 h-4" />,
    category: "Mercado de Capitais",
    question: "Qual a diferença entre CRI, CRA, FIDC e Debêntures Incentivadas para captação corporativa?",
  },
  {
    icon: <PieChart className="w-4 h-4" />,
    category: "M&A Valuation",
    question: "Como calcular o múltiplo de EBITDA em um M&A mid-market? Quais os múltiplos setoriais no Brasil?",
  },
  {
    icon: <TrendingUp className="w-4 h-4" />,
    category: "High Ticket",
    question: "Como estruturar um Project Finance com SPE e DSCR? Quais as garantias exigidas?",
  },
  {
    icon: <Scale className="w-4 h-4" />,
    category: "Compliance PLD",
    question: "Quais as obrigações de PLD/FT para correspondentes bancários? COAF, KYC e monitoramento",
  },
  {
    icon: <BookOpen className="w-4 h-4" />,
    category: "Câmbio & Cross-border",
    question: "Como funciona a remessa de lucros ao exterior e o hedge cambial para empresas exportadoras?",
  },
  {
    icon: <Building2 className="w-4 h-4" />,
    category: "Previdência",
    question: "PGBL vs VGBL: quando indicar cada um? Como funciona a tabela regressiva de IR?",
  },
];

export default function IAAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/ia-conversations");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions ?? []);
      }
    } catch {
      // silencioso
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const saveSession = useCallback(async (msgs: Message[], sid: string | null) => {
    if (msgs.length < 2) return;
    try {
      const res = await fetch("/api/ia-conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sid,
          messages: msgs,
          title: msgs[0]?.content?.slice(0, 80),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (!sid && data.session_id) setSessionId(data.session_id);
      }
    } catch {
      // silencioso
    }
  }, []);

  const restoreSession = (session: ConversationSession) => {
    setMessages(session.messages);
    setSessionId(session.id);
    setShowHistory(false);
  };

  const deleteSession = async (e: React.MouseEvent, sid: string) => {
    e.stopPropagation();
    try {
      await fetch(`/api/ia-conversations?session_id=${sid}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.id !== sid));
      if (sessionId === sid) {
        setMessages([]);
        setSessionId(null);
      }
    } catch {
      // silencioso
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: content.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    const assistantMessage: Message = { role: "assistant", content: "" };
    setMessages([...newMessages, assistantMessage]);

    try {
      const response = await fetch("/api/ia-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) throw new Error("Erro na requisição");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        fullContent += decoder.decode(value);
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: fullContent };
          return updated;
        });
      }

      // Salva sessão após resposta completa
      const finalMessages = [...newMessages, { role: "assistant" as const, content: fullContent }];
      await saveSession(finalMessages, sessionId);
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Desculpe, ocorreu um erro ao processar sua pergunta. Tente novamente.",
        };
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setInput("");
    setSessionId(null);
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-3.5rem-2.5rem)] max-h-[860px] animate-fade-in">
      {/* Painel de histórico */}
      {showHistory && (
        <div className="w-72 flex-shrink-0 flex flex-col rounded-xl border border-[#C9A84C]/20 bg-[#09081A] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#122036]">
            <span className="text-sm font-semibold text-white">Histórico</span>
            <button
              onClick={() => setShowHistory(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loadingHistory && (
              <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>
            )}
            {!loadingHistory && sessions.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhuma conversa salva</p>
            )}
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => restoreSession(session)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all group flex items-start gap-2",
                  sessionId === session.id
                    ? "bg-[#C9A84C]/15 border border-[#C9A84C]/30 text-foreground"
                    : "hover:bg-[#122036] text-muted-foreground hover:text-foreground"
                )}
              >
                <BrainCircuit className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-[#C9A84C]" />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{session.title}</p>
                  <p className="text-[10px] opacity-60 mt-0.5">
                    {new Date(session.updated_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <button
                  onClick={(e) => deleteSession(e, session.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-400 flex-shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </button>
            ))}
          </div>
          <div className="p-2 border-t border-[#122036]">
            <button
              onClick={startNewConversation}
              className="w-full text-xs text-center py-2 rounded-lg border border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-colors"
            >
              + Nova conversa
            </button>
          </div>
        </div>
      )}

      {/* Chat principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#C9A84C] to-[#8B5E1A] flex items-center justify-center shadow-lg shadow-[#C9A84C]/20">
              <BrainCircuit className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white">V3 IA Partner</h1>
                <span className="text-[10px] font-semibold bg-[#C9A84C]/20 text-[#E8C97A] border border-[#C9A84C]/30 px-2 py-0.5 rounded-full">
                  Powered by Claude
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Especialista financeiro · Acessa seus dados em tempo real
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowHistory((v) => !v);
                if (!showHistory) loadHistory();
              }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-secondary"
            >
              <History className="w-3.5 h-3.5" />
              Histórico
            </button>
            {messages.length > 0 && (
              <button
                onClick={startNewConversation}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-secondary"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Nova conversa
              </button>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto rounded-xl border border-[#C9A84C]/20 bg-[#09081A] p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-6 py-4">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-2xl bg-[#C9A84C]/10 border border-[#C9A84C]/25 flex items-center justify-center mx-auto">
                  <Sparkles className="w-8 h-8 text-[#C9A84C]" />
                </div>
                <h2 className="text-lg font-semibold text-white">Como posso te ajudar?</h2>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Tenho acesso aos seus dados — propostas, deals, metas e comissões — para responder com precisão.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl">
                {SUGGESTED_QUESTIONS.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(item.question)}
                    className="text-left p-3 rounded-lg border border-[#122036] hover:border-[#C9A84C]/40 hover:bg-[#C9A84C]/5 text-xs text-muted-foreground hover:text-foreground transition-all group"
                  >
                    <div className="flex items-center gap-1.5 mb-1 text-[#C9A84C] group-hover:text-[#E8C97A]">
                      {item.icon}
                      <span className="font-semibold text-[10px] uppercase tracking-wide">{item.category}</span>
                    </div>
                    {item.question}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message, i) => (
                <div
                  key={i}
                  className={cn("flex gap-3", message.role === "user" ? "justify-end" : "justify-start")}
                >
                  {message.role === "assistant" && (
                    <div className="w-7 h-7 rounded-lg bg-[#C9A84C]/20 border border-[#C9A84C]/30 flex items-center justify-center flex-shrink-0 mt-1">
                      <BrainCircuit className="w-4 h-4 text-[#C9A84C]" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-xl px-4 py-3 text-sm",
                      message.role === "user"
                        ? "bg-[#C9A84C] text-white"
                        : "bg-[#091221] border border-[#122036] text-foreground"
                    )}
                  >
                    {message.role === "assistant" ? (
                      <div
                        className="prose prose-sm prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: formatMarkdown(message.content) }}
                      />
                    ) : (
                      message.content
                    )}
                    {message.role === "assistant" && message.content === "" && isLoading && (
                      <div className="flex gap-1 items-center h-4">
                        <span className="w-1.5 h-1.5 bg-[#C9A84C] rounded-full animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 bg-[#C9A84C] rounded-full animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 bg-[#C9A84C] rounded-full animate-bounce [animation-delay:300ms]" />
                      </div>
                    )}
                  </div>
                  {message.role === "user" && (
                    <div className="w-7 h-7 rounded-lg bg-[#C9A84C]/20 border border-[#C9A84C]/30 flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="w-4 h-4 text-[#C9A84C]" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="mt-3">
          <div className="flex gap-2 p-3 bg-[#09081A] border border-[#C9A84C]/25 rounded-xl focus-within:border-[#C9A84C]/50 transition-colors">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte sobre seu desempenho, SELIC, crédito, M&A, câmbio, regulação..."
              rows={1}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none min-h-[24px] max-h-24"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="w-8 h-8 rounded-lg bg-[#C9A84C] hover:bg-[#E8C97A] flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed transition-all self-end"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-1.5">
            Enter para enviar · Shift+Enter para nova linha
          </p>
        </form>
      </div>
    </div>
  );
}

function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, '<code class="bg-[#0F1E35] px-1 py-0.5 rounded text-xs text-[#E8C97A]">$1</code>')
    .replace(/^## (.*)/gm, '<h2 class="text-base font-bold mt-3 mb-1 text-[#E8C97A]">$1</h2>')
    .replace(/^### (.*)/gm, '<h3 class="text-sm font-semibold mt-2 mb-1 text-[#C9A84C]">$1</h3>')
    .replace(/^> (.*)/gm, '<blockquote class="border-l-2 border-[#C9A84C] pl-3 text-muted-foreground italic my-1">$1</blockquote>')
    .replace(/^- (.*)/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^(\d+)\. (.*)/gm, '<li class="ml-4 list-decimal">$2</li>')
    .replace(/\n\n/g, '</p><p class="mt-2">')
    .replace(/\n/g, "<br>");
}
