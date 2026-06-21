"use client";

import React, { useState } from "react";
import { FileText, Download, Shield, CheckCircle2, Loader2, Lock } from "lucide-react";

interface DealRoomViewerProps {
  token: string;
  initialData: any;
}

export function DealRoomViewer({ token, initialData }: DealRoomViewerProps) {
  const [data, setData] = useState(initialData);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");

  const acceptNda = async () => {
    setAccepting(true);
    setError("");
    try {
      const res = await fetch(`/api/cm/deal-room/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept_nda" }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Erro ao aceitar NDA");
      }
      const refreshRes = await fetch(`/api/cm/deal-room/${token}`);
      const refreshData = await refreshRes.json();
      setData(refreshData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAccepting(false);
    }
  };

  if (data.nda_required) {
    return (
      <div className="max-w-lg mx-auto text-center">
        <div className="w-16 h-16 rounded-full bg-[#C9A84C]/10 flex items-center justify-center mx-auto mb-6">
          <Shield className="w-8 h-8 text-[#C9A84C]" />
        </div>
        <h2 className="text-xl font-bold text-[#F5F1E8] mb-2">Termo de Confidencialidade</h2>
        <p className="text-sm text-[#9BAFC5] mb-6">
          Para acessar os documentos do ativo <span className="text-[#C9A84C] font-bold">{data.listing?.anonymous_id}</span>,
          é necessário aceitar o termo de confidencialidade.
        </p>

        <div className="bg-[#162744] border border-[#9BAFC5]/10 rounded-lg p-6 mb-6 text-left max-h-[250px] overflow-y-auto text-xs text-[#9BAFC5]/80 leading-relaxed">
          <p className="mb-3">Pelo presente termo, declaro que manterei em sigilo absoluto todas as informações acessadas nesta sala de documentos, incluindo dados financeiros, jurídicos e operacionais do ativo identificado pelo código {data.listing?.anonymous_id}.</p>
          <p className="mb-3">Comprometo-me a não divulgar, compartilhar ou utilizar as informações para qualquer finalidade diferente da análise de viabilidade da operação de cessão/aquisição proposta pela V3 Partners Soluções Ltda (CNPJ 14.219.287/0001-50).</p>
          <p className="mb-3">O descumprimento deste termo sujeita o infrator às penalidades previstas em lei, incluindo indenização por perdas e danos.</p>
          <p>Os dados de acesso (IP, data, horário) serão registrados para fins de auditoria e compliance, conforme LGPD Art. 7, inc. V.</p>
        </div>

        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

        <button
          onClick={acceptNda}
          disabled={accepting}
          className="px-8 py-3 bg-[#C9A84C] text-[#09081A] rounded-lg text-sm font-bold hover:bg-[#E8C97A] disabled:opacity-50 transition"
        >
          {accepting ? <Loader2 size={16} className="animate-spin inline mr-2" /> : <Lock size={16} className="inline mr-2" />}
          Aceitar NDA e Acessar Documentos
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        <div>
          <p className="text-sm text-[#F5F1E8] font-medium">NDA aceito{data.access?.buyer_name ? ` por ${data.access.buyer_name}` : ""}</p>
          <p className="text-[10px] text-[#9BAFC5]">
            {data.access?.nda_accepted_at ? new Date(data.access.nda_accepted_at).toLocaleString("pt-BR") : ""}
          </p>
        </div>
      </div>

      {/* Resumo do Ativo */}
      <div className="bg-[#12112A] border border-[#C9A84C]/15 rounded-lg p-5 mb-6">
        <div className="text-[10px] text-[#C9A84C] font-bold uppercase tracking-wider mb-3">{data.listing?.anonymous_id}</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[
            { label: "Tipo", value: data.listing?.asset_type?.replace(/_/g, " ") ?? "—" },
            { label: "Valor Face", value: data.listing?.valor_face ? `R$ ${(Number(data.listing.valor_face) / 1e6).toFixed(1)}M` : "—" },
            { label: "Deságio", value: data.listing?.desagio_pretendido ? `${data.listing.desagio_pretendido}%` : "—" },
            { label: "Prazo", value: data.listing?.prazo_estimado_meses ? `${data.listing.prazo_estimado_meses} meses` : "—" },
          ].map((item) => (
            <div key={item.label}>
              <div className="text-xs font-bold text-[#F5F1E8]">{item.value}</div>
              <div className="text-[9px] text-[#9BAFC5] uppercase">{item.label}</div>
            </div>
          ))}
        </div>
        {data.listing?.ente_devedor && (
          <div className="mt-3 pt-3 border-t border-[#9BAFC5]/10 text-xs text-[#9BAFC5]">
            Ente: <span className="text-[#F5F1E8]">{data.listing.ente_devedor}</span>
            {data.listing.tribunal && <> · Tribunal: <span className="text-[#F5F1E8]">{data.listing.tribunal}</span></>}
            {data.listing.natureza && <> · Natureza: <span className="text-[#F5F1E8]">{data.listing.natureza}</span></>}
          </div>
        )}
      </div>

      {/* Documentos */}
      <div className="text-[10px] text-[#C9A84C] font-bold uppercase tracking-wider mb-3">
        Documentos ({data.documents?.length ?? 0})
      </div>
      {(!data.documents || data.documents.length === 0) ? (
        <div className="text-center py-12 text-[#9BAFC5] text-sm">
          Nenhum documento disponível nesta sala.
        </div>
      ) : (
        <div className="space-y-2">
          {data.documents.map((doc: any) => (
            <div key={doc.id} className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-[#C9A84C]" />
                <div>
                  <div className="text-sm text-[#F5F1E8] font-medium">{doc.original_filename ?? "Documento"}</div>
                  <div className="text-[10px] text-[#9BAFC5]">
                    {doc.document_type} · {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : ""}
                    {doc.created_at && ` · ${new Date(doc.created_at).toLocaleDateString("pt-BR")}`}
                  </div>
                </div>
              </div>
              {doc.download_url && (
                <a
                  href={doc.download_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded-lg text-[#C9A84C] text-xs font-bold hover:bg-[#C9A84C]/20 transition"
                >
                  <Download size={14} /> Baixar
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
