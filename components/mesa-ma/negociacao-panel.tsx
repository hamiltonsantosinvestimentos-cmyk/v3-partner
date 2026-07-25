"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Send, Copy, Check, RefreshCw, AlertCircle, CheckCircle2, FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

type StageStatus = "nao_iniciado" | "convite_enviado" | "rascunho" | "enviado_assinatura" | "assinado";

type Stage = {
  etapa: string;
  label: string;
  status: StageStatus;
  contractId: string | null;
  externalEnvelopeId: string | null;
  signedAt: string | null;
  invite: { id: string; nome: string; email: string; token: string } | null;
};

type ProposalStatus = "draft" | "sent" | "viewed" | "signed";

type Proposal = {
  id: string;
  code: string;
  status: ProposalStatus;
  recipientName: string;
  recipientEmail: string;
  sentAt: string | null;
  signedAt: string | null;
};

const PROPOSAL_STATUS_META: Record<ProposalStatus, { label: string; color: string; bg: string }> = {
  draft: { label: "Rascunho", color: "#7A8FA8", bg: "rgba(122,143,168,0.1)" },
  sent: { label: "Enviada", color: "#C9A84C", bg: "rgba(201,168,76,0.1)" },
  viewed: { label: "Visualizada", color: "#F59E0B", bg: "rgba(245,158,11,0.1)" },
  signed: { label: "Assinada", color: "#10B981", bg: "rgba(16,185,129,0.1)" },
};

const STATUS_META: Record<StageStatus, { label: string; color: string; bg: string }> = {
  nao_iniciado: { label: "Não iniciado", color: "#7A8FA8", bg: "rgba(122,143,168,0.1)" },
  convite_enviado: { label: "Convite enviado", color: "#F59E0B", bg: "rgba(245,158,11,0.1)" },
  rascunho: { label: "Rascunho", color: "#C9A84C", bg: "rgba(201,168,76,0.1)" },
  enviado_assinatura: { label: "Aguardando assinatura", color: "#C9A84C", bg: "rgba(201,168,76,0.1)" },
  assinado: { label: "Assinado", color: "#10B981", bg: "rgba(16,185,129,0.1)" },
};

