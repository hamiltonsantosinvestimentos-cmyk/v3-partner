"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Loader2, CheckCircle2, Circle, ExternalLink, Plus, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PartnerOrder } from "./pedidos-partners-client";

interface Props {
  order: PartnerOrder;
  onClose: () => void;
  onUpdated: () => void;
}

function StepRow({ done, label, action }: { done: boolean; label: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-border/30 last:border-b-0">
      <div className="flex items-center gap-2">
        {done ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
        <span className={`text-sm ${done ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
      </div>
      {action}
    </div>
  );
}

// ─── Documentos adicionais (sócio/garantidor CPF, 2º+ CNPJ do grupo) ───────
// Cada um tem seu próprio consentimento LGPD → proposta → análise →
// relatório, independente do documento principal do pedido (que segue no
// fluxo de StepRow acima, sem mudança). Ver migration
// 20260911_credit_consents_multi_doc e decisão com Hamilton, 11/09/2026.
interface OrderDocument {
  id: string;
  doc: string;
  label: string | null;
  consent_status: string;
  intake_token: string | null;
  registrato_uploaded: boolean;
  credit_desk_proposal_id: string | null;
  credit_profile_id: string | null;
  report_public_token: string | null;
  report_delivered_at: string | null;
}

function DocRow({ orderId, doc, onUpdated }: { orderId: string; doc: OrderDocument; onUpdated: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function call(action: string, url: string, body?: Record<string, unknown>) {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha na operação");
      onUpdated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function copyLink() {
    if (!doc.intake_token) return;
    const url = `${window.location.origin}/intake/credit/${doc.intake_token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const consented = doc.consent_status === "consented";
  const hasProposal = Boolean(doc.credit_desk_proposal_id);
  const hasAnalysis = Boolean(doc.credit_profile_id);
  const hasReport = Boolean(doc.report_public_token);

  return (
    <div className="rounded-lg border border-border/40 bg-secondary/20 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{doc.label ?? "Documento adicional"}</p>
          <p className="text-[11px] text-muted-foreground">{doc.doc}</p>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full flex-shrink-0 ${
          consented ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
        }`}>
          {consented ? "Consentido" : "Pendente"}
        </span>
      </div>

      {!consented && (
        <Button size="sm" variant="outline" className="w-full" onClick={copyLink}>
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Link copiado" : "Copiar link de consentimento"}
        </Button>
      )}

      {consented && !hasProposal && (
        <Button size="sm" className="w-full" disabled={busy !== null} onClick={() => call("link", `/api/credit-engine/orders/${orderId}/link-proposal`, { consent_id: doc.id })}>
          {busy === "link" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Vincular proposta"}
        </Button>
      )}

      {hasProposal && !hasAnalysis && (
        <Button size="sm" className="w-full" disabled={busy !== null} onClick={() => call("analyze", "/api/credit-engine/trigger", { proposal_id: doc.credit_desk_proposal_id })}>
          {busy === "analyze" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Rodar análise"}
        </Button>
      )}

      {hasAnalysis && (
        <Button size="sm" variant={hasReport ? "outline" : "default"} className="w-full" disabled={busy !== null} onClick={() => call("report", `/api/credit-engine/orders/${orderId}/documents/${doc.id}/generate-report`)}>
          {busy === "report" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : hasReport ? "Gerar relatório novamente" : "Gerar relatório"}
        </Button>
      )}

      {hasReport && (
        <a href={`/relatorio-credito/${doc.report_public_token}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[11px] text-[#C9A84C] hover:underline">
          <ExternalLink className="w-3 h-3" /> Ver link público do relatório
        </a>
      )}

      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
}

function AdditionalDocuments({ order, onUpdated }: { order: PartnerOrder; onUpdated: () => void }) {
  const [docs, setDocs] = useState<OrderDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [docType, setDocType] = useState<"CPF" | "CNPJ">("CPF");
  const [docValue, setDocValue] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/credit-engine/orders/${order.id}/documents`);
      const json = await res.json();
      if (res.ok) setDocs(json.documents ?? []);
    } finally {
      setLoading(false);
    }
  }, [order.id]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    setError(null);
    const digits = docValue.replace(/\D/g, "");
    const expected = docType === "CPF" ? 11 : 14;
    if (digits.length !== expected) {
      setError(`${docType} precisa ter ${expected} dígitos`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/credit-engine/orders/${order.id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_type: docType, doc_value: digits, label: label.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao gerar link");
      setDocValue("");
      setLabel("");
      setShowForm(false);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const totalExpected = (order.cnpj_count ?? 1) + (order.cpf_count ?? 0);

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Documentos adicionais da operação</p>
          <p className="text-[11px] text-muted-foreground">
            Sócios/garantidores (CPF) ou empresas extras (CNPJ) contratados junto com o documento principal.
            {totalExpected > 1 && ` Total contratado: ${totalExpected} documentos.`}
          </p>
        </div>
        {!showForm && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </Button>
        )}
      </div>

      {showForm && (
        <div className="rounded-lg border border-border/40 bg-secondary/20 p-3 space-y-2">
          <div className="flex gap-2">
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as "CPF" | "CNPJ")}
              className="h-9 px-2 text-xs bg-secondary border border-border rounded-lg text-foreground"
            >
              <option value="CPF">CPF (sócio/garantidor)</option>
              <option value="CNPJ">CNPJ (empresa adicional)</option>
            </select>
            <input
              value={docValue}
              onChange={(e) => setDocValue(e.target.value)}
              placeholder={docType === "CPF" ? "000.000.000-00" : "00.000.000/0000-00"}
              className="flex-1 h-9 px-3 text-xs bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Rótulo (ex: Sócio 1 - João Silva)"
            className="w-full h-9 px-3 text-xs bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          {error && <p className="text-[11px] text-red-400">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" disabled={saving} onClick={handleAdd}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Gerar link de consentimento"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setError(null); }}>Cancelar</Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground">Carregando…</p>
      ) : docs.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum documento adicional cadastrado ainda.</p>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <DocRow key={d.id} orderId={order.id} doc={d} onUpdated={() => { load(); onUpdated(); }} />
          ))}
        </div>
      )}
    </div>
  );
}

export function PedidoDetailModal({ order, onClose, onUpdated }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportUrl, setReportUrl] = useState<string | null>(null);

  async function call(action: string, url: string, body?: Record<string, unknown>) {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha na operação");
      return json;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function handleLinkProposal() {
    const json = await call("link", `/api/credit-engine/orders/${order.id}/link-proposal`);
    if (json) onUpdated();
  }

  async function handleTriggerAnalysis() {
    if (!order.credit_desk_proposal_id) return;
    const json = await call("analyze", "/api/credit-engine/trigger", { proposal_id: order.credit_desk_proposal_id });
    if (json) onUpdated();
  }

  async function handleGenerateReport() {
    // Regenerar substitui o token público do relatório -- um link já enviado
    // ao cliente (se o pedido já tinha sido marcado como entregue) para de
    // funcionar. Confirma antes só nesse caso; na primeira geração ou depois
    // de um erro anterior (relatório nunca chegou a existir), gera direto.
    if (order.report_public_token && order.report_delivered_at) {
      const ok = window.confirm(
        "Isso gera um relatório novo e invalida o link já enviado ao cliente por email. Você vai precisar reenviar o novo link depois. Continuar?"
      );
      if (!ok) return;
    }
    const json = await call("report", `/api/credit-engine/orders/${order.id}/generate-report`);
    if (json?.pdf_url) setReportUrl(json.pdf_url);
    if (json) onUpdated();
  }

  async function handleDeliver() {
    const json = await call("deliver", `/api/credit-engine/orders/${order.id}/deliver`);
    if (json) onUpdated();
  }

  const hasProposal = Boolean(order.credit_desk_proposal_id);
  const hasAnalysis = Boolean(order.credit_profile_id);
  const hasReport = Boolean(order.report_public_token);
  const delivered = Boolean(order.report_delivered_at);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-white">{order.client_name}</h2>
            <p className="text-xs text-muted-foreground">{order.client_doc} · {order.client_email}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="rounded-xl border border-border/50 bg-secondary/30 p-4 grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Serviço</p><p className="text-foreground font-medium">{order.service_title}</p></div>
            <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Valor pago</p><p className="text-foreground font-medium">{formatCurrency(order.amount_cents / 100)}</p></div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Origem</p>
              <p className="text-foreground font-medium">
                {order.source === "direct" ? "Venda direta" : "Via partner"}
                {order.source === "direct" && order.ref_partner_name && ` (ref. ${order.ref_partner_name})`}
                {order.source !== "direct" && order.partner_name && `: ${order.partner_name}`}
              </p>
            </div>
            <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pago em</p><p className="text-foreground font-medium">{order.paid_at ? formatDate(order.paid_at) : "—"}</p></div>
          </div>

          {order.consent_status !== "consented" && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-400">
              Cliente ainda não preencheu o consentimento. As etapas abaixo dependem disso.
            </div>
          )}

          <div className="rounded-xl border border-border/50 bg-card p-1">
            <div className="px-3">
              <StepRow done={order.consent_status === "consented"} label="Consentimento preenchido pelo cliente" />
              <StepRow
                done={hasProposal}
                label="Proposta vinculada"
                action={
                  !hasProposal ? (
                    <Button size="sm" disabled={busy !== null} onClick={handleLinkProposal}>
                      {busy === "link" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Vincular"}
                    </Button>
                  ) : undefined
                }
              />
              <StepRow
                done={hasAnalysis}
                label="Análise rodada (Motor V3)"
                action={
                  hasProposal && !hasAnalysis ? (
                    <Button size="sm" disabled={busy !== null} onClick={handleTriggerAnalysis}>
                      {busy === "analyze" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Rodar análise"}
                    </Button>
                  ) : undefined
                }
              />
              <StepRow
                done={hasReport}
                label="Relatório gerado"
                action={
                  hasAnalysis ? (
                    <Button size="sm" variant={hasReport ? "outline" : "default"} disabled={busy !== null} onClick={handleGenerateReport}>
                      {busy === "report"
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : hasReport ? "Gerar novamente" : "Gerar relatório"}
                    </Button>
                  ) : undefined
                }
              />
              <StepRow
                done={delivered}
                label="Entregue ao cliente"
                action={
                  hasReport && !delivered ? (
                    <Button size="sm" disabled={busy !== null} onClick={handleDeliver}>
                      {busy === "deliver" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Enviar por email"}
                    </Button>
                  ) : undefined
                }
              />
            </div>
          </div>

          {(order.cnpj_count ?? 1) + (order.cpf_count ?? 0) > 1 && (
            <AdditionalDocuments order={order} onUpdated={onUpdated} />
          )}

          <div className="rounded-xl border border-border/50 bg-secondary/30 p-3 text-[11px] text-muted-foreground">
            {order.partner_commission_id ? (
              <span className="text-[#E8C97A]">Comissão do partner já gerada por esta consulta (aguardando autorização na aba Comissões).</span>
            ) : (order.partner_id || order.ref_partner_id) ? (
              <>Ao entregar o relatório, a comissão fixa do partner por esta consulta é registrada automaticamente com status <strong className="text-foreground">Aguardando autorização</strong>. Valor configurado no topo da tela.</>
            ) : (
              <>Pedido sem partner vinculado — nenhuma comissão de consulta será gerada na entrega.</>
            )}
          </div>

          {reportUrl && (
            <a href={reportUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-[#C9A84C] hover:underline">
              <ExternalLink className="w-3.5 h-3.5" /> Baixar PDF gerado
            </a>
          )}

          {order.report_public_token && (
            <a
              href={`/relatorio-credito/${order.report_public_token}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-xs text-[#C9A84C] hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Ver link público do relatório
            </a>
          )}

          {error && <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">{error}</div>}
        </div>
      </div>
    </div>
  );
}
