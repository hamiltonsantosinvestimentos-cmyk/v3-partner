"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MessageSquare, Send, X, Search, Paperclip, Briefcase, Sparkles, StickyNote, UserCheck, UserMinus, Loader2,
  Zap, Settings2, ArrowLeft, Clock, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  type Anexo, type ChatMessage, type PropostaResumo, type RespostaPronta,
  Bolha, GerenciarRespostas, NotasInternas, PropostaCard, SalvarAnexoModal, haQuanto,
} from "@/components/chat/chat-partes";

// Chat Partners v2 (26/10/2026). Mesa (isAdmin): fila de conversas por tempo de espera,
// responsável, notas internas, respostas prontas (/atalho), sugestão por IA, salvar anexo
// na proposta. Partner: a própria conversa com a Mesa. Os dois: anexos, cartão de
// proposta, ✓✓ de leitura, avisos automáticos e tempo real (Supabase Realtime).

export interface ChatProfile { id: string; full_name: string | null; role: string }

export interface ChatRoom {
  room_id: string;
  partner_id: string;
  partner_name: string;
  partner_role: string;
  last_message: { content: string; sender_name: string; created_at: string; da_mesa?: boolean } | null;
  unread_count: number;
  aguardando_desde?: string | null;
  responsavel_id?: string | null;
  responsavel_nome?: string | null;
}

interface ChatClientProps { roomId: string; profile: ChatProfile; isAdmin: boolean; rooms?: ChatRoom[] }

const SLA_H = 4;
const MESA = ["ADMIN", "GESTAO", "MESA_OPERACIONAL", "SYSTEM"];
const ROTULO_PAPEL: Record<string, string> = {
  STARTER: "V3 Access", PARTNER: "Partner", PARTNER_PRO: "Partner PRO", GOLD: "V3 Gold", DIAMANTE: "V3 Diamante",
  PARTNER_HE: "Partner HE", ENTERPRISE: "Enterprise", INSTITUICAO: "Instituição Financeira",
};
type Filtro = "aguardando" | "minhas" | "todas";

function dataGrupo(iso: string) {
  const tz = "America/Sao_Paulo";
  const k = new Date(iso).toLocaleDateString("en-CA", { timeZone: tz });
  if (k === new Date().toLocaleDateString("en-CA", { timeZone: tz })) return "Hoje";
  if (k === new Date(Date.now() - 864e5).toLocaleDateString("en-CA", { timeZone: tz })) return "Ontem";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: tz });
}

