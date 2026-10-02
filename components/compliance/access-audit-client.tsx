"use client";

// Auditoria de acessos a dado sensível (Compliance, só ADMIN). Revelações de campo, aberturas de
// documento e apagamentos de log, mais recente primeiro. IP sempre mascarado; o valor revelado
// nunca aparece. Exportação CSV registrada no servidor (uso interno, sem repasse).
import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck, Download } from "lucide-react";

type Item = { id: string; source: string; at: string; user_name: string; qualification_id: string | null; party_name: string; what: string; ip_masked: string };
type Summary = { today: number; days7: number; days30: number; distinct_users: number; top: { name: string; count: number }[]; users: { id: string; name: string }[] };

const TYPE_LABELS: Record<string, string> = { campo: "Revelação de campo", documento: "Abertura de documento", apagamento: "Apagamento de log" };
const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function AccessAuditClient() {
  const [filters, setFilters] = useState({ from: "", to: "", user: "", party: "", type: "todos" });
  const [applied, setApplied] = useState(filters);
  const [items, setItems] = useState<Item[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const qs = useCallback((f: typeof filters, cursor?: string | null) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
    if (cursor) p.set("cursor", cursor);
    return p.toString();
  }, []);

  const load = useCallback(async (f: typeof filters, cursor?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/compliance/access-audit?${qs(f, cursor)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? "Não foi possível carregar a auditoria"); return; }
      setItems((prev) => (cursor ? [...prev, ...json.items] : json.items));
      setNext(json.next ?? null);
      if (json.summary) setSummary(json.summary);
    } catch {
      setError("Não foi possível carregar a auditoria");
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => { load(applied); }, [applied, load]);

  const input = "bg-[#12112A] border border-[#9BAFC5]/20 rounded px-2 py-1.5 text-[13px] text-[#F5F1E8]";

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-[#F5F1E8] flex items-center gap-2"><ShieldCheck size={18} className="text-[#C9A84C]" /> Auditoria de acessos a dados sensíveis</h1>
        <p className="text-[13px] text-[#9BAFC5]">Quem revelou CPF e identidade, abriu documentos ou apagou registros de acesso. Uso interno, para segurança e auditoria. O IP aparece mascarado.</p>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[["Hoje", summary.today], ["Últimos 7 dias", summary.days7], ["Últimos 30 dias", summary.days30], ["Usuários distintos (30 dias)", summary.distinct_users]].map(([l, v]) => (
            <div key={String(l)} className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-3">
              <p className="text-[12px] text-[#E8C97A] font-bold uppercase">{l}</p>
              <p className="text-2xl font-bold text-[#F5F1E8]">{v}</p>
            </div>
          ))}
          {summary.top.length > 0 && (
            <div className="col-span-2 md:col-span-4 bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-3">
              <p className="text-[12px] text-[#E8C97A] font-bold uppercase mb-1">Quem mais acessou (30 dias)</p>
              <p className="text-[13px] text-[#F5F1E8]">{summary.top.map((t) => `${t.name} (${t.count})`).join(" · ")}</p>
            </div>
          )}
        </div>
      )}

      <form className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end" onSubmit={(e) => { e.preventDefault(); setApplied(filters); }}>
        <label className="text-[12px] text-[#9BAFC5]">De<input type="date" className={`${input} w-full`} value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></label>
        <label className="text-[12px] text-[#9BAFC5]">Até<input type="date" className={`${input} w-full`} value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></label>
        <label className="text-[12px] text-[#9BAFC5]">Usuário
          <select className={`${input} w-full`} value={filters.user} onChange={(e) => setFilters({ ...filters, user: e.target.value })}>
            <option value="">Todos</option>
            {(summary?.users ?? []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
        <label className="text-[12px] text-[#9BAFC5]">Parte<input className={`${input} w-full`} placeholder="Nome" value={filters.party} onChange={(e) => setFilters({ ...filters, party: e.target.value })} /></label>
        <label className="text-[12px] text-[#9BAFC5]">Tipo
          <select className={`${input} w-full`} value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
            <option value="todos">Todos</option>
            <option value="campo">Revelação de campo</option>
            <option value="documento">Abertura de documento</option>
            <option value="apagamento">Apagamento de log</option>
          </select>
        </label>
        <div className="flex gap-2">
          <button type="submit" className="text-[13px] font-semibold text-[#09081A] bg-[#C9A84C] rounded px-3 py-1.5">Filtrar</button>
          <a href={`/api/compliance/access-audit/export?${qs(applied)}`} className="text-[13px] font-semibold text-[#E8C97A] border border-[#C9A84C]/40 rounded px-3 py-1.5 inline-flex items-center gap-1">
            <Download size={13} /> Exportar CSV
          </a>
        </div>
      </form>

      {error && (
        <div className="text-[13px] text-[#E24B4A] bg-[#12112A] border border-[#E24B4A]/30 rounded p-3 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={() => load(applied)} className="text-[#E8C97A] font-semibold">Tentar de novo</button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[12px] text-[#E8C97A] uppercase">
              <th className="py-1.5 pr-3">Data e hora</th><th className="pr-3">Quem acessou</th><th className="pr-3">Parte</th><th className="pr-3">Tipo</th><th className="pr-3">O que foi acessado</th><th>IP</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={`${r.source}:${r.id}`} className="border-t border-[#9BAFC5]/10 text-[#F5F1E8]">
                <td className="py-1.5 pr-3 whitespace-nowrap">{fmt(r.at)}</td>
                <td className="pr-3">{r.user_name}</td>
                <td className="pr-3">{r.party_name}</td>
                <td className="pr-3">{TYPE_LABELS[r.source] ?? r.source}</td>
                <td className="pr-3">{r.what}</td>
                <td className="text-[#9BAFC5]">{r.ip_masked}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div className="py-6 flex justify-center"><Loader2 size={18} className="animate-spin text-[#C9A84C]" /></div>}
        {!loading && !error && items.length === 0 && <p className="py-6 text-[13px] text-[#9BAFC5]">Nenhum acesso no período selecionado.</p>}
        {!loading && next && (
          <button type="button" onClick={() => load(applied, next)} className="mt-3 text-[13px] font-semibold text-[#E8C97A]">Ver mais</button>
        )}
      </div>
    </div>
  );
}
