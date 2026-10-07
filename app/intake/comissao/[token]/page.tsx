"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, Lock } from "lucide-react";
import { LGPD_AVISO_QUALIFICACAO, LGPD_CHECKBOX_TEXT } from "@/lib/lgpd-aviso-qualificacao";
import { percentToCents } from "@/lib/commission-grid";

// Grade de comissionamento por grupo (BRIEF 06/10/2026). Página pública, mobile primeiro.
// Só recebe NOMES do grupo; nunca CPF, e-mail, telefone ou dado bancário.

interface Participant { qualification_id: string; name: string; fixed_percent: number | null }
interface GridData {
  group_label: string;
  group_percent: number;
  representative_name: string | null;
  participants: Participant[];
  fixed_allocations: { label: string; percent: number }[];
  locked?: boolean;
  message?: string;
  allocations?: { qualification_id: string; percent: number }[];
}

const INPUT_CLS = "w-full bg-[#12112A] border border-[#9BAFC5]/25 rounded-lg px-3 py-3 text-base text-[#F5F1E8] text-right focus:outline-none focus:border-[#C9A84C] focus-visible:ring-2 focus-visible:ring-[#C9A84C]/40";
const fmtPct = (n: number) => n.toFixed(2).replace(".", ",") + "%";
const fmtGroup = (n: number) => Number(n).toFixed(2).replace(".", ",") + "%";

function Shell({ children }: { children: React.ReactNode }) {
  return (
  <div className="min-h-screen bg-[#09081A] text-[#9BAFC5] px-4 py-8" style={{ fontFamily: "'DM Sans', sans-serif" }}>
    <div className="max-w-xl mx-auto">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners" className="h-12 mb-6" />
      {children}
    </div>
  </div>
);
}

