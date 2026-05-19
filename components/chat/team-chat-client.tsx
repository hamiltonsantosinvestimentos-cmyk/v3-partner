"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  ChangeEvent,
} from "react";
import {
  Crown,
  Shield,
  Headphones,
  TrendingUp,
  ShoppingBag,
  MessageSquare,
  Send,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamRoom {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  last_message: {
    content: string;
    sender_name: string;
    created_at: string;
  } | null;
  unread_count: number;
}

interface TeamMessage {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  content: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  created_at: string;
}

interface TeamChatProfile {
  id: string;
  full_name: string | null;
  role: string;
}

interface TeamChatClientProps {
  profile: TeamChatProfile;
  initialRooms: TeamRoom[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;

  const today = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  if (d.toDateString() === yesterday.toDateString()) {
    return `ontem ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (diffDays < 365) {
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function formatGroupDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === now.toDateString()) return "Hoje";
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function groupMessagesByDate(messages: TeamMessage[]) {
  const groups: { date: string; messages: TeamMessage[] }[] = [];
  let currentDate = "";
  for (const msg of messages) {
    const date = formatGroupDate(msg.created_at);
    if (date !== currentDate) {
      currentDate = date;
      groups.push({ date, messages: [msg] });
    } else {
      groups[groups.length - 1].messages.push(msg);
    }
  }
  return groups;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function isImageType(type: string | null): boolean {
  if (!type) return false;
  return type.startsWith("image/");
}

// Avatar color palette from role
const ROLE_AVATAR_COLORS: Record<string, string> = {
  ADMIN: "#8B5CF6",
  GESTAO: "#F59E0B",
  MESA_OPERACIONAL: "#3B82F6",
  MESA: "#10B981",
  FINANCEIRO: "#06B6D4",
};

function avatarColor(role: string): string {
  return ROLE_AVATAR_COLORS[role] ?? "#7A8FA8";
}

// ─── Room Icon ────────────────────────────────────────────────────────────────

function RoomIcon({ icon, active }: { icon: string; active?: boolean }) {
  const cls = cn(
    "w-4 h-4 flex-shrink-0",
    active ? "text-[#C9A84C]" : "text-[#7A8FA8]"
  );

  switch (icon) {
    case "Crown":
      return <Crown className={cls} style={active ? {} : { color: "#C9A84C", opacity: 0.7 }} />;
    case "Shield":
      return <Shield className={cls} />;
    case "Headphones":
      return <Headphones className={cls} />;
    case "TrendingUp":
      return <TrendingUp className={cls} style={{ color: active ? "#10B981" : "#4B7A5A" }} />;
    case "ShoppingBag":
      return <ShoppingBag className={cls} />;
    default:
      return <MessageSquare className={cls} />;
  }
}

// ─── Attachment Preview (in message) ─────────────────────────────────────────

function AttachmentDisplay({
  url,
  name,
  type,
}: {
  url: string;
  name: string | null;
  type: string | null;
}) {
  if (isImageType(type)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={name ?? "imagem"}
          className="rounded-xl border border-[#243A66]/60 max-h-[200px] object-contain cursor-pointer hover:opacity-90 transition-opacity"
        />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 mt-1.5 px-3 py-2 rounded-xl border border-[#243A66]/60 bg-[#09081A]/40 hover:bg-[#243A66]/30 transition-colors max-w-xs"
    >
      <FileText className="w-4 h-4 text-[#C9A84C] flex-shrink-0" />
      <span className="text-[11px] text-[#F0ECE4] truncate">{name ?? "arquivo"}</span>
      <span className="text-[9px] text-[#7A8FA8] flex-shrink-0 ml-auto">download</span>
    </a>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TeamChatClient({ profile, initialRooms }: TeamChatClientProps) {
  const [rooms, setRooms] = useState<TeamRoom[]>(initialRooms);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(
    initialRooms.length > 0 ? initialRooms[0].id : null
  );
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // Attachment state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMsgIdRef = useRef<string | null>(null);
  const isFirstFetchRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? null;

  // ── Fetch messages ──
  const fetchMessages = useCallback(
    async (roomId: string) => {
      try {
        const res = await fetch(
          `/api/team-chat/messages?room_id=${encodeURIComponent(roomId)}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as { messages: TeamMessage[] };
        const msgs = data.messages ?? [];

        if (!isFirstFetchRef.current && msgs.length > 0) {
          const latest = msgs[msgs.length - 1];
          if (
            latest.id !== lastMsgIdRef.current &&
            latest.sender_id !== profile.id
          ) {
            // Could show a toast here if desired
          }
          lastMsgIdRef.current = latest.id;
        } else if (isFirstFetchRef.current) {
          lastMsgIdRef.current =
            msgs.length > 0 ? msgs[msgs.length - 1].id : null;
          isFirstFetchRef.current = false;
        }

        setMessages(msgs);
      } catch {
        // silently ignore
      } finally {
        setLoadingMessages(false);
      }
    },
    [profile.id]
  );

  // ── Fetch rooms (to update last message + unread) ──
  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch("/api/team-chat/rooms");
      if (!res.ok) return;
      const data = (await res.json()) as { rooms: TeamRoom[] };
      setRooms(data.rooms ?? []);
    } catch {
      // silently ignore
    }
  }, []);

  // ── Polling ──
  useEffect(() => {
    if (!activeRoomId) return;

    setLoadingMessages(true);
    isFirstFetchRef.current = true;
    lastMsgIdRef.current = null;
    fetchMessages(activeRoomId);
    fetchRooms();

    intervalRef.current = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchMessages(activeRoomId);
        fetchRooms();
      }
    }, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeRoomId, fetchMessages, fetchRooms]);

  // ── Scroll to bottom ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Room select ──
  const handleRoomSelect = (roomId: string) => {
    if (roomId === activeRoomId) return;
    setActiveRoomId(roomId);
    setMessages([]);
    setInput("");
    clearSelectedFile();
  };

  // ── File selection ──
  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);

    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setFilePreviewUrl(url);
    } else {
      setFilePreviewUrl(null);
    }

    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const clearSelectedFile = () => {
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    setSelectedFile(null);
    setFilePreviewUrl(null);
  };

  // ── Send message ──
  const handleSend = async () => {
    const trimmed = input.trim();
    if ((!trimmed && !selectedFile) || sending || !activeRoomId) return;

    setSending(true);
    try {
      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;
      let attachmentType: string | null = null;

      // Upload file if selected
      if (selectedFile) {
        setUploadingFile(true);
        const fd = new FormData();
        fd.append("file", selectedFile);
        fd.append("room_id", activeRoomId);

        const uploadRes = await fetch("/api/team-chat/upload", {
          method: "POST",
          body: fd,
        });

        setUploadingFile(false);

        if (!uploadRes.ok) {
          const err = (await uploadRes.json()) as { error?: string };
          console.error("Upload failed:", err.error);
          setSending(false);
          return;
        }

        const uploadData = (await uploadRes.json()) as {
          url: string;
          name: string;
          type: string;
        };
        attachmentUrl = uploadData.url;
        attachmentName = uploadData.name;
        attachmentType = uploadData.type;
      }

      const res = await fetch("/api/team-chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: activeRoomId,
          content: trimmed || null,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
          attachment_type: attachmentType,
        }),
      });

      if (res.ok) {
        setInput("");
        clearSelectedFile();
        // Reset textarea height
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
        await fetchMessages(activeRoomId);
      }
    } catch {
      // silently ignore
    } finally {
      setSending(false);
      setUploadingFile(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const msgGroups = groupMessagesByDate(messages);
  const canSend = (input.trim().length > 0 || selectedFile !== null) && !sending;

  // ── Empty state ──
  if (rooms.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-[calc(100vh-180px)] rounded-2xl border border-[#243A66]/50"
        style={{ background: "#09081A" }}
      >
        <div className="flex flex-col items-center gap-3 text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-[#162744] border border-[#243A66]/50 flex items-center justify-center">
            <MessageSquare className="w-7 h-7 text-[#7A8FA8]/30" />
          </div>
          <p className="text-[14px] font-semibold text-[#7A8FA8]">
            Nenhuma sala disponível para seu perfil
          </p>
          <p className="text-[11px] text-[#7A8FA8]/50 max-w-[240px]">
            Seu nível de acesso não permite visualizar salas do chat interno no momento.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-[calc(100vh-160px)] rounded-2xl overflow-hidden border border-[#243A66]/50"
      style={{ background: "#09081A" }}
    >
      {/* ── Sidebar: Room list ── */}
      <aside
        className="w-[280px] flex-shrink-0 border-r border-[#243A66]/50 flex flex-col"
        style={{ background: "#111F35" }}
      >
        {/* Header */}
        <div className="px-4 py-4 border-b border-[#243A66]/50">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#C9A84C]" />
            <h2 className="text-[11px] font-bold tracking-[0.15em] text-[#C9A84C] uppercase">
              Salas da Equipe
            </h2>
          </div>
        </div>

        {/* Room list */}
        <div className="flex-1 overflow-y-auto py-1 scrollbar-thin">
          {rooms.map((room) => {
            const isActive = room.id === activeRoomId;
            return (
              <button
                key={room.id}
                onClick={() => handleRoomSelect(room.id)}
                className={cn(
                  "w-full text-left px-4 py-3 transition-all duration-150 flex items-start gap-3 relative",
                  isActive
                    ? "bg-[#1E3A5C] border-l-2 border-[#C9A84C]"
                    : "hover:bg-white/[0.03] border-l-2 border-transparent"
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5",
                    isActive ? "bg-[#C9A84C]/15" : "bg-[#243A66]/40"
                  )}
                >
                  <RoomIcon icon={room.icon} active={isActive} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p
                      className={cn(
                        "text-[12px] font-semibold truncate",
                        isActive ? "text-[#F0ECE4]" : "text-[#7A8FA8]"
                      )}
                    >
                      {room.name}
                    </p>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {room.last_message && (
                        <span className="text-[9px] text-[#7A8FA8]/50">
                          {formatTimestamp(room.last_message.created_at)}
                        </span>
                      )}
                      {room.unread_count > 0 && (
                        <span className="ml-1 min-w-[16px] h-4 px-1 rounded-full bg-[#C9A84C] text-black text-[9px] font-bold flex items-center justify-center">
                          {room.unread_count > 99 ? "99+" : room.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                  {room.last_message ? (
                    <p className="text-[10px] text-[#7A8FA8]/60 truncate mt-0.5">
                      <span className="text-[#7A8FA8]/40">{room.last_message.sender_name}: </span>
                      {room.last_message.content}
                    </p>
                  ) : (
                    <p className="text-[10px] text-[#7A8FA8]/30 italic mt-0.5">
                      Sem mensagens ainda
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Main chat area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeRoom ? (
          <>
            {/* Header */}
            <div
              className="px-5 py-3.5 border-b border-[#243A66]/50 flex items-center gap-3"
              style={{ background: "#111F35" }}
            >
              <div className="w-9 h-9 rounded-xl bg-[#C9A84C]/10 flex items-center justify-center flex-shrink-0">
                <RoomIcon icon={activeRoom.icon} active />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[13px] font-semibold text-[#F0ECE4]">
                  {activeRoom.name}
                </h3>
                {activeRoom.description && (
                  <p className="text-[10px] text-[#7A8FA8] truncate">
                    {activeRoom.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-[#7A8FA8]">Online</span>
              </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1 scrollbar-thin">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin" />
                    <p className="text-[11px] text-[#7A8FA8]/50">
                      Carregando mensagens...
                    </p>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-[#162744] border border-[#243A66]/50 flex items-center justify-center">
                    <MessageSquare className="w-7 h-7 text-[#7A8FA8]/30" />
                  </div>
                  <p className="text-[13px] text-[#7A8FA8]/50 font-medium">
                    Nenhuma mensagem ainda
                  </p>
                  <p className="text-[11px] text-[#7A8FA8]/30 text-center max-w-[200px]">
                    Seja o primeiro a enviar uma mensagem nesta sala
                  </p>
                </div>
              ) : (
                msgGroups.map((group) => (
                  <div key={group.date}>
                    {/* Date separator */}
                    <div className="flex items-center gap-3 my-3">
                      <div className="flex-1 h-px bg-[#243A66]/40" />
                      <span className="text-[10px] text-[#7A8FA8]/40 font-medium px-2">
                        {group.date}
                      </span>
                      <div className="flex-1 h-px bg-[#243A66]/40" />
                    </div>

                    {group.messages.map((msg) => {
                      const isOwn = msg.sender_id === profile.id;
                      const color = avatarColor(msg.sender_role);

                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex mb-3",
                            isOwn ? "justify-end" : "justify-start"
                          )}
                        >
                          {/* Avatar (others only) */}
                          {!isOwn && (
                            <div
                              className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-bold mr-2 mt-1"
                              style={{
                                background: `${color}22`,
                                color: color,
                                border: `1px solid ${color}33`,
                              }}
                            >
                              {getInitials(msg.sender_name)}
                            </div>
                          )}

                          <div
                            className={cn(
                              "max-w-[70%] flex flex-col",
                              isOwn ? "items-end" : "items-start"
                            )}
                          >
                            {/* Sender info (others only) */}
                            {!isOwn && (
                              <div className="flex items-center gap-1.5 mb-1 ml-1">
                                <span className="text-[10px] font-semibold text-[#F0ECE4]/70">
                                  {msg.sender_name}
                                </span>
                                <span
                                  className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                  style={{
                                    background: `${avatarColor(msg.sender_role)}18`,
                                    color: avatarColor(msg.sender_role),
                                  }}
                                >
                                  {msg.sender_role.replace("_", " ")}
                                </span>
                              </div>
                            )}

                            {/* Bubble */}
                            <div
                              className={cn(
                                "px-3.5 py-2.5 rounded-2xl text-[12.5px] leading-relaxed break-words",
                                isOwn ? "rounded-tr-sm" : "rounded-tl-sm"
                              )}
                              style={
                                isOwn
                                  ? {
                                      background: "#1A3A5C",
                                      border: "1px solid rgba(201,168,76,0.3)",
                                      color: "#E8C97A",
                                    }
                                  : {
                                      background: "#162744",
                                      border: "1px solid rgba(36,58,102,0.6)",
                                      color: "#F0ECE4",
                                    }
                              }
                            >
                              {msg.content && (
                                <span className="whitespace-pre-wrap">{msg.content}</span>
                              )}
                              {msg.attachment_url && (
                                <AttachmentDisplay
                                  url={msg.attachment_url}
                                  name={msg.attachment_name}
                                  type={msg.attachment_type}
                                />
                              )}
                            </div>

                            {/* Timestamp */}
                            <span className="text-[9px] text-[#7A8FA8]/40 mt-1 px-1">
                              {formatTimestamp(msg.created_at)}
                            </span>
                          </div>

                          {/* Own avatar */}
                          {isOwn && (
                            <div
                              className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-bold ml-2 mt-1"
                              style={{
                                background: "rgba(201,168,76,0.15)",
                                color: "#C9A84C",
                                border: "1px solid rgba(201,168,76,0.2)",
                              }}
                            >
                              {getInitials(profile.full_name ?? profile.role)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input area */}
            <div
              className="px-4 py-3 border-t border-[#243A66]/50"
              style={{ background: "#111F35" }}
            >
              {/* File preview */}
              {selectedFile && (
                <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-xl border border-[#243A66]/60 bg-[#162744]">
                  {filePreviewUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={filePreviewUrl}
                        alt="preview"
                        className="w-10 h-10 rounded-lg object-cover border border-[#243A66]/60"
                      />
                      <ImageIcon className="w-4 h-4 text-[#C9A84C] flex-shrink-0 hidden" />
                    </>
                  ) : (
                    <FileText className="w-4 h-4 text-[#C9A84C] flex-shrink-0" />
                  )}
                  <span className="text-[11px] text-[#F0ECE4] truncate flex-1">
                    {selectedFile.name}
                  </span>
                  <button
                    onClick={clearSelectedFile}
                    className="p-0.5 rounded hover:bg-white/10 transition-colors flex-shrink-0"
                    title="Remover arquivo"
                  >
                    <X className="w-3.5 h-3.5 text-[#7A8FA8]" />
                  </button>
                </div>
              )}

              <div className="flex items-end gap-2">
                {/* Paperclip button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending}
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all",
                    uploadingFile
                      ? "bg-[#C9A84C]/15 cursor-wait"
                      : "bg-[#162744] hover:bg-[#243A66]/60 text-[#7A8FA8] hover:text-[#F0ECE4]"
                  )}
                  title="Anexar arquivo"
                >
                  {uploadingFile ? (
                    <div className="w-4 h-4 border-2 border-[#C9A84C]/30 border-t-[#C9A84C] rounded-full animate-spin" />
                  ) : (
                    <Paperclip className="w-4 h-4" />
                  )}
                </button>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain"
                  className="hidden"
                  onChange={handleFileSelect}
                />

                {/* Textarea */}
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
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
                      maxHeight: "96px",
                    }}
                    onInput={(e) => {
                      const el = e.currentTarget;
                      el.style.height = "auto";
                      el.style.height = Math.min(el.scrollHeight, 96) + "px";
                    }}
                  />
                </div>

                {/* Send button */}
                <button
                  onClick={handleSend}
                  disabled={!canSend}
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-150",
                    canSend
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
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[12px] text-[#7A8FA8]/40">
              Selecione uma sala para começar
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
