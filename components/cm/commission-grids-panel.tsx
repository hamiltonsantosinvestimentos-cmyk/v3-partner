"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Copy, Loader2, Lock, RotateCcw, Send } from "lucide-react";
import { PhoneIntlInput } from "@/components/ui/phone-intl-input";
import { whatsappDigits } from "@/lib/phone";
import { commissionLink } from "@/lib/commission-grid";

// Aba "Grade de Comissão" da Central de Contratos (BRIEF 06/10/2026). ADMIN e GESTAO.
// Três grupos em ordem fixa (venda, compra, assessoria). Mostra só nomes e percentuais, nunca documento.

interface Grid {
  id: string;
  token: string;
  status: "pendente" | "enviado" | "substituido";
  representative_name: string | null;
  representative_phone: string | null;
  submitted_by_name: string | null;
  submitted_at: string | null;
  token_expires_at: string;
  reopened_count: number;
  participants: { qualification_id: string; name: string; fixed_percent?: number }[];
  allocations: { qualification_id: string; percent: number }[] | null;
  fixed_allocations: { label: string; percent: number }[];
}
interface Group {
  group_code: string;
  label: string;
  group_percent: number;
  default_source: string;
  participants_preview: { qualification_id: string; name: string }[];
  grid: Grid | null;
}

const fmtPct = (n: number) => n.toFixed(2).replace(".", ",") + "%";
const fmtGroup = (n: number) => String(n).replace(".", ",") + "%";
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function whatsappLink(label: string, name: string | null, phone: string | null, token: string) {
  const msg = `Olá ${name ?? ""}, você foi indicado(a) como representante do grupo ${label} para informar a divisão percentual da comissão. Preencha pelo link (vale por 7 dias): ${commissionLink(token)}`;
  return `https://wa.me/${whatsappDigits(phone)}?text=${encodeURIComponent(msg)}`;
}

