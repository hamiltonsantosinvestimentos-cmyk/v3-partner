"use client";

// Painel de indicações (comissionados) de um card de Ativo (SELL_SIDE) ou
// Comprador (BUY_SIDE) na Bolsa de Ativos. Fase 2 do BRIEF de 13/08/2026:
// depois da Fase 1 (botão "Indicar"), não existia nenhuma tela pra VER quem
// já foi indicado -- este componente fecha esse gap, reaproveitando o
// padrão visual já usado em contracts-panel-client.tsx (linhas 491-537),
// nunca refatorando aquele componente já em produção (decisão registrada
// no BRIEF: risco desnecessário pra esta fase).
import { useState, useEffect, useCallback } from "react";
import { UserPlus, Copy, Share2, CheckCircle2, FileText, Loader2, X } from "lucide-react";
import { ROLE_LABELS } from "@/lib/qualification-roles";

interface QualParty {
  id: string;
  full_name: string;
  role_in_document: string;
  status: string;
  qualification_token: string;
}

interface QualBatch {
  id: string;
  status: string;
  cm_party_qualifications: QualParty[];
}

interface Props {
  listingId?: string;
  demandId?: string;
  cardLabel: string; // usado na mensagem de WhatsApp, ex: "Ativo CM-OT-FED-0002" ou "Comprador Fundo X"
}

export function QualificationBatchesPanel({ listingId, demandId, cardLabel }: Props) {
  const [batches, setBatches] = useState<QualBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedToken, setCopiedToken] = useState("");
  const [minuta, setMinuta] = useState<{ html: string; role_label: string } | null>(null);
  const [minutaLoading, setMinutaLoading] = useState<string>("");
  const [minutaError, setMinutaError] = useState("");

  const load = useCallback(async () => {
    const qs = listingId ? `listing_id=${listingId}` : demandId ? `demand_id=${demandId}` : "";
    if (!qs) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cm/qualifications?${qs}`);
      const json = await res.json();
      if (res.ok) setBatches(json.batches ?? []);
    } finally {
      setLoading(false);
    }
  }, [listingId, demandId]);

  useEffect(() => { load(); }, [load]);

  const qualificationLink = (token: string) =>
    `${typeof window !== "undefined" ? window.location.origin : "https://app.v3partners.com.br"}/intake/qualificacao/${token}`;

  const copyQualLink = (token: string) => {
    navigator.clipboard.writeText(qualificationLink(token));
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(""), 2000);
  };

  const whatsappQualLink = (party: QualParty) => {
    const msg = `Olá ${party.full_name}, você foi indicado(a) como envolvido(a) em ${cardLabel} da V3 Partners. Complete seus dados de qualificação para prosseguirmos: ${qualificationLink(party.qualification_token)}`;
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  };

  const verMinuta = async (party: QualParty) => {
    setMinutaError("");
    setMinutaLoading(party.id);
    try {
      const res = await fetch(`/api/cm/qualifications/legal-text?id=${party.id}`);
      const json = await res.json();
      if (!res.ok) {
        setMinutaError(json.error ?? "Erro ao gerar minuta");
        return;
      }
      setMinuta({ html: json.html, role_label: json.role_label });
    } catch {
      setMinutaError("Erro de conexão");
    } finally {
      setMinutaLoading("");
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-[11px] text-[#9BAFC5]"><Loader2 size={13} className="animate-spin" /> Carregando indicações</div>;
  }

  return (
    <div className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-4">
      <h3 className="text-xs font-bold text-[#F5F1E8] mb-3 flex items-center gap-2">
        <UserPlus size={13} className="text-[#C9A84C]" /> Comissionados Indicados
      </h3>

      {batches.length === 0 ? (
        <p className="text-[11px] text-[#9BAFC5]">Nenhuma indicação feita para este card ainda.</p>
      ) : (
        <div className="space-y-3">
          {batches.map((batch) => (
            <div key={batch.id} className="space-y-1.5">
              {batch.cm_party_qualifications.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 bg-[#09081A] rounded px-2.5 py-1.5">
                  <div className="min-w-0">
                    <p className="text-xs text-[#F5F1E8] truncate">
                      {p.full_name} <span className="text-[9px] text-[#9BAFC5]">, {ROLE_LABELS[p.role_in_document] ?? p.role_in_document}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {p.status === "preenchido" ? (
                      <>
                        <span className="text-[9px] text-emerald-400 flex items-center gap-1"><CheckCircle2 size={11} /> Qualificado</span>
                        <button onClick={() => verMinuta(p)} disabled={minutaLoading === p.id}
                          className="flex items-center gap-1 text-[9px] font-semibold text-[#C9A84C] px-2 py-1 rounded border border-[#C9A84C]/40 bg-[#C9A84C]/10 hover:bg-[#C9A84C]/20 transition-colors disabled:opacity-50">
                          {minutaLoading === p.id ? <Loader2 size={10} className="animate-spin" /> : <FileText size={10} />} Ver Minuta
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => copyQualLink(p.qualification_token)}
                          className="flex items-center gap-1 text-[9px] font-semibold text-[#C9A84C] px-2 py-1 rounded border border-[#C9A84C]/40 bg-[#C9A84C]/10 hover:bg-[#C9A84C]/20 transition-colors">
                          <Copy size={10} /> {copiedToken === p.qualification_token ? "Copiado" : "Copiar link"}
                        </button>
                        <a href={whatsappQualLink(p)} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[9px] font-semibold text-emerald-400 px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors">
                          <Share2 size={10} /> WhatsApp
                        </a>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {minutaError && <p className="text-[10px] text-red-400 mt-2">{minutaError}</p>}

      {minuta && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" onClick={() => setMinuta(null)}>
          <div className="bg-white rounded-lg overflow-hidden max-w-2xl w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2 bg-[#12112A]">
              <p className="text-xs font-bold text-[#F5F1E8]">Minuta, {minuta.role_label}</p>
              <button onClick={() => setMinuta(null)} className="text-[#9BAFC5] hover:text-[#F5F1E8]"><X size={16} /></button>
            </div>
            <iframe srcDoc={minuta.html} className="w-full flex-1 border-0" title="Minuta de qualificação" />
          </div>
        </div>
      )}
    </div>
  );
}
