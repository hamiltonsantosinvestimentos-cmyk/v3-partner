"use client";

import React, { useCallback, useEffect, useState } from "react";
import { FilePlus2, Loader2, Plus, X, CheckCircle2, Clock } from "lucide-react";
import { isValidEmail } from "@/lib/utils";
import { PhoneIntlInput } from "@/components/ui/phone-intl-input";
import { normalizePhone, whatsappDigits } from "@/lib/phone";
import { PartyQualificationCardModal } from "./party-qualification-card";

// Termo de Adesão ao NCNDA Mestre (BRIEF 06/10/2026). Seção "Adesões deste contrato" e botão
// "Adicionar adesão" no painel de um contrato ASSINADO. A elegibilidade vem do servidor
// (GET /api/contracts/[id]/adhesions); o contrato de origem nunca é alterado por esta seção.

interface AdhesionData {
  eligible: boolean;
  reason: string | null;
  template: { id: string; template_name: string; approval_status: string } | null;
  children: { id: string; contract_code: string; status_signature: string; created_at: string; aderentes: string[] }[];
  pending_batches: { id: string; status: string; created_at: string; parties: { id: string; name: string; status: string; phone: string | null; token: string | null }[] }[];
}

interface Aderente { name: string; email: string; phone: string }

const APP_ORIGIN = "https://app.v3partners.com.br";

// Link de WhatsApp com o convite de qualificação. Com número, abre direto na conversa; sem número, cai no seletor de contato do WhatsApp.
function whatsappInviteLink(name: string, phone: string | null, token: string, contractCode: string | null): string {
  const msg = `Olá ${name}, você foi convidado(a) a aderir ao contrato ${contractCode ?? ""} da V3 Partners. Complete seus dados de qualificação para prosseguirmos: ${APP_ORIGIN}/intake/qualificacao/${token}`;
  const digits = whatsappDigits(phone);
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
}

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  enviado_assinatura: "Enviado para assinatura",
  assinado: "Assinado",
  cancelado: "Cancelado",
};

const MAX_ADERENTES = 10;

