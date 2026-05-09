"use client";

import React, { useState } from "react";
import { X, Building2, TrendingUp, Layers, Mail, Send, Plus, Trash2 } from "lucide-react";
import { DealIntakeModal } from "./deal-intake-modal";

export interface HubDeal {
  id: string;
  empresa_nome: string;
  setor: string;
  valor_estimado: number;
  tipo_operacao: string;
  origem_lead: string;
  sugestao_tese: string;
  status: string;
  deal_card_html: string | null;
  created_at: string;
  contato_nome: string | null;
  contato_telefone: string | null;
  contato_email: string | null;
}

interface HubClientProps {
  deals: HubDeal[];
  userRole: string;
  userName: string;
}

const SETOR_LABEL: Record<string, string> = {
  credito_recebiveis:  "Crédito e Recebíveis",
  real_estate:         "Real Estate",
  mineracao_commodities: "Mineração e Commodities",
  ma_cross_border:     "M&A Cross-Border",
};

const TIPO_LABEL: Record<string, string> = {
  venda:        "Venda",
  fusao:        "Fusão",
  captacao:     "Captação",
  estruturacao: "Estruturação",
};

const STATUS_COLOR: Record<string, string> = {
  novo:              "bg-[#C9A84C]/20 text-[#C9A84C]",
  em_analise:        "bg-[#243A66] text-[#F0ECE4]",
  deal_card_gerado:  "bg-emerald-900/40 text-emerald-400",
  arquivado:         "bg-[#162744] text-[#7A8FA8]",
};

