"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Bot, User, FileText, AlertCircle } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  ts?: string;
}

interface DealIaChatProps {
  dealId: string;
  dealTitle?: string;
}

export function DealIaChat({ dealId, dealTitle }: DealIaChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [docsLoaded, setDocsLoaded] = useState<number | null>(null);
  const [docsPending, setDocsPending] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const msg = input.trim();
    if (!msg || loading) return;

    setInput("");
    setError(null);
    setMessages(prev => [...prev, { role: "user", content: msg, ts: new Date().toISOString() }]);
    setLoading(true);

    try {
      const res = await fetch(`/api/ma/deals/${dealId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, session_id: sessionId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao processar mensagem.");
        setMessages(prev => prev.slice(0, -1));
        return;
      }

      setMessages(prev => [...prev, { role: "assistant", content: data.response, ts: new Date().toISOString() }]);
      if (data.session_id && !sessionId) setSessionId(data.session_id);
      if (data.docs_loaded != null) setDocsLoaded(data.docs_loaded);
      if (data.docs_pending != null) setDocsPending(data.docs_pending);
    } catch {
      setError("Falha de conexão. Tente novamente.");
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex flex-col h-[560px] rounded-xl border border-[#1E3A5F] bg-[#09111D] overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E3A5F] bg-[#0B1623]">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-[#C9A84C]" />
          <span className="text-xs font-bold text-[#C9A84C] uppercase tracking-wider">IA Dedicada</span>
          <span className="text-xs text-[#9BAFC5] truncate max-w-[220px]">{dealTitle}</span>
        </div>
        <div className="flex items-center gap-2">
          {docsLoaded != null && (
            <div className="flex items-center gap-1 text-[10px] text-[#9BAFC5]">
              <FileText className="w-3 h-3" />
              {docsLoaded} doc{docsLoaded !== 1 ? "s" : ""} lido{docsLoaded !== 1 ? "s" : ""}
            </div>
          )}
          {docsPending != null && docsPending > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-400/10 border border-amber-400/25 px-2 py-0.5 rounded-full">
              <AlertCircle className="w-2.5 h-2.5" />
              {docsPending} pendente{docsPending !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>

      {/* Pending docs warning banner */}
      {docsPending != null && docsPending > 0 && (
        <div className="flex items-start gap-2 px-4 py-2.5 bg-amber-400/8 border-b border-amber-400/20">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-300/80 leading-snug">
            <span className="font-semibold text-amber-400">{docsPending} documento{docsPending !== 1 ? "s" : ""} ainda não processado{docsPending !== 1 ? "s" : ""} pelo OCR.</span>{" "}
            O agente não tem acesso ao conteúdo desse{docsPending !== 1 ? "s" : ""} arquivo{docsPending !== 1 ? "s" : ""} — processe-o{docsPending !== 1 ? "s" : ""} antes de fazer perguntas que dependam de seu conteúdo.
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8">
            <Bot className="w-10 h-10 text-[#C9A84C]/40" />
            <p className="text-sm text-[#9BAFC5] max-w-xs">
              Analista dedicado a este deal. Faça perguntas sobre o ativo, valide a tese ou ajuste a narrativa com base nos dados reais.
            </p>
            <p className="text-[11px] text-[#9BAFC5]/60">
              Apenas dados carregados do banco e documentos OCR são usados como fonte.
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#C9A84C]/15 border border-[#C9A84C]/30 flex items-center justify-center mt-0.5">
                <Bot className="w-3 h-3 text-[#C9A84C]" />
              </div>
            )}
            <div className={`max-w-[82%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
              m.role === "user"
                ? "bg-[#C9A84C]/10 border border-[#C9A84C]/20 text-[#F5F1E8]"
                : "bg-[#0F2035] border border-[#1E3A5F] text-[#E0E8F5]"
            }`}>
              {m.content}
            </div>
            {m.role === "user" && (
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#1E3A5F] border border-[#243A66] flex items-center justify-center mt-0.5">
                <User className="w-3 h-3 text-[#9BAFC5]" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5 justify-start">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#C9A84C]/15 border border-[#C9A84C]/30 flex items-center justify-center mt-0.5">
              <Bot className="w-3 h-3 text-[#C9A84C]" />
            </div>
            <div className="bg-[#0F2035] border border-[#1E3A5F] rounded-xl px-3.5 py-2.5 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-[#C9A84C] animate-spin" />
              <span className="text-xs text-[#9BAFC5]">Analisando...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            <span className="text-xs text-red-400">{error}</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-[#1E3A5F] bg-[#0B1623]">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Pergunte sobre o deal, valide dados ou ajuste a tese..."
            rows={1}
            className="flex-1 resize-none bg-[#0F2035] border border-[#1E3A5F] rounded-lg px-3 py-2 text-sm text-[#F5F1E8] placeholder-[#9BAFC5]/50 focus:outline-none focus:border-[#C9A84C]/40 transition-colors min-h-[38px] max-h-[100px]"
            style={{ height: "auto" }}
            onInput={e => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = Math.min(t.scrollHeight, 100) + "px";
            }}
            disabled={loading}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 w-9 h-9 rounded-lg bg-[#C9A84C]/15 border border-[#C9A84C]/30 flex items-center justify-center text-[#C9A84C] hover:bg-[#C9A84C]/25 hover:border-[#C9A84C]/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-[#9BAFC5]/50 mt-1.5 px-0.5">
          Enter para enviar · Shift+Enter para nova linha · Fonte: dados reais deste deal
        </p>
      </div>
    </div>
  );
}
