"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, X, Send, Loader2, ChevronDown, ExternalLink } from "lucide-react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Msg = {
  id: string;
  room_id?: string;
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

function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch {}
}

export function ChatFloatWidget({ profileId, profileName, role, isAdmin }: ChatFloatWidgetProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const [activeRoomId, setActiveRoomId] = useState<string>("");
  const [activeRoomName, setActiveRoomName] = useState<string>("");
  const lastIdRef = useRef<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  const isOnChatPage = pathname?.startsWith("/chat");
  const partnerRoomId = isAdmin ? null : `partner_${profileId}`;

  // ── Busca mensagens via HTTP (fallback / inicial) ──────────────────────────
  const fetchMessages = useCallback(async (roomOverride?: string) => {
    try {
      const targetRoom = roomOverride ?? (isAdmin ? activeRoomId : partnerRoomId);

      let url: string;
      if (isAdmin) {
        if (targetRoom) {
          url = `/api/chat/messages?room_id=${encodeURIComponent(targetRoom)}`;
        } else {
          // Descobre a sala mais recente
          const res = await fetch("/api/chat/messages/latest");
          if (!res.ok) return;
          const data = await res.json() as { messages: Msg[] };
          const msgs = data.messages ?? [];
          if (msgs.length > 0) {
            const latestRoom = msgs[0].room_id ?? "";
            const latestName = msgs[0].sender_name ?? "Partner";
            setActiveRoomId(latestRoom);
            setActiveRoomName(latestName);
            // Agora busca todas as mensagens da sala
            await fetchMessages(latestRoom);
          }
          return;
        }
      } else {
        url = `/api/chat/messages?room_id=${encodeURIComponent(partnerRoomId!)}`;
      }

      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json() as { messages: Msg[] };
      const msgs = data.messages ?? [];

      setMessages(prev => {
        if (JSON.stringify(prev.map(m => m.id)) === JSON.stringify(msgs.map((m: Msg) => m.id))) return prev;
        return msgs;
      });

      if (!open && msgs.length > 0) {
        const lastId = msgs[msgs.length - 1].id;
        if (lastIdRef.current && lastId !== lastIdRef.current) {
          const newOnes = msgs.filter((m: Msg) => m.sender_id !== profileId && m.id > lastIdRef.current);
          if (newOnes.length > 0) {
            setUnread(u => u + newOnes.length);
            playNotificationSound();
          }
        }
        if (!lastIdRef.current) lastIdRef.current = lastId;
      }
    } catch {}
  }, [isAdmin, activeRoomId, partnerRoomId, profileId, open]);

  // ── Supabase Realtime ──────────────────────────────────────────────────────
  useEffect(() => {
    if (isOnChatPage) return;

    let supabase: ReturnType<typeof createClient> | null = null;
    try { supabase = createClient(); } catch { return; }

    const roomFilter = isAdmin
      ? undefined  // admin ouve todas as salas
      : `room_id=eq.${partnerRoomId}`;

    const channelName = isAdmin
      ? `float-admin-${profileId}`
      : `float-partner-${profileId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          ...(roomFilter ? { filter: roomFilter } : {}),
        },
        (payload) => {
          const msg = payload.new as Msg;

          // Admin: atualiza sala ativa se for a primeira ou mais recente
          if (isAdmin) {
            setActiveRoomId(prev => prev || msg.room_id || "");
            setActiveRoomName(prev => prev || msg.sender_name || "");
          }

          setMessages(prev => {
            if (prev.find(m => m.id === msg.id)) return prev;
            // Para admin, só adiciona se for da sala ativa
            if (isAdmin && activeRoomId && msg.room_id !== activeRoomId) return prev;
            return [...prev, msg];
          });

          // Notificação de não lida + som
          if (msg.sender_id !== profileId) {
            setOpen(isOpen => {
              if (!isOpen) {
                setUnread(u => u + 1);
                playNotificationSound();
              }
              return isOpen;
            });
            lastIdRef.current = msg.id;
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Busca inicial
    fetchMessages();

    // Polling como fallback (30s)
    const iv = setInterval(() => fetchMessages(), 30000);

    return () => {
      clearInterval(iv);
      supabase?.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnChatPage, isAdmin, partnerRoomId, profileId]);

  // Re-assina quando sala ativa muda (admin)
  useEffect(() => {
    if (!isAdmin || !activeRoomId) return;
    fetchMessages(activeRoomId);
  }, [activeRoomId, isAdmin, fetchMessages]);

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

  // ── Enviar mensagem ────────────────────────────────────────────────────────
  async function handleSend() {
    if (!text.trim() || sending) return;
    const targetRoom = isAdmin ? activeRoomId : partnerRoomId;
    if (!targetRoom) return;
    setSending(true);
    try {
      await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: targetRoom, content: text.trim() }),
      });
      setText("");
      await fetchMessages();
    } catch {} finally {
      setSending(false);
    }
  }

  if (isOnChatPage) return null;

  const canSend = !isAdmin || !!activeRoomId;

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
                  {isAdmin
                    ? activeRoomName ? `Chat — ${activeRoomName}` : "Chat — Partners"
                    : "Mesa V3 Partners"}
                </p>
                <p className="text-[10px] text-[#7A8FA8]">
                  {isAdmin ? "Resposta rápida · mensagem mais recente" : "Chat direto com a equipe"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {isAdmin && (
                <a
                  href="/chat/admin"
                  className="text-[#7A8FA8] hover:text-[#C9A84C] p-1 rounded"
                  title="Abrir chat completo"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              <button onClick={() => setOpen(false)} className="text-[#7A8FA8] hover:text-[#F0ECE4] p-1 rounded">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ minHeight: 180 }}>
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-7 h-7 text-[#243A66] mx-auto mb-2" />
                <p className="text-xs text-[#7A8FA8]">
                  {isAdmin ? "Nenhuma mensagem recente de partners." : "Nenhuma mensagem ainda."}
                </p>
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

          {/* Input — partners e admins (admin precisa de sala ativa) */}
          <div className="px-3 py-3 border-t border-[#243A66]">
            {canSend ? (
              <div className="flex gap-2">
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
              <a
                href="/chat/admin"
                className="flex items-center justify-center gap-2 w-full py-2 bg-[#C9A84C]/15 hover:bg-[#C9A84C]/25 border border-[#C9A84C]/30 text-[#C9A84C] text-xs font-semibold rounded-xl transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" /> Abrir chat completo
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}
