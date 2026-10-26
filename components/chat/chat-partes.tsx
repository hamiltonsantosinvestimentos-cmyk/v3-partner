"use client";

import React, { useEffect, useState } from "react";
import {
  Check, CheckCheck, FileText, Download, FolderInput, Loader2, X, StickyNote, Trash2, Plus, Pencil, Zap, Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Peças do Chat Partners v2 (26/10/2026), usadas por chat-client.tsx.

export interface Anexo { path: string; nome: string; tipo: string; tamanho: number }

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string | null;
  sender_name: string;
  sender_role: string;
  content: string;
  created_at: string;
  tipo?: string | null;
  anexos?: Anexo[] | null;
  proposta_id?: string | null;
}

export interface PropostaResumo {
  id: string; code: string; client_name: string | null; credit_line: string | null;
  requested_value: number | null; stage: string | null; status: string | null; pending_reason: string | null;
}

const ETAPA: Record<string, string> = {
  RECEBIDO: "Recebido", TRIAGEM: "Triagem", ANALISE: "Análise de crédito", PENDENCIA: "Pendência de docs",
  AVALIACAO_IMOVEL: "Avaliação de imóvel", APROVACAO: "Em aprovação", CONTRATO_ASSINADO: "Contrato assinado",
  REGISTRO_IMOVEL: "Registro de imóveis", LIBERADO: "Recurso liberado", REPROVADO: "Reprovado", DECLINADO: "Declinado", FINALIZADO: "Finalizado",
};
export const etapaLabel = (s?: string | null) => (s ? ETAPA[s] ?? s : "—");
const corEtapa = (s?: string | null) =>
  s === "LIBERADO" ? "#34D399" : s === "PENDENCIA" ? "#F59E0B" : s === "REPROVADO" || s === "DECLINADO" ? "#F87171" : "#C9A84C";
const brl = (v?: number | null) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }));
const tamanho = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

export function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