export function ChatClient({ roomId, profile, isAdmin }: ChatClientProps) {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [roomsCarregadas, setRoomsCarregadas] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("aguardando");
  const [buscaNome, setBuscaNome] = useState("");
  const [resultadosBusca, setResultadosBusca] = useState<{ id: string; room_id: string; sender_name: string; content: string; created_at: string }[] | null>(null);
  const [activeRoom, setActiveRoom] = useState(roomId);
  const [mostrarLista, setMostrarLista] = useState(!roomId);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [propostasMsg, setPropostasMsg] = useState<Record<string, PropostaResumo>>({});
  const [leitura, setLeitura] = useState<{ mesa_lido_ate: string | null; partner_lido_ate: string | null }>({ mesa_lido_ate: null, partner_lido_ate: null });
  const [responsavel, setResponsavel] = useState<{ id: string | null; nome: string | null } | null>(null);
  const [mais, setMais] = useState(false);
  const [loading, setLoading] = useState(true);

  const [input, setInput] = useState("");
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [subindo, setSubindo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [propostaVinc, setPropostaVinc] = useState<PropostaResumo | null>(null);
  const [propostasPartner, setPropostasPartner] = useState<PropostaResumo[]>([]);
  const [abrirPropostas, setAbrirPropostas] = useState(false);

  const [respostas, setRespostas] = useState<RespostaPronta[]>([]);
  const [gerenciar, setGerenciar] = useState(false);
  const [painelNotas, setPainelNotas] = useState(false);
  const [salvarAnexo, setSalvarAnexo] = useState<Anexo | null>(null);
  const [sugerindo, setSugerindo] = useState(false);
  const [toast, setToast] = useState<{ nome: string; texto: string; room: string } | null>(null);

  const fimRef = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef(activeRoom);
  useEffect(() => { activeRef.current = activeRoom; }, [activeRoom]);
  const roomsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ehInstituicao = activeRoom.startsWith("instituicao_");
  const roomAtual = rooms.find((r) => r.room_id === activeRoom);

  // ── Carregamento ────────────────────────────────────────────────────────────
  const carregarSalas = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const r = await fetch("/api/chat/rooms");
      if (!r.ok) return;
      const j = await r.json() as { rooms: ChatRoom[] };
      setRooms(j.rooms ?? []);
      setRoomsCarregadas(true);
    } catch { /* tenta de novo na próxima */ }
  }, [isAdmin]);
  const agendarSalas = useCallback(() => {
    if (roomsTimer.current) clearTimeout(roomsTimer.current);
    roomsTimer.current = setTimeout(carregarSalas, 700);
  }, [carregarSalas]);

  const marcarLido = useCallback((rid: string) => {
    if (!rid || rid.startsWith("instituicao_") || document.hidden) return;
    fetch("/api/chat/lido", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ room_id: rid }) })
      .then(() => isAdmin && agendarSalas()).catch(() => {});
  }, [isAdmin, agendarSalas]);

  const carregarMensagens = useCallback(async (rid: string, opcoes: { antes?: string } = {}) => {
    if (!rid) return;
    try {
      const inst = rid.startsWith("instituicao_");
      const url = inst
        ? `/api/instituicao/chat/admin?room_id=${encodeURIComponent(rid)}`
        : `/api/chat/messages?room_id=${encodeURIComponent(rid)}${opcoes.antes ? `&antes=${encodeURIComponent(opcoes.antes)}` : ""}`;
      const r = await fetch(url);
      if (!r.ok || activeRef.current !== rid) return;
      const j = await r.json();
      const lista = (j.messages ?? []) as ChatMessage[];
      if (opcoes.antes) setMessages((m) => [...lista, ...m]);
      else setMessages(lista);
      setUrls((u) => ({ ...u, ...(j.urls ?? {}) }));
      setPropostasMsg((p) => ({ ...p, ...(j.propostas ?? {}) }));
      if (j.leitura) setLeitura(j.leitura);
      setResponsavel(j.responsavel ?? null);
      if (!opcoes.antes) setMais(!!j.mais);
    } catch { /* silencioso */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregarSalas(); }, [carregarSalas]);

  // Mesa sem sala escolhida: abre a primeira da fila
  useEffect(() => {
    if (isAdmin && !activeRoom && rooms.length) setActiveRoom(rooms[0].room_id);
  }, [isAdmin, activeRoom, rooms]);

  useEffect(() => {
    if (!activeRoom) return;
    setLoading(true); setMessages([]); setMais(false); setPropostaVinc(null); setAnexos([]); setErro(null);
    carregarMensagens(activeRoom).then(() => marcarLido(activeRoom));
    setPropostasPartner([]);
    if (activeRoom.startsWith("partner_")) {
      fetch(`/api/chat/propostas?room_id=${encodeURIComponent(activeRoom)}`).then((r) => r.json()).then((j) => {
        if (activeRef.current === activeRoom) setPropostasPartner(j.propostas ?? []);
      }).catch(() => {});
    }
  }, [activeRoom, carregarMensagens, marcarLido]);

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/chat/respostas").then((r) => r.json()).then((j) => setRespostas(j.respostas ?? [])).catch(() => {});
  }, [isAdmin]);

  // ── Tempo real + reserva por intervalo ───────────────────────────────────────
  useEffect(() => {
    let sb: ReturnType<typeof createClient> | null = null;
    try { sb = createClient(); } catch { /* sem realtime: fica a reserva */ }
    const canal = sb?.channel(`chat-page-${profile.id}`).on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "chat_messages", ...(isAdmin ? {} : { filter: `room_id=eq.${roomId}` }) },
      (payload) => {
        const m = payload.new as ChatMessage;
        if (m.room_id === activeRef.current) {
          carregarMensagens(m.room_id).then(() => { if (m.sender_id !== profile.id) marcarLido(m.room_id); });
        } else if (m.sender_id !== profile.id && !MESA.includes(m.sender_role)) {
          setToast({ nome: m.sender_name, texto: m.content, room: m.room_id });
        }
        if (isAdmin) agendarSalas();
      },
    ).subscribe();
    const reserva = setInterval(() => {
      if (document.hidden) return;
      if (activeRef.current) carregarMensagens(activeRef.current);
      if (isAdmin) carregarSalas();
    }, 30000);
    const aoVoltar = () => { if (!document.hidden && activeRef.current) { carregarMensagens(activeRef.current); marcarLido(activeRef.current); } };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearInterval(reserva);
      document.removeEventListener("visibilitychange", aoVoltar);
      if (canal && sb) sb.removeChannel(canal);
    };
  }, [isAdmin, roomId, profile.id, carregarMensagens, carregarSalas, agendarSalas, marcarLido]);

  // Rolagem: ao abrir a sala e quando chega mensagem (se já estava perto do fim)
  const ultimoId = messages[messages.length - 1]?.id;
  useEffect(() => {
    const el = listaRef.current;
    if (!el) return;
    const perto = el.scrollHeight - el.scrollTop - el.clientHeight < 240;
    if (perto || loading) fimRef.current?.scrollIntoView({ behavior: loading ? "auto" : "smooth" });
  }, [ultimoId, loading]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Ações ───────────────────────────────────────────────────────────────────
  const enviar = async () => {
    const texto = input.trim();
    if ((!texto && !anexos.length) || enviando || subindo) return;
    setEnviando(true); setErro(null);
    try {
      const r = await fetch(ehInstituicao ? "/api/instituicao/chat/admin" : "/api/chat/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: activeRoom, content: texto, anexos, proposta_id: propostaVinc?.id }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErro(j.error ?? "Não foi possível enviar"); return; }
      setInput(""); setAnexos([]); setPropostaVinc(null);
      await carregarMensagens(activeRoom);
      fimRef.current?.scrollIntoView({ behavior: "smooth" });
      if (isAdmin) agendarSalas();
    } finally {
      setEnviando(false);
    }
  };

  const subirArquivos = async (files: FileList | null) => {
    if (!files?.length) return;
    setSubindo(true); setErro(null);
    for (const f of Array.from(files).slice(0, 10)) {
      const fd = new FormData();
      fd.append("file", f); fd.append("room_id", activeRoom);
      const r = await fetch("/api/chat/upload", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErro(j.error ?? `Falha ao enviar ${f.name}`); break; }
      setAnexos((a) => [...a, j as Anexo]);
    }
    setSubindo(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const assumir = async (soltar: boolean) => {
    const r = await fetch("/api/chat/assumir", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ room_id: activeRoom, soltar }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErro(j.error ?? "Não foi possível");
    setResponsavel(j.responsavel ?? null);
    carregarSalas();
  };

  const sugerir = async () => {
    setSugerindo(true); setErro(null);
    try {
      const r = await fetch("/api/chat/sugestao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ room_id: activeRoom }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return setErro(j.error ?? "IA indisponível");
      setInput((atual) => (atual.trim() ? `${atual.trim()}\n\n${j.sugestao}` : j.sugestao));
    } finally {
      setSugerindo(false);
    }
  };

  const buscarHistorico = async () => {
    const q = buscaNome.trim();
    if (q.length < 2) return;
    const r = await fetch(`/api/chat/busca?q=${encodeURIComponent(q)}`);
    const j = await r.json().catch(() => ({}));
    setResultadosBusca(j.resultados ?? []);
  };

  const abrirSala = (rid: string) => {
    setActiveRoom(rid); setMostrarLista(false); setPainelNotas(false); setResultadosBusca(null);
  };

  // ── Derivados ───────────────────────────────────────────────────────────────
  const contagem = useMemo(() => ({
    aguardando: rooms.filter((r) => r.aguardando_desde).length,
    minhas: rooms.filter((r) => r.responsavel_id === profile.id).length,
  }), [rooms, profile.id]);
  const salasVisiveis = useMemo(() => {
    const q = buscaNome.trim().toLowerCase();
    return rooms.filter((r) => {
      if (q && !r.partner_name.toLowerCase().includes(q)) return false;
      if (q) return true;
      if (filtro === "aguardando") return !!r.aguardando_desde;
      if (filtro === "minhas") return r.responsavel_id === profile.id;
      return true;
    });
  }, [rooms, buscaNome, filtro, profile.id]);
  const nomePorSala = useMemo(() => new Map(rooms.map((r) => [r.room_id, r.partner_name])), [rooms]);

  const slash = isAdmin && /^\/[\w-]*$/.test(input) ? input.slice(1).toLowerCase() : null;
  const sugestoesSlash = slash !== null ? respostas.filter((r) => r.atalho.startsWith(slash) || r.titulo.toLowerCase().includes(slash)).slice(0, 8) : [];

  const grupos = useMemo(() => {
    const g: { data: string; msgs: ChatMessage[] }[] = [];
    for (const m of messages) {
      const d = dataGrupo(m.created_at);
      if (g[g.length - 1]?.data !== d) g.push({ data: d, msgs: [m] });
      else g[g.length - 1].msgs.push(m);
    }
    return g;
  }, [messages]);

  const lidaPeloOutro = (m: ChatMessage) => {
    const ref = isAdmin ? leitura.partner_lido_ate : leitura.mesa_lido_ate;
    return !!ref && ref >= m.created_at;
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {toast && (
        <button onClick={() => { if (isAdmin) abrirSala(toast.room); setToast(null); }}
          className="fixed bottom-6 right-6 z-[999] flex max-w-xs items-start gap-3 rounded-2xl border border-[#C9A84C]/30 bg-[#111F35] px-4 py-3 text-left shadow-2xl animate-slide-in-right">
          <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-[#C9A84C]/15"><MessageSquare className="w-4 h-4 text-[#C9A84C]" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#C9A84C]">Nova mensagem</p>
            <p className="truncate text-[12px] font-semibold text-[#F0ECE4]">{toast.nome}</p>
            <p className="mt-0.5 line-clamp-2 text-[11px] text-[#7A8FA8]">{toast.texto}</p>
          </div>
        </button>
      )}

      <div className="flex h-[calc(100vh-150px)] min-h-[520px] overflow-hidden rounded-2xl border border-[#243A66]/50 bg-[#09081A]">
        {/* ── Lista (Mesa) ── */}
        {isAdmin && (
          <aside className={cn("w-full md:w-80 flex-shrink-0 flex-col border-r border-[#243A66]/50 bg-[#111F35]", mostrarLista ? "flex" : "hidden md:flex")}>
            <div className="space-y-3 border-b border-[#243A66]/50 p-3">
              <div className="flex items-center gap-2 rounded-xl border border-[#243A66] bg-[#09081A]/60 px-3">
                <Search className="w-3.5 h-3.5 text-[#7A8FA8]" />
                <input value={buscaNome} onChange={(e) => { setBuscaNome(e.target.value); setResultadosBusca(null); }}
                  onKeyDown={(e) => e.key === "Enter" && buscarHistorico()}
                  placeholder="Partner ou texto da mensagem" className="w-full bg-transparent py-2 text-[12px] text-[#F0ECE4] outline-none placeholder:text-[#7A8FA8]/60" />
                {buscaNome && <button onClick={() => { setBuscaNome(""); setResultadosBusca(null); }} aria-label="Limpar"><X className="w-3.5 h-3.5 text-[#7A8FA8]" /></button>}
              </div>
              {buscaNome.trim().length >= 2 && !resultadosBusca && (
                <button onClick={buscarHistorico} className="w-full rounded-lg bg-[#C9A84C]/10 px-3 py-1.5 text-left text-[11px] font-semibold text-[#E8C97A] hover:bg-[#C9A84C]/15">
                  Buscar &quot;{buscaNome.trim()}&quot; nas mensagens
                </button>
              )}
              {!buscaNome && (
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#09081A]/60 p-1">
                  {([["aguardando", "Aguardando", contagem.aguardando], ["minhas", "Minhas", contagem.minhas], ["todas", "Todas", rooms.length]] as const).map(([k, t, n]) => (
                    <button key={k} onClick={() => setFiltro(k)}
                      className={cn("rounded-lg px-1 py-1.5 text-[10.5px] font-bold transition-all", filtro === k ? "bg-[#C9A84C] text-[#09081A]" : "text-[#7A8FA8] hover:text-[#F0ECE4]")}>
                      {t} <span className="opacity-70">{n}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto py-1 scrollbar-thin">
              {resultadosBusca ? (
                <>
                  <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7A8FA8]">{resultadosBusca.length} mensagens encontradas</p>
                  {resultadosBusca.map((m) => (
                    <button key={m.id} onClick={() => abrirSala(m.room_id)} className="w-full border-l-2 border-transparent px-4 py-2.5 text-left hover:bg-white/[0.03]">
                      <p className="text-[11.5px] font-semibold text-[#F0ECE4]">{nomePorSala.get(m.room_id) ?? m.sender_name}</p>
                      <p className="mt-0.5 line-clamp-2 text-[10.5px] text-[#7A8FA8]">{m.sender_name}: {m.content}</p>
                      <p className="mt-0.5 text-[9.5px] text-[#7A8FA8]/60">{new Date(m.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p>
                    </button>
                  ))}
                </>
              ) : !roomsCarregadas ? (
                <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-[#C9A84C]" /></div>
              ) : salasVisiveis.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                  <MessageSquare className="w-8 h-8 text-[#7A8FA8]/30" />
                  <p className="text-[11.5px] text-[#7A8FA8]">{filtro === "aguardando" && !buscaNome ? "Ninguém aguardando resposta. 🎉" : filtro === "minhas" && !buscaNome ? "Você não assumiu nenhuma conversa." : "Nenhuma conversa encontrada."}</p>
                </div>
              ) : (
                salasVisiveis.map((r) => {
                  const ativa = r.room_id === activeRoom;
                  const horas = r.aguardando_desde ? (Date.now() - Date.parse(r.aguardando_desde)) / 36e5 : 0;
                  return (
                    <button key={r.room_id} onClick={() => abrirSala(r.room_id)}
                      className={cn("relative flex w-full items-start gap-3 border-l-2 px-4 py-3 text-left transition-all", ativa ? "border-[#C9A84C] bg-[#162744]" : "border-transparent hover:bg-white/[0.03]")}>
                      <div className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-[12px] font-bold", ativa ? "bg-[#C9A84C]/20 text-[#C9A84C]" : "bg-[#243A66]/50 text-[#7A8FA8]")}>
                        {r.partner_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className={cn("truncate text-[12.5px]", r.unread_count ? "font-bold text-[#F0ECE4]" : "font-semibold text-[#F0ECE4]/80")}>{r.partner_name}</p>
                          {r.last_message && <span className="flex-shrink-0 text-[9.5px] text-[#7A8FA8]/60">{haQuanto(r.last_message.created_at)}</span>}
                        </div>
                        <p className="truncate text-[10.5px] text-[#7A8FA8]/80">
                          {r.last_message ? `${r.last_message.da_mesa ? "Mesa: " : ""}${r.last_message.content}` : <span className="italic opacity-60">Sem mensagens</span>}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="text-[9.5px] text-[#7A8FA8]/60">{ROTULO_PAPEL[r.partner_role] ?? r.partner_role}</span>
                          {r.aguardando_desde && (
                            <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold", horas >= SLA_H ? "bg-[#F87171]/15 text-[#F87171]" : "bg-[#F59E0B]/15 text-[#F59E0B]")}>
                              <Clock className="w-2.5 h-2.5" /> esperando há {haQuanto(r.aguardando_desde)}
                            </span>
                          )}
                          {r.responsavel_nome && <span className="rounded-full bg-[#243A66]/60 px-1.5 py-0.5 text-[9.5px] text-[#F0ECE4]/70">{r.responsavel_id === profile.id ? "Você" : r.responsavel_nome.split(" ")[0]}</span>}
                        </div>
                      </div>
                      {r.unread_count > 0 && (
                        <span className="v3-badge-pop absolute right-3 top-9 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#C9A84C] px-1.5 text-[10px] font-bold text-[#09081A]">{r.unread_count}</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
            <button onClick={() => setGerenciar(true)} className="flex items-center gap-2 border-t border-[#243A66]/50 px-4 py-3 text-[11px] font-semibold text-[#7A8FA8] hover:text-[#E8C97A]">
              <Settings2 className="w-3.5 h-3.5" /> Respostas prontas ({respostas.length})
            </button>
          </aside>
        )}

        {/* ── Conversa ── */}
        <div className={cn("min-w-0 flex-1 flex-col", isAdmin && mostrarLista ? "hidden md:flex" : "flex")}>
          <div className="flex items-center gap-3 border-b border-[#243A66]/50 bg-[#111F35] px-4 py-3">
            {isAdmin && (
              <button onClick={() => setMostrarLista(true)} className="rounded-lg p-1.5 text-[#7A8FA8] hover:text-[#F0ECE4] md:hidden" aria-label="Voltar"><ArrowLeft className="w-4 h-4" /></button>
            )}
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#C9A84C]/15"><MessageSquare className="w-4 h-4 text-[#C9A84C]" /></div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[13px] font-semibold text-[#F0ECE4]">{isAdmin ? roomAtual?.partner_name ?? "Selecione uma conversa" : "Mesa V3"}</h3>
              <p className="truncate text-[10.5px] text-[#7A8FA8]">
                {isAdmin
                  ? roomAtual ? `${ROTULO_PAPEL[roomAtual.partner_role] ?? roomAtual.partner_role}${responsavel?.nome ? ` · Responsável: ${responsavel.id === profile.id ? "você" : responsavel.nome}` : " · Sem responsável"}` : ""
                  : "Chat direto com a equipe V3 · respondemos em horário comercial"}
              </p>
            </div>
            {isAdmin && roomAtual && !ehInstituicao && (
              <div className="flex items-center gap-1.5">
                {responsavel?.id === profile.id ? (
                  <button onClick={() => assumir(true)} className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-[#243A66] px-2.5 py-1.5 text-[10.5px] font-semibold text-[#7A8FA8] hover:text-[#F0ECE4]"><UserMinus className="w-3.5 h-3.5" /> Soltar</button>
                ) : (
                  <button onClick={() => assumir(false)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#C9A84C]/40 px-2.5 py-1.5 text-[10.5px] font-bold text-[#E8C97A] hover:bg-[#C9A84C]/10"><UserCheck className="w-3.5 h-3.5" /> Assumir</button>
                )}
                <button onClick={() => setPainelNotas((v) => !v)} title="Notas internas"
                  className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10.5px] font-semibold", painelNotas ? "border-[#F59E0B]/50 bg-[#F59E0B]/10 text-[#F59E0B]" : "border-[#243A66] text-[#7A8FA8] hover:text-[#F0ECE4]")}>
                  <StickyNote className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Notas</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex min-h-0 flex-1">
            <div className="flex min-w-0 flex-1 flex-col">
              <div ref={listaRef} className="flex-1 space-y-1 overflow-y-auto px-4 py-4 scrollbar-thin sm:px-5">
                {!activeRoom ? (
                  <div className="flex h-full items-center justify-center text-[12px] text-[#7A8FA8]/60">Escolha uma conversa na lista.</div>
                ) : loading ? (
                  <div className="flex h-full items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#C9A84C]" /></div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                    <MessageSquare className="w-8 h-8 text-[#7A8FA8]/30" />
                    <p className="text-[12.5px] text-[#7A8FA8]">Nenhuma mensagem ainda</p>
                    <p className="max-w-[240px] text-[11px] text-[#7A8FA8]/60">{isAdmin ? "Mande a primeira mensagem para este partner." : "Mande sua dúvida, um documento ou cite uma proposta."}</p>
                  </div>
                ) : (
                  <>
                    {mais && (
                      <div className="flex justify-center pb-2">
                        <button onClick={() => carregarMensagens(activeRoom, { antes: messages[0]?.created_at })} className="inline-flex items-center gap-1.5 rounded-full border border-[#243A66] px-3 py-1 text-[10.5px] text-[#7A8FA8] hover:text-[#F0ECE4]">
                          <ChevronUp className="w-3 h-3" /> Mensagens anteriores
                        </button>
                      </div>
                    )}
                    {grupos.map((g) => (
                      <div key={g.data + g.msgs[0].id}>
                        <div className="my-3 flex items-center gap-3">
                          <div className="h-px flex-1 bg-[#243A66]/40" /><span className="px-2 text-[10px] font-medium text-[#7A8FA8]/50">{g.data}</span><div className="h-px flex-1 bg-[#243A66]/40" />
                        </div>
                        {g.msgs.map((m) => (
                          <Bolha key={m.id} msg={m} propria={m.sender_id === profile.id && m.tipo !== "sistema" && m.sender_role !== "SYSTEM"}
                            lidaPeloOutro={lidaPeloOutro(m)} urls={urls} proposta={m.proposta_id ? propostasMsg[m.proposta_id] : undefined}
                            podeSalvarAnexo={isAdmin && activeRoom.startsWith("partner_")} onSalvarAnexo={setSalvarAnexo} />
                        ))}
                      </div>
                    ))}
                  </>
                )}
                <div ref={fimRef} />
              </div>

              {/* ── Campo de mensagem ── */}
              {activeRoom && (
                <div className="relative border-t border-[#243A66]/50 bg-[#111F35] px-3 py-3 sm:px-4">
                  {sugestoesSlash.length > 0 && (
                    <div className="absolute bottom-full left-3 right-3 mb-2 overflow-hidden rounded-xl border border-[#243A66] bg-[#09081A] shadow-2xl">
                      {sugestoesSlash.map((r) => (
                        <button key={r.id} onClick={() => setInput(r.texto)} className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-[#162744]">
                          <Zap className="mt-0.5 w-3 h-3 flex-shrink-0 text-[#C9A84C]" />
                          <span className="min-w-0"><span className="font-mono text-[11px] text-[#E8C97A]">/{r.atalho}</span> <span className="text-[11px] text-[#F0ECE4]">{r.titulo}</span>
                            <span className="block truncate text-[10px] text-[#7A8FA8]">{r.texto}</span></span>
                        </button>
                      ))}
                    </div>
                  )}
                  {abrirPropostas && (
                    <div className="absolute bottom-full left-3 right-3 mb-2 max-h-80 overflow-y-auto rounded-xl border border-[#243A66] bg-[#09081A] p-2 shadow-2xl">
                      <div className="mb-1 flex items-center justify-between px-1">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7A8FA8]">Vincular proposta</p>
                        <button onClick={() => setAbrirPropostas(false)} aria-label="Fechar"><X className="w-3.5 h-3.5 text-[#7A8FA8]" /></button>
                      </div>
                      {propostasPartner.length === 0 ? <p className="px-2 py-4 text-center text-[11px] text-[#7A8FA8]">Nenhuma proposta.</p> : (
                        <div className="grid gap-1.5 sm:grid-cols-2">
                          {propostasPartner.map((p) => (
                            <button key={p.id} onClick={() => { setPropostaVinc(p); setAbrirPropostas(false); }} className="rounded-xl border-2 border-transparent text-left hover:border-[#C9A84C]/50"><PropostaCard p={p} compacto /></button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {(anexos.length > 0 || propostaVinc || subindo) && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {anexos.map((a) => (
                        <span key={a.path} className="inline-flex max-w-[220px] items-center gap-1.5 rounded-lg border border-[#243A66] bg-[#09081A]/60 px-2 py-1 text-[10.5px] text-[#F0ECE4]">
                          <Paperclip className="w-3 h-3 flex-shrink-0 text-[#C9A84C]" /><span className="truncate">{a.nome}</span>
                          <button onClick={() => setAnexos((l) => l.filter((x) => x.path !== a.path))} aria-label="Remover anexo"><X className="w-3 h-3 text-[#7A8FA8]" /></button>
                        </span>
                      ))}
                      {subindo && <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[10.5px] text-[#7A8FA8]"><Loader2 className="w-3 h-3 animate-spin" /> Enviando arquivo…</span>}
                      {propostaVinc && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#C9A84C]/40 bg-[#C9A84C]/10 px-2 py-1 text-[10.5px] font-semibold text-[#E8C97A]">
                          <Briefcase className="w-3 h-3" />{propostaVinc.code} · {propostaVinc.client_name}
                          <button onClick={() => setPropostaVinc(null)} aria-label="Desvincular"><X className="w-3 h-3" /></button>
                        </span>
                      )}
                    </div>
                  )}
                  {erro && <p className="mb-2 text-[10.5px] text-[#F87171]">{erro}</p>}

                  <div className="flex items-end gap-2">
                    {!ehInstituicao && (
                      <div className="flex items-center gap-0.5 pb-1">
                        <input ref={fileRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" className="hidden" onChange={(e) => subirArquivos(e.target.files)} />
                        <button onClick={() => fileRef.current?.click()} title="Anexar arquivo" className="rounded-lg p-2 text-[#7A8FA8] hover:bg-white/5 hover:text-[#E8C97A]"><Paperclip className="w-4 h-4" /></button>
                        {activeRoom.startsWith("partner_") && (
                          <button onClick={() => setAbrirPropostas((v) => !v)} title="Vincular proposta" className={cn("rounded-lg p-2 hover:bg-white/5", abrirPropostas ? "text-[#E8C97A]" : "text-[#7A8FA8] hover:text-[#E8C97A]")}><Briefcase className="w-4 h-4" /></button>
                        )}
                        {isAdmin && activeRoom.startsWith("partner_") && (
                          <button onClick={sugerir} disabled={sugerindo} title="Sugerir resposta com IA" className="rounded-lg p-2 text-[#7A8FA8] hover:bg-white/5 hover:text-[#E8C97A] disabled:opacity-50">
                            {sugerindo ? <Loader2 className="w-4 h-4 animate-spin text-[#C9A84C]" /> : <Sparkles className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    )}
                    <textarea value={input} onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (sugestoesSlash.length) setInput(sugestoesSlash[0].texto);
                          else enviar();
                        }
                      }}
                      onPaste={(e) => { if (e.clipboardData.files.length && !ehInstituicao) { e.preventDefault(); subirArquivos(e.clipboardData.files); } }}
                      placeholder={isAdmin ? "Mensagem… ( / para respostas prontas )" : "Escreva sua mensagem…"}
                      rows={Math.min(6, Math.max(1, input.split("\n").length))}
                      className="max-h-40 min-h-[40px] flex-1 resize-none rounded-xl border border-[#243A66]/60 bg-[#162744] px-3.5 py-2.5 text-[12.5px] text-[#F0ECE4] outline-none transition-all placeholder:text-[#7A8FA8]/50 focus:ring-1 focus:ring-[#C9A84C]/30 scrollbar-thin" />
                    <button onClick={enviar} disabled={enviando || subindo || (!input.trim() && !anexos.length)}
                      className={cn("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-all",
                        (input.trim() || anexos.length) && !enviando ? "bg-[#C9A84C] text-[#09081A] shadow-lg shadow-[#C9A84C]/20 hover:bg-[#E8C97A]" : "cursor-not-allowed bg-[#162744] text-[#7A8FA8]/30")}>
                      {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="mt-1.5 px-1 text-[9px] text-[#7A8FA8]/40">
                    Enter envia · Shift+Enter quebra linha · cole ou anexe PDF/fotos{activeRoom.startsWith("partner_") ? " · cite o código da proposta para vinculá-la" : ""}
                  </p>
                </div>
              )}
            </div>

            {isAdmin && painelNotas && activeRoom && (
              <aside className="hidden w-72 flex-shrink-0 border-l border-[#243A66]/50 bg-[#111F35] p-4 lg:block">
                <NotasInternas roomId={activeRoom} meuId={profile.id} />
              </aside>
            )}
          </div>
        </div>
      </div>

      {isAdmin && painelNotas && activeRoom && (
        <div className="fixed inset-x-0 bottom-0 z-40 max-h-[60vh] overflow-y-auto rounded-t-2xl border-t border-[#243A66] bg-[#111F35] p-4 lg:hidden">
          <button onClick={() => setPainelNotas(false)} className="absolute right-3 top-3" aria-label="Fechar notas"><X className="w-4 h-4 text-[#7A8FA8]" /></button>
          <NotasInternas roomId={activeRoom} meuId={profile.id} />
        </div>
      )}
      {gerenciar && (
        <GerenciarRespostas respostas={respostas} onFechar={() => setGerenciar(false)}
          onMudou={() => fetch("/api/chat/respostas").then((r) => r.json()).then((j) => setRespostas(j.respostas ?? [])).catch(() => {})} />
      )}
      {salvarAnexo && (
        <SalvarAnexoModal anexo={salvarAnexo} propostas={propostasPartner} onFechar={() => setSalvarAnexo(null)}
          onSalvo={(code) => { setSalvarAnexo(null); setToast({ nome: "Anexo salvo", texto: `Arquivo salvo nos documentos da proposta ${code}.`, room: activeRoom }); }} />
      )}
    </>
  );
}
