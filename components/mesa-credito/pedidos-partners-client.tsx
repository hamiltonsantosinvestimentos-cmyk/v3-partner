"use client";

import { useEffect, useState, useCallback } from "react";
import { Handshake, Loader2, Wallet, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PedidoDetailModal } from "./pedido-detail-modal";

export interface PartnerOrder {
  id: string;
  client_name: string;
  client_email: string;
  client_doc: string;
  partner_name: string | null;
  source: string;
  ref_partner_name: string | null;
  service_title: string;
  amount_cents: number;
  status: string;
  paid_at: string | null;
  consent_status: string;
  registrato_uploaded: boolean;
  credit_desk_proposal_id: string | null;
  credit_profile_id: string | null;
  report_public_token: string | null;
  report_delivered_at: string | null;
  partner_commission_id: string | null;
  partner_id: string | null;
  ref_partner_id: string | null;
  created_at: string;
}

function ConsentBadge({ status }: { status: string }) {
  if (status === "consented") return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Consentido</Badge>;
  return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Pendente</Badge>;
}

function OriginBadge({ order }: { order: PartnerOrder }) {
  if (order.source === "direct") {
    return (
      <div className="flex flex-col gap-1">
        <Badge className="bg-secondary text-muted-foreground border-border/50 w-fit">Venda direta</Badge>
        {order.ref_partner_name && (
          <span className="text-[11px] text-muted-foreground truncate max-w-40">Ref: {order.ref_partner_name}</span>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <Badge className="bg-teal-500/10 text-teal-400 border-teal-500/20 w-fit">Via partner</Badge>
      <span className="text-[11px] text-muted-foreground truncate max-w-40">{order.partner_name ?? "—"}</span>
    </div>
  );
}

function StageBadge({ order }: { order: PartnerOrder }) {
  if (order.report_delivered_at) return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Entregue</Badge>;
  if (order.report_public_token) return <Badge className="bg-teal-500/10 text-teal-400 border-teal-500/20">Relatório pronto</Badge>;
  if (order.credit_profile_id) return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">Análise concluída</Badge>;
  if (order.credit_desk_proposal_id) return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Proposta criada</Badge>;
  return <Badge className="bg-secondary text-muted-foreground border-border/50">Aguardando vínculo</Badge>;
}

function CommissionBadge({ order }: { order: PartnerOrder }) {
  if (order.partner_commission_id) {
    return <Badge className="bg-[#C9A84C]/10 text-[#E8C97A] border-[#C9A84C]/20">Comissão gerada</Badge>;
  }
  const hasPartner = Boolean(order.partner_id || order.ref_partner_id);
  if (!hasPartner) return <span className="text-xs text-muted-foreground">Sem partner</span>;
  if (order.report_delivered_at) return <span className="text-xs text-muted-foreground">—</span>;
  return <span className="text-xs text-muted-foreground">Na entrega</span>;
}

// ─── Config: valor fixo direcionado ao partner por consulta ────────────────
function PayoutConfigStrip({ canManage }: { canManage: boolean }) {
  const [reais, setReais] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/consulta-partner-payout")
      .then((r) => r.json())
      .then((d) => {
        const v = typeof d.payout_reais === "number" ? d.payout_reais : 0;
        setReais(v);
        setDraft(String(v));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setError(null);
    const n = Number(draft.replace(",", "."));
    if (Number.isNaN(n) || n < 0) { setError("Informe um valor válido em R$."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/settings/consulta-partner-payout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payout_reais: n }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao salvar");
      setReais(json.payout_reais);
      setDraft(String(json.payout_reais));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#C9A84C]/20 bg-[#C9A84C]/5 p-4">
      <div className="flex items-start gap-3">
        <Wallet className="w-4 h-4 text-[#C9A84C] flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-[#E8C97A]">Valor direcionado ao partner por consulta</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Valor fixo que vira comissão do partner quando o relatório da consulta é entregue ao cliente.
            A comissão nasce como <strong className="text-foreground">Aguardando autorização</strong> na aba Comissões.
          </p>

          {loading ? (
            <p className="text-xs text-muted-foreground mt-2">Carregando…</p>
          ) : canManage ? (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-[#C9A84C]">R$</span>
              <input
                type="number" min="0" step="0.01"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={saving}
                className="w-32 h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] text-xs font-bold transition-colors disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null}
                {saving ? "Salvando…" : saved ? "Salvo!" : "Salvar"}
              </button>
              {error && <span className="text-xs text-red-400">{error}</span>}
            </div>
          ) : (
            <p className="text-sm font-bold text-[#C9A84C] mt-2">
              {reais != null ? formatCurrency(reais) : "—"}
              <span className="ml-2 text-xs font-normal text-muted-foreground">· configurável por ADMIN/Gestão em Configurações › Comissões</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

interface Props {
  canManagePayout?: boolean;
}

export function PedidosPartnersClient({ canManagePayout = false }: Props) {
  const [orders, setOrders] = useState<PartnerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PartnerOrder | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/credit-engine/orders");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao carregar pedidos");
      setOrders(json.orders ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Handshake className="w-6 h-6 text-teal-400" />
          Pedidos de Partners
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Análises de crédito vendidas por partners: vincular proposta, rodar análise e entregar o relatório
        </p>
      </div>

      <PayoutConfigStrip canManage={canManagePayout} />

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">{error}</div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="rounded-xl border border-border/50 bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhum pedido pago de Análise de Crédito ainda.
        </div>
      )}

      {!loading && !error && orders.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                {["Cliente", "Origem", "Valor Pago", "Consentimento", "Etapa", "Comissão", "Pago em"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-border/30 cursor-pointer transition-colors hover:bg-secondary/50"
                  onClick={() => setSelected(o)}
                >
                  <td className="px-4 py-3 font-medium text-foreground max-w-48 truncate">{o.client_name}</td>
                  <td className="px-4 py-3"><OriginBadge order={o} /></td>
                  <td className="px-4 py-3 text-right font-semibold text-white">{formatCurrency(o.amount_cents / 100)}</td>
                  <td className="px-4 py-3"><ConsentBadge status={o.consent_status} /></td>
                  <td className="px-4 py-3"><StageBadge order={o} /></td>
                  <td className="px-4 py-3"><CommissionBadge order={o} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{o.paid_at ? formatDate(o.paid_at) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <PedidoDetailModal
          order={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => { load(); setSelected(null); }}
        />
      )}
    </div>
  );
}
