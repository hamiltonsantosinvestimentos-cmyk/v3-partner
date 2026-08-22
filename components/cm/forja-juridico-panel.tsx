"use client";

// Forja Jurídico — Parecer Preliminar + Disparo Institucional de E-mails
// (Etapa 7, 21/08/2026). Aba nova no painel de detalhe do ativo, Mesa de
// Capitais. Duas peças independentes na mesma aba: compilar a tese interna
// (Claude Sonnet, /api/cm/forja/compile-thesis) e disparar um dos 4
// e-mails institucionais (Brand Guardian gate na rota, envio de fato via
// n8n W-CM-Email, log em cm_communications_log).

import { useEffect, useState } from "react";
import { Loader2, FileText, Send, RefreshCw, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

const TEMPLATE_LABELS: Record<string, string> = {
  solicitacao_documentos: "Solicitação de Documentos",
  link_qualificacao: "Envio de Link de Qualificação",
  aviso_minuta_ncnda: "Aviso de Minuta de NCNDA",
  convocacao_alinhamento: "Convocação de Alinhamento",
};

const SENDER_LABELS: Record<string, string> = {
  juridico: "Jurídico V3 <juridico@v3partners.com.br>",
  athaydes: "Dr. Luís Athaydes | V3 Partners <luis.athaydes@v3partners.com.br>",
};

type LogEntry = {
  id: string;
  template_key: string;
  sender_key: string;
  recipient_email: string;
  subject: string;
  status: "enviado" | "falhou";
  error_message: string | null;
  sent_at: string;
};

export function ForjaJuridicoPanel({
  listingId, assetLabel, internalThesis, internalThesisGeneratedAt, onThesisUpdated,
}: {
  listingId: string;
  assetLabel: string;
  internalThesis: string | null;
  internalThesisGeneratedAt: string | null;
  onThesisUpdated: (thesis: string, generatedAt: string) => void;
}) {
  const [thesisDraft, setThesisDraft] = useState(internalThesis ?? "");
  const [compiling, setCompiling] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);

  const [templateKey, setTemplateKey] = useState("solicitacao_documentos");
  const [senderKey, setSenderKey] = useState("juridico");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [qualificationUrl, setQualificationUrl] = useState("");
  const [documentsListRaw, setDocumentsListRaw] = useState("");
  const [meetingDateTime, setMeetingDateTime] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  const [log, setLog] = useState<LogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(true);

  useEffect(() => { setThesisDraft(internalThesis ?? ""); }, [internalThesis]);

  const loadLog = async () => {
    setLogLoading(true);
    try {
      const res = await fetch(`/api/cm/listings/${listingId}/communications-log`);
      const json = await res.json();
      if (res.ok) setLog(json.log ?? []);
    } finally { setLogLoading(false); }
  };

  useEffect(() => { loadLog(); }, [listingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const compileThesis = async () => {
    setCompiling(true);
    setCompileError(null);
    try {
      const res = await fetch("/api/cm/forja/compile-thesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listingId }),
      });
      const json = await res.json();
      if (!res.ok) { setCompileError(json.error ?? "Erro ao compilar tese"); return; }
      setThesisDraft(json.internal_thesis);
      onThesisUpdated(json.internal_thesis, json.internal_thesis_generated_at);
    } catch { setCompileError("Erro de conexão"); }
    finally { setCompiling(false); }
  };

  const sendEmail = async () => {
    setSendError(null);
    setSendSuccess(null);
    if (!recipientName.trim() || !recipientEmail.trim() || !customMessage.trim()) {
      setSendError("Nome, e-mail e mensagem são obrigatórios.");
      return;
    }
    if (templateKey === "link_qualificacao" && !qualificationUrl.trim()) {
      setSendError("Link de Qualificação exige o campo URL preenchido.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/cm/institutional-email/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: listingId,
          template_key: templateKey,
          sender_key: senderKey,
          recipient_name: recipientName,
          recipient_email: recipientEmail,
          custom_message: customMessage,
          documents_list: documentsListRaw.split("\n").map((s) => s.trim()).filter(Boolean),
          qualification_url: qualificationUrl || undefined,
          meeting_date_time: meetingDateTime || undefined,
          meeting_url: meetingUrl || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSendError(json.violations
          ? `Brand Guardian bloqueou: ${json.violations.map((v: { message: string }) => v.message).join("; ")}`
          : (json.error ?? "Erro ao enviar"));
        return;
      }
      setSendSuccess(`E-mail enviado para ${recipientEmail}.`);
      setCustomMessage("");
      loadLog();
    } catch { setSendError("Erro de conexão"); }
    finally { setSending(false); }
  };

  return (
    <div className="px-4 mt-4 space-y-6">
      {/* Parecer Preliminar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] text-[#C9A84C] font-bold uppercase tracking-wider flex items-center gap-1.5">
            <FileText size={12} /> Parecer Preliminar Executivo
          </div>
          <button
            onClick={compileThesis}
            disabled={compiling}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#C9A84C]/10 border border-[#C9A84C]/30 rounded text-[#C9A84C] text-[9px] font-bold hover:bg-[#C9A84C]/20 transition disabled:opacity-50"
          >
            {compiling ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            {internalThesis ? "Regenerar" : "Compilar Tese"}
          </button>
        </div>
        {compileError && <p className="text-[10px] text-red-400 mb-2">{compileError}</p>}
        {internalThesisGeneratedAt && (
          <p className="text-[9px] text-[#9BAFC5] mb-1.5">
            Compilado em {new Date(internalThesisGeneratedAt).toLocaleString("pt-BR")}
          </p>
        )}
        <textarea
          value={thesisDraft}
          onChange={(e) => setThesisDraft(e.target.value)}
          placeholder="Nenhuma tese compilada ainda. Clique em &quot;Compilar Tese&quot; para gerar a partir dos documentos e due diligence deste ativo."
          rows={10}
          className="w-full bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg px-3 py-2.5 text-[11px] text-[#F5F1E8] placeholder:text-[#9BAFC5]/50 focus:outline-none focus:border-[#C9A84C]/40 resize-y leading-relaxed"
        />
        <p className="text-[9px] text-[#9BAFC5]/70 mt-1">
          Uso interno da Mesa e Governança. Nunca é exposto na vitrine pública.
        </p>
      </div>

      {/* Disparo Institucional */}
      <div>
        <div className="text-[10px] text-[#C9A84C] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Mail size={12} /> Disparo Institucional
        </div>
        <div className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-[#9BAFC5] uppercase">Template</label>
              <select
                value={templateKey}
                onChange={(e) => setTemplateKey(e.target.value)}
                className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded px-2 py-2 text-[11px] text-[#F5F1E8] mt-1"
              >
                {Object.entries(TEMPLATE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[9px] text-[#9BAFC5] uppercase">Remetente</label>
              <select
                value={senderKey}
                onChange={(e) => setSenderKey(e.target.value)}
                className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded px-2 py-2 text-[11px] text-[#F5F1E8] mt-1"
              >
                {Object.entries(SENDER_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-[#9BAFC5] uppercase">Nome do Destinatário</label>
              <input
                value={recipientName} onChange={(e) => setRecipientName(e.target.value)}
                className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded px-2 py-2 text-[11px] text-[#F5F1E8] mt-1"
              />
            </div>
            <div>
              <label className="text-[9px] text-[#9BAFC5] uppercase">E-mail do Destinatário</label>
              <input
                type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)}
                className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded px-2 py-2 text-[11px] text-[#F5F1E8] mt-1"
              />
            </div>
          </div>

          {templateKey === "solicitacao_documentos" && (
            <div>
              <label className="text-[9px] text-[#9BAFC5] uppercase">Documentos (1 por linha)</label>
              <textarea
                value={documentsListRaw} onChange={(e) => setDocumentsListRaw(e.target.value)}
                rows={3} placeholder={"Certidão de Inteiro Teor\nLaudo de Avaliação"}
                className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded px-2 py-2 text-[11px] text-[#F5F1E8] mt-1 resize-none"
              />
            </div>
          )}
          {templateKey === "link_qualificacao" && (
            <div>
              <label className="text-[9px] text-[#9BAFC5] uppercase">URL de Qualificação</label>
              <input
                value={qualificationUrl} onChange={(e) => setQualificationUrl(e.target.value)}
                placeholder="https://app.v3partners.com.br/intake/qualificacao/..."
                className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded px-2 py-2 text-[11px] text-[#F5F1E8] mt-1"
              />
            </div>
          )}
          {templateKey === "convocacao_alinhamento" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] text-[#9BAFC5] uppercase">Data/Hora (opcional)</label>
                <input
                  value={meetingDateTime} onChange={(e) => setMeetingDateTime(e.target.value)}
                  placeholder="25/08 às 15h"
                  className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded px-2 py-2 text-[11px] text-[#F5F1E8] mt-1"
                />
              </div>
              <div>
                <label className="text-[9px] text-[#9BAFC5] uppercase">Link da Reunião (opcional)</label>
                <input
                  value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)}
                  className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded px-2 py-2 text-[11px] text-[#F5F1E8] mt-1"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-[9px] text-[#9BAFC5] uppercase">Mensagem</label>
            <textarea
              value={customMessage} onChange={(e) => setCustomMessage(e.target.value)}
              rows={4}
              className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded px-2 py-2 text-[11px] text-[#F5F1E8] mt-1 resize-none"
            />
          </div>

          {sendError && <p className="text-[10px] text-red-400">{sendError}</p>}
          {sendSuccess && <p className="text-[10px] text-emerald-400">{sendSuccess}</p>}

          <button
            onClick={sendEmail}
            disabled={sending}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#C9A84C]/20 border border-[#C9A84C]/30 rounded text-[#E8C97A] text-[10px] font-bold hover:bg-[#C9A84C]/30 transition disabled:opacity-50"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Enviar
          </button>
        </div>
      </div>

      {/* Histórico */}
      <div>
        <div className="text-[10px] text-[#9BAFC5] font-bold uppercase tracking-wider mb-2">Histórico de Envios</div>
        {logLoading ? (
          <Loader2 size={14} className="animate-spin text-[#9BAFC5]" />
        ) : log.length === 0 ? (
          <p className="text-[10px] text-[#9BAFC5]/70 italic">Nenhum e-mail institucional enviado para este ativo ainda.</p>
        ) : (
          <div className="space-y-1.5">
            {log.map((l) => (
              <div key={l.id} className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] text-[#F5F1E8] truncate">{TEMPLATE_LABELS[l.template_key] ?? l.template_key}</div>
                  <div className="text-[9px] text-[#9BAFC5] truncate">{l.recipient_email} · {new Date(l.sent_at).toLocaleString("pt-BR")}</div>
                </div>
                <span className={cn(
                  "text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border flex-shrink-0",
                  l.status === "enviado" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-red-500/15 text-red-400 border-red-500/30"
                )}>
                  {l.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