function formatCurrency(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
  return `R$ ${v.toLocaleString("pt-BR")}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function HubClient({ deals, userRole }: HubClientProps) {
  const [selected, setSelected]     = useState<HubDeal | null>(null);
  const [showIntake, setShowIntake] = useState(false);
  const [dealList, setDealList]     = useState<HubDeal[]>(deals);

  function handleNewDeal() {
    // Reload page to show the new deal
    window.location.reload();
  }

  return (
    <div className="min-h-screen bg-[#09081A] p-6">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-5 h-5 text-[#C9A84C]" />
            <span className="text-[#C9A84C] text-xs font-bold tracking-[2px] uppercase">Hub de Inteligência</span>
          </div>
          <h1 className="text-[#F0ECE4] text-3xl font-bold">Deals V3</h1>
          <p className="text-[#7A8FA8] text-sm mt-1">
            {dealList.length} {dealList.length === 1 ? "deal registrado" : "deals registrados"}
            {userRole === "ADMIN" ? " · Visão completa (ADMIN)" : " · Visão interna"}
          </p>
        </div>
        <button
          onClick={() => setShowIntake(true)}
          className="flex items-center gap-2 bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-bold text-sm px-4 py-2.5 rounded-xl transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Novo Deal
        </button>
      </div>

      {/* Gallery Grid */}
      {dealList.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Layers className="w-12 h-12 text-[#243A66] mb-4" />
          <p className="text-[#7A8FA8] text-sm">Nenhum deal registrado ainda.</p>
          <p className="text-[#7A8FA8] text-xs mt-1">Os deals aparecerão aqui após serem captados via webhook W2.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {dealList.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              onClick={() => setSelected(deal)}
            />
          ))}
        </div>
      )}

      {/* Modal deal detalhe */}
      {selected && (
        <DealModal deal={selected} userRole={userRole} onClose={() => setSelected(null)} />
      )}

      {/* Modal novo deal */}
      {showIntake && (
        <DealIntakeModal
          onClose={() => setShowIntake(false)}
          onSuccess={handleNewDeal}
        />
      )}
    </div>
  );
}

function DealCard({ deal, onClick }: { deal: HubDeal; onClick: () => void }) {
  const tesePreview = deal.sugestao_tese.length > 140
    ? deal.sugestao_tese.substring(0, 140) + "..."
    : deal.sugestao_tese;

  return (
    <button
      onClick={onClick}
      className="text-left bg-[#111F35] border border-[#243A66] rounded-xl p-5 hover:border-[#C9A84C] hover:bg-[#162744] transition-all duration-200 group w-full"
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <span className="text-[#C9A84C] text-[9px] font-bold tracking-[2px] uppercase">
          {SETOR_LABEL[deal.setor] ?? deal.setor}
        </span>
        <span className={`text-[9px] font-bold uppercase tracking-[1px] px-2 py-0.5 rounded-full ${STATUS_COLOR[deal.status] ?? "bg-[#162744] text-[#7A8FA8]"}`}>
          {deal.status.replace("_", " ")}
        </span>
      </div>

      {/* Empresa */}
      <div className="flex items-center gap-2 mb-3">
        <Building2 className="w-4 h-4 text-[#7A8FA8] shrink-0" />
        <h3 className="text-[#F0ECE4] font-semibold text-base leading-tight group-hover:text-[#C9A84C] transition-colors">
          {deal.empresa_nome}
        </h3>
      </div>

      {/* Valor + Tipo */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-[#C9A84C]" />
          <span className="text-[#F0ECE4] text-sm font-semibold">
            {formatCurrency(deal.valor_estimado)}
          </span>
        </div>
        <span className="text-[#7A8FA8] text-xs">·</span>
        <span className="text-[#7A8FA8] text-xs">{TIPO_LABEL[deal.tipo_operacao] ?? deal.tipo_operacao}</span>
      </div>

      {/* Tese preview */}
      {deal.sugestao_tese && (
        <div className="bg-[#09081A] rounded-lg p-3 border-l-2 border-[#243A66] group-hover:border-[#C9A84C] transition-colors">
          <p className="text-[#7A8FA8] text-xs leading-relaxed">{tesePreview}</p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3">
        <span className="text-[#7A8FA8] text-[10px]">{formatDate(deal.created_at)}</span>
        <span className="text-[#C9A84C] text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
          Ver deal completo →
        </span>
      </div>
    </button>
  );
}

function DealModal({ deal, userRole, onClose }: { deal: HubDeal; userRole: string; onClose: () => void }) {
  const isFull = userRole === "ADMIN";
  const [view, setView] = useState<"card" | "html" | "share">("card");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111F35] border border-[#243A66] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#243A66]">
          <div>
            <span className="text-[#C9A84C] text-[9px] font-bold tracking-[2px] uppercase block mb-0.5">
              {SETOR_LABEL[deal.setor] ?? deal.setor}
            </span>
            <h2 className="text-[#F0ECE4] text-xl font-bold">{deal.empresa_nome}</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-[#09081A] rounded-lg p-1 gap-1">
              <button
                onClick={() => setView("card")}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${view === "card" ? "bg-[#C9A84C] text-[#09081A]" : "text-[#7A8FA8] hover:text-[#F0ECE4]"}`}
              >
                Ficha
              </button>
              {deal.deal_card_html && (
                <button
                  onClick={() => setView("html")}
                  className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${view === "html" ? "bg-[#C9A84C] text-[#09081A]" : "text-[#7A8FA8] hover:text-[#F0ECE4]"}`}
                >
                  Deal Card
                </button>
              )}
              <button
                onClick={() => setView("share")}
                className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${view === "share" ? "bg-[#C9A84C] text-[#09081A]" : "text-[#7A8FA8] hover:text-[#F0ECE4]"}`}
              >
                <Mail className="w-3 h-3" />
                Enviar
              </button>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-[#162744] hover:bg-[#243A66] text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto flex-1">
          {view === "share" ? (
          <SharePanel deal={deal} onBack={() => setView("card")} />
        ) : view === "html" && deal.deal_card_html ? (
            <div
              className="w-full"
              dangerouslySetInnerHTML={{ __html: deal.deal_card_html }}
            />
          ) : (
            <div className="p-6 space-y-5">

              {/* Métricas principais */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: "Valor Estimado", value: formatCurrency(deal.valor_estimado) },
                  { label: "Tipo de Operação", value: TIPO_LABEL[deal.tipo_operacao] ?? deal.tipo_operacao },
                  { label: "Origem", value: deal.origem_lead },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-[#09081A] rounded-xl p-4">
                    <span className="text-[#7A8FA8] text-[9px] font-bold tracking-[1.5px] uppercase block mb-1">{label}</span>
                    <span className="text-[#F0ECE4] text-sm font-semibold">{value}</span>
                  </div>
                ))}
              </div>

              {/* Tese completa */}
              {deal.sugestao_tese && (
                <div className="bg-[#09081A] border-l-4 border-[#C9A84C] rounded-xl p-5">
                  <span className="text-[#C9A84C] text-[9px] font-bold tracking-[2px] uppercase block mb-3">Tese de Investimento</span>
                  <p className="text-[#F0ECE4] text-sm leading-relaxed">{deal.sugestao_tese}</p>
                </div>
              )}

              {/* Contato — apenas ADMIN */}
              {isFull && (deal.contato_nome || deal.contato_email || deal.contato_telefone) && (
                <div className="bg-[#162744] rounded-xl p-5">
                  <span className="text-[#C9A84C] text-[9px] font-bold tracking-[2px] uppercase block mb-3">Dados de Contato</span>
                  <div className="space-y-2">
                    {deal.contato_nome && (
                      <div className="flex justify-between">
                        <span className="text-[#7A8FA8] text-xs">Nome</span>
                        <span className="text-[#F0ECE4] text-xs font-medium">{deal.contato_nome}</span>
                      </div>
                    )}
                    {deal.contato_email && (
                      <div className="flex justify-between">
                        <span className="text-[#7A8FA8] text-xs">E-mail</span>
                        <a href={`mailto:${deal.contato_email}`} className="text-[#C9A84C] text-xs hover:underline">{deal.contato_email}</a>
                      </div>
                    )}
                    {deal.contato_telefone && (
                      <div className="flex justify-between">
                        <span className="text-[#7A8FA8] text-xs">Telefone</span>
                        <a href={`tel:${deal.contato_telefone}`} className="text-[#F0ECE4] text-xs hover:text-[#C9A84C]">{deal.contato_telefone}</a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Meta */}
              <div className="flex items-center justify-between text-xs text-[#7A8FA8]">
                <span>ID: {deal.id.slice(0, 8)}...</span>
                <span>{formatDate(deal.created_at)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SharePanel({ deal, onBack }: { deal: HubDeal; onBack: () => void }) {
  const [emails, setEmails] = useState<string[]>([""]);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const addEmail = () => setEmails(e => [...e, ""]);
  const removeEmail = (i: number) => setEmails(e => e.filter((_, idx) => idx !== i));
  const updateEmail = (i: number, val: string) => setEmails(e => e.map((v, idx) => idx === i ? val : v));

  const validEmails = emails.map(e => e.trim()).filter(e => e.includes("@"));

  async function handleSend() {
    if (!validEmails.length) return;
    setStatus("sending");
    setErrorMsg("");
    try {
      const res = await fetch("/api/hub/share-deal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealId: deal.id,
          empresaNome: deal.empresa_nome,
          setor: deal.setor,
          valorEstimado: deal.valor_estimado,
          sugestaoTese: deal.sugestao_tese,
          emails: validEmails,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatus("sent");
      } else {
        setStatus("error");
        setErrorMsg(data.error ?? "Erro ao enviar");
      }
    } catch (e) {
      setStatus("error");
      setErrorMsg("Falha de conexão");
    }
  }

  if (status === "sent") {
    return (
      <div className="p-8 flex flex-col items-center justify-center text-center gap-4">
        <div className="w-14 h-14 rounded-full bg-emerald-900/40 flex items-center justify-center">
          <Send className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <p className="text-[#F0ECE4] font-semibold text-base mb-1">Email enviado com sucesso</p>
          <p className="text-[#7A8FA8] text-sm">
            Deal <strong className="text-[#F0ECE4]">{deal.empresa_nome}</strong> compartilhado com {validEmails.length} {validEmails.length === 1 ? "destinatário" : "destinatários"}.
          </p>
        </div>
        <button onClick={onBack} className="text-[#C9A84C] text-sm font-medium hover:underline mt-2">
          Voltar à ficha
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <p className="text-[#C9A84C] text-[9px] font-bold tracking-[2px] uppercase mb-1">Compartilhar deal por email</p>
        <p className="text-[#F0ECE4] font-semibold">{deal.empresa_nome}</p>
        <p className="text-[#7A8FA8] text-xs mt-0.5">
          A tese de investimento e os dados do deal serão enviados para os destinatários abaixo.
        </p>
      </div>

      <div className="space-y-3">
        <span className="text-[#7A8FA8] text-xs font-semibold uppercase tracking-wide">Destinatários</span>
        {emails.map((email, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={e => updateEmail(i, e.target.value)}
              placeholder="email@exemplo.com.br"
              className="flex-1 bg-[#09081A] border border-[#243A66] rounded-lg px-3 py-2 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8] focus:outline-none focus:border-[#C9A84C] transition-colors"
            />
            {emails.length > 1 && (
              <button
                onClick={() => removeEmail(i)}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#162744] hover:bg-red-900/30 text-[#7A8FA8] hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addEmail}
          className="flex items-center gap-1.5 text-xs text-[#7A8FA8] hover:text-[#C9A84C] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Adicionar destinatário
        </button>
      </div>

      {status === "error" && (
        <p className="text-red-400 text-xs bg-red-900/20 px-3 py-2 rounded-lg">{errorMsg}</p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          onClick={handleSend}
          disabled={!validEmails.length || status === "sending"}
          className="flex items-center gap-2 bg-[#C9A84C] hover:bg-[#E8C97A] disabled:opacity-50 disabled:cursor-not-allowed text-[#09081A] font-bold text-sm px-5 py-2.5 rounded-lg transition-colors"
        >
          <Send className="w-4 h-4" />
          {status === "sending" ? "Enviando..." : `Enviar para ${validEmails.length || "..."}`}
        </button>
        <button
          onClick={onBack}
          className="text-[#7A8FA8] hover:text-[#F0ECE4] text-sm transition-colors px-3"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
