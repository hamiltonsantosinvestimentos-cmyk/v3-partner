"use client";
// Kanban de Consórcio › Projetos: quadro, alternância Kanban/Lista e modal do item com fio de comentários.
// BRIEF docs/briefs/2026-11-27_kanban-consorcio-projetos.md

import React, { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Loader2, MessageSquare, X } from "lucide-react";
import { dataBR } from "@/app/(platform)/enterprise/mesa-operacional/exibicao";
import { TEXTO_MAX, agruparPorColuna, type AlvoTipo } from "@/lib/consorcio/kanban";

export type Visao = "kanban" | "lista";
export type Coluna = { id: string; rotulo: string };

/** Alternância Kanban | Lista, lembrada no navegador. */
const EVENTO_VISAO = "v3:visao-kanban";
// Cópia em memória: sem armazenamento no navegador, a troca ainda vale enquanto a página está aberta.
const memoria = new Map<string, Visao>();
function lerVisao(chave: string): Visao {
  const m = memoria.get(chave);
  if (m) return m;
  try {
    return window.localStorage.getItem(chave) === "lista" ? "lista" : "kanban";
  } catch {
    return "kanban";
  }
}
export function useVisao(chave: string): [Visao, (v: Visao) => void] {
  const visao = useSyncExternalStore(
    (avisar) => { window.addEventListener(EVENTO_VISAO, avisar); return () => window.removeEventListener(EVENTO_VISAO, avisar); },
    () => lerVisao(chave),
    () => "kanban" as Visao,
  );
  const trocar = (v: Visao) => {
    memoria.set(chave, v);
    try { window.localStorage.setItem(chave, v); } catch { /* ignora */ }
    window.dispatchEvent(new Event(EVENTO_VISAO));
  };
  return [visao, trocar];
}

