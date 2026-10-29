"use client";

// Modal de mudança de fase da Mesa M&A (BRIEF 28/10/2026, bloco B, seção 4.1).
// Um só modal para Ganho, Perdido, Reabrir, Retroceder e Salto de fase, igual nos
// três caminhos (arrastar, menu "Mover para…" e painel do deal). Fecha só pelos
// botões Cancelar e Confirmar: clique fora e Esc não fecham. Nada é gravado antes
// de Confirmar; o servidor revalida tudo (PATCH /api/ma-deals).

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Dica } from "@/components/shared/dica";
import {
  LOSS_CATEGORIES, MIN_REASON_LENGTH, brToIso, isoToBr, todaySaoPaulo, validateClosedDate,
  type TransitionKind,
} from "@/lib/ma/pipeline";

export type ModalKind = Extract<TransitionKind, "won" | "lost" | "reopen_won" | "reopen_lost" | "back" | "skip">;

export type TransitionPayload = {
  transition_reason?: string;
  closed_date?: string;
  closed_reason_category?: string;
  closed_reason?: string;
  closed_note?: string;
};

const TITLES: Record<ModalKind, string> = {
  won:         "Marcar como Ganho",
  lost:        "Marcar como Perdido",
  reopen_won:  "Reabrir deal Ganho",
  reopen_lost: "Reabrir deal Perdido",
  back:        "Retroceder fase",
  skip:        "Pular fase",
};

function impactText(kind: ModalKind, fromLabel: string, toLabel: string): string {
  switch (kind) {
    case "won":
      return "Os clientes vinculados passam a \"performado\" no Cliente 360 e o deal entra em metas, ranking e no relatório gerencial. Só ADMIN reabre.";
    case "lost":
      return "O deal sai do pipeline ativo, deixa de contar na probabilidade e no valor em aberto e fica na coluna Perdido com o motivo. Pode ser reaberto.";
    case "reopen_lost":
      return `O deal volta para "${toLabel}". Os clientes no Cliente 360 não mudam. Metas e ranking voltam a contar o deal como aberto, e o relatório gerencial registra a reabertura. O motivo fica na Timeline.`;
    case "reopen_won":
      return `O deal volta para "${toLabel}". Os clientes "performado" no Cliente 360 voltam a "a performar" se o deal tem contrato assinado, ou a "prospecto" se não tem. O ganho deixa de contar em metas, ranking e no relatório gerencial. Comissões não mudam. O motivo fica na Timeline.`;
    case "back":
      return `O deal volta para "${toLabel}". A mudança fica registrada na Timeline.`;
    case "skip":
      return `O deal sai de "${fromLabel}" direto para "${toLabel}", fora da sequência padrão da esteira. A justificativa fica na Timeline. A trava da Análise de Crédito continua valendo.`;
  }
}

