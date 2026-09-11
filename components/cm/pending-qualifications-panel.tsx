"use client";

// Qualificações Pendentes (11/09/2026, pedido de João: "aonde consigo ver os
// contratos pendentes aguardando qualificação? isso não está previsto no
// UX?"). Antes desta tela, cada lote só era visível entrando na minuta ou
// no card específico que o criou -- nenhum lugar agregava os lotes em
// aberto do sistema inteiro, então acompanhar preenchimento exigia lembrar
// e abrir minuta por minuta manualmente.
import { useState, useEffect, useCallback } from "react";
import { Clock, CheckCircle2, Users, RefreshCw, ArrowRight } from "lucide-react";
import { VERTICAL_LABELS } from "@/lib/contract-verticals";

interface Party {
  id: string;
  full_name: string;
  status: string;
}

interface Batch {
  id: string;
  document_type: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  reminder_count: number;
  last_reminder_sent_at: string | null;
  template_id: string | null;
  listing_id: string | null;
  demand_id: string | null;
  operation_contract_id: string | null;
  contract_templates: { id: string; template_name: string; vertical: string } | null;
  cm_asset_listings: { anonymous_id: string; seller_name: string | null } | null;
  investor_demands: { empresa: string | null; nome_contato: string | null } | null;
  linked_contract: { contract_code: string | null; contract_title: string } | null;
  cm_party_qualifications: Party[];
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  nda_quadripartite: "NDA Quadripartite",
  fpa_venda: "FPA Venda",
  fpa_compra: "FPA Compra",
  mandato: "Mandato",
  contrato_final: "Contrato Final",
  contrato_parceria: "Contrato de Parceria",
  ncnda_ma: "NCNDA Mesa M&A",
};

function batchLabel(b: Batch): string {
  if (b.contract_templates) return b.contract_templates.template_name;
  if (b.cm_asset_listings) return `Ativo ${b.cm_asset_listings.anonymous_id}${b.cm_asset_listings.seller_name ? ` · ${b.cm_asset_listings.seller_name}` : ""}`;
  if (b.investor_demands) return `Comprador ${b.investor_demands.empresa ?? b.investor_demands.nome_contato ?? ""}`;
  if (b.linked_contract) return b.linked_contract.contract_code ?? b.linked_contract.contract_title;
  return DOCUMENT_TYPE_LABELS[b.document_type] ?? b.document_type;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "há menos de 1h";
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

export function PendingQualificationsPanel({ onOpenMinuta }: { onOpenMinuta: (templateId: string) => void }) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cm/qualifications/pending");
      const json = await res.json();
      setBatches(json.batches ?? []);
    } catch { setBatches([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const aguardandoPreenchimento = batches.filter((b) => b.status === "coletando");
  const prontoAguardandoGeracao = batches.filter((b) => b.status === "completo");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#F5F1E8]">Qualificações Pendentes</h2>
          <p className="text-xs text-[#9BAFC5]">Todos os lotes em aberto no sistema, sem precisar abrir minuta por minuta.</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#162744] text-[#9BAFC5] border border-[#9BAFC5]/20 rounded-lg text-xs font-medium hover:text-[#F5F1E8] transition disabled:opacity-50">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Atualizar
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#9BAFC5] text-sm">Carregando...</div>
      ) : batches.length === 0 ? (
        <div className="text-center py-12 text-[#9BAFC5] text-sm">Nenhum lote de qualificação em aberto no momento.</div>
      ) : (
        <>
          <section>
            <h3 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Clock size={13} /> Aguardando Preenchimento ({aguardandoPreenchimento.length})
            </h3>
            {aguardandoPreenchimento.length === 0 ? (
              <p className="text-xs text-[#9BAFC5]">Nenhum lote aguardando preenchimento.</p>
            ) : (
              <div className="space-y-2">
                {aguardandoPreenchimento.map((b) => {
                  const filled = b.cm_party_qualifications.filter((p) => p.status === "preenchido");
                  const pending = b.cm_party_qualifications.filter((p) => p.status !== "preenchido");
                  return (
                    <div key={b.id} className="bg-[#12112A] border border-amber-500/20 rounded-lg p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm text-[#F5F1E8] font-medium truncate">{batchLabel(b)}</span>
                          {b.contract_templates && (
                            <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#243A66] text-[#9BAFC5] flex-shrink-0">
                              {VERTICAL_LABELS[b.contract_templates.vertical] ?? b.contract_templates.vertical}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#9BAFC5]">
                          <Users size={11} className="inline mr-1" />
                          {filled.length}/{b.cm_party_qualifications.length} qualificados · falta: {pending.length > 0 ? pending.map((p) => p.full_name).join(", ") : "-"}
                          {" · "}criado {timeAgo(b.created_at)}
                          {b.reminder_count > 0 && ` · ${b.reminder_count} lembrete(s) enviado(s)`}
                        </p>
                      </div>
                      {b.template_id && (
                        <button onClick={() => onOpenMinuta(b.template_id!)}
                          className="flex-shrink-0 flex items-center gap-1 text-[10px] font-bold text-[#C9A84C] px-2.5 py-1.5 rounded border border-[#C9A84C]/40 bg-[#C9A84C]/10 hover:bg-[#C9A84C]/20 transition">
                          Ver Minuta <ArrowRight size={11} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <CheckCircle2 size={13} /> Completo, Aguardando Geração do Contrato ({prontoAguardandoGeracao.length})
            </h3>
            {prontoAguardandoGeracao.length === 0 ? (
              <p className="text-xs text-[#9BAFC5]">Nenhum lote completo aguardando geração.</p>
            ) : (
              <div className="space-y-2">
                {prontoAguardandoGeracao.map((b) => (
                  <div key={b.id} className="bg-[#12112A] border border-emerald-500/20 rounded-lg p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-[#F5F1E8] font-medium truncate">{batchLabel(b)}</span>
                        {b.contract_templates && (
                          <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#243A66] text-[#9BAFC5] flex-shrink-0">
                            {VERTICAL_LABELS[b.contract_templates.vertical] ?? b.contract_templates.vertical}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#9BAFC5]">
                        {b.cm_party_qualifications.map((p) => p.full_name).join(", ")}
                        {" · completo "}{b.completed_at ? timeAgo(b.completed_at) : ""}
                      </p>
                    </div>
                    {b.template_id && (
                      <button onClick={() => onOpenMinuta(b.template_id!)}
                        className="flex-shrink-0 flex items-center gap-1 text-[10px] font-bold text-[#C9A84C] px-2.5 py-1.5 rounded border border-[#C9A84C]/40 bg-[#C9A84C]/10 hover:bg-[#C9A84C]/20 transition">
                        Gerar Contrato <ArrowRight size={11} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
