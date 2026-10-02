"use client";

// Ficha de Qualificação (04/09/2026, extraído de contracts-panel-client.tsx
// em 11/09/2026 para ser reaproveitado também em Minutas e no painel da
// Bolsa de Ativos -- pedido de João: "coloque disponível a possibilidade
// de nós clicarmos em cima do link e já abrir o card de qualificação",
// sem esperar o contrato ser gerado). Card com toda a ficha civil coletada
// + documentos de KYC + IP de quem preencheu/enviou (compliance, pedido de
// Robson Lino, mesmo bloco).
import { formatPhoneIntl } from "@/lib/phone";
import { useState, useEffect } from "react";
import { User, Loader2, FileText, Download, X, Eye, EyeOff } from "lucide-react";
import { PARTY_NATURE_LABELS, REPRESENTATIVE_TYPE_LABELS, formatDocumentNumber, type PartyNature } from "@/lib/legal-qualification";
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
        <p className="text-[12px] text-[#E8C97A] font-bold uppercase">{KYC_DOCUMENT_KIND_LABELS[doc.document_kind as keyof typeof KYC_DOCUMENT_KIND_LABELS] ?? doc.document_kind}</p>
        <p className="text-[10px] text-[#9BAFC5] truncate">
          {doc.original_filename ?? "arquivo"} · enviado {new Date(doc.uploaded_at).toLocaleDateString("pt-BR")} · válido até {new Date(doc.valid_until).toLocaleDateString("pt-BR")}
        </p>
        {doc.uploaded_ip && <p className="text-[9px] text-[#9BAFC5]/70">IP de envio: {doc.uploaded_ip}</p>}
      </div>
      {doc.download_url ? (
        <a href={doc.download_url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-[12px] font-semibold text-[#E8C97A] px-2 py-1 rounded border border-[#C9A84C]/40 bg-[#C9A84C]/10 hover:bg-[#C9A84C]/20 transition-colors flex-shrink-0">
          <Download size={10} /> Baixar
        </a>
      ) : null}
    </div>
  );
}

// Revelação de dado sensível (BRIEF 5.12): o valor real só sai por POST .../reveal, que grava o log
// antes de devolver o dado. O valor em claro vive só neste estado; ocultar, fechar a ficha ou trocar
// de qualificação volta a mascarar (o componente é remontado por key).
function SensitiveValue({ qualificationId, field, masked, label, format, onRevealed }: {
  qualificationId: string; field: string; masked: string; label: string;
  format?: (v: any) => string; onRevealed: () => void;
}) {
  const [value, setValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reveal() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cm/qualifications/party/${qualificationId}/reveal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? "Não foi possível registrar o acesso, tente novamente"); return; }
      setValue(format ? format(json.value) : String(json.value));
      onRevealed();
    } catch {
      setError("Não foi possível registrar o acesso, tente novamente");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span>{value ?? masked}</span>
      <button
        type="button"
        onClick={() => (value ? setValue(null) : reveal())}
        disabled={loading}
        aria-label={value ? `Ocultar ${label}` : `Revelar ${label} (será registrado)`}
        title={value ? "Ocultar" : "Revelar (será registrado)"}
        className="text-[#E8C97A] hover:text-[#F5F1E8] transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : value ? <EyeOff size={12} /> : <Eye size={12} />}
      </button>
      {error && <span className="basis-full text-[12px] text-[#E24B4A]">{error}</span>}
    </span>
  );
}

const formatBankData = (b: any) => `${b?.banco ?? ""} · Ag. ${b?.agencia ?? ""} · Conta ${b?.conta ?? ""}${b?.tipo_conta ? ` (${b.tipo_conta})` : ""}`;