// Máscara DD/MM/AAAA enquanto digita.
function maskBrDate(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export function MaTransitionModal({
  open, kind, dealLabel, fromLabel, toLabel, onCancel, onConfirm,
}: {
  open: boolean;
  kind: ModalKind;
  dealLabel: string;
  fromLabel: string;
  toLabel: string;
  onCancel: () => void;
  // Devolve a mensagem de erro do servidor, ou null se gravou.
  onConfirm: (payload: TransitionPayload) => Promise<string | null>;
}) {
  const [dateBr, setDateBr] = useState("");
  const [category, setCategory] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDateBr(isoToBr(todaySaoPaulo()));
    setCategory("");
    setReason("");
    setNote("");
    setSaving(false);
    setServerError(null);
  }, [open, kind]);

  const needsDate = kind === "won" || kind === "lost";
  const needsReason = kind === "lost" || kind === "skip" || kind === "reopen_won" || kind === "reopen_lost";
  const dateIso = needsDate ? brToIso(dateBr) : null;
  const dateError = needsDate ? (dateIso ? validateClosedDate(dateIso) : "Use o formato DD/MM/AAAA.") : null;
  const reasonOk = !needsReason || reason.trim().length >= MIN_REASON_LENGTH;
  const categoryOk = kind !== "lost" || !!category;
  const canConfirm = !saving && !dateError && reasonOk && categoryOk;

  const reasonLabel =
    kind === "lost" ? "Motivo da perda" :
    kind === "skip" ? "Justificativa do salto" :
    "Motivo da reabertura";
  const reasonDica =
    kind === "lost" ? "ma_motivo_perda" as const :
    kind === "skip" ? "ma_justificativa_salto" as const :
    "ma_motivo_reabertura" as const;

  async function confirm() {
    if (!canConfirm) return;
    setSaving(true);
    setServerError(null);
    const payload: TransitionPayload = {};
    if (needsDate && dateIso) payload.closed_date = dateIso;
    if (kind === "lost") {
      payload.closed_reason_category = category;
      payload.closed_reason = reason.trim();
    }
    if (kind === "won" && note.trim()) payload.closed_note = note.trim();
    if (kind === "skip" || kind === "reopen_won" || kind === "reopen_lost") payload.transition_reason = reason.trim();
    const err = await onConfirm(payload);
    setSaving(false);
    if (err) setServerError(err);
  }

  const inputCls = "w-full rounded-lg border border-[#243A66] bg-[#09081A] text-[#F5F1E8] text-sm px-3 py-2.5 placeholder:text-[#9BAFC5]/60 focus:outline-none focus:border-[#C9A84C] transition-colors";
  const labelCls = "flex items-center gap-1.5 text-[11px] font-semibold text-[#9BAFC5] mb-1.5";

  return (
    <Dialog open={open}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="max-w-md w-[calc(100vw-32px)] border border-[#F5B942]/40 [&>button.absolute]:hidden"
      >
        <DialogTitle className="flex items-center gap-2 text-base font-bold text-[#F5F1E8]">
          <AlertTriangle className="w-4 h-4 text-[#F5B942] flex-shrink-0" aria-hidden="true" />
          {TITLES[kind]}
        </DialogTitle>
        <p className="text-xs text-[#9BAFC5] -mt-2">{dealLabel}</p>

        <div className="rounded-lg border border-[#F5B942]/30 bg-[#F5B942]/5 px-3 py-2.5 text-[12px] leading-relaxed text-[#F5F1E8]">
          {impactText(kind, fromLabel, toLabel)}
          {kind === "won" && <Dica id="ma_ganho" className="ml-1" />}
        </div>

        {needsDate && (
          <div>
            <label htmlFor="ma-tr-date" className={labelCls}>
              Data de fechamento <Dica id="ma_data_fechamento" />
            </label>
            <input
              id="ma-tr-date"
              inputMode="numeric"
              placeholder="DD/MM/AAAA"
              value={dateBr}
              onChange={(e) => setDateBr(maskBrDate(e.target.value))}
              className={inputCls}
            />
            {dateBr.length === 10 && dateError && <p className="text-[11px] text-[#F26D6D] mt-1">{dateError}</p>}
          </div>
        )}

        {kind === "lost" && (
          <div>
            <label htmlFor="ma-tr-cat" className={labelCls}>Categoria da perda</label>
            <select id="ma-tr-cat" value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              <option value="">Selecione</option>
              {LOSS_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        )}

        {needsReason && (
          <div>
            <label htmlFor="ma-tr-reason" className={labelCls}>
              {reasonLabel} <Dica id={reasonDica} />
            </label>
            <textarea
              id="ma-tr-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={`Mínimo de ${MIN_REASON_LENGTH} caracteres`}
              className={`${inputCls} resize-none`}
            />
            <p className="text-[10px] text-[#9BAFC5] mt-1">{reason.trim().length}/{MIN_REASON_LENGTH} caracteres no mínimo</p>
          </div>
        )}

        {kind === "won" && (
          <div>
            <label htmlFor="ma-tr-note" className={labelCls}>
              Observação (opcional) <Dica id="ma_observacao_ganho" />
            </label>
            <textarea
              id="ma-tr-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={`${inputCls} resize-none`}
            />
          </div>
        )}

        {serverError && (
          <p role="alert" className="rounded-lg border border-[#F26D6D]/40 bg-[#F26D6D]/10 px-3 py-2 text-[12px] text-[#F5F1E8]">{serverError}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-[#243A66] px-4 py-2 text-xs font-semibold text-[#9BAFC5] hover:text-[#F5F1E8] disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!canConfirm}
            className="flex items-center gap-1.5 rounded-lg border border-[#C9A84C]/60 bg-[#C9A84C]/15 px-4 py-2 text-xs font-bold text-[#C9A84C] hover:bg-[#C9A84C]/25 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Confirmar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
