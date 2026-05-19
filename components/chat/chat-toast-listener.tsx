"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MessageSquare, X } from "lucide-react";
import { usePathname } from "next/navigation";

interface NewMsgToast {
  id: string;
  senderName: string;
  content: string;
}

interface ChatToastListenerProps {
  profileId: string;
  roomId: string; // "partner_{id}" para partners, ou vazio para admins (ouve todas as salas)
  isAdmin: boolean;
}

export function ChatToastListener({ profileId, roomId, isAdmin }: ChatToastListenerProps) {
  const pathname = usePathname();
  const [toast, setToast] = useState<NewMsgToast | null>(null);
  const lastMsgIdRef = useRef<string | null>(null);
  const isFirstFetchRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Não mostra toast se já estiver na página de chat
  const isOnChatPage = pathname?.startsWith("/chat");

  const checkNewMessages = useCallback(async () => {
    if (isOnChatPage) return;
    try {
      const url = isAdmin
        ? `/api/chat/messages/latest`
        : `/api/chat/messages?room_id=${encodeURIComponent(roomId)}`;

      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json() as { messages: { id: string; sender_id: string; sender_name: string; content: string }[] };
      const msgs = data.messages ?? [];
      if (msgs.length === 0) return;

      const latest = msgs[msgs.length - 1];

      if (isFirstFetchRef.current) {
        lastMsgIdRef.current = latest.id;
        isFirstFetchRef.current = false;
        return;
      }

      if (latest.id !== lastMsgIdRef.current && latest.sender_id !== profileId) {
        lastMsgIdRef.current = latest.id;
        setToast({ id: latest.id, senderName: latest.sender_name, content: latest.content });
      }
    } catch {
      // silently ignore
    }
  }, [isOnChatPage, isAdmin, roomId, profileId]);

  useEffect(() => {
    // Reset ao mudar de página
    isFirstFetchRef.current = true;
    lastMsgIdRef.current = null;

    checkNewMessages();
    intervalRef.current = setInterval(checkNewMessages, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkNewMessages, pathname]);

  if (!toast || isOnChatPage) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] flex items-start gap-3 px-4 py-3 rounded-2xl shadow-2xl border border-[#C9A84C]/30 bg-[#111F35] max-w-xs cursor-pointer animate-slide-in-right"
      style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,168,76,0.15)" }}
      onClick={() => { window.location.href = isAdmin ? "/chat/admin" : "/chat"; }}
    >
      <div className="w-8 h-8 rounded-xl bg-[#C9A84C]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
        <MessageSquare className="w-4 h-4 text-[#C9A84C]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-[#C9A84C] uppercase tracking-wider mb-0.5">Nova mensagem</p>
        <p className="text-[12px] font-semibold text-[#F0ECE4] truncate">{toast.senderName}</p>
        <p className="text-[11px] text-[#7A8FA8] line-clamp-2 mt-0.5">{toast.content}</p>
        <p className="text-[10px] text-[#C9A84C]/60 mt-1">Clique para abrir o chat →</p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); setToast(null); }}
        className="text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors flex-shrink-0 mt-0.5"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