// Lista de acessos a dados sensíveis (BRIEF 5.12 C): quem revelou, qual campo, quando. IP mascarado.
// Só o ADMIN vê as caixas de seleção e o botão de apagar (eliminação a pedido do titular, 5.12 D):
// modal vermelho V3 com motivo obrigatório, que nunca fecha ao clicar fora.
function AccessLog({ qualificationId, refreshKey }: { qualificationId: string; refreshKey: number }) {
  const [items, setItems] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [canErase, setCanErase] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, { source: string; id: string }>>({});
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [erasing, setErasing] = useState(false);
  const [eraseError, setEraseError] = useState<string | null>(null);

  async function load(offset: number) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cm/qualifications/party/${qualificationId}/access-log?offset=${offset}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? "Não foi possível carregar os acessos"); return; }
      setItems((prev) => (offset === 0 ? json.items : [...prev, ...json.items]));
      setHasMore(!!json.has_more);
      setCanErase(!!json.can_erase);
    } catch {
      setError("Não foi possível carregar os acessos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(0); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [qualificationId, refreshKey]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const selectedList = Object.values(selected);

  function toggle(it: any) {
    const key = `${it.source}:${it.id}`;
    setSelected((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key]; else next[key] = { source: it.source, id: it.id };
      return next;
    });
  }

  async function confirmErase() {
    setErasing(true);
    setEraseError(null);
    try {
      for (const source of ["field_views", "document_views"]) {
        const ids = selectedList.filter((s) => s.source === source).map((s) => s.id);
        if (!ids.length) continue;
        const res = await fetch(`/api/cm/qualifications/party/${qualificationId}/access-log/erase`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source, ids, reason }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) { setEraseError(json.error ?? "Não foi possível apagar os registros"); return; }
      }
      setConfirming(false);
      setReason("");
      setSelected({});
      await load(0);
    } catch {
      setEraseError("Não foi possível apagar os registros");
    } finally {
      setErasing(false);
    }
  }

  return (
    <div className="pt-2 border-t border-[#9BAFC5]/10 space-y-1.5">
      <p className="text-[12px] font-bold text-[#E8C97A] uppercase">Acessos a dados sensíveis</p>
      {loading && items.length === 0 && <Loader2 size={14} className="animate-spin text-[#C9A84C]" />}
      {error && <p className="text-[12px] text-[#E24B4A]">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className="text-[12px] text-[#9BAFC5]">Nenhum dado sensível foi revelado ainda.</p>
      )}
      {items.map((it) => (
        <label key={`${it.source}:${it.id}`} className="flex items-start gap-2 text-[12px] text-[#9BAFC5]">
          {canErase && (
            <input type="checkbox" className="mt-0.5" checked={!!selected[`${it.source}:${it.id}`]} onChange={() => toggle(it)}
              aria-label={`Selecionar acesso: ${it.field_label}`} />
          )}
          <span>
            <span className="text-[#F5F1E8]">{it.field_label}</span> · {it.viewed_by_name} · {fmt(it.viewed_at)} · IP {it.ip_masked}
          </span>
        </label>
      ))}
      {hasMore && (
        <button type="button" onClick={() => load(items.length)} disabled={loading}
          className="text-[12px] font-semibold text-[#E8C97A] hover:text-[#F5F1E8] disabled:opacity-50">
          Ver mais
        </button>
      )}
      {canErase && (
        <div className="pt-1">
          <button type="button" disabled={selectedList.length === 0} onClick={() => { setEraseError(null); setConfirming(true); }}
            title={selectedList.length === 0 ? "Nenhum registro para apagar" : undefined}
            className="text-[12px] font-semibold text-[#E24B4A] border border-[#E24B4A]/50 rounded px-2 py-1 disabled:opacity-40 disabled:cursor-not-allowed">
            Apagar registros selecionados{selectedList.length ? ` (${selectedList.length})` : ""}
          </button>
          {selectedList.length === 0 && items.length > 0 && (
            <span className="ml-2 text-[12px] text-[#9BAFC5]">Marque os registros que deseja apagar.</span>
          )}
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/75 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="erase-title"
            className="w-full max-w-md bg-[#09081A] border border-[#E24B4A]/60 rounded-xl p-4 space-y-3">
            <p id="erase-title" className="text-sm font-bold text-[#E24B4A]">Apagar registros de acesso</p>
            <p className="text-[12px] text-[#F5F1E8]">
              Esta ação apaga definitivamente {selectedList.length} registro(s) de acesso e não pode ser desfeita.
              O apagamento fica registrado com quem o fez, quando e o motivo, sem nenhum dado do titular.
            </p>
            <label className="block text-[12px] text-[#9BAFC5]">
              Motivo (obrigatório, mínimo de 10 caracteres)
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                className="mt-1 w-full bg-[#12112A] border border-[#9BAFC5]/20 rounded p-2 text-[12px] text-[#F5F1E8]" />
            </label>
            {eraseError && <p className="text-[12px] text-[#E24B4A]">{eraseError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirming(false)} disabled={erasing}
                className="text-[12px] font-semibold text-[#F5F1E8] border border-[#9BAFC5]/30 rounded px-3 py-1.5 disabled:opacity-50">
                Cancelar
              </button>
              <button type="button" onClick={confirmErase} disabled={erasing || reason.trim().length < 10}
                className="text-[12px] font-semibold text-[#F5F1E8] bg-[#E24B4A] rounded px-3 py-1.5 disabled:opacity-50">
                {erasing ? "Apagando..." : "Apagar registros"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PartyCardBody({ data, onPreview }: { data: any; onPreview: (url: string) => void }) {
  const q = data.qualification;
  const [accessBump, setAccessBump] = useState(0);
  const onRevealed = () => setAccessBump((n) => n + 1);
  const canReveal = (f: string) => Array.isArray(q.revealable) && q.revealable.includes(f);

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
        <p className="text-[11px] text-[#9BAFC5]">{q.email}{q.phone ? ` · ${formatPhoneIntl(q.phone)}` : ""}</p>
        <span className="inline-block mt-1 text-[12px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#C9A84C]/15 text-[#E8C97A] border border-[#C9A84C]/30">
          {ROLE_LABELS[q.role_in_document] ?? q.role_in_document} · {natureLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        {q.cpf_cnpj_masked && <div><span className="text-[#9BAFC5]">{canReveal("cpf_cnpj") ? "CPF" : "CPF/CNPJ"}</span><p className="text-[#F5F1E8]">
          {canReveal("cpf_cnpj")
            ? <SensitiveValue qualificationId={q.id} field="cpf_cnpj" masked={q.cpf_cnpj_masked} label="CPF" format={(v) => formatDocumentNumber(v) ?? v} onRevealed={onRevealed} />
            : q.cpf_cnpj_masked}
        </p></div>}
        {q.rg_masked && <div><span className="text-[#9BAFC5]">RG</span><p className="text-[#F5F1E8]">
          {canReveal("rg")
            ? <SensitiveValue qualificationId={q.id} field="rg" masked={q.rg_masked} label="identidade" onRevealed={onRevealed} />
            : q.rg_masked}
        </p></div>}
        {q.id_number_masked && <div><span className="text-[#9BAFC5]">Nº da identidade</span><p className="text-[#F5F1E8]">
          {canReveal("id_number")
            ? <SensitiveValue qualificationId={q.id} field="id_number" masked={q.id_number_masked} label="número da identidade" onRevealed={onRevealed} />
            : q.id_number_masked}
        </p></div>}
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
          <p className="text-[12px] font-bold text-[#E8C97A] uppercase">Empresa</p>
          <div className="text-[11px]"><span className="text-[#9BAFC5]">Razão Social</span><p className="text-[#F5F1E8]">{q.company_name}</p></div>
          <div className="text-[11px]"><span className="text-[#9BAFC5]">CNPJ</span><p className="text-[#F5F1E8]">{formatDocumentNumber(q.company_cnpj) ?? q.company_cnpj}</p></div>
          {q.company_address && <div className="text-[11px]"><span className="text-[#9BAFC5]">Endereço da Sede</span><p className="text-[#F5F1E8]">{q.company_address}</p></div>}
        </div>
      )}

      {(q.dados_bancarios || q.pix_key) && (
        <div className="pt-2 border-t border-[#9BAFC5]/10 space-y-1.5">
          <p className="text-[12px] font-bold text-[#E8C97A] uppercase">Dados para Repasse</p>
          {q.pix_key_masked && <div className="text-[11px]"><span className="text-[#9BAFC5]">Chave PIX</span><p className="text-[#F5F1E8]">
            {canReveal("pix_key")
              ? <SensitiveValue qualificationId={q.id} field="pix_key" masked={q.pix_key_masked} label="chave PIX" onRevealed={onRevealed} />
              : q.pix_key_masked}
          </p></div>}
          {q.dados_bancarios?.banco && (
            <p className="text-[11px] text-[#F5F1E8]">
              {canReveal("dados_bancarios")
                ? <SensitiveValue qualificationId={q.id} field="dados_bancarios" masked={formatBankData(q.dados_bancarios)} label="dados bancários" format={formatBankData} onRevealed={onRevealed} />
                : formatBankData(q.dados_bancarios)}
            </p>
          )}
        </div>
      )}

      {data.documents?.length > 0 && (
        <div className="pt-2 border-t border-[#9BAFC5]/10 space-y-1.5">
          <p className="text-[12px] font-bold text-[#E8C97A] uppercase">Documentos KYC</p>
          {data.documents.map((doc: any, i: number) => <DocumentRow key={i} doc={doc} onPreview={onPreview} />)}
        </div>
      )}

      {data.representation_chain?.length > 0 && (
        <div className="pt-2 border-t border-[#9BAFC5]/10 space-y-2">
          <p className="text-[12px] font-bold text-[#E8C97A] uppercase">Cadeia de Representação</p>
          {data.representation_chain.map((rep: any, i: number) => (
            <div key={i} className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-2.5 space-y-1" style={{ marginLeft: rep.depth * 12 }}>
              <p className="text-[12px] text-[#E8C97A] font-bold uppercase">{REPRESENTATIVE_TYPE_LABELS[rep.representative_type as keyof typeof REPRESENTATIVE_TYPE_LABELS] ?? rep.representative_type}</p>
              <p className="text-xs text-[#F5F1E8] font-medium">{rep.party_nature === "PJ" ? rep.company_name : rep.full_name}</p>
              {rep.party_nature === "PJ" ? (
                <p className="text-[12px] text-[#9BAFC5]">{formatDocumentNumber(rep.company_cnpj) ?? rep.company_cnpj}</p>
              ) : (
                <>
                  {rep.cpf_cnpj_masked && (() => {
                    const f = (rep.revealable ?? []).find((x: string) => x.endsWith(".cpf_cnpj"));
                    return (
                      <p className="text-[12px] text-[#9BAFC5]">CPF{" "}
                        {f ? <SensitiveValue qualificationId={q.id} field={f} masked={rep.cpf_cnpj_masked} label="CPF do representante" format={(v) => formatDocumentNumber(v) ?? v} onRevealed={onRevealed} /> : rep.cpf_cnpj_masked}
                      </p>
                    );
                  })()}
                  {rep.rg_masked && (() => {
                    const f = (rep.revealable ?? []).find((x: string) => x.endsWith(".rg"));
                    return (
                      <p className="text-[12px] text-[#9BAFC5]">Identidade{" "}
                        {f ? <SensitiveValue qualificationId={q.id} field={f} masked={rep.rg_masked} label="identidade do representante" onRevealed={onRevealed} /> : rep.rg_masked}
                      </p>
                    );
                  })()}
                  {rep.id_number_masked && (() => {
                    const f = (rep.revealable ?? []).find((x: string) => x.endsWith(".id_number"));
                    return (
                      <p className="text-[12px] text-[#9BAFC5]">Nº da identidade{" "}
                        {f ? <SensitiveValue qualificationId={q.id} field={f} masked={rep.id_number_masked} label="número da identidade do representante" onRevealed={onRevealed} /> : rep.id_number_masked}
                      </p>
                    );
                  })()}
                </>
              )}
              {rep.documents?.length > 0 && (
                <div className="pt-1 space-y-1">
                  {rep.documents.map((doc: any, j: number) => <DocumentRow key={j} doc={doc} onPreview={onPreview} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AccessLog qualificationId={q.id} refreshKey={accessBump} />

      <p className="text-[12px] text-[#9BAFC5]/70 pt-2 border-t border-[#9BAFC5]/10 space-y-0.5">
        <span className="block">Preenchido em {q.filled_at ? new Date(q.filled_at).toLocaleString("pt-BR") : "-"}{q.filled_ip ? ` a partir do IP ${q.filled_ip}` : ""}.</span>
        <span className="block">Abertura desta ficha e download de documentos ficam registrados na trilha de auditoria de KYC. Cada revelação de CPF, identidade e dados de repasse é registrada com quem acessou, o campo e a data.</span>
        <span className="block">Por regra de compliance, seu IP é armazenado por 36 meses como prova de que você teve acesso a dados sensíveis das partes.</span>
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
              <PartyCardBody key={qualificationId} data={state.data} onPreview={setLightboxUrl} />
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