export function NegociacaoPanel({ dealId }: { dealId: string }) {
  const [stages, setStages] = useState<Stage[] | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/ma/deals/${dealId}/negociacao`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao carregar");
      setStages(json.stages);
      setProposal(json.proposal ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar etapas");
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[#7A8FA8]">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando etapas da negociação
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-xs text-red-300 flex items-center gap-2">
        <AlertCircle size={14} /> {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-[#7A8FA8] uppercase tracking-widest font-bold">
        Circuito de Negociação, da proposta ao fechamento
      </p>
      <ProposalCard proposal={proposal} />
      {(stages ?? []).map((stage, i) => (
        <StageCard key={stage.etapa} index={i + 1} dealId={dealId} stage={stage} onChanged={load} />
      ))}
    </div>
  );
}

function ProposalCard({ proposal }: { proposal: Proposal | null }) {
  const meta = proposal ? PROPOSAL_STATUS_META[proposal.status] : null;
  return (
    <div className="rounded-xl border border-[#122036] bg-[#0D1626] p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-[#162744] border border-[#243A66] text-[#7A8FA8] text-[11px] font-bold flex items-center justify-center">
            0
          </span>
          <div>
            <p className="text-sm font-bold text-[#E8EDF5] flex items-center gap-1.5">
              <FileText size={13} /> Proposta Comercial
            </p>
            {proposal ? (
              <p className="text-[11px] text-[#7A8FA8] mt-0.5">
                {proposal.code} &middot; {proposal.recipientName} &middot; {proposal.recipientEmail}
              </p>
            ) : (
              <p className="text-[11px] text-[#5A7490] mt-0.5">Nenhuma proposta comercial registrada para este deal ainda</p>
            )}
          </div>
        </div>
        {meta && (
          <span
            className="text-[9px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full flex-shrink-0"
            style={{ color: meta.color, background: meta.bg }}
          >
            {meta.label}
          </span>
        )}
      </div>
      <div className="mt-3">
        <a href="/propostas" target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="ghost" className="h-7 text-[11px]">
            <ExternalLink size={12} /> {proposal ? "Ver em Propostas Comerciais" : "Criar proposta em Propostas Comerciais"}
          </Button>
        </a>
      </div>
    </div>
  );
}

function StageCard({ index, dealId, stage, onChanged }: {
  index: number; dealId: string; stage: Stage; onChanged: () => void;
}) {
  const meta = STATUS_META[stage.status];
  const [editing, setEditing] = useState(false);
  const [nome, setNome] = useState(stage.invite?.nome ?? "");
  const [email, setEmail] = useState(stage.invite?.email ?? "");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const intakeUrl = stage.invite
    ? `${typeof window !== "undefined" ? window.location.origin : "https://app.v3partners.com.br"}/intake/${stage.etapa}/${stage.invite.token}`
    : null;

  const canDispatch = stage.status === "nao_iniciado" || stage.status === "convite_enviado";
  const canRemindSignature = stage.status === "enviado_assinatura" || stage.status === "rascunho";

  async function dispatchInvite() {
    if (!nome.trim() || !email.trim()) {
      setFeedback({ ok: false, msg: "Preencha nome e email do signatário." });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/ma/deals/${dealId}/negociacao/${stage.etapa}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao enviar convite");
      setFeedback({ ok: true, msg: json.email_sent ? "Convite enviado por email." : "Convite gerado (email não confirmado, copie o link manualmente)." });
      setEditing(false);
      onChanged();
    } catch (e) {
      setFeedback({ ok: false, msg: e instanceof Error ? e.message : "Erro ao enviar" });
    } finally {
      setBusy(false);
    }
  }

  async function remindSignature() {
    if (!stage.contractId) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/ma/loi-contracts/${stage.contractId}/resend`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao reenviar");
      setFeedback({ ok: true, msg: json.message ?? "Lembrete reenviado." });
    } catch (e) {
      setFeedback({ ok: false, msg: e instanceof Error ? e.message : "Erro ao reenviar" });
    } finally {
      setBusy(false);
    }
  }

  function copyLink() {
    if (!intakeUrl) return;
    navigator.clipboard.writeText(intakeUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-xl border border-[#122036] bg-[#0D1626] p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-[#162744] border border-[#243A66] text-[#7A8FA8] text-[11px] font-bold flex items-center justify-center">
            {index}
          </span>
          <div>
            <p className="text-sm font-bold text-[#E8EDF5]">{stage.label}</p>
            {stage.invite ? (
              <p className="text-[11px] text-[#7A8FA8] mt-0.5">{stage.invite.nome} &middot; {stage.invite.email}</p>
            ) : (
              <p className="text-[11px] text-[#5A7490] mt-0.5">Nenhum signatário definido ainda</p>
            )}
            {stage.status === "assinado" && stage.signedAt && (
              <p className="text-[10px] text-[#10B981] mt-0.5 flex items-center gap-1">
                <CheckCircle2 size={11} /> Assinado em {new Date(stage.signedAt).toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>
        </div>
        <span
          className="text-[9px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full flex-shrink-0"
          style={{ color: meta.color, background: meta.bg }}
        >
          {meta.label}
        </span>
      </div>

      {feedback && (
        <p className={`text-[11px] mt-3 ${feedback.ok ? "text-[#10B981]" : "text-red-400"}`}>{feedback.msg}</p>
      )}

      {stage.status === "assinado" ? null : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canDispatch && !editing && (
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setEditing(true)}>
              {stage.status === "nao_iniciado" ? "Gerar link e enviar" : "Editar e reenviar"}
            </Button>
          )}
          {canDispatch && editing && (
            <div className="w-full flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Nome do signatário"
                className="h-7 flex-1 min-w-[140px] rounded border border-[#243A66] bg-[#09081A] px-2 text-[11px] text-[#E8EDF5] placeholder:text-[#5A7490] focus:outline-none focus:border-[#C9A84C]/50"
              />
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="h-7 flex-1 min-w-[160px] rounded border border-[#243A66] bg-[#09081A] px-2 text-[11px] text-[#E8EDF5] placeholder:text-[#5A7490] focus:outline-none focus:border-[#C9A84C]/50"
              />
              <Button size="sm" disabled={busy} className="h-7 text-[11px] bg-[#C9A84C] text-[#09081A] hover:bg-[#E8C97A]" onClick={dispatchInvite}>
                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send size={12} />}
                {stage.status === "nao_iniciado" ? "Enviar" : "Reenviar"}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setEditing(false)}>Cancelar</Button>
            </div>
          )}
          {canRemindSignature && (
            <Button size="sm" variant="outline" disabled={busy} className="h-7 text-[11px]" onClick={remindSignature}>
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw size={12} />}
              Reenviar lembrete de assinatura
            </Button>
          )}
          {intakeUrl && (
            <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={copyLink}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copiado" : "Copiar link"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