export function CommissionGridsPanel() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, { rep: string; email: string; phone: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [copied, setCopied] = useState<string | null>(null);
  // Modais vermelhos V3 (nunca fecham clicando fora; nunca window.confirm/alert).
  const [confirmReplace, setConfirmReplace] = useState<string | null>(null);
  const [reopen, setReopen] = useState<{ id: string; label: string } | null>(null);
  const [reopenReason, setReopenReason] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/cm/commission-grids");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setLoadError(json.error ?? "Erro ao carregar."); return; }
      setGroups(json.groups);
      setLoadError(null);
    } catch { setLoadError("Erro de conexão."); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const setField = (g: string, k: "rep" | "email" | "phone", v: string) =>
    setForm((f) => ({ ...f, [g]: { ...(f[g] ?? { rep: "", email: "", phone: "" }), [k]: v } }));

  const create = async (g: Group, replace = false) => {
    const f = form[g.group_code] ?? { rep: "", email: "", phone: "" };
    if (!f.rep) { setMsg((m) => ({ ...m, [g.group_code]: { ok: false, text: "Escolha o representante do grupo." } })); return; }
    setBusy(g.group_code);
    try {
      const res = await fetch("/api/cm/commission-grids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_code: g.group_code, source_contract_code: g.default_source,
          representative_qualification_id: f.rep,
          representative_email: f.email.trim() || undefined, representative_phone: f.phone.trim() || undefined, replace,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409 && json.has_active) { setConfirmReplace(g.group_code); return; }
      if (!res.ok) { setMsg((m) => ({ ...m, [g.group_code]: { ok: false, text: json.error ?? "Erro ao gerar o link." } })); return; }
      setMsg((m) => ({ ...m, [g.group_code]: { ok: true, text: json.email_sent ? "Link gerado e enviado por e-mail ao representante." : "Link gerado. O e-mail não pôde ser enviado: use o WhatsApp ou copie o link." } }));
      setConfirmReplace(null);
      await load();
    } finally { setBusy(null); }
  };

  const doReopen = async () => {
    if (!reopen) return;
    if (reopenReason.trim().length < 5) { setModalError("Motivo obrigatório: mínimo 5 caracteres."); return; }
    setBusy(reopen.id);
    setModalError(null);
    try {
      const res = await fetch(`/api/cm/commission-grids/${reopen.id}/reopen`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: reopenReason.trim() }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setModalError(json.error ?? "Erro ao reabrir."); return; }
      setReopen(null);
      setReopenReason("");
      await load();
    } finally { setBusy(null); }
  };

  if (loadError) return <div className="p-6 text-sm text-red-400">{loadError}</div>;
  if (!groups) return <div className="p-6 text-sm text-[#9BAFC5] flex items-center gap-2"><Loader2 className="animate-spin" size={14} /> Carregando...</div>;

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <div>
        <h2 className="text-lg font-bold text-[#F5F1E8]">Grade de Comissão</h2>
        <p className="text-xs text-[#9BAFC5] mt-1">Um link por grupo para 1 representante informar a divisão percentual da parcela do grupo. O representante vê só os nomes do grupo. Depois de confirmada, a grade fica travada.</p>
      </div>

      {groups.map((g) => {
        const gr = g.grid;
        const nameOf = (id: string) => gr?.participants.find((p) => p.qualification_id === id)?.name ?? "";
        return (
          <section key={g.group_code} className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-xl p-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-sm font-bold text-[#F5F1E8]">{g.label} <span className="text-[#E8C97A] font-bold">({fmtGroup(g.group_percent)} do volume)</span></div>
              {gr && (
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${gr.status === "enviado" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-[#243A66] text-[#9BAFC5] border-[#9BAFC5]/15"}`}>
                  {gr.status === "enviado" ? "Enviado e travado" : "Aguardando representante"}
                </span>
              )}
            </div>

            {!gr && (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] text-[#9BAFC5]">Participantes lidos do contrato {g.default_source}. Escolha o representante; o e-mail e o WhatsApp vêm da qualificação dele, e você pode sobrescrever abaixo.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-[#E8C97A] uppercase tracking-wider mb-1">Representante *</label>
                    <select value={form[g.group_code]?.rep ?? ""} onChange={(e) => setField(g.group_code, "rep", e.target.value)}
                      className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded-lg px-2 py-2 text-xs text-[#F5F1E8]">
                      <option value="">Selecione</option>
                      {g.participants_preview.map((p) => <option key={p.qualification_id} value={p.qualification_id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#E8C97A] uppercase tracking-wider mb-1">E-mail (opcional)</label>
                    <input type="email" inputMode="email" value={form[g.group_code]?.email ?? ""} onChange={(e) => setField(g.group_code, "email", e.target.value)}
                      className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded-lg px-2 py-2 text-xs text-[#F5F1E8]" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#E8C97A] uppercase tracking-wider mb-1">WhatsApp (opcional)</label>
                    <PhoneIntlInput value={form[g.group_code]?.phone ?? ""} onChange={(v) => setField(g.group_code, "phone", v)} placeholder="Fora do Brasil use +DDI"
                      className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded-lg px-2 py-2 text-xs text-[#F5F1E8]" />
                  </div>
                </div>
                <button onClick={() => create(g)} disabled={busy === g.group_code}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#C9A84C]/20 text-[#C9A84C] rounded-lg text-xs font-bold hover:bg-[#C9A84C]/30 transition disabled:opacity-50">
                  {busy === g.group_code ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Gerar link
                </button>
              </div>
            )}

            {gr?.status === "pendente" && (
              <div className="mt-3 space-y-2 text-xs">
                <p className="text-[#9BAFC5] flex items-center gap-1.5"><Clock size={12} /> Representante: <span className="text-[#F5F1E8] font-bold">{gr.representative_name}</span>. O link vale até {fmtDateTime(gr.token_expires_at)}.</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => { navigator.clipboard?.writeText(commissionLink(gr.token)); setCopied(gr.id); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#162744] text-[#9BAFC5] rounded-lg font-bold hover:text-[#F5F1E8] transition"><Copy size={12} /> {copied === gr.id ? "Copiado" : "Copiar link"}</button>
                  <a href={whatsappLink(g.label, gr.representative_name, gr.representative_phone, gr.token)} target="_blank" rel="noreferrer"
                    className="px-3 py-1.5 bg-[#25D366]/15 text-[#4ADE80] border border-[#4ADE80]/30 rounded-lg font-bold hover:bg-[#25D366]/25 transition">Enviar por WhatsApp</a>
                  <button onClick={() => setConfirmReplace(g.group_code)}
                    className="px-3 py-1.5 bg-[#162744] text-[#C9A84C] border border-[#C9A84C]/30 rounded-lg font-bold hover:bg-[#243A66] transition">Gerar novo link</button>
                </div>
              </div>
            )}

            {gr?.status === "enviado" && (
              <div className="mt-3 space-y-2 text-xs">
                <p className="text-emerald-400 flex items-center gap-1.5"><CheckCircle2 size={12} /> Confirmado por {gr.submitted_by_name} em {gr.submitted_at ? fmtDateTime(gr.submitted_at) : ""}.</p>
                <ul className="space-y-1">
                  {gr.participants.map((p) => {
                    const pct = typeof p.fixed_percent === "number" ? p.fixed_percent : gr.allocations?.find((a) => a.qualification_id === p.qualification_id)?.percent ?? 0;
                    return <li key={p.qualification_id} className="flex justify-between gap-3 text-[#F5F1E8]"><span>{nameOf(p.qualification_id)}</span><b>{fmtPct(pct)}</b></li>;
                  })}
                  {gr.fixed_allocations.map((f) => <li key={f.label} className="flex justify-between gap-3 text-[#F5F1E8]"><span>{f.label}</span><b>{fmtPct(f.percent)}</b></li>)}
                </ul>
                <button onClick={() => { setReopen({ id: gr.id, label: g.label }); setReopenReason(""); setModalError(null); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#162744] text-[#C9A84C] border border-[#C9A84C]/30 rounded-lg font-bold hover:bg-[#243A66] transition"><RotateCcw size={12} /> Reabrir</button>
                {gr.reopened_count > 0 && <p className="text-[#9BAFC5]">Reaberta {gr.reopened_count} vez(es).</p>}
              </div>
            )}

            {msg[g.group_code] && <p className={`mt-2 text-[11px] ${msg[g.group_code].ok ? "text-emerald-400" : "text-red-400"}`}>{msg[g.group_code].text}</p>}
          </section>
        );
      })}

      {confirmReplace && (() => {
        const g = groups.find((x) => x.group_code === confirmReplace)!;
        return (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md bg-[#09081A] border border-red-500/40 rounded-xl p-5 space-y-3">
              <div className="text-sm font-bold text-red-400 flex items-center gap-2"><AlertTriangle size={14} /> Gerar um novo link para {g.label}?</div>
              <p className="text-xs text-[#F5F1E8]">O link anterior deixa de valer e o representante recebe um novo. Use só se o link se perdeu ou venceu.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmReplace(null)} className="flex-1 px-3 py-2 bg-[#162744] text-[#F5F1E8] rounded-lg text-xs font-bold">Voltar</button>
                <button onClick={() => (g.grid ? replaceActive(g) : create(g, true))} disabled={busy === g.group_code}
                  className="flex-1 px-3 py-2 bg-red-500/20 text-red-300 border border-red-500/40 rounded-lg text-xs font-bold disabled:opacity-50">Gerar novo link</button>
              </div>
            </div>
          </div>
        );
      })()}

      {reopen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-[#09081A] border border-red-500/40 rounded-xl p-5 space-y-3">
            <div className="text-sm font-bold text-red-400 flex items-center gap-2"><Lock size={14} /> Reabrir a grade de {reopen.label}?</div>
            <p className="text-xs text-[#F5F1E8]">A grade confirmada é substituída por uma nova, em branco. O representante recebe um novo link e o anterior deixa de valer.</p>
            <div>
              <label className="block text-[10px] font-bold text-[#E8C97A] uppercase tracking-wider mb-1">Motivo *</label>
              <textarea value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} placeholder="Ex: erro de digitação no percentual"
                className="w-full bg-[#12112A] border border-[#9BAFC5]/15 rounded-lg px-3 py-2 text-xs text-[#F5F1E8] min-h-[60px]" />
            </div>
            {modalError && <p className="text-[11px] text-red-400">{modalError}</p>}
            <div className="flex gap-2">
              <button onClick={() => setReopen(null)} disabled={busy === reopen.id} className="flex-1 px-3 py-2 bg-[#162744] text-[#F5F1E8] rounded-lg text-xs font-bold">Voltar</button>
              <button onClick={doReopen} disabled={busy === reopen.id}
                className="flex-1 px-3 py-2 bg-red-500/20 text-red-300 border border-red-500/40 rounded-lg text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                {busy === reopen.id && <Loader2 size={13} className="animate-spin" />} Reabrir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // "Gerar novo link" sobre grade pendente: recria com o mesmo representante (a grade enviada só muda por Reabrir).
  async function replaceActive(g: Group) {
    const gr = g.grid;
    if (!gr) return;
    setBusy(g.group_code);
    try {
      // Usa o primeiro participante cujo nome coincide com o representante atual como fonte do contato.
      const rep = gr.participants.find((p) => p.name === gr.representative_name) ?? gr.participants[0];
      const res = await fetch("/api/cm/commission-grids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_code: g.group_code, source_contract_code: g.default_source, representative_qualification_id: rep.qualification_id, replace: true }),
      });
      const json = await res.json().catch(() => ({}));
      setMsg((m) => ({ ...m, [g.group_code]: res.ok ? { ok: true, text: "Novo link gerado. O anterior deixou de valer." } : { ok: false, text: json.error ?? "Erro ao gerar o novo link." } }));
      setConfirmReplace(null);
      await load();
    } finally { setBusy(null); }
  }
}
