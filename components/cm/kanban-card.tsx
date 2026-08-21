"use client";

// Card do Kanban da Mesa de Capitais, extraido de mesa-capitais-client.tsx (21/08/2026)
// para caber o menu de 3 pontos + drag-and-drop sem inflar ainda mais o client gigante.
// Regra de design deste card: ele NUNCA decide se uma transicao de status e valida --
// isso e feito 100% pela funcao transition_cm_listing_status() no banco (ver
// app/api/cm/listings/[id]/status/route.ts). O card so oferece o atalho (menu/drag),
// o pai (MesaCapitaisClient) chama a mesma rota PATCH que o painel de detalhe ja usa,
// e mostra o erro real devolvido pelo servidor se a transicao for rejeitada.

import { useEffect, useRef, useState } from "react";
import { MoreVertical, GripVertical, Trash2, ArrowRight } from "lucide-react";
import { cn, type CmCurrency } from "@/lib/utils";

export interface KanbanCardListing {
  id: string;
  anonymous_id: string;
  apelido: string | null;
  valor_face: number;
  currency?: CmCurrency;
  risk_score: number | null;
  listing_status: string;
  cm_bids?: { count: number }[];
  cm_listing_documents?: { count: number }[];
  deletion_status?: string | null;
  nda_authorization_status?: string | null;
  days_in_stage?: number | null;
}

function daysBadgeStyle(days: number): string {
  if (days >= 8) return "bg-red-500/10 border-red-500/20 text-red-400";
  if (days >= 4) return "bg-amber-500/10 border-amber-500/20 text-amber-400";
  return "bg-[#162744] border-[#9BAFC5]/15 text-[#9BAFC5]";
}

export function KanbanCard({
  listing: l,
  userRole,
  valueLabel,
  isBulkEligible,
  isBulkSelected,
  onToggleBulk,
  onOpenDetail,
  slaInfo,
  nextAction,
  onAdvance,
  onRequestDelete,
  draggable,
  onDragStart,
  onDragEnd,
}: {
  listing: KanbanCardListing;
  userRole: string;
  valueLabel: string;
  isBulkEligible: boolean;
  isBulkSelected: boolean;
  onToggleBulk: () => void;
  onOpenDetail: () => void;
  slaInfo?: { hours_pending: number; pending_count: number };
  nextAction: { label: string } | null;
  onAdvance: () => void;
  onRequestDelete: () => void;
  draggable: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  const canManage = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(userRole);

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpenDetail}
      className={cn(
        "group relative bg-[#12112A] border border-[#9BAFC5]/10 rounded-md p-3 pr-7 cursor-pointer hover:border-[#C9A84C]/30 transition",
        draggable && "active:cursor-grabbing"
      )}
    >
      {draggable && (
        <GripVertical
          size={14}
          className="absolute left-1 top-1/2 -translate-y-1/2 text-[#9BAFC5]/25 opacity-0 group-hover:opacity-100 transition hidden sm:block"
        />
      )}

      {isBulkEligible && ["ADMIN", "GESTAO"].includes(userRole) && (
        <input
          type="checkbox"
          checked={isBulkSelected}
          onClick={(e) => e.stopPropagation()}
          onChange={onToggleBulk}
          className="absolute top-2 right-7 w-3.5 h-3.5 accent-[#C9A84C]"
          title="Selecionar para publicação em lote"
        />
      )}

      {canManage && (nextAction || true) && (
        <div ref={menuRef} className="absolute top-1 right-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            className="min-w-[28px] min-h-[28px] sm:min-w-[22px] sm:min-h-[22px] flex items-center justify-center rounded text-[#9BAFC5] hover:text-[#F5F1E8] hover:bg-[#F5F1E8]/10 transition"
            aria-label="Ações rápidas"
          >
            <MoreVertical size={14} />
          </button>
          {menuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full mt-1 z-20 w-52 bg-[#162744] border border-[#C9A84C]/20 rounded-lg shadow-xl py-1"
            >
              {nextAction && (
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onAdvance(); }}
                  className="w-full min-h-[44px] sm:min-h-0 sm:py-2 flex items-center gap-2 px-3 text-left text-xs text-[#F5F1E8] hover:bg-[#243A66] transition"
                >
                  <ArrowRight size={13} className="text-emerald-400 flex-shrink-0" />
                  {nextAction.label}
                </button>
              )}
              {!nextAction && (
                <div className="px-3 py-2 text-[10px] text-[#9BAFC5]">
                  Sem próxima etapa automática nesta fase.
                </div>
              )}
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onRequestDelete(); }}
                className="w-full min-h-[44px] sm:min-h-0 sm:py-2 flex items-center gap-2 px-3 text-left text-xs text-red-400 hover:bg-red-500/10 transition"
              >
                <Trash2 size={13} className="flex-shrink-0" />
                {userRole === "ADMIN" ? "Excluir" : "Solicitar exclusão"}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="text-[9px] text-[#C9A84C] font-bold">{l.anonymous_id}</div>
      {l.apelido && <div className="text-[10px] text-[#F5F1E8] font-semibold truncate">{l.apelido}</div>}
      <div className="text-xs sm:text-xs text-[#F5F1E8] font-semibold">{valueLabel}</div>
      {l.risk_score && (
        <div className={cn("text-[9px] font-bold mt-1",
          l.risk_score >= 70 ? "text-emerald-400" : l.risk_score >= 50 ? "text-[#C9A84C]" : "text-red-400"
        )}>Score {l.risk_score}</div>
      )}
      {(l.cm_bids?.[0] as any)?.count > 0 && (
        <div className="text-[9px] text-orange-400 mt-1">{(l.cm_bids![0] as any).count} proposta(s)</div>
      )}
      {l.deletion_status === "pending_governance" && (
        <div className="text-[8px] text-red-400 font-bold uppercase mt-1 px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 rounded inline-block">Exclusão Solicitada</div>
      )}
      {l.nda_authorization_status === "pending_director" && (
        <div className="text-[8px] text-[#C9A84C] font-bold uppercase mt-1 px-1.5 py-0.5 bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded inline-block">Enviado: Aguardando Diretoria</div>
      )}
      {Number((l.cm_listing_documents?.[0] as any)?.count) > 0 && (
        <div className="text-[9px] text-[#9BAFC5] mt-1">{(l.cm_listing_documents![0] as any).count} doc(s)</div>
      )}
      {slaInfo && (() => {
        const h = slaInfo.hours_pending;
        const n = slaInfo.pending_count;
        const badge = h >= 48
          ? { label: `SLA Estourado: ${h}h`, cls: "bg-red-500/10 border-red-500/20 text-red-400" }
          : h >= 24
          ? { label: `SLA Atenção: ${h}h`, cls: "bg-amber-500/10 border-amber-500/20 text-amber-400" }
          : { label: `Assinatura: ${h}h`, cls: "bg-[#162744] border-[#9BAFC5]/15 text-[#9BAFC5]" };
        return (
          <div className={cn("text-[8px] font-bold uppercase mt-1 px-1.5 py-0.5 border rounded inline-block", badge.cls)}>
            {badge.label} ({n})
          </div>
        );
      })()}
      {typeof l.days_in_stage === "number" && (
        <div className={cn("text-[8px] font-bold mt-1 px-1.5 py-0.5 border rounded inline-block", daysBadgeStyle(l.days_in_stage))}>
          {l.days_in_stage === 0 ? "Entrou hoje" : `${l.days_in_stage} dia${l.days_in_stage === 1 ? "" : "s"} na fase`}
        </div>
      )}
    </div>
  );
}
