"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, X, Send, Loader2, ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";

type Msg = {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  created_at: string;
};

interface ChatFloatWidgetProps {
  profileId: string;
  profileName: string | null;
  role: string;
  isAdmin: boolean;
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function formatDay(d: string) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function ChatFloatWidget({ profileId, profileName, role, isAdmin }: ChatFloatWidgetProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const lastIdRef = useRef<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Não mostra na página de chat (já tem interface completa lá)
  const isOnChatPage = pathname?.startsWith("/chat");

  const roomId = isAdmin ? null : `partner_${profileId}`;

  const fetchMessages = useCallback(async () => {
    try {
      const url = isAdmin
        ? `/api/chat/messages/latest`
        : `/api/chat/messages?room_id=${encodeURIComponent(roomId!)}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json() as { messages: Msg[] };
      const msgs = data.messages ?? [];
      setMessages(msgs);

      if (!open && msgs.length > 0) {
        const lastId = msgs[msgs.length - 1].id;
        if (lastIdRef.current && lastId !== lastIdRef.current) {
          const newOnes = msgs.filter(m => m.sender_id !== profileId && m.id > lastIdRef.current);
          if (newOnes.length > 0) setUnread(u => u + newOnes.length);
        }
        if (!lastIdRef.current) lastIdRef.current = lastId;
      }
    } catch {}
  }, [isAdmin, roomId, profileId, open]);

  useEffect(() => {
    if (isOnChatPage) return;
    fetchMessages();
    const iv = setInterval(fetchMessages, 5000);
    return () => clearInterval(iv);
  }, [fetchMessages, isOnChatPage]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      if (messages.length > 0) lastIdRef.current = messages[messages.length - 1].id;
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [open, messages]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function handleSend() {
    if (!text.trim() || sending || isAdmin) return;
    setSending(true);
    try {
      await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: roomId, content: text.trim() }),
      });
      setText("");
      await fetchMessages();
    } catch {} finally {
      setSending(false);
    }
  }

  if (isOnChatPage) return null;

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 rounded-full bg-[#C9A84C] hover:bg-[#E8C97A] shadow-2xl flex items-center justify-center transition-all"
        style={{ width: 52, height: 52 }}
      >
        {open
          ? <ChevronDown className="w-5 h-5 text-[#09081A]" />
          : <MessageSquare className="w-5 h-5 text-[#09081A]" />}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Janela */}
      {open && (
        <div
          className="fixed bottom-20 right-6 z-50 w-80 sm:w-96 flex flex-col bg-[#111F35] border border-[#243A66] rounded-2xl shadow-2xl overflow-hidden"
          style={{ maxHeight: "70vh" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#162744] border-b border-[#243A66]">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-[#C9A84C]" />
              <div>
                <p className="text-xs font-bold text-[#F0ECE4]">
                  {isAdmin ? "Chat — Partners" : "Mesa V3 Partners"}
                </p>
                <p className="text-[10px] text-[#7A8FA8]">
                  {isAdmin ? "Clique para abrir o chat completo" : "Chat direto com a equipe"}
                </p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-[#7A8FA8] hover:text-[#F0ECE4] p-1 rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ minHeight: 180 }}>
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-7 h-7 text-[#243A66] mx-auto mb-2" />
                <p className="text-xs text-[#7A8FA8]">Nenhuma mensagem ainda.</p>
              </div>
            ) : (
              messages.map((m, i) => {
                const isMe = m.sender_id === profileId;
                const showDay = i === 0 || formatDay(messages[i - 1].created_at) !== formatDay(m.created_at);
                return (
                  <React.Fragment key={m.id}>
                    {showDay && (
                      <div className="text-center">
                        <span className="text-[9px] text-[#243A66] bg-[#0D1929] px-2 py-0.5 rounded-full">{formatDay(m.created_at)}</span>
                      </div>
                    )}
                    <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${isMe ? "bg-[#C9A84C] text-[#09081A]" : "bg-[#162744] text-[#F0ECE4] border border-[#243A66]"}`}>
                        {!isMe && <p className="text-[9px] font-bold text-[#C9A84C] mb-0.5">{m.sender_name}</p>}
                        <p className="text-xs leading-relaxed">{m.content}</p>
                        <p className={`text-[9px] mt-1 text-right ${isMe ? "text-[#09081A]/60" : "text-[#7A8FA8]"}`}>{formatTime(m.created_at)}</p>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input — apenas para partners; admins usam a interface completa */}
          {!isAdmin ? (
            <div className="px-3 py-3 border-t border-[#243A66] flex gap-2">
              <input
                type="text"
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleSend(); }}
                placeholder="Escreva sua mensagem..."
                className="flex-1 bg-[#0D1929] border border-[#243A66] rounded-xl px-3 py-2 text-xs text-[#F0ECE4] placeholder:text-[#7A8FA8]/40 focus:outline-none focus:border-[#C9A84C]/50 transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={!text.trim() || sending}
                className="w-8 h-8 rounded-xl bg-[#C9A84C] hover:bg-[#E8C97A] flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-colors"
              >
                {sending ? <Loader2 className="w-3.5 h-3.5 text-[#09081A] animate-spin" /> : <Send className="w-3.5 h-3.5 text-[#09081A]" />}
              </button>
            </div>
          ) : (
            <div className="px-3 py-3 border-t border-[#243A66]">
              <a
                href="/chat/admin"
                className="flex items-center justify-center gap-2 w-full py-2 bg-[#C9A84C]/15 hover:bg-[#C9A84C]/25 border border-[#C9A84C]/30 text-[#C9A84C] text-xs font-semibold rounded-xl transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" /> Abrir chat completo
              </a>
            </div>
          )}
        </div>
      )}
    </>
  );
}
