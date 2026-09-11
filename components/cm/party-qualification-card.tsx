"use client";

// Ficha de Qualificação (04/09/2026, extraído de contracts-panel-client.tsx
// em 11/09/2026 para ser reaproveitado também em Minutas e no painel da
// Bolsa de Ativos -- pedido de João: "coloque disponível a possibilidade
// de nós clicarmos em cima do link e já abrir o card de qualificação",
// sem esperar o contrato ser gerado). Card com toda a ficha civil coletada
// + documentos de KYC + IP de quem preencheu/enviou (compliance, pedido de
// Robson Lino, mesmo bloco).
import { useState, useEffect } from "react";
import { User, Loader2, FileText, Download, X } from "lucide-react";
import { PARTY_NATURE_LABELS, REPRESENTATIVE_TYPE_LABELS, type PartyNature } from "@/lib/legal-qualification";
import { KYC_DOCUMENT_KIND_LABELS } from "@/lib/kyc-documents";
import { ROLE_LABELS } from "@/lib/qualification-roles";

type KycDocument = { document_kind: string; original_filename: string | null; mime_type?: string | null; uploaded_at: string; valid_until: string; download_url: string | null; uploaded_ip?: string | null };

function DocumentRow({ doc, onPreview }: { doc: KycDocument; onPreview: (url: string) => void }) {
  const isImage = doc.mime_type?.startsWith("image/");
  return (
    <div className="flex items-center gap-2 bg-[#09081A] rounded px-2.5 py-2">
      {isImage && doc.download_url ? (
        <button type="button" onClick={() => onPreview(doc.download_url!)} className="flex-shrink-0 w-10 h-10 rounded overflow-hidden border border-[#9BAFC5]/20 hover:border-[#C9A84C]/60 transition-colors">
          <img src={doc.download_url} alt={doc.original_filename ?? "documento"} className="w-full h-full object-cover" />
        </button>
      ) : (
        <div className="flex-shrink-0 w-10 h-10 rounded flex items-center justify-center bg-[#12112A] border border-[#9BAFC5]/15">
          <FileText size={16} className="text-[#9BAFC5]" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-[#C9A84C] font-bold uppercase">{KYC_DOCUMENT_KIND_LABELS[doc.document_kind as keyof typeof KYC_DOCUMENT_KIND_LABELS] ?? doc.document_kind}</p>
        <p className="text-[10px] text-[#9BAFC5] truncate">
          {doc.original_filename ?? "arquivo"} · enviado {new Date(doc.uploaded_at).toLocaleDateString("pt-BR")} · válido até {new Date(doc.valid_until).toLocaleDateString("pt-BR")}
        </p>
        {doc.uploaded_ip && <p className="text-[9px] text-[#9BAFC5]/70">IP de envio: {doc.uploaded_ip}</p>}
      </div>
      {doc.download_url ? (
        <a href={doc.download_url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-[9px] font-semibold text-[#C9A84C] px-2 py-1 rounded border border-[#C9A84C]/40 bg-[#C9A84C]/10 hover:bg-[#C9A84C]/20 transition-colors flex-shrink-0">
          <Download size={10} /> Baixar
        </a>
      ) : null}
    </div>
  );
}

function PartyCardBody({ data, onPreview }: { data: any; onPreview: (url: string) => void }) {
  const q = data.qualification;

  if (!data.filled) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-[#F5F1E8] font-semibold">{q.full_name}</p>
        <p className="text-[11px] text-[#9BAFC5]">{q.email}</p>
        <p className="text-xs text-[#9BAFC5] bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-3 mt-2">Aguardando preenchimento: esta parte ainda não enviou a qualificação.</p>
      </div>
    );
  }

  const natureLabel = q.party_nature ? PARTY_NATURE_LABELS[q.party_nature as PartyNature] : (q.person_type ?? "-");

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-[#F5F1E8] font-semibold">{q.full_name}</p>
        <p className="text-[11px] text-[#9BAFC5]">{q.email}{q.phone ? ` · ${q.phone}` : ""}</p>
        <span className="inline-block mt-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#C9A84C]/15 text-[#C9A84C] border border-[#C9A84C]/30">
          {ROLE_LABELS[q.role_in_document] ?? q.role_in_document} · {natureLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        {q.cpf_cnpj && <div><span className="text-[#9BAFC5]">CPF</span><p className="text-[#F5F1E8]">{q.cpf_cnpj}</p></div>}
        {q.rg && <div><span className="text-[#9BAFC5]">RG</span><p className="text-[#F5F1E8]">{q.rg}</p></div>}
        {q.nationality && <div><span className="text-[#9BAFC5]">Nacionalidade</span><p className="text-[#F5F1E8]">{q.nationality}</p></div>}
        {q.marital_status && <div><span className="text-[#9BAFC5]">Estado Civil</span><p className="text-[#F5F1E8]">{q.marital_status}</p></div>}
        {q.profession && <div><span className="text-[#9BAFC5]">Profissão</span><p className="text-[#F5F1E8]">{q.profession}</p></div>}
        {q.birth_date && <div><span className="text-[#9BAFC5]">Nascimento</span><p className="text-[#F5F1E8]">{new Date(q.birth_date).toLocaleDateString("pt-BR")}</p></div>}
      </div>

      {q.endereco_completo && (
        <div className="text-[11px]"><span className="text-[#9BAFC5]">Endereço Residencial</span><p className="text-[#F5F1E8]">{q.endereco_completo}</p></div>
      )}

      {q.person_type === "PJ" && (
        <div className="pt-2 border-t border-[#9BAFC5]/10 space-y-1.5">
          <p className="text-[9px] font-bold text-[#C9A84C] uppercase">Empresa</p>
          <div className="text-[11px]"><span className="text-[#9BAFC5]">Razão Social</span><p className="text-[#F5F1E8]">{q.company_name}</p></div>
          <div className="text-[11px]"><span className="text-[#9BAFC5]">CNPJ</span><p className="text-[#F5F1E8]">{q.company_cnpj}</p></div>
          {q.company_address && <div className="text-[11px]"><span className="text-[#9BAFC5]">Endereço da Sede</span><p className="text-[#F5F1E8]">{q.company_address}</p></div>}
        </div>
      )}

      {(q.dados_bancarios || q.pix_key) && (
        <div className="pt-2 border-t border-[#9BAFC5]/10 space-y-1.5">
          <p className="text-[9px] font-bold text-[#C9A84C] uppercase">Dados para Repasse</p>
          {q.pix_key && <div className="text-[11px]"><span className="text-[#9BAFC5]">Chave PIX</span><p className="text-[#F5F1E8]">{q.pix_key}</p></div>}
          {q.dados_bancarios?.banco && (
            <p className="text-[11px] text-[#F5F1E8]">{q.dados_bancarios.banco} · Ag. {q.dados_bancarios.agencia} · Conta {q.dados_bancarios.conta} ({q.dados_bancarios.tipo_conta})</p>
          )}
        </div>
      )}

      {data.documents?.length > 0 && (
        <div className="pt-2 border-t border-[#9BAFC5]/10 space-y-1.5">
          <p className="text-[9px] font-bold text-[#C9A84C] uppercase">Documentos KYC</p>
          {data.documents.map((doc: any, i: number) => <DocumentRow key={i} doc={doc} onPreview={onPreview} />)}
        </div>
      )}

      {data.representation_chain?.length > 0 && (
        <div className="pt-2 border-t border-[#9BAFC5]/10 space-y-2">
          <p className="text-[9px] font-bold text-[#C9A84C] uppercase">Cadeia de Representação</p>
          {data.representation_chain.map((rep: any, i: number) => (
            <div key={i} className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-2.5 space-y-1" style={{ marginLeft: rep.depth * 12 }}>
              <p className="text-[10px] text-[#C9A84C] font-bold uppercase">{REPRESENTATIVE_TYPE_LABELS[rep.representative_type as keyof typeof REPRESENTATIVE_TYPE_LABELS] ?? rep.representative_type}</p>
              <p className="text-xs text-[#F5F1E8] font-medium">{rep.party_nature === "PJ" ? rep.company_name : rep.full_name}</p>
              <p className="text-[10px] text-[#9BAFC5]">{rep.party_nature === "PJ" ? rep.company_cnpj : rep.cpf_cnpj}</p>
              {rep.documents?.length > 0 && (
                <div className="pt-1 space-y-1">
                  {rep.documents.map((doc: any, j: number) => <DocumentRow key={j} doc={doc} onPreview={onPreview} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-[9px] text-[#9BAFC5]/60 pt-2 border-t border-[#9BAFC5]/10 space-y-0.5">
        <span className="block">Preenchido em {q.filled_at ? new Date(q.filled_at).toLocaleString("pt-BR") : "-"}{q.filled_ip ? ` a partir do IP ${q.filled_ip}` : ""}.</span>
        <span className="block">Abertura desta ficha e download de documentos ficam registrados na trilha de auditoria de KYC.</span>
      </p>
    </div>
  );
}

export function PartyQualificationCardModal({ qualificationId, onClose }: { qualificationId: string | null; onClose: () => void }) {
  const [state, setState] = useState<{ loading: boolean; data: any | null; error: string | null }>({ loading: false, data: null, error: null });
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!qualificationId) { setState({ loading: false, data: null, error: null }); return; }
    setState({ loading: true, data: null, error: null });
    fetch(`/api/cm/qualifications/party/${qualificationId}`)
      .then(async (res) => {
        const json = await res.json();
        if (res.ok) setState({ loading: false, data: json, error: null });
        else setState({ loading: false, data: null, error: json.error ?? "Erro ao carregar ficha" });
      })
      .catch(() => setState({ loading: false, data: null, error: "Erro de conexão" }));
  }, [qualificationId]);

  if (!qualificationId) return null;

  return (
    <>
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60" onClick={onClose}>
        <div className="w-full max-w-lg max-h-[85vh] bg-[#09081A] border border-[#C9A84C]/20 rounded-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="p-4 border-b border-[#C9A84C]/20 flex items-center justify-between flex-shrink-0">
            <div className="text-sm font-bold text-[#F5F1E8] flex items-center gap-2"><User size={14} className="text-[#C9A84C]" /> Ficha de Qualificação</div>
            <button onClick={onClose} className="text-[#9BAFC5] hover:text-[#F5F1E8] text-xl">&times;</button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {state.loading && (
              <div className="flex items-center justify-center py-10"><Loader2 size={20} className="animate-spin text-[#C9A84C]" /></div>
            )}
            {!state.loading && state.error && (
              <p className="text-xs text-[#9BAFC5] bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-3">{state.error}</p>
            )}
            {!state.loading && state.data && (
              <PartyCardBody data={state.data} onPreview={setLightboxUrl} />
            )}
          </div>
        </div>
      </div>

      {lightboxUrl && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/85 p-6" onClick={() => setLightboxUrl(null)}>
          <button onClick={() => setLightboxUrl(null)} className="absolute top-4 right-4 text-[#F5F1E8] hover:text-[#C9A84C] transition-colors">
            <X size={24} />
          </button>
          <img src={lightboxUrl} alt="Documento" className="max-w-full max-h-full rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
