"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MessageSquare, Send, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface NewMsgToast {
  id: string;
  senderName: string;
  content: string;
}

function NewMessageToast({ toast, onClose }: { toast: NewMsgToast; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-[999] flex items-start gap-3 px-4 py-3 rounded-2xl shadow-2xl border border-[#C9A84C]/30 bg-[#111F35] max-w-xs animate-slide-in-right"
      style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(201,168,76,0.15)" }}>
      <div className="w-8 h-8 rounded-xl bg-[#C9A84C]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
        <MessageSquare className="w-4 h-4 text-[#C9A84C]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-[#C9A84C] uppercase tracking-wider mb-0.5">Nova mensagem</p>
        <p className="text-[12px] font-semibold text-[#F0ECE4] truncate">{toast.senderName}</p>
        <p className="text-[11px] text-[#7A8FA8] line-clamp-2 mt-0.5">{toast.content}</p>
      </div>
      <button onClick={onClose} className="text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors flex-shrink-0 mt-0.5">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export interface ChatProfile {
  id: string;
  full_name: string | null;
  role: string;
}

export interface ChatRoom {
  room_id: string;
  partner_id: string;
  partner_name: string;
  partner_role: string;
  last_message: {
    content: string;
    sender_name: string;
    created_at: string;
  } | null;
  unread_count: number;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  created_at: string;
}

interface ChatClientProps {
  roomId: string;
  profile: ChatProfile;
  isAdmin: boolean;
  rooms?: ChatRoom[];
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function groupMessagesByDate(messages: ChatMessage[]) {
  const groups: { date: string; messages: ChatMessage[] }[] = [];
  let currentDate = "";

  for (const msg of messages) {
    const date = formatDate(msg.created_at);
    if (date !== currentDate) {
      currentDate = date;
      groups.push({ date, messages: [msg] });
    } else {
      groups[groups.length - 1].messages.push(msg);
    }
  }
  return groups;
}

export function ChatClient({ roomId, profile, isAdmin, rooms = [] }: ChatClientProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [activeRoom, setActiveRoom] = useState(roomId);
  const [roomList, setRoomList] = useState<ChatRoom[]>(rooms);
  const [loading, setLoading] = useState(true);
  const [newMsgToast, setNewMsgToast] = useState<NewMsgToast | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMsgIdRef = useRef<string | null>(null);
  const isFirstFetchRef = useRef(true);

  const fetchMessages = useCallback(async (rid: string) => {
    try {
      const isInst = rid.startsWith("instituicao_");
      const endpoint = isInst
        ? `/api/instituicao/chat/admin?room_id=${encodeURIComponent(rid)}`
        : `/api/chat/messages?room_id=${encodeURIComponent(rid)}`;
      const res = await fetch(endpoint);
      if (!res.ok) return;
      const data = await res.json() as { messages: ChatMessage[] };
      const msgs = data.messages ?? [];

      // Detecta mensagem nova (não é o primeiro fetch e o último id mudou)
      if (!isFirstFetchRef.current && msgs.length > 0) {
        const latestMsg = msgs[msgs.length - 1];
        if (latestMsg.id !== lastMsgIdRef.current && latestMsg.sender_id !== profile.id) {
          setNewMsgToast({
            id: latestMsg.id,
            senderName: latestMsg.sender_name,
            content: latestMsg.content,
          });
        }
        lastMsgIdRef.current = latestMsg.id;
      } else if (isFirstFetchRef.current && msgs.length > 0) {
        lastMsgIdRef.current = msgs[msgs.length - 1].id;
        isFirstFetchRef.current = false;
      } else if (isFirstFetchRef.current) {
        isFirstFetchRef.current = false;
      }

      setMessages(msgs);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [profile.id]);

  const fetchRooms = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch("/api/chat/rooms");
      if (!res.ok) return;
      const data = await res.json() as { rooms: ChatRoom[] };
      setRoomList(data.rooms ?? []);
    } catch {
      // silently ignore
    }
  }, [isAdmin]);

  // Polling a cada 3 segundos
  useEffect(() => {
    setLoading(true);
    fetchMessages(activeRoom);
    if (isAdmin) fetchRooms();

    intervalRef.current = setInterval(() => {
      fetchMessages(activeRoom);
      if (isAdmin) fetchRooms();
    }, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeRoom, fetchMessages, fetchRooms, isAdmin]);

  // Scroll automático para a última mensagem
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      const isInst = activeRoom.startsWith("instituicao_");
      const endpoint = isInst ? "/api/instituicao/chat/admin" : "/api/chat/messages";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: activeRoom, content: trimmed }),
      });

      if (res.ok) {
        setInput("");
        await fetchMessages(activeRoom);
      }
    } catch {
      // silently ignore
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRoomSelect = (rid: string) => {
    setActiveRoom(rid);
    setMessages([]);
    setLoading(true);
    lastMsgIdRef.current = null;
    isFirstFetchRef.current = true;
  };

  const activeRoomData = isAdmin
    ? roomList.find((r) => r.room_id === activeRoom)
    : null;

  const msgGroups = groupMessagesByDate(messages);

  return (
    <>
    {newMsgToast && (
      <NewMessageToast
        toast={newMsgToast}
        onClose={() => setNewMsgToast(null)}
      />
    )}
    <div
      className="flex h-[calc(100vh-120px)] rounded-2xl overflow-hidden border border-[#243A66]/50"
      style={{ background: "#09081A" }}
    >
      {/* ── Painel Esquerdo (apenas admin) ── */}
      {isAdmin && (
        <aside className="w-72 flex-shrink-0 border-r border-[#243A66]/50 flex flex-col"
          style={{ background: "#111F35" }}>
          {/* Header painel esquerdo */}
          <div className="px-4 py-4 border-b border-[#243A66]/50">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#C9A84C]" />
              <h2 className="text-[12px] font-bold tracking-[0.15em] text-[#C9A84C] uppercase">
                Salas
              </h2>
              <span className="ml-auto text-[10px] text-[#7A8FA8]">
                {roomList.length} partners
              </span>
            </div>
          </div>

          {/* Lista de rooms */}
          <div className="flex-1 overflow-y-auto scrollbar-thin py-1">
            {roomList.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 p-4">
                <MessageSquare className="w-8 h-8 text-[#7A8FA8]/30" />
                <p className="text-[11px] text-[#7A8FA8]/50 text-center">
                  Nenhum partner ativo
                </p>
              </div>
            ) : (
              roomList.map((room) => {
                const isActive = room.room_id === activeRoom;
                return (
                  <button
                    key={room.room_id}
                    onClick={() => handleRoomSelect(room.room_id)}
                    className={cn(
                      "w-full text-left px-4 py-3 transition-all duration-150 flex items-start gap-3 relative",
                      isActive
                        ? "bg-[#162744] border-l-2 border-[#C9A84C]"
                        : "hover:bg-white/[0.03] border-l-2 border-transparent"
                    )}
                  >
                    {/* Avatar */}
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-[11px] font-bold",
                      isActive
                        ? "bg-[#C9A84C]/20 text-[#C9A84C]"
                        : "bg-[#243A66]/50 text-[#7A8FA8]"
                    )}>
                      {room.partner_name.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className={cn(
                          "text-[12px] font-semibold truncate",
                          isActive ? "text-[#F0ECE4]" : "text-[#7A8FA8]"
                        )}>
                          {room.partner_name}
                        </p>
                        {room.last_message && (
                          <span className="text-[9px] text-[#7A8FA8]/50 flex-shrink-0">
                            {formatTime(room.last_message.created_at)}
                          </span>
                        )}
                      </div>
                      {room.last_message ? (
                        <p className="text-[10px] text-[#7A8FA8]/60 truncate mt-0.5">
                          {room.last_message.content}
                        </p>
                      ) : (
                        <p className="text-[10px] text-[#7A8FA8]/30 italic mt-0.5">
                          Sem mensagens ainda
                        </p>
                      )}
                    </div>

                    {isActive && (
                      <ChevronRight className="w-3 h-3 text-[#C9A84C]/50 flex-shrink-0 mt-1" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>
      )}

      {/* ── Painel Direito (chat) ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header do chat */}
        <div className="px-5 py-4 border-b border-[#243A66]/50 flex items-center gap-3"
          style={{ background: "#111F35" }}>
          <div className="w-9 h-9 rounded-xl bg-[#C9A84C]/15 flex items-center justify-center flex-shrink-0">
            <MessageSquare className="w-4 h-4 text-[#C9A84C]" />
          </div>
          <div className="flex-1 min-w-0">
            {isAdmin && activeRoomData ? (
              <>
                <h3 className="text-[13px] font-semibold text-[#F0ECE4] truncate">
                  {activeRoomData.partner_name}
                </h3>
                <p className="text-[10px] text-[#7A8FA8]">
                  {activeRoomData.partner_role === "INSTITUICAO" ? "Instituição Financeira" : activeRoomData.partner_role === "PARTNER_PRO" ? "Partner PRO" : "Partner"} · Chat direto
                </p>
              </>
            ) : (
              <>
                <h3 className="text-[13px] font-semibold text-[#F0ECE4]">
                  Mesa V3
                </h3>
                <p className="text-[10px] text-[#7A8FA8]">Chat direto com a equipe V3</p>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-[#7A8FA8]">Online</span>
          </div>
        </div>

        {/* Área de mensagens */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1 scrollbar-thin">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin" />
                <p className="text-[11px] text-[#7A8FA8]/50">Carregando mensagens...</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="w-16 h-16 rounded-2xl bg-[#162744] border border-[#243A66]/50 flex items-center justify-center">
                <MessageSquare className="w-7 h-7 text-[#7A8FA8]/30" />
              </div>
              <p className="text-[13px] text-[#7A8FA8]/50 font-medium">Nenhuma mensagem ainda</p>
              <p className="text-[11px] text-[#7A8FA8]/30 text-center max-w-[200px]">
                Envie a primeira mensagem para iniciar a conversa
              </p>
            </div>
          ) : (
            msgGroups.map((group) => (
              <div key={group.date}>
                {/* Separador de data */}
                <div className="flex items-center gap-3 my-3">
                  <div className="flex-1 h-px bg-[#243A66]/40" />
                  <span className="text-[10px] text-[#7A8FA8]/40 font-medium px-2">
                    {group.date}
                  </span>
                  <div className="flex-1 h-px bg-[#243A66]/40" />
                </div>

                {group.messages.map((msg) => {
                  const isOwn = msg.sender_id === profile.id;
                  const isPartnerMsg = ["PARTNER", "PARTNER_PRO"].includes(msg.sender_role);

                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex mb-2",
                        isOwn ? "justify-end" : "justify-start"
                      )}
                    >
                      {/* Avatar (apenas para mensagens de outros) */}
                      {!isOwn && (
                        <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-bold mr-2 mt-1"
                          style={{
                            background: isPartnerMsg
                              ? "rgba(36,58,102,0.8)"
                              : "rgba(201,168,76,0.15)",
                            color: isPartnerMsg ? "#7A8FA8" : "#C9A84C",
                          }}
                        >
                          {msg.sender_name.charAt(0).toUpperCase()}
                        </div>
                      )}

                      <div className={cn("max-w-[70%] flex flex-col", isOwn ? "items-end" : "items-start")}>
                        {/* Nome remetente */}
                        {!isOwn && (
                          <span className="text-[10px] text-[#7A8FA8]/60 mb-1 ml-1">
                            {msg.sender_name}
                          </span>
                        )}

                        {/* Bolha */}
                        <div
                          className={cn(
                            "px-3.5 py-2.5 rounded-2xl text-[12.5px] leading-relaxed break-words",
                            isOwn
                              ? "rounded-tr-sm"
                              : isPartnerMsg
                              ? "rounded-tl-sm"
                              : "rounded-tl-sm"
                          )}
                          style={
                            isOwn
                              ? {
                                  background: "rgba(201,168,76,0.12)",
                                  border: "1px solid rgba(201,168,76,0.2)",
                                  color: "#E8C97A",
                                }
                              : isPartnerMsg
                              ? {
                                  background: "#162744",
                                  border: "1px solid rgba(36,58,102,0.6)",
                                  color: "#F0ECE4",
                                }
                              : {
                                  background: "#162744",
                                  border: "1px solid rgba(36,58,102,0.6)",
                                  color: "#F0ECE4",
                                }
                          }
                        >
                          {msg.content}
                        </div>

                        {/* Timestamp */}
                        <span className="text-[9px] text-[#7A8FA8]/40 mt-1 px-1">
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input fixo no rodapé */}
        <div className="px-4 py-3 border-t border-[#243A66]/50"
          style={{ background: "#111F35" }}>
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite uma mensagem… (Enter para enviar)"
                rows={1}
                className="w-full resize-none rounded-xl px-4 py-2.5 text-[12.5px] text-[#F0ECE4] placeholder-[#7A8FA8]/40 outline-none transition-all focus:ring-1 focus:ring-[#C9A84C]/30 scrollbar-thin"
                style={{
                  background: "#162744",
                  border: "1px solid rgba(36,58,102,0.6)",
                  minHeight: "40px",
                  maxHeight: "120px",
                }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 120) + "px";
                }}
              />
            </div>

            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-150",
                input.trim() && !sending
                  ? "bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] shadow-lg shadow-[#C9A84C]/20"
                  : "bg-[#162744] text-[#7A8FA8]/30 cursor-not-allowed"
              )}
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>

          <p className="text-[9px] text-[#7A8FA8]/30 mt-1.5 px-1">
            Enter para enviar · Shift+Enter para nova linha
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
