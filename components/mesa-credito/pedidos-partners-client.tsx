"use client";

import { useEffect, useState, useCallback } from "react";
import { Handshake, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PedidoDetailModal } from "./pedido-detail-modal";

export interface PartnerOrder {
  id: string;
  client_name: string;
  client_email: string;
  client_doc: string;
  partner_name: string | null;
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
  created_at: string;
}

function ConsentBadge({ status }: { status: string }) {
  if (status === "consented") return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Consentido</Badge>;
  return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Pendente</Badge>;
}

function StageBadge({ order }: { order: PartnerOrder }) {
  if (order.report_delivered_at) return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Entregue</Badge>;
  if (order.report_public_token) return <Badge className="bg-teal-500/10 text-teal-400 border-teal-500/20">Relatório pronto</Badge>;
  if (order.credit_profile_id) return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">Análise concluída</Badge>;
  if (order.credit_desk_proposal_id) return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Proposta criada</Badge>;
  return <Badge className="bg-secondary text-muted-foreground border-border/50">Aguardando vínculo</Badge>;
}

export function PedidosPartnersClient() {
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
                {["Cliente", "Partner", "Valor Pago", "Consentimento", "Etapa", "Pago em"].map((h) => (
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
                  <td className="px-4 py-3 text-xs text-muted-foreground">{o.partner_name ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-white">{formatCurrency(o.amount_cents / 100)}</td>
                  <td className="px-4 py-3"><ConsentBadge status={o.consent_status} /></td>
                  <td className="px-4 py-3"><StageBadge order={o} /></td>
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
