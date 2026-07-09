"use client";

import React, { useState } from "react";
import { FileText, Download, Shield, CheckCircle2, Loader2, Lock, Upload, UserCheck, ScrollText, Fingerprint, ExternalLink } from "lucide-react";
import { maskCpfInput, isValidEmail } from "@/lib/utils";

interface DealRoomViewerProps {
  token: string;
  initialData: any;
}

export function DealRoomViewer({ token, initialData }: DealRoomViewerProps) {
  const [data, setData] = useState(initialData);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");
  const [ndaEmail, setNdaEmail] = useState("");
  const [qualifying, setQualifying] = useState(false);
  const [qualifyForm, setQualifyForm] = useState({ buyer_name: "", buyer_company: "", buyer_cpf: "", buyer_email: "", notes: "" });
  const [qualifyFile, setQualifyFile] = useState<File | null>(null);
  const [acceptingMandato, setAcceptingMandato] = useState(false);
  const [acceptingCessao, setAcceptingCessao] = useState(false);
  const [cessaoHash, setCessaoHash] = useState<string | null>(initialData?.cessao?.hash ?? null);

  const acceptNda = async () => {
    if (!isValidEmail(ndaEmail)) {
      setError("Informe um email válido para receber a cópia do documento assinado.");
      return;
    }
    setAccepting(true);
    setError("");
    try {
      const res = await fetch(`/api/cm/deal-room/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept_nda", buyer_email: ndaEmail.trim() }),
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

  const refreshData = async () => {
    const res = await fetch(`/api/cm/deal-room/${token}`);
    const json = await res.json();
    setData(json);
  };

  const submitQualification = async () => {
    setQualifying(true);
    setError("");
    try {
      const fd = new FormData();
      if (qualifyFile) fd.append("proof_of_funds", qualifyFile);
      fd.append("buyer_name", qualifyForm.buyer_name);
      fd.append("buyer_company", qualifyForm.buyer_company);
      fd.append("buyer_cpf", qualifyForm.buyer_cpf);
      fd.append("buyer_email", qualifyForm.buyer_email);
      fd.append("notes", qualifyForm.notes);
      const res = await fetch(`/api/cm/deal-room/${token}/qualify`, { method: "POST", body: fd });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Erro ao enviar qualificação");
      }
      await refreshData();
    } catch (err: any) { setError(err.message); }
    finally { setQualifying(false); }
  };

  const acceptCessao = async () => {
    setAcceptingCessao(true);
    setError("");
    try {
      const res = await fetch(`/api/cm/deal-room/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept_cessao" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao aceitar cessão");
      setCessaoHash(json.cessao_hash);
      await refreshData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAcceptingCessao(false);
    }
  };

  const acceptMandato = async () => {
    setAcceptingMandato(true);
    setError("");
    try {
      const res = await fetch(`/api/cm/deal-room/${token}/mandato`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept_mandato" }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Erro ao aceitar mandato");
      }
      await refreshData();
    } catch (err: any) { setError(err.message); }
    finally { setAcceptingMandato(false); }
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

        {data.nda_document_html ? (
          <div
            className="bg-[#162744] border border-[#9BAFC5]/10 rounded-lg p-6 mb-6 text-left max-h-[350px] overflow-y-auto text-xs text-[#9BAFC5]/90 leading-relaxed [&_h2]:text-[#C9A84C] [&_h2]:font-bold [&_h2]:uppercase [&_h2]:text-[11px] [&_h2]:tracking-wide [&_h2]:mt-4 [&_h2]:mb-2 [&_p]:mb-3 [&_strong]:text-[#F5F1E8]"
            dangerouslySetInnerHTML={{ __html: data.nda_document_html }}
          />
        ) : (
          <div className="bg-[#162744] border border-[#9BAFC5]/10 rounded-lg p-6 mb-6 text-left max-h-[250px] overflow-y-auto text-xs text-[#9BAFC5]/80 leading-relaxed">
            <p className="mb-3">Pelo presente termo, declaro que manterei em sigilo absoluto todas as informações acessadas nesta sala de documentos, incluindo dados financeiros, jurídicos e operacionais do ativo identificado pelo código {data.listing?.anonymous_id}.</p>
            <p className="mb-3">Comprometo-me a não divulgar, compartilhar ou utilizar as informações para qualquer finalidade diferente da análise de viabilidade da operação de cessão/aquisição proposta pela V3 Partners Soluções Ltda (CNPJ 14.219.287/0001-50).</p>
            <p className="mb-3">O descumprimento deste termo sujeita o infrator às penalidades previstas em lei, incluindo indenização por perdas e danos.</p>
            <p>Os dados de acesso (IP, data, horário) serão registrados para fins de auditoria e compliance, conforme LGPD Art. 7, inc. V.</p>
          </div>
        )}
        {!data.nda_document_html && (
          <p className="text-[9px] text-[#9BAFC5]/50 mb-4 -mt-4">Modelo padrão exibido. Nenhuma minuta específica de Bolsa de Ativos ativa na Central de Contratos.</p>
        )}

        <div className="text-left mb-4">
          <input
            type="email"
            value={ndaEmail}
            onChange={(e) => setNdaEmail(e.target.value)}
            placeholder="Email * (para receber a cópia do NDA assinado)"
            className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-lg px-4 py-2.5 text-sm text-[#F5F1E8] placeholder:text-[#9BAFC5]/60 focus:border-[#C9A84C]/50 focus:outline-none"
          />
          {ndaEmail && !isValidEmail(ndaEmail) && (
            <p className="text-[10px] text-red-400 mt-1">Email inválido</p>
          )}
        </div>

        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

        <button
          onClick={acceptNda}
          disabled={accepting || !isValidEmail(ndaEmail)}
          className="px-8 py-3 bg-[#C9A84C] text-[#09081A] rounded-lg text-sm font-bold hover:bg-[#E8C97A] disabled:opacity-50 transition"
        >
          {accepting ? <Loader2 size={16} className="animate-spin inline mr-2" /> : <Lock size={16} className="inline mr-2" />}
          Aceitar NDA e Acessar Documentos
        </button>
      </div>
    );
  }

  const tier = data.access_tier ?? "nda_only";

  const listingSummary = (
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
      {tier === "full_dd" && data.listing?.seller_name && (
        <div className="mt-3 pt-3 border-t border-emerald-500/20 text-xs">
          <span className="text-emerald-400 font-bold">Cedente:</span> <span className="text-[#F5F1E8]">{data.listing.seller_name}</span>
          {data.listing.numero_processo && <> · Processo: <span className="text-[#F5F1E8]">{data.listing.numero_processo}</span></>}
        </div>
      )}
    </div>
  );

  const docsSection = (data.documents && data.documents.length > 0) ? (
    <div>
      <div className="text-[10px] text-[#C9A84C] font-bold uppercase tracking-wider mb-3">
        Documentos ({data.documents.length})
      </div>
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
              <a href={doc.download_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded-lg text-[#C9A84C] text-xs font-bold hover:bg-[#C9A84C]/20 transition">
                <Download size={14} /> Baixar
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        <div>
          <p className="text-sm text-[#F5F1E8] font-medium">NDA aceito{data.access?.buyer_name ? ` por ${data.access.buyer_name}` : ""}</p>
          <p className="text-[10px] text-[#9BAFC5]">
            {data.access?.nda_accepted_at ? new Date(data.access.nda_accepted_at).toLocaleString("pt-BR") : ""}
          </p>
        </div>
      </div>

      {/* Tier Badge */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(["nda_only", "qualified", "full_dd"] as const).map((t) => (
          <span key={t} className={`text-[9px] font-bold px-2 py-1 rounded ${
            t === tier ? "bg-[#C9A84C]/20 text-[#C9A84C]" : "bg-[#162744] text-[#9BAFC5]/50"
          }`}>
            {t === "nda_only" ? "1. NDA" : t === "qualified" ? "2. Qualificado" : "3. Due Diligence"}
          </span>
        ))}
        {tier === "full_dd" && (
          <span className={`text-[9px] font-bold px-2 py-1 rounded ${
            (cessaoHash ?? data.cessao?.hash) ? "bg-emerald-500/20 text-emerald-400" : "bg-[#162744] text-[#9BAFC5]/50"
          }`}>
            4. Cessão
          </span>
        )}
      </div>

      {listingSummary}

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {/* TIER 1: NDA Only — Manifestar Interesse */}
      {tier === "nda_only" && data.actions?.can_qualify && (
        <div className="bg-[#12112A] border border-[#C9A84C]/15 rounded-lg p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <UserCheck size={16} className="text-[#C9A84C]" />
            <h3 className="text-sm font-bold text-[#F5F1E8]">Manifestar Interesse</h3>
          </div>
          <p className="text-xs text-[#9BAFC5] mb-4">Para acessar os documentos completos, preencha sua identificacao e envie comprovante de capacidade financeira.</p>
          <div className="space-y-3">
            <input value={qualifyForm.buyer_name} onChange={(e) => setQualifyForm(p => ({ ...p, buyer_name: e.target.value }))}
              placeholder="Nome completo / Razao Social" className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded-lg px-4 py-2.5 text-sm text-[#F5F1E8] focus:border-[#C9A84C]/50 focus:outline-none" />
            <input value={qualifyForm.buyer_company} onChange={(e) => setQualifyForm(p => ({ ...p, buyer_company: e.target.value }))}
              placeholder="Empresa / Fundo" className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded-lg px-4 py-2.5 text-sm text-[#F5F1E8] focus:border-[#C9A84C]/50 focus:outline-none" />
            <div>
              <input type="email" value={qualifyForm.buyer_email} onChange={(e) => setQualifyForm(p => ({ ...p, buyer_email: e.target.value }))}
                placeholder="Email * (obrigatório para acessar documentos)" className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded-lg px-4 py-2.5 text-sm text-[#F5F1E8] focus:border-[#C9A84C]/50 focus:outline-none" />
              {qualifyForm.buyer_email && !isValidEmail(qualifyForm.buyer_email) && (
                <p className="text-[10px] text-red-400 mt-1">Email inválido</p>
              )}
            </div>
            <div>
              <input value={qualifyForm.buyer_cpf} onChange={(e) => setQualifyForm(p => ({ ...p, buyer_cpf: maskCpfInput(e.target.value) }))}
                placeholder="CPF * (obrigatório para acessar documentos)" className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded-lg px-4 py-2.5 text-sm text-[#F5F1E8] focus:border-[#C9A84C]/50 focus:outline-none" />
              <p className="text-[10px] text-[#9BAFC5]/70 mt-1">Todo documento visualizado nesta sala fica associado ao seu CPF, email e IP de acesso, para fins de auditoria (LGPD Art. 7, inc. V).</p>
            </div>
            <div>
              <label className="text-[10px] text-[#9BAFC5] uppercase">Prova de Fundos (PDF)</label>
              <label className="mt-1 w-full flex items-center gap-2 px-4 py-3 bg-[#162744] border border-[#9BAFC5]/15 rounded-lg text-[#9BAFC5] text-xs cursor-pointer hover:border-[#C9A84C]/30 transition">
                <Upload size={14} />
                {qualifyFile ? qualifyFile.name : "Selecionar arquivo"}
                <input type="file" className="hidden" accept=".pdf,.jpg,.png" onChange={(e) => setQualifyFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
            <textarea value={qualifyForm.notes} onChange={(e) => setQualifyForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Observacoes (opcional)" rows={2}
              className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded-lg px-4 py-2.5 text-sm text-[#F5F1E8] focus:border-[#C9A84C]/50 focus:outline-none resize-none" />
            <button onClick={submitQualification} disabled={qualifying || !qualifyForm.buyer_name || qualifyForm.buyer_cpf.replace(/\D/g, "").length < 11 || !isValidEmail(qualifyForm.buyer_email)}
              className="w-full px-6 py-3 bg-[#C9A84C] text-[#09081A] rounded-lg text-sm font-bold hover:bg-[#E8C97A] disabled:opacity-50 transition">
              {qualifying ? <Loader2 size={16} className="animate-spin inline mr-2" /> : null}
              Enviar Qualificacao
            </button>
          </div>
        </div>
      )}

      {tier === "nda_only" && data.qualification_status === "pendente" && !data.actions?.can_qualify && (
        <div className="bg-[#162744] border border-[#C9A84C]/20 rounded-lg p-5 mb-6 text-center">
          <Loader2 size={20} className="animate-spin text-[#C9A84C] mx-auto mb-2" />
          <p className="text-sm text-[#F5F1E8] font-medium">Qualificacao em analise</p>
          <p className="text-xs text-[#9BAFC5] mt-1">A equipe V3 Partners esta verificando seus dados. Voce sera notificado quando o acesso for liberado.</p>
        </div>
      )}

      {/* TIER 2: Qualified — Docs + Mandato V3 */}
      {tier === "qualified" && (
        <>
          {docsSection}
          {data.actions?.can_accept_mandato && (
            <div className="bg-[#12112A] border border-[#C9A84C]/15 rounded-lg p-5 mt-6">
              <div className="flex items-center gap-2 mb-4">
                <ScrollText size={16} className="text-[#C9A84C]" />
                <h3 className="text-sm font-bold text-[#F5F1E8]">Mandato V3 Partners</h3>
              </div>
              <div className="bg-[#162744] border border-[#9BAFC5]/10 rounded-lg p-4 mb-4 max-h-[200px] overflow-y-auto text-xs text-[#9BAFC5]/80 leading-relaxed">
                <p className="mb-2">Pelo presente instrumento, o interessado declara que toda negociacao referente ao ativo identificado pelo codigo {data.listing?.anonymous_id} sera conduzida exclusivamente por intermedio da V3 Partners Solucoes Ltda (CNPJ 14.219.287/0001-50).</p>
                <p className="mb-2">O mandato tem vigencia de 12 (doze) meses a partir da data de aceite. A intermediacao abrange ativos similares ofertados pelo mesmo cedente.</p>
                <p>O descumprimento deste mandato sujeita o infrator a multa contratual equivalente a comissao de intermediacao que seria devida a V3 Partners, acrescida de perdas e danos.</p>
              </div>
              <button onClick={acceptMandato} disabled={acceptingMandato}
                className="w-full px-6 py-3 bg-[#C9A84C] text-[#09081A] rounded-lg text-sm font-bold hover:bg-[#E8C97A] disabled:opacity-50 transition">
                {acceptingMandato ? <Loader2 size={16} className="animate-spin inline mr-2" /> : <ScrollText size={16} className="inline mr-2" />}
                Aceitar Mandato V3 e Acessar Due Diligence
              </button>
            </div>
          )}
        </>
      )}

      {/* TIER 3: Full DD — Tudo liberado */}
      {tier === "full_dd" && (
        <>
          {data.mandato_v3_accepted && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span className="text-xs text-emerald-400 font-medium">Mandato V3 aceito em {data.access?.mandato_v3_accepted_at ? new Date(data.access.mandato_v3_accepted_at).toLocaleString("pt-BR") : ""}</span>
            </div>
          )}
          {docsSection}
          {!docsSection && (
            <div className="text-center py-12 text-[#9BAFC5] text-sm">
              Nenhum documento disponivel nesta sala.
            </div>
          )}

          {/* TIER 4: Cessão — aceite do contrato + âncora blockchain */}
          {data.actions?.can_accept_cessao && !(cessaoHash ?? data.cessao?.hash) && (
            <div className="bg-[#12112A] border border-[#C9A84C]/15 rounded-lg p-5 mt-6">
              <div className="flex items-center gap-2 mb-4">
                <Fingerprint size={16} className="text-[#C9A84C]" />
                <h3 className="text-sm font-bold text-[#F5F1E8]">Aceite do Contrato de Cessão</h3>
              </div>
              <div className="bg-[#162744] border border-[#9BAFC5]/10 rounded-lg p-4 mb-4 max-h-[200px] overflow-y-auto text-xs text-[#9BAFC5]/80 leading-relaxed">
                <p className="mb-2">Pelo presente instrumento, declaro minha intenção formal de adquirir o ativo identificado pelo código <span className="text-[#C9A84C] font-bold">{data.listing?.anonymous_id}</span>, nos termos negociados com a V3 Partners Soluções Ltda (CNPJ 14.219.287/0001-50).</p>
                <p className="mb-2">Este aceite gera um registro criptográfico (SHA-256) que será ancorado na blockchain Bitcoin via OpenTimestamps, garantindo prova imutável de existência e timestamp desta declaração de intenção.</p>
                <p>O aceite não constitui obrigação de compra, mas registra formalmente o interesse e o momento do aceite para fins de compliance e auditoria. Os dados de acesso serão registrados conforme LGPD Art. 7, inc. V.</p>
              </div>
              <button
                onClick={acceptCessao}
                disabled={acceptingCessao}
                className="w-full px-6 py-3 bg-[#C9A84C] text-[#09081A] rounded-lg text-sm font-bold hover:bg-[#E8C97A] disabled:opacity-50 transition"
              >
                {acceptingCessao
                  ? <Loader2 size={16} className="animate-spin inline mr-2" />
                  : <Fingerprint size={16} className="inline mr-2" />}
                Assinar Digitalmente e Ancorар na Blockchain
              </button>
            </div>
          )}

          {/* Prova de aceite da cessão */}
          {(cessaoHash ?? data.cessao?.hash) && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-5 mt-6">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <h3 className="text-sm font-bold text-emerald-400">Cessão Aceita: Prova Criptográfica</h3>
              </div>
              {data.cessao?.accepted_at && (
                <p className="text-xs text-[#9BAFC5] mb-3">
                  Aceito em {new Date(data.cessao.accepted_at).toLocaleString("pt-BR")}
                </p>
              )}
              <div className="bg-[#09081A] border border-emerald-500/15 rounded p-3 mb-3">
                <div className="text-[9px] text-[#9BAFC5] uppercase font-bold mb-1">Hash SHA-256</div>
                <div className="font-mono text-[10px] text-emerald-400 break-all">
                  {cessaoHash ?? data.cessao?.hash}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {data.cessao?.ots_proof_path ? (
                  <div className="flex items-center gap-2 text-xs text-emerald-400">
                    <CheckCircle2 size={12} />
                    <span>Ancorado na blockchain Bitcoin</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-[#9BAFC5]">
                    <Loader2 size={12} className="animate-spin" />
                    <span>Ancoragem Bitcoin em andamento (~10 min)</span>
                  </div>
                )}
                <a
                  href="https://opentimestamps.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto flex items-center gap-1 text-[10px] text-[#9BAFC5]/60 hover:text-[#9BAFC5] transition"
                >
                  <ExternalLink size={10} /> OpenTimestamps
                </a>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
