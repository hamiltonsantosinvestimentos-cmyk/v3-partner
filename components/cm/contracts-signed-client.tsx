"use client";

import React, { useState, useEffect } from "react";
import { Shield, FileText, Loader2, ChevronDown, Download, Eye, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface SignedContract {
  id: string;
  contract_title: string;
  vertical: string;
  signed_at: string;
  commission_percent: number | null;
  parties: any[];
  created_at: string;
}

const VERTICAL_LABELS: Record<string, string> = {
  capital_markets: "Bolsa de Ativos",
  credito: "Mesa de Credito",
  ma: "M&A",
  institucional: "Institucional",
  clientes: "Clientes / Partners",
  talent_pool: "Talent Pool",
  colaboradores: "Colaboradores",
  outros: "Outros",
};

const VERTICAL_ICONS: Record<string, string> = {
  capital_markets: "&#9878;",
  credito: "&#128179;",
  ma: "&#129309;",
  institucional: "&#127970;",
  clientes: "&#128101;",
  talent_pool: "&#127891;",
  colaboradores: "&#128188;",
  outros: "&#128196;",
};

export function ContractsSignedClient() {
  const [grouped, setGrouped] = useState<Record<string, SignedContract[]>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/contracts/signed")
      .then(r => r.json())
      .then(json => {
        setGrouped(json.grouped ?? {});
        setExpanded(Object.keys(json.grouped ?? {}));
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleSection = (v: string) => {
    setExpanded(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  };

  const totalCount = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);

  const handlePreview = async (contractId: string) => {
    if (selectedId === contractId) { setSelectedId(null); setPreviewHtml(null); return; }
    setSelectedId(contractId);
    try {
      const res = await fetch(`/api/contracts/list?status=assinado`);
      const json = await res.json();
      const contract = (json.contracts ?? []).find((c: any) => c.id === contractId);
      setPreviewHtml(contract?.rendered_html ?? null);
    } catch { setPreviewHtml(null); }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F1E8]">Contratos Assinados</h1>
          <p className="text-sm text-[#9BAFC5]">Arquivo de contratos assinados organizados por vertical</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#9BAFC5]">
          <Shield size={14} className="text-[#C9A84C]" />
          <span>{totalCount} contrato{totalCount !== 1 ? "s" : ""} assinado{totalCount !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#C9A84C]" size={32} /></div>
      ) : totalCount === 0 ? (
        <div className="text-center py-20">
          <Shield size={48} className="text-[#243A66] mx-auto mb-4" />
          <p className="text-[#9BAFC5] text-sm">Nenhum contrato assinado ainda</p>
          <p className="text-[#9BAFC5]/50 text-xs mt-1">Contratos aparecerão aqui após atingir quórum e serem assinados</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([vertical, contracts]) => (
            <div key={vertical} className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection(vertical)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#162744]/50 transition"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="text-lg"
                    dangerouslySetInnerHTML={{ __html: VERTICAL_ICONS[vertical] ?? "&#128196;" }}
                  />
                  <div className="text-left">
                    <span className="text-sm font-bold text-[#F5F1E8]">{VERTICAL_LABELS[vertical] ?? vertical}</span>
                    <span className="ml-2 text-[10px] bg-[#C9A84C]/15 text-[#C9A84C] px-2 py-0.5 rounded-full font-bold">
                      {contracts.length}
                    </span>
                  </div>
                </div>
                <ChevronDown size={16} className={cn("text-[#9BAFC5] transition", expanded.includes(vertical) && "rotate-180")} />
              </button>

              {expanded.includes(vertical) && (
                <div className="border-t border-[#9BAFC5]/10">
                  <table className="w-full">
                    <thead>
                      <tr className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-wider">
                        <th className="px-5 py-2 text-left">Contrato</th>
                        <th className="px-3 py-2 text-left">Partes</th>
                        <th className="px-3 py-2 text-center">Comissão</th>
                        <th className="px-3 py-2 text-center">Assinado em</th>
                        <th className="px-3 py-2 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contracts.map((c) => (
                        <React.Fragment key={c.id}>
                          <tr className="border-t border-[#9BAFC5]/5 hover:bg-[#162744]/30 transition">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <FileText size={14} className="text-[#C9A84C]" />
                                <span className="text-xs font-medium text-[#F5F1E8]">{c.contract_title}</span>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex gap-1 flex-wrap">
                                {(c.parties ?? []).map((p: any, i: number) => (
                                  <span key={i} className="text-[9px] bg-[#162744] text-[#9BAFC5] px-1.5 py-0.5 rounded">
                                    {p.name ?? p.role}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className="text-xs text-[#F5F1E8]">{c.commission_percent ? `${c.commission_percent}%` : "—"}</span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <div className="flex items-center justify-center gap-1 text-[10px] text-[#9BAFC5]">
                                <Calendar size={10} />
                                {c.signed_at ? new Date(c.signed_at).toLocaleDateString("pt-BR") : "—"}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <button
                                onClick={() => handlePreview(c.id)}
                                className={cn(
                                  "text-[10px] px-2 py-1 rounded transition",
                                  selectedId === c.id
                                    ? "bg-[#C9A84C]/20 text-[#C9A84C]"
                                    : "bg-[#162744] text-[#9BAFC5] hover:text-[#F5F1E8]"
                                )}
                              >
                                <Eye size={12} className="inline mr-1" />
                                {selectedId === c.id ? "Fechar" : "Ver"}
                              </button>
                            </td>
                          </tr>
                          {selectedId === c.id && previewHtml && (
                            <tr>
                              <td colSpan={5} className="p-4">
                                <div className="bg-white rounded-lg overflow-hidden">
                                  <iframe srcDoc={previewHtml} className="w-full h-[400px] border-0" title="Preview" />
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
