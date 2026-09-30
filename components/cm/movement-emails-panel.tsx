"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail, RefreshCw, XCircle } from "lucide-react";

// Seção "E-mails de movimentação" do detalhe do ativo (30/09/2026, Entrega 2 do BRIEF).
// Mostra o que foi enviado, para quem, quando e o estado. "Reenviar" só em e-mail com falha,
// só ADMIN e GESTAO, com confirmação em modal V3 (dispara e-mail externo).

interface MovementEmail {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  recipient_role: "partner" | "mesa" | "cedente";
  status: "pendente" | "enviando" | "enviado" | "falhou" | "ignorado";
  attempts: number;
  sent_at: string | null;
  error: string | null;
  ignore_reason: string | null;
  created_at: string;
  stage_label: string | null;
}

const ROLE_LABEL: Record<MovementEmail["recipient_role"], string> = { partner: "Partner", mesa: "Mesa", cedente: "Cedente" };
const STATUS_LABEL: Record<MovementEmail["status"], string> = {
  pendente: "Pendente",
  enviando: "Enviando",
  enviado: "Enviado",
  falhou: "Falhou",
  ignorado: "Ignorado (teste)",
};
const STATUS_STYLE: Record<MovementEmail["status"], string> = {
  pendente: "text-[#E8C97A] border-[#C9A84C]/30 bg-[#C9A84C]/10",
  enviando: "text-[#E8C97A] border-[#C9A84C]/30 bg-[#C9A84C]/10",
  enviado: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  falhou: "text-red-400 border-red-500/30 bg-red-500/10",
  ignorado: "text-[#9BAFC5] border-[#9BAFC5]/20 bg-[#162744]",
};

// DD/MM/AAAA HH:mm em America/Sao_Paulo, sem deslocamento de fuso.
function fmt(iso: string): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("day")}/${g("month")}/${g("year")} ${g("hour")}:${g("minute")}`;
}

export function MovementEmailsPanel({ listingId }: { listingId: string }) {
  const [emails, setEmails] = useState<MovementEmail[] | null>(null);
  const [canResend, setCanResend] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<MovementEmail | null>(null);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/cm/listings/${listingId}/movement-emails`);
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erro ao carregar"); setEmails([]); return; }
      setEmails(json.emails ?? []);
      setCanResend(!!json.can_resend);
      setEnabled(!!json.enabled);
    } catch { setError("Erro de conexão"); setEmails([]); }
  }, [listingId]);

  useEffect(() => { setEmails(null); load(); }, [load]);

  const doResend = async () => {
    if (!confirming) return;
    setResending(true);
    setResendError(null);
    try {
      const res = await fetch(`/api/cm/movement-emails/${confirming.id}/resend`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) { setResendError(json.error ?? "Erro ao reenviar"); return; }
      setConfirming(null);
      // O envio roda em segundo plano: recarrega agora e de novo em instantes.
      await load();
      setTimeout(load, 6000);
    } catch { setResendError("Erro de conexão"); }
    finally { setResending(false); }
  };

  return (
    <div className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-[#F5F1E8] flex items-center gap-2">
          <Mail size={13} className="text-[#C9A84C]" /> E-mails de movimentação
        </h3>
        <button onClick={load} className="text-[#9BAFC5] hover:text-[#F5F1E8] transition" aria-label="Atualizar lista">
          <RefreshCw size={12} />
        </button>
      </div>

      {!enabled && (
        <p className="text-[11px] text-[#E8C97A] bg-[#C9A84C]/10 border border-[#C9A84C]/30 rounded-md p-2 mb-3">
          O envio de e-mails de movimentação está desligado. Nada é enviado até a chave ser ligada.
        </p>
      )}

      {emails === null ? (
        <div className="flex items-center gap-2 text-[11px] text-[#9BAFC5]"><Loader2 size={12} className="animate-spin" /> Carregando...</div>
      ) : error ? (
        <p className="text-[11px] text-red-400">{error}</p>
      ) : emails.length === 0 ? (
        <p className="text-[11px] text-[#9BAFC5]">Nenhum e-mail enviado para este ativo.</p>
      ) : (
        <div className="space-y-1.5">
          {emails.map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-2 bg-[#162744] rounded-md px-2.5 py-2">
              <div className="min-w-0">
                <div className="text-[11px] text-[#F5F1E8] truncate">
                  {e.recipient_name?.trim() || e.recipient_email} <span className="text-[#9BAFC5]">· {ROLE_LABEL[e.recipient_role]}</span>
                </div>
                <div className="text-[11px] text-[#9BAFC5]">
                  {e.stage_label ?? "Etapa"} · {fmt(e.sent_at ?? e.created_at)}
                </div>
                {e.status === "falhou" && e.error && <div className="text-[11px] text-red-400 break-words">{e.error}</div>}
                {e.status === "ignorado" && e.ignore_reason && <div className="text-[11px] text-[#9BAFC5]">{e.ignore_reason}</div>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLE[e.status]}`}>{STATUS_LABEL[e.status]}</span>
                {canResend && e.status === "falhou" && (
                  <button
                    onClick={() => { setResendError(null); setConfirming(e); }}
                    className="text-[11px] font-bold text-[#E8C97A] border border-[#C9A84C]/40 bg-[#C9A84C]/10 px-2 py-0.5 rounded hover:bg-[#C9A84C]/20 transition"
                  >
                    Reenviar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md bg-[#09081A] border border-[#C9A84C]/30 rounded-xl">
            <div className="p-4 border-b border-[#C9A84C]/20 flex items-center justify-between">
              <div className="text-sm font-bold text-[#F5F1E8] flex items-center gap-2"><Mail size={14} className="text-[#C9A84C]" /> Reenviar e-mail</div>
              <button onClick={() => setConfirming(null)} disabled={resending} className="text-[#9BAFC5] hover:text-[#F5F1E8] text-xl" aria-label="Fechar">&times;</button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-[#F5F1E8] leading-relaxed">
                Um e-mail externo de movimentação ({confirming.stage_label ?? "etapa"}) será reenviado para{" "}
                <span className="font-bold">{confirming.recipient_name?.trim() || confirming.recipient_email}</span>{" "}
                ({ROLE_LABEL[confirming.recipient_role]}).
              </p>
              <p className="text-xs text-[#9BAFC5] leading-relaxed">Confira o destinatário antes de confirmar. O e-mail sai em nome da V3 Partners.</p>
              {resendError && (
                <p className="text-[11px] text-red-400 flex items-start gap-1.5"><XCircle size={12} className="mt-0.5 flex-shrink-0" /> {resendError}</p>
              )}
              <div className="flex gap-2">
                <button onClick={() => setConfirming(null)} disabled={resending}
                  className="flex-1 px-3 py-2 bg-[#162744] text-[#F5F1E8] rounded-lg text-xs font-bold hover:bg-[#243A66] transition">Voltar</button>
                <button onClick={doResend} disabled={resending}
                  className="flex-1 px-3 py-2 bg-[#C9A84C] text-[#09081A] rounded-lg text-xs font-bold hover:bg-[#E8C97A] transition disabled:opacity-50 flex items-center justify-center gap-2">
                  {resending && <Loader2 size={13} className="animate-spin" />} Reenviar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
