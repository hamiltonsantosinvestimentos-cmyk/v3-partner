"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Loader2, Bot, User, Mic } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  listingId: string;
  anonymousId: string;
  onClose: () => void;
}

export function AssetAssistant({ listingId, anonymousId, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [docsLoaded, setDocsLoaded] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reidrata a conversa já existente deste usuário para este ativo, ao abrir
  // o assistente — antes desta correção, a conversa vivia só em useState e
  // era apagada toda vez que o modal fechava.
  useEffect(() => {
    let cancelled = false;
    setLoadingHistory(true);
    fetch(`/api/cm/assistant?listing_id=${listingId}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setMessages(json.messages ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => { cancelled = true; };
  }, [listingId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const q = input.trim();
    if (!q || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/cm/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listingId, question: q }),
      });
      const json = await res.json();
      if (json.answer) {
        setMessages((prev) => [...prev, { role: "assistant", content: json.answer }]);
        setDocsLoaded(json.docs_loaded ?? 0);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: json.error ?? "Erro ao consultar o ativo." }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Erro de conexão." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg bg-[#09081A] border border-[#C9A84C]/30 rounded-xl overflow-hidden flex flex-col" style={{ height: "70vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#C9A84C]/20 bg-[#12112A]">
          <div className="flex items-center gap-2">
            <Bot size={18} className="text-[#C9A84C]" />
            <span className="text-sm font-bold text-[#F5F1E8]">Assistente do Ativo</span>
            <span className="text-[10px] font-bold text-[#C9A84C] tracking-wider">{anonymousId}</span>
          </div>
          <div className="flex items-center gap-3">
            {docsLoaded !== null && (
              <span className="text-[10px] text-[#9BAFC5]">{docsLoaded} doc(s) carregados</span>
            )}
            <button onClick={onClose} className="text-[#9BAFC5] hover:text-[#F5F1E8] text-lg leading-none">&times;</button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {loadingHistory && (
            <div className="text-center py-12 text-[#9BAFC5] text-sm">
              <Loader2 size={24} className="mx-auto mb-2 animate-spin text-[#C9A84C]" />
              <p>Carregando conversa...</p>
            </div>
          )}
          {!loadingHistory && messages.length === 0 && (
            <div className="text-center py-12 text-[#9BAFC5] text-sm">
              <Bot size={40} className="mx-auto mb-3 opacity-30" />
              <p>Pergunte sobre este ativo.</p>
              <p className="text-xs mt-1 opacity-60">A IA consulta apenas os documentos deste listing.</p>
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {["Qual o risco de glosa?", "Valor de face bate com os docs?", "Resumo do ativo"].map((s) => (
                  <button
                    key={s}
                    onClick={() => { setInput(s); }}
                    className="text-[10px] px-3 py-1.5 border border-[#C9A84C]/20 rounded-full text-[#C9A84C] hover:bg-[#C9A84C]/10 transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && <Bot size={16} className="text-[#C9A84C] mt-1 flex-shrink-0" />}
              <div className={`max-w-[80%] px-3 py-2 rounded-lg text-xs leading-relaxed ${
                m.role === "user"
                  ? "bg-[#C9A84C]/15 text-[#F5F1E8]"
                  : "bg-[#162744] text-[#F5F1E8] border border-[#9BAFC5]/10"
              }`}>
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
              {m.role === "user" && <User size={16} className="text-[#9BAFC5] mt-1 flex-shrink-0" />}
            </div>
          ))}
          {loading && (
            <div className="flex gap-2 items-center">
              <Bot size={16} className="text-[#C9A84C]" />
              <Loader2 size={14} className="animate-spin text-[#C9A84C]" />
              <span className="text-xs text-[#9BAFC5]">Analisando documentos...</span>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-[#9BAFC5]/10 bg-[#12112A]">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Pergunte sobre o ativo..."
              className="flex-1 bg-[#162744] border border-[#9BAFC5]/15 rounded-lg px-3 py-2 text-xs text-[#F5F1E8] placeholder:text-[#9BAFC5]/40 focus:border-[#C9A84C]/40 focus:outline-none"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="px-3 py-2 bg-[#C9A84C] text-[#09081A] rounded-lg disabled:opacity-30 hover:bg-[#D4B96A] transition"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