export function haQuanto(iso: string) {
  const min = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d`;
}

// ─── Cartão de proposta ──────────────────────────────────────────────────────

export function PropostaCard({ p, compacto = false }: { p: PropostaResumo; compacto?: boolean }) {
  const cor = corEtapa(p.stage);
  return (
    <div className={cn("rounded-xl border bg-[#09081A]/60 text-left", compacto ? "px-3 py-2" : "px-3.5 py-3")} style={{ borderColor: `${cor}55` }}>
      <div className="flex items-center gap-2">
        <Briefcase className="w-3.5 h-3.5 flex-shrink-0" style={{ color: cor }} />
        <span className="font-mono text-[11px] font-bold text-[#F0ECE4]">{p.code}</span>
        <span className="ml-auto rounded-full px-2 py-0.5 text-[9.5px] font-bold" style={{ color: cor, background: `${cor}1A` }}>{etapaLabel(p.stage)}</span>
      </div>
      <p className="mt-1 truncate text-[11.5px] text-[#F0ECE4]">{p.client_name ?? "Cliente"}</p>
      <p className="text-[10.5px] text-[#7A8FA8]">{p.credit_line ?? ""}{p.requested_value ? ` · ${brl(p.requested_value)}` : ""}</p>
      {p.stage === "PENDENCIA" && p.pending_reason && !compacto && (
        <p className="mt-1.5 rounded-lg bg-[#F59E0B]/10 px-2 py-1 text-[10.5px] text-[#F59E0B]">Falta: {p.pending_reason}</p>
      )}
    </div>
  );
}

// ─── Anexo ───────────────────────────────────────────────────────────────────

export function AnexoView({ a, url, podeSalvar, onSalvar }: { a: Anexo; url?: string; podeSalvar: boolean; onSalvar: () => void }) {
  const imagem = a.tipo.startsWith("image/");
  return (
    <div className="mt-1.5 overflow-hidden rounded-xl border border-[#243A66]/70 bg-[#09081A]/50">
      {imagem && url && (
        <a href={url} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={a.nome} className="max-h-56 w-full object-cover" />
        </a>
      )}
      <div className="flex items-center gap-2 px-3 py-2">
        <FileText className="w-4 h-4 flex-shrink-0 text-[#C9A84C]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11.5px] font-semibold text-[#F0ECE4]">{a.nome}</p>
          <p className="text-[10px] text-[#7A8FA8]">{tamanho(a.tamanho)}</p>
        </div>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" title="Abrir" className="rounded-lg p-1.5 text-[#7A8FA8] hover:bg-white/5 hover:text-[#F0ECE4]">
            <Download className="w-3.5 h-3.5" />
          </a>
        )}
        {podeSalvar && (
          <button onClick={onSalvar} title="Salvar nos documentos da proposta" className="inline-flex items-center gap-1 rounded-lg border border-[#C9A84C]/40 px-2 py-1 text-[10px] font-bold text-[#E8C97A] hover:bg-[#C9A84C]/10">
            <FolderInput className="w-3 h-3" /> Salvar na proposta
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Bolha de mensagem ───────────────────────────────────────────────────────

export function Bolha({ msg, propria, lidaPeloOutro, urls, proposta, podeSalvarAnexo, onSalvarAnexo }: {
  msg: ChatMessage; propria: boolean; lidaPeloOutro: boolean; urls: Record<string, string>;
  proposta?: PropostaResumo; podeSalvarAnexo: boolean; onSalvarAnexo: (a: Anexo) => void;
}) {
  if (msg.tipo === "sistema" || msg.sender_role === "SYSTEM") {
    return (
      <div className="my-3 flex justify-center">
        <div className="max-w-[85%] rounded-2xl border border-[#C9A84C]/25 bg-[#C9A84C]/[.06] px-4 py-2.5 text-center">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-[#C9A84C]">{msg.sender_name} · {hora(msg.created_at)}</p>
          <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-[#F0ECE4]">{msg.content}</p>
          {proposta && <div className="mt-2"><PropostaCard p={proposta} compacto /></div>}
        </div>
      </div>
    );
  }
  const soAnexo = !!msg.anexos?.length && msg.content.split("\n").every((l) => l.startsWith("📎 "));
  return (
    <div className={cn("flex mb-2", propria ? "justify-end" : "justify-start")}>
      {!propria && (
        <div className="mr-2 mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[#243A66]/80 text-[10px] font-bold text-[#7A8FA8]">
          {msg.sender_name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className={cn("flex max-w-[75%] flex-col", propria ? "items-end" : "items-start")}>
        {!propria && <span className="mb-1 ml-1 text-[10px] text-[#7A8FA8]/70">{msg.sender_name}</span>}
        <div className={cn("rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed break-words", propria ? "rounded-tr-sm" : "rounded-tl-sm")}
          style={propria
            ? { background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.2)", color: "#E8C97A" }
            : { background: "#162744", border: "1px solid rgba(36,58,102,0.6)", color: "#F0ECE4" }}>
          {!soAnexo && <p className="whitespace-pre-wrap">{msg.content}</p>}
          {(msg.anexos ?? []).map((a) => (
            <AnexoView key={a.path} a={a} url={urls[a.path]} podeSalvar={podeSalvarAnexo} onSalvar={() => onSalvarAnexo(a)} />
          ))}
          {proposta && <div className="mt-2"><PropostaCard p={proposta} /></div>}
        </div>
        <span className="mt-1 flex items-center gap-1 px-1 text-[9px] text-[#7A8FA8]/50">
          {hora(msg.created_at)}
          {propria && (lidaPeloOutro
            ? <CheckCheck className="w-3 h-3 text-[#34D399]" aria-label="Lida" />
            : <Check className="w-3 h-3" aria-label="Enviada" />)}
        </span>
      </div>
    </div>
  );
}

// ─── Salvar anexo na proposta ────────────────────────────────────────────────

export function SalvarAnexoModal({ anexo, propostas, onFechar, onSalvo }: {
  anexo: Anexo; propostas: PropostaResumo[]; onFechar: () => void; onSalvo: (code: string) => void;
}) {
  const [escolhida, setEscolhida] = useState<string>(propostas[0]?.id ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const salvar = async () => {
    setSalvando(true); setErro(null);
    const r = await fetch("/api/chat/salvar-anexo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: anexo.path, nome: anexo.nome, proposal_id: escolhida }) });
    const j = await r.json().catch(() => ({}));
    setSalvando(false);
    if (!r.ok) return setErro(j.error ?? "Não foi possível salvar");
    onSalvo(j.proposta);
  };
  return (
    <Janela titulo="Salvar anexo na proposta" onFechar={onFechar}>
      <p className="text-[12px] text-[#7A8FA8]">O arquivo <span className="font-semibold text-[#F0ECE4]">{anexo.nome}</span> vai para a aba Documentos da proposta escolhida.</p>
      {propostas.length === 0 ? (
        <p className="mt-4 rounded-xl border border-[#243A66] px-3 py-4 text-center text-[12px] text-[#7A8FA8]">Este partner não tem propostas.</p>
      ) : (
        <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
          {propostas.map((p) => (
            <button key={p.id} onClick={() => setEscolhida(p.id)} className={cn("block w-full rounded-xl border-2 text-left transition-all", escolhida === p.id ? "border-[#C9A84C]" : "border-transparent")}>
              <PropostaCard p={p} compacto />
            </button>
          ))}
        </div>
      )}
      {erro && <p className="mt-3 text-[11px] text-[#F87171]">{erro}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onFechar} className="rounded-xl px-4 py-2 text-[12px] text-[#7A8FA8] hover:text-[#F0ECE4]">Cancelar</button>
        <button onClick={salvar} disabled={!escolhida || salvando} className="inline-flex items-center gap-2 rounded-xl bg-[#C9A84C] px-4 py-2 text-[12px] font-bold text-[#09081A] disabled:opacity-50">
          {salvando && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Salvar
        </button>
      </div>
    </Janela>
  );
}

export function Janela({ titulo, onFechar, children, largura = "max-w-lg" }: { titulo: string; onFechar: () => void; children: React.ReactNode; largura?: string }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onFechar]);
  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-6" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="absolute inset-0 bg-[#09081A]/75 backdrop-blur-sm" onClick={onFechar} />
      <div className={cn("v3-cmdk relative max-h-[90vh] w-full overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-[#243A66] bg-[#111F35] p-5", largura)}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-[#F0ECE4]">{titulo}</h3>
          <button onClick={onFechar} aria-label="Fechar" className="rounded-lg p-1.5 text-[#7A8FA8] hover:bg-white/5 hover:text-[#F0ECE4]"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Notas internas ──────────────────────────────────────────────────────────

interface Nota { id: string; autor_id: string | null; autor_nome: string | null; conteudo: string; created_at: string }

export function NotasInternas({ roomId, meuId }: { roomId: string; meuId: string }) {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    let vivo = true;
    setNotas([]);
    fetch(`/api/chat/notas?room_id=${encodeURIComponent(roomId)}`).then((r) => r.json()).then((j) => {
      if (!vivo) return;
      setNotas(j.notas ?? []);
      setErro(j.semMigration ? "Notas disponíveis depois da atualização do banco." : null);
    }).catch(() => {});
    return () => { vivo = false; };
  }, [roomId]);
  const salvar = async () => {
    if (!texto.trim()) return;
    setSalvando(true);
    const r = await fetch("/api/chat/notas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ room_id: roomId, conteudo: texto }) });
    const j = await r.json().catch(() => ({}));
    setSalvando(false);
    if (!r.ok) return setErro(j.error ?? "Erro ao salvar");
    setNotas((n) => [j.nota, ...n]); setTexto(""); setErro(null);
  };
  const apagar = async (id: string) => {
    const r = await fetch(`/api/chat/notas?id=${id}`, { method: "DELETE" });
    if (r.ok) setNotas((n) => n.filter((x) => x.id !== id));
  };
  return (
    <div className="flex h-full flex-col">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#C9A84C]"><StickyNote className="w-3.5 h-3.5" /> Notas internas</p>
      <p className="mb-3 text-[10.5px] text-[#7A8FA8]">Só a Mesa vê. O partner nunca recebe.</p>
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} placeholder="Ex.: cliente pediu para ligar depois das 14h"
        className="w-full resize-none rounded-xl border border-[#243A66] bg-[#09081A]/60 px-3 py-2 text-[12px] text-[#F0ECE4] outline-none focus:border-[#C9A84C]/50" />
      <button onClick={salvar} disabled={salvando || !texto.trim()} className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#C9A84C]/15 px-3 py-2 text-[11px] font-bold text-[#E8C97A] disabled:opacity-40">
        {salvando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Adicionar nota
      </button>
      {erro && <p className="mt-2 text-[10.5px] text-[#F59E0B]">{erro}</p>}
      <div className="mt-4 flex-1 space-y-2 overflow-y-auto scrollbar-thin">
        {notas.map((n) => (
          <div key={n.id} className="rounded-xl border border-[#F59E0B]/20 bg-[#F59E0B]/[.05] px-3 py-2">
            <p className="whitespace-pre-wrap text-[11.5px] text-[#F0ECE4]">{n.conteudo}</p>
            <div className="mt-1 flex items-center justify-between text-[9.5px] text-[#7A8FA8]">
              <span>{n.autor_nome} · {new Date(n.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
              {n.autor_id === meuId && <button onClick={() => apagar(n.id)} aria-label="Apagar nota" className="hover:text-[#F87171]"><Trash2 className="w-3 h-3" /></button>}
            </div>
          </div>
        ))}
        {!notas.length && !erro && <p className="text-center text-[10.5px] text-[#7A8FA8]/60">Nenhuma nota nesta conversa.</p>}
      </div>
    </div>
  );
}

// ─── Respostas prontas ───────────────────────────────────────────────────────

export interface RespostaPronta { id: string; atalho: string; titulo: string; texto: string }

export function GerenciarRespostas({ respostas, onFechar, onMudou }: { respostas: RespostaPronta[]; onFechar: () => void; onMudou: () => void }) {
  const vazio = { id: "", atalho: "", titulo: "", texto: "" };
  const [edit, setEdit] = useState<RespostaPronta>(vazio);
  const [erro, setErro] = useState<string | null>(null);
  const salvar = async () => {
    const r = await fetch("/api/chat/respostas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...edit, id: edit.id || undefined }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErro(j.error ?? "Erro ao salvar");
    setEdit(vazio); setErro(null); onMudou();
  };
  const apagar = async (id: string) => {
    const r = await fetch(`/api/chat/respostas?id=${id}`, { method: "DELETE" });
    if (r.ok) onMudou();
  };
  const campo = "w-full rounded-xl border border-[#243A66] bg-[#09081A]/60 px-3 py-2 text-[12px] text-[#F0ECE4] outline-none focus:border-[#C9A84C]/50";
  return (
    <Janela titulo="Respostas prontas" onFechar={onFechar} largura="max-w-2xl">
      <p className="text-[11.5px] text-[#7A8FA8]">No campo de mensagem, digite <span className="font-mono text-[#E8C97A]">/</span> e o atalho para inserir o texto.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-[140px_1fr]">
        <input value={edit.atalho} onChange={(e) => setEdit({ ...edit, atalho: e.target.value })} placeholder="atalho (ex.: docs-pf)" className={campo} />
        <input value={edit.titulo} onChange={(e) => setEdit({ ...edit, titulo: e.target.value })} placeholder="Título" className={campo} />
      </div>
      <textarea value={edit.texto} onChange={(e) => setEdit({ ...edit, texto: e.target.value })} rows={4} placeholder="Texto da resposta" className={cn(campo, "mt-2 resize-none")} />
      {erro && <p className="mt-2 text-[11px] text-[#F87171]">{erro}</p>}
      <div className="mt-2 flex justify-end gap-2">
        {edit.id && <button onClick={() => setEdit(vazio)} className="rounded-xl px-3 py-2 text-[11px] text-[#7A8FA8]">Cancelar edição</button>}
        <button onClick={salvar} className="inline-flex items-center gap-1.5 rounded-xl bg-[#C9A84C] px-4 py-2 text-[11px] font-bold text-[#09081A]">
          {edit.id ? <Pencil className="w-3 h-3" /> : <Plus className="w-3 h-3" />} {edit.id ? "Salvar alteração" : "Adicionar"}
        </button>
      </div>
      <div className="mt-5 divide-y divide-[#243A66]/50 border-t border-[#243A66]/50">
        {respostas.map((r) => (
          <div key={r.id} className="flex items-start gap-3 py-3">
            <Zap className="mt-0.5 w-3.5 h-3.5 flex-shrink-0 text-[#C9A84C]" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-[#F0ECE4]"><span className="font-mono text-[#E8C97A]">/{r.atalho}</span> · {r.titulo}</p>
              <p className="mt-0.5 line-clamp-2 text-[11px] text-[#7A8FA8]">{r.texto}</p>
            </div>
            <button onClick={() => setEdit(r)} aria-label="Editar" className="rounded-lg p-1.5 text-[#7A8FA8] hover:text-[#F0ECE4]"><Pencil className="w-3.5 h-3.5" /></button>
            <button onClick={() => apagar(r.id)} aria-label="Apagar" className="rounded-lg p-1.5 text-[#7A8FA8] hover:text-[#F87171]"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
        {!respostas.length && <p className="py-4 text-center text-[11px] text-[#7A8FA8]">Nenhuma resposta cadastrada (ou o banco ainda não foi atualizado).</p>}
      </div>
    </Janela>
  );
}