export function SeletorVisao({ visao, onTrocar }: { visao: Visao; onTrocar: (v: Visao) => void }) {
  return (
    <div role="group" aria-label="Visão" className="inline-flex rounded-lg border border-[#243A66] bg-[#111F35] p-0.5">
      {(["kanban", "lista"] as Visao[]).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={visao === v}
          onClick={() => onTrocar(v)}
          className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${visao === v ? "bg-[#C9A84C] text-[#09081A]" : "text-[#7A8FA8] hover:text-[#F0ECE4]"}`}
        >
          {v === "kanban" ? "Kanban" : "Lista"}
        </button>
      ))}
    </div>
  );
}

export function SeloComentarios({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-[#7A8FA8]" title={`${n} comentário(s)`}>
      <MessageSquare className="h-3 w-3" /> {n}
    </span>
  );
}

type ItemBase = { id: string; created_at: string | null; code?: string | null };

export function QuadroKanban<T extends ItemBase>({
  colunas, itens, colunaDe, podeMover, onMover, onAbrir, renderCard,
}: {
  colunas: Coluna[];
  itens: T[];
  colunaDe: (i: T) => string;
  podeMover: boolean;
  onMover: (item: T, coluna: string) => Promise<boolean>;
  onAbrir: (item: T) => void;
  renderCard: (item: T) => React.ReactNode;
}) {
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const grupos = agruparPorColuna(colunas.map((c) => c.id), itens, colunaDe);

  const soltar = async (coluna: string) => {
    setAlvo(null);
    const item = itens.find((i) => i.id === arrastando);
    setArrastando(null);
    if (!item || colunaDe(item) === coluna) return;
    setErro(null);
    const ok = await onMover(item, coluna);
    if (!ok) setErro("Não foi possível mover agora. Tente de novo.");
  };

  return (
    <div className="space-y-2">
      {erro && <p role="alert" className="rounded-lg border border-[#E8C97A]/40 px-3 py-2 text-xs text-[#E8C97A]">{erro}</p>}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-max">
          {colunas.map((c) => (
            <div
              key={c.id}
              onDragOver={(e) => { if (podeMover && arrastando) { e.preventDefault(); setAlvo(c.id); } }}
              onDragLeave={() => setAlvo((a) => (a === c.id ? null : a))}
              onDrop={(e) => { e.preventDefault(); if (podeMover) void soltar(c.id); }}
              className={`flex w-[250px] flex-col gap-2 rounded-xl border p-2 transition-colors ${alvo === c.id ? "border-[#C9A84C] bg-[#C9A84C]/5" : "border-[#243A66] bg-[#111F35]"}`}
            >
              <div className="flex items-center justify-between px-1 pt-0.5">
                <span className="text-[9px] font-bold tracking-[0.18em] uppercase text-[#C9A84C]">{c.rotulo}</span>
                <span className="text-[11px] font-semibold text-[#7A8FA8] tabular-nums">{grupos[c.id].length}</span>
              </div>
              {grupos[c.id].length === 0 ? (
                <p className="py-4 text-center text-[11px] text-[#7A8FA8]">Nada aqui</p>
              ) : grupos[c.id].map((i) => (
                <div
                  key={i.id}
                  role="button"
                  tabIndex={0}
                  draggable={podeMover}
                  onDragStart={(e) => { setArrastando(i.id); e.dataTransfer.effectAllowed = "move"; }}
                  onDragEnd={() => { setArrastando(null); setAlvo(null); }}
                  onClick={() => onAbrir(i)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAbrir(i); } }}
                  className={`overflow-hidden rounded-lg border border-[#243A66] bg-[#162744] text-left hover:border-[#C9A84C]/50 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#E8C97A] ${podeMover ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${arrastando === i.id ? "opacity-50" : ""}`}
                >
                  {renderCard(i)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type Comentario = { id: string; autor: string; texto: string; visivel_partner: boolean; evento: boolean; created_at: string };

export function ModalItem({
  tipo, id, titulo, tarja, detalhes, etapas, etapaAtual, podeMover, onMudarEtapa, onFechar, onComentou,
}: {
  tipo: AlvoTipo;
  id: string;
  titulo: string;
  tarja: string;
  detalhes: React.ReactNode;
  etapas: Coluna[];
  etapaAtual: string;
  podeMover: boolean;
  onMudarEtapa: (etapa: string) => Promise<boolean>;
  onFechar: () => void;
  onComentou: () => void;
}) {
  const [fio, setFio] = useState<Comentario[] | null>(null);
  const [erroFio, setErroFio] = useState<string | null>(null);
  const [podeComentar, setPodeComentar] = useState(false);
  const [podeNota, setPodeNota] = useState(false);
  const [texto, setTexto] = useState("");
  const [visivel, setVisivel] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [etapa, setEtapa] = useState(etapaAtual);
  const [mudando, setMudando] = useState(false);
  const [erroEtapa, setErroEtapa] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/consorcio/comentarios?tipo=${tipo}&id=${id}`);
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error();
      if (j?.disponivel === false) { setErroFio("Comentários indisponíveis no momento."); setFio([]); return; }
      setFio(Array.isArray(j?.comentarios) ? j.comentarios : []);
      setPodeComentar(!!j?.pode_comentar);
      setPodeNota(!!j?.pode_nota_interna);
      setErroFio(null);
    } catch {
      setErroFio("Não foi possível carregar os comentários agora.");
    }
  }, [tipo, id]);

  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { setEtapa(etapaAtual); }, [etapaAtual]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);

  const comentar = async () => {
    const t = texto.trim();
    if (!t || t.length > TEXTO_MAX) return;
    setEnviando(true);
    setErroEnvio(null);
    try {
      const r = await fetch("/api/consorcio/comentarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, id, texto: t, visivel_partner: podeNota ? visivel : true }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(typeof j?.error === "string" ? j.error : "Não foi possível comentar agora. Tente de novo.");
      setTexto("");
      setVisivel(true);
      await carregar();
      onComentou();
    } catch (e) {
      setErroEnvio(e instanceof Error ? e.message : "Não foi possível comentar agora. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  };

  const mudarEtapa = async (nova: string) => {
    if (nova === etapa) return;
    const anterior = etapa;
    setEtapa(nova);
    setMudando(true);
    setErroEtapa(null);
    const ok = await onMudarEtapa(nova);
    setMudando(false);
    if (!ok) { setEtapa(anterior); setErroEtapa("Não foi possível mover agora. Tente de novo."); return; }
    await carregar();
  };

  const rotuloBotao = !podeNota ? "Comentar" : visivel ? "Comentar para o partner" : "Salvar nota interna";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#09081A]/80 p-4" onClick={onFechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-item-titulo"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[760px] max-h-[calc(100vh-32px)] flex-col overflow-hidden rounded-2xl border border-[#243A66] bg-[#111F35]"
      >
        <div className="bg-[#C9A84C] px-5 py-1 text-[9px] font-bold tracking-[0.18em] uppercase text-[#09081A]">{tarja}</div>
        <div className="flex items-start justify-between gap-3 border-b border-[#243A66] px-5 py-3">
          <h3 id="modal-item-titulo" className="min-w-0 break-words text-base font-semibold text-[#F0ECE4]">{titulo}</h3>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded-md p-1 text-[#7A8FA8] hover:text-[#F0ECE4]"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="space-y-1.5">{detalhes}</div>

          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="modal-etapa" className="text-xs text-[#7A8FA8]">Etapa</label>
            {podeMover ? (
              <select
                id="modal-etapa"
                value={etapa}
                disabled={mudando}
                onChange={(e) => void mudarEtapa(e.target.value)}
                className="rounded-lg border border-[#243A66] bg-[#162744] px-2 py-1 text-xs font-semibold text-[#F0ECE4] focus:outline-none"
              >
                {etapas.map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
              </select>
            ) : (
              <span id="modal-etapa" className="rounded-full bg-[#243A66] px-2 py-0.5 text-[11px] font-semibold text-[#F0ECE4]">
                {etapas.find((c) => c.id === etapa)?.rotulo ?? etapa}
              </span>
            )}
            {mudando && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C9A84C]" />}
            {erroEtapa && <span className="text-[11px] text-[#E8C97A]">{erroEtapa}</span>}
          </div>

          <div className="space-y-2">
            <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-[#C9A84C]">Acompanhamento</p>
            {erroFio ? (
              <p className="text-xs text-[#7A8FA8]">{erroFio}</p>
            ) : fio === null ? (
              <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-[#C9A84C]" /></div>
            ) : fio.length === 0 ? (
              <p className="text-xs text-[#7A8FA8]">Nenhum comentário ainda.</p>
            ) : (
              <ol className="space-y-2">
                {fio.map((c) => c.evento ? (
                  <li key={c.id} className="text-[11px] text-[#7A8FA8]">{c.texto}, por {c.autor}, {dataBR(c.created_at, true)}</li>
                ) : (
                  <li key={c.id} className={`rounded-lg border px-3 py-2 ${c.visivel_partner ? "border-[#243A66] bg-[#162744]" : "border-dashed border-[#C9A84C]/40 bg-[#09081A]"}`}>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#7A8FA8]">
                      <span className="font-semibold text-[#F0ECE4]">{c.autor}</span>
                      <span>{dataBR(c.created_at, true)}</span>
                      {!c.visivel_partner && <span className="rounded-full border border-[#C9A84C]/40 px-1.5 text-[10px] text-[#E8C97A]">Nota interna</span>}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[#F0ECE4]">{c.texto}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {podeComentar && (
          <div className="border-t border-[#243A66] px-5 py-3 space-y-2">
            <label htmlFor="modal-comentario" className="sr-only">Comentário</label>
            <textarea
              id="modal-comentario"
              value={texto}
              maxLength={TEXTO_MAX}
              rows={3}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escreva um comentário"
              className="w-full resize-y rounded-lg border border-[#243A66] bg-[#162744] px-3 py-2 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/60"
            />
            <p className="text-[11px] text-[#7A8FA8]">Não escreva CPF, telefone, e-mail ou renda do cliente no comentário.</p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-3">
                {podeNota && (
                  <label htmlFor="modal-visivel" className="flex items-center gap-1.5 text-xs text-[#7A8FA8]" title="Desmarque para deixar a nota só para a equipe V3.">
                    <input id="modal-visivel" type="checkbox" checked={visivel} onChange={(e) => setVisivel(e.target.checked)} className="accent-[#C9A84C]" />
                    Visível para o partner
                  </label>
                )}
                {podeNota && visivel && <span className="rounded-full bg-[#C9A84C]/15 px-2 py-0.5 text-[10px] font-semibold text-[#E8C97A]">O partner verá este comentário</span>}
                <span className="text-[10px] text-[#7A8FA8] tabular-nums">{texto.length.toLocaleString("pt-BR")}/{TEXTO_MAX.toLocaleString("pt-BR")}</span>
              </div>
              <button
                type="button"
                onClick={() => void comentar()}
                disabled={enviando || !texto.trim()}
                className="h-9 rounded-md bg-[#C9A84C] px-4 text-sm font-semibold text-[#09081A] hover:bg-[#E8C97A] disabled:opacity-45 disabled:cursor-not-allowed"
              >
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : rotuloBotao}
              </button>
            </div>
            {erroEnvio && <p className="text-xs text-[#E8C97A]">{erroEnvio}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