export default function ComissaoPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<{ loading: boolean; data: GridData | null; error: string | null }>({ loading: true, data: null, error: null });
  const [values, setValues] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [okPrivacy, setOkPrivacy] = useState(false);
  const [okDeclare, setOkDeclare] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/public/commission-grid/${token}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (res.ok || (res.status === 409 && json.locked)) {
          setState({ loading: false, data: json, error: null });
          setName(json.representative_name ?? "");
        } else {
          setState({ loading: false, data: null, error: json.error ?? "Não foi possível abrir este link." });
        }
      })
      .catch(() => setState({ loading: false, data: null, error: "Erro de conexão. Tente de novo." }));
  }, [token]);

  const data = state.data;
  const editable = useMemo(() => (data?.participants ?? []).filter((p) => p.fixed_percent === null), [data]);

  // Total em centésimos inteiros (nunca float).
  const totalCents = useMemo(() => {
    if (!data) return 0;
    let sum = 0;
    for (const p of data.participants) {
      if (p.fixed_percent !== null) sum += Math.round(p.fixed_percent * 100);
      else sum += percentToCents(values[p.qualification_id] ?? "") ?? 0;
    }
    for (const f of data.fixed_allocations) sum += Math.round(f.percent * 100);
    return sum;
  }, [data, values]);
  const diffCents = 10000 - totalCents;
  const allFilled = editable.every((p) => (percentToCents(values[p.qualification_id] ?? "") ?? 0) >= 1);
  const canReview = !!data && allFilled && diffCents === 0 && name.trim().split(/\s+/).filter(Boolean).length >= 2 && okPrivacy && okDeclare;

  const setVal = (id: string, raw: string) => setValues((v) => ({ ...v, [id]: raw.replace(/[^\d.,]/g, "").slice(0, 6) }));
  const normalize = (id: string) => {
    const c = percentToCents(values[id] ?? "");
    if (c !== null) setValues((v) => ({ ...v, [id]: (c / 100).toFixed(2).replace(".", ",") }));
  };
  const adjustLast = () => {
    const last = editable[editable.length - 1];
    if (!last) return;
    const cur = percentToCents(values[last.qualification_id] ?? "") ?? 0;
    const next = cur + diffCents;
    if (next >= 1 && next <= 10000) setValues((v) => ({ ...v, [last.qualification_id]: (next / 100).toFixed(2).replace(".", ",") }));
  };

  const submit = async () => {
    if (!data) return;
    setSaving(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/public/commission-grid/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allocations: editable.map((p) => ({ qualification_id: p.qualification_id, percent: values[p.qualification_id] })),
          submitted_by_name: name.trim(),
          acknowledged: okPrivacy && okDeclare,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) { setDone(true); setShowConfirm(false); }
      else { setSubmitError(json.error ?? "Não foi possível confirmar."); setShowConfirm(false); }
    } catch {
      setSubmitError("Erro de conexão. Tente de novo.");
      setShowConfirm(false);
    } finally {
      setSaving(false);
    }
  };

  if (state.loading) return <Shell><div className="flex items-center gap-2 text-sm"><Loader2 className="animate-spin" size={16} /> Carregando...</div></Shell>;
  if (state.error || !data) {
    return (
      <Shell>
        <div className="bg-[#162744] border border-[#9BAFC5]/15 rounded-xl p-5 flex gap-3">
          <AlertTriangle className="text-[#E8C97A] shrink-0" size={20} />
          <p className="text-sm text-[#F5F1E8]">{state.error ?? "Link indisponível."}</p>
        </div>
      </Shell>
    );
  }
  if (done || data.locked) {
    return (
      <Shell>
        <div className="bg-[#162744] border border-[#9BAFC5]/15 rounded-xl p-5">
          <div className="flex items-center gap-2 text-[#F5F1E8] font-bold mb-2">
            {done ? <CheckCircle2 className="text-emerald-400" size={18} /> : <Lock className="text-[#E8C97A]" size={18} />}
            {done ? "Divisão confirmada" : "Divisão já confirmada"}
          </div>
          <p className="text-sm">
            {done ? "A divisão do grupo foi registrada e está travada. A equipe V3 Partners foi avisada." : data.message}
          </p>
          <p className="text-xs mt-3">Grupo: {data.group_label}. Para qualquer ajuste, fale com a equipe V3 Partners.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-2xl font-extrabold text-[#F5F1E8]">Divisão da comissão</h1>
      <p className="text-sm mt-1">Grupo <span className="text-[#F5F1E8] font-bold">{data.group_label}</span>, parcela de <span className="text-[#E8C97A] font-bold">{fmtGroup(data.group_percent)}</span> do volume movimentado.</p>
      <p className="text-sm mt-3">Informe o percentual de cada integrante sobre a parcela do grupo. A soma precisa fechar em exatamente 100,00%. Depois de confirmada, a divisão fica travada.</p>

      <div className="mt-5 space-y-3">
        {data.participants.map((p) => (
          <div key={p.qualification_id} className="bg-[#162744] border border-[#9BAFC5]/15 rounded-xl p-3 grid grid-cols-[1fr_8rem] gap-3 items-center">
            <label htmlFor={`pct-${p.qualification_id}`} className="text-sm text-[#F5F1E8] font-medium break-words">{p.name}</label>
            {p.fixed_percent !== null ? (
              <div className="text-right text-base text-[#E8C97A] font-bold" title="Definido no Mandato">{fmtPct(p.fixed_percent)}</div>
            ) : (
              <input
                id={`pct-${p.qualification_id}`} inputMode="decimal" autoComplete="off" placeholder="0,00"
                value={values[p.qualification_id] ?? ""} onChange={(e) => setVal(p.qualification_id, e.target.value)}
                onBlur={() => normalize(p.qualification_id)} className={INPUT_CLS}
              />
            )}
          </div>
        ))}
        {data.fixed_allocations.map((f) => (
          <div key={f.label} className="bg-[#162744] border border-[#9BAFC5]/15 rounded-xl p-3 grid grid-cols-[1fr_8rem] gap-3 items-center">
            <span className="text-sm text-[#F5F1E8] font-medium">{f.label}</span>
            <div className="text-right text-base text-[#E8C97A] font-bold" title="Definido no Mandato">{fmtPct(f.percent)}</div>
          </div>
        ))}
      </div>

      <div className={`mt-4 rounded-xl p-3 text-sm flex items-center justify-between gap-2 border ${diffCents === 0 && allFilled ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-[#E8C97A]/40 bg-[#E8C97A]/10 text-[#E8C97A]"}`} aria-live="polite">
        <span>Total: <b>{fmtPct(totalCents / 100)}</b>{diffCents > 0 ? ` (faltam ${fmtPct(diffCents / 100)})` : diffCents < 0 ? ` (sobram ${fmtPct(-diffCents / 100)})` : ""}</span>
        {diffCents !== 0 && editable.length > 0 && (
          <button type="button" onClick={adjustLast} className="text-xs font-bold underline underline-offset-2">Ajustar a diferença no último</button>
        )}
      </div>

      <div className="mt-6">
        <label htmlFor="rep-name" className="block text-[11px] font-bold text-[#E8C97A] uppercase tracking-wider mb-1">Seu nome completo *</label>
        <input id="rep-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name"
          className="w-full bg-[#12112A] border border-[#9BAFC5]/25 rounded-lg px-3 py-3 text-base text-[#F5F1E8] focus:outline-none focus:border-[#C9A84C] focus-visible:ring-2 focus-visible:ring-[#C9A84C]/40" />
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <label className="flex gap-2 items-start text-[#F5F1E8]">
          <input type="checkbox" checked={okDeclare} onChange={(e) => setOkDeclare(e.target.checked)} className="mt-1" />
          <span>Declaro que represento o grupo {data.group_label} e que a divisão acima foi combinada entre os integrantes.</span>
        </label>
        <label className="flex gap-2 items-start text-[#F5F1E8]">
          <input type="checkbox" checked={okPrivacy} onChange={(e) => setOkPrivacy(e.target.checked)} className="mt-1" />
          <span>{LGPD_CHECKBOX_TEXT}</span>
        </label>
        <button type="button" onClick={() => setShowPrivacy((v) => !v)} className="text-xs underline underline-offset-2 text-[#9BAFC5]">
          {showPrivacy ? "Ocultar o Aviso de Privacidade" : "Ler o Aviso de Privacidade"}
        </button>
        {showPrivacy && (
          <div className="bg-[#162744] border border-[#9BAFC5]/15 rounded-xl p-3 space-y-2 text-xs max-h-64 overflow-y-auto">
            {LGPD_AVISO_QUALIFICACAO.map((s) => (
              <div key={s.title}><div className="text-[#F5F1E8] font-bold">{s.title}</div><div>{s.text}</div></div>
            ))}
          </div>
        )}
      </div>

      {submitError && <p className="mt-4 text-sm text-red-400" role="alert">{submitError}</p>}

      <button type="button" disabled={!canReview} onClick={() => { setSubmitError(null); setShowConfirm(true); }}
        className="mt-6 w-full bg-[#C9A84C] text-[#09081A] font-bold rounded-lg px-4 py-3 text-base disabled:opacity-40 disabled:cursor-not-allowed">
        Revisar e confirmar
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          {/* Não fecha clicando fora: só pelos botões. */}
          <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-md bg-[#09081A] border border-red-500/50 rounded-xl p-5">
            <h2 id="confirm-title" className="text-red-300 font-bold flex items-center gap-2"><AlertTriangle size={16} /> Confirmar e travar a divisão?</h2>
            <p className="text-sm text-[#F5F1E8] mt-2">Depois de confirmada, a grade fica travada e só a equipe V3 Partners pode reabri-la.</p>
            <ul className="mt-3 text-sm space-y-1">
              {data.participants.map((p) => (
                <li key={p.qualification_id} className="flex justify-between gap-3 text-[#F5F1E8]">
                  <span className="break-words">{p.name}</span>
                  <b>{p.fixed_percent !== null ? fmtPct(p.fixed_percent) : fmtPct((percentToCents(values[p.qualification_id] ?? "") ?? 0) / 100)}</b>
                </li>
              ))}
              {data.fixed_allocations.map((f) => (
                <li key={f.label} className="flex justify-between gap-3 text-[#F5F1E8]"><span>{f.label}</span><b>{fmtPct(f.percent)}</b></li>
              ))}
            </ul>
            <div className="flex gap-2 mt-5">
              <button type="button" onClick={() => setShowConfirm(false)} disabled={saving} className="flex-1 bg-[#162744] text-[#F5F1E8] rounded-lg px-3 py-3 text-sm font-bold">Voltar</button>
              <button type="button" onClick={submit} disabled={saving} className="flex-1 bg-red-500/20 text-red-200 border border-red-500/50 rounded-lg px-3 py-3 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                {saving && <Loader2 size={14} className="animate-spin" />} Confirmar e travar
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