export function AdhesionSection({ contractId, contractCode, onGenerated }: { contractId: string; contractCode: string | null; onGenerated: () => void }) {
  const [data, setData] = useState<AdhesionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [aderentes, setAderentes] = useState<Aderente[]>([{ name: "", email: "", phone: "" }]);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [invites, setInvites] = useState<{ name: string; phone: string | null; token: string }[]>([]);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [openPartyId, setOpenPartyId] = useState<string | null>(null);
  const [generatingBatch, setGeneratingBatch] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/contracts/${contractId}/adhesions`);
      setData(res.ok ? await res.json() : null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return null;
  // Sem permissão ou contrato que não aceita adesão e sem histórico: a seção não aparece.
  if (!data || (!data.eligible && data.children.length === 0 && data.pending_batches.length === 0)) return null;

  const openModal = () => {
    setAderentes([{ name: "", email: "", phone: "" }]);
    setReason("");
    setError(null);
    setShowModal(true);
  };

  const submit = async () => {
    setError(null);
    if (reason.trim().length < 5) { setError("Motivo obrigatório: mínimo 5 caracteres."); return; }
    const cleaned = aderentes.map((a) => ({ name: a.name.trim(), email: a.email.trim(), phone: a.phone.trim() }));
    if (cleaned.some((a) => a.name.split(/\s+/).filter(Boolean).length < 2)) { setError("Informe nome e sobrenome de cada aderente."); return; }
    if (cleaned.some((a) => !isValidEmail(a.email))) { setError("Informe um e-mail válido para cada aderente."); return; }
    if (new Set(cleaned.map((a) => a.email.toLowerCase())).size !== cleaned.length) { setError("Há e-mail repetido entre os aderentes."); return; }
    const badPhone = cleaned.find((a) => a.phone && !normalizePhone(a.phone).ok);
    if (badPhone) { setError(`${badPhone.name}: WhatsApp inválido. Confira o DDI e o número.`); return; }
    if (!data.template) { setError("O Termo de Adesão ainda não existe para esta vertical."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/cm/qualifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: data.template.id,
          parent_contract_id: contractId,
          document_type: "ncnda_ma",
          adhesion_reason: reason.trim(),
          parties: cleaned.map((a) => ({ full_name: a.name, email: a.email, phone: a.phone || undefined, role_in_document: "partner" })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? "Erro ao criar a adesão."); return; }
      setShowModal(false);
      setInvites(((json.qualifications ?? []) as { full_name: string; phone: string | null; qualification_token: string }[]).map((q) => ({ name: q.full_name, phone: q.phone, token: q.qualification_token })));
      setDone(`${cleaned.length} aderente(s) receberam o link de qualificação por e-mail. Se quiser, envie também por WhatsApp. Quando todos preencherem, gere o Termo aqui.`);
      await load();
    } catch {
      setError("Erro de conexão.");
    } finally {
      setSaving(false);
    }
  };

  const generateTermo = async (batchId: string) => {
    if (!data.template) return;
    setGenerateError(null);
    setGeneratingBatch(batchId);
    try {
      const res = await fetch("/api/contracts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: data.template.id, parent_contract_id: contractId, qualification_batch_id: batchId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setGenerateError(json.error ?? "Erro ao gerar o Termo."); return; }
      setDone(`Termo ${json.contract?.contract_code ?? ""} gerado em rascunho. Ele aparece na lista de contratos para conferência e envio.`);
      await load();
      onGenerated();
    } catch {
      setGenerateError("Erro de conexão.");
    } finally {
      setGeneratingBatch(null);
    }
  };

  const templateApproved = data.template?.approval_status === "aprovado";
  const empty = data.children.length === 0 && data.pending_batches.length === 0;

  return (
    <div className="mt-4 border border-[#9BAFC5]/15 rounded-lg p-3 bg-[#162744]/40">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-[11px] font-bold text-[#E8C97A] uppercase tracking-wider">Adesões deste contrato</div>
        {data.eligible && (
          <button
            onClick={openModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#C9A84C]/20 text-[#C9A84C] rounded-lg text-xs font-bold hover:bg-[#C9A84C]/30 transition"
          >
            <FilePlus2 size={13} /> Adicionar adesão
          </button>
        )}
      </div>

      {done && <p className="text-[11px] text-emerald-400 mt-2 flex items-start gap-1.5"><CheckCircle2 size={12} className="mt-0.5 shrink-0" /> {done}</p>}
      {invites.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {invites.map((inv) => (
            <div key={inv.token} className="flex items-center justify-between gap-2 flex-wrap text-xs">
              <span className="text-[#F5F1E8]">{inv.name}</span>
              <span className="flex items-center gap-2">
                <a href={whatsappInviteLink(inv.name, inv.phone, inv.token, contractCode)} target="_blank" rel="noreferrer"
                  className="px-2.5 py-1 bg-[#25D366]/15 text-[#4ADE80] border border-[#4ADE80]/30 rounded-lg font-bold hover:bg-[#25D366]/25 transition">Enviar por WhatsApp</a>
                <button onClick={() => { navigator.clipboard?.writeText(`${APP_ORIGIN}/intake/qualificacao/${inv.token}`); setCopiedToken(inv.token); }}
                  className="px-2.5 py-1 bg-[#162744] text-[#9BAFC5] rounded-lg font-bold hover:text-[#F5F1E8] transition">{copiedToken === inv.token ? "Copiado" : "Copiar link"}</button>
              </span>
            </div>
          ))}
        </div>
      )}
      {generateError && <p className="text-[11px] text-red-400 mt-2">{generateError}</p>}
      {data.eligible && !templateApproved && (
        <p className="text-[11px] text-[#9BAFC5] mt-2">
          O texto do Termo ainda não foi aprovado pelos sócios. Você já pode convidar os aderentes; a geração do Termo libera depois da aprovação.
        </p>
      )}

      {empty && <p className="text-xs text-[#9BAFC5] mt-2">Nenhuma adesão ainda.</p>}

      {data.pending_batches.map((b) => {
        const complete = b.status === "completo";
        return (
          <div key={b.id} className="mt-2 flex items-center justify-between gap-2 flex-wrap text-xs">
            <div className="text-[#F5F1E8]">
              <span className="text-[#9BAFC5] flex items-center gap-1"><Clock size={11} /> Aguardando Termo</span>
              {b.parties.map((p, i) => (
                <React.Fragment key={p.id}>
                  {i > 0 && ", "}
                  <button onClick={() => setOpenPartyId(p.id)} title="Ver ficha e documentos" className="hover:text-[#C9A84C] hover:underline transition-colors">{p.name}</button>
                </React.Fragment>
              ))}
              <span className="text-[#9BAFC5]"> ({complete ? "qualificação completa" : "aguardando preenchimento"})</span>
            </div>
            {!complete && b.parties.filter((p) => p.token && p.status !== "preenchido").map((p) => (
              <a key={p.token} href={whatsappInviteLink(p.name, p.phone, p.token!, contractCode)} target="_blank" rel="noreferrer"
                className="px-2.5 py-1 bg-[#25D366]/15 text-[#4ADE80] border border-[#4ADE80]/30 rounded-lg text-[11px] font-bold hover:bg-[#25D366]/25 transition">
                WhatsApp: {p.name.split(" ")[0]}
              </a>
            ))}
            {complete && (
              <button
                onClick={() => generateTermo(b.id)}
                disabled={!templateApproved || generatingBatch === b.id}
                title={templateApproved ? "" : "Minuta do Termo ainda não aprovada pelos sócios"}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#C9A84C]/20 text-[#C9A84C] rounded-lg text-xs font-bold hover:bg-[#C9A84C]/30 transition disabled:opacity-50"
              >
                {generatingBatch === b.id && <Loader2 size={12} className="animate-spin" />} Gerar Termo
              </button>
            )}
          </div>
        );
      })}

      {data.children.map((c) => (
        <div key={c.id} className="mt-2 text-xs text-[#F5F1E8]">
          <span className="font-bold">{c.contract_code}</span>{" "}
          <span className="text-[#9BAFC5]">({STATUS_LABEL[c.status_signature] ?? c.status_signature})</span>
          {c.aderentes.length > 0 && <span className="text-[#9BAFC5]">: {c.aderentes.join(", ")}</span>}
        </div>
      ))}

      <PartyQualificationCardModal qualificationId={openPartyId} onClose={() => setOpenPartyId(null)} />

      {showModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4">
          {/* Não fecha clicando fora: só pelos botões. */}
          <div className="w-full max-w-lg bg-[#09081A] border border-[#C9A84C]/30 rounded-xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-[#9BAFC5]/15 flex items-center justify-between">
              <div className="text-sm font-bold text-[#F5F1E8] flex items-center gap-2"><FilePlus2 size={14} /> Adicionar adesão</div>
              <button onClick={() => setShowModal(false)} disabled={saving} className="text-[#9BAFC5] hover:text-[#F5F1E8] text-xl">&times;</button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-[#9BAFC5] leading-relaxed">
                Contrato de origem: <span className="text-[#F5F1E8] font-bold">{contractCode ?? contractId}</span>. Ele não será alterado. Cada aderente recebe um link por e-mail para preencher a qualificação. Com o WhatsApp, você também pode enviar o convite por lá.
              </p>
              {aderentes.map((a, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                  <div>
                    <label className="block text-[10px] font-bold text-[#E8C97A] uppercase tracking-wider mb-1">Nome completo *</label>
                    <input value={a.name} onChange={(e) => setAderentes((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                      className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded-lg px-3 py-2 text-sm text-[#F5F1E8]" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#E8C97A] uppercase tracking-wider mb-1">E-mail *</label>
                    <input type="email" inputMode="email" value={a.email} onChange={(e) => setAderentes((prev) => prev.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))}
                      className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded-lg px-3 py-2 text-sm text-[#F5F1E8]" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-[#E8C97A] uppercase tracking-wider mb-1">WhatsApp (opcional)</label>
                    <PhoneIntlInput value={a.phone} onChange={(v) => setAderentes((prev) => prev.map((x, j) => (j === i ? { ...x, phone: v } : x)))}
                      placeholder="Fora do Brasil use +DDI"
                      className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded-lg px-3 py-2 text-sm text-[#F5F1E8]" />
                  </div>
                  {aderentes.length > 1 && (
                    <button onClick={() => setAderentes((prev) => prev.filter((_, j) => j !== i))} aria-label="Remover aderente"
                      className="px-2 py-2 text-[#9BAFC5] hover:text-red-300"><X size={14} /></button>
                  )}
                </div>
              ))}
              {aderentes.length < MAX_ADERENTES && (
                <button onClick={() => setAderentes((prev) => [...prev, { name: "", email: "", phone: "" }])}
                  className="flex items-center gap-1.5 text-xs font-bold text-[#C9A84C] hover:text-[#E8C97A]"><Plus size={12} /> Adicionar outro aderente</button>
              )}
              <div>
                <label className="block text-[10px] font-bold text-[#E8C97A] uppercase tracking-wider mb-1">Motivo *</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: entrada de novos parceiros na operação"
                  className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded-lg px-3 py-2 text-sm text-[#F5F1E8] min-h-[60px] resize-y" />
              </div>
              {error && <p className="text-[11px] text-red-400">{error}</p>}
              <div className="flex gap-2">
                <button onClick={() => setShowModal(false)} disabled={saving}
                  className="flex-1 px-3 py-2 bg-[#162744] text-[#F5F1E8] rounded-lg text-xs font-bold hover:bg-[#243A66] transition">Voltar</button>
                <button onClick={submit} disabled={saving}
                  className="flex-1 px-3 py-2 bg-[#C9A84C]/20 text-[#C9A84C] border border-[#C9A84C]/40 rounded-lg text-xs font-bold hover:bg-[#C9A84C]/30 transition disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving && <Loader2 size={13} className="animate-spin" />} Enviar convites
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
