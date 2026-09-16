"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, FileText, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";

interface ScanResult {
  id: string;
  status: "concluido" | "erro";
  score: number | null;
  risk_label: string | null;
  verdict: string | null;
  escavador_result: { total_processos?: number; processos?: { numero_cnj: string; polo_ativo: string | null; polo_passivo: string | null; status: string | null }[] } | null;
  checktudo_scr_result: { risk_flags?: Record<string, unknown> } | null;
  checktudo_dossie_result: { risk_flags?: Record<string, unknown> } | null;
  blacklist_match: { name: string; type: string; notes: string | null } | null;
  source_errors: { source: string; message: string }[];
}

interface HistoryItem {
  id: string;
  entity_name: string;
  entity_doc: string;
  status: string;
  score: number | null;
  risk_label: string | null;
  verdict: string | null;
  pdf_path: string | null;
  created_at: string;
}

function maskCpf(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length !== 11) return digits;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function riskColor(label: string | null): string {
  if (label === "BAIXO RISCO") return "text-emerald-400";
  if (label === "RISCO MÉDIO") return "text-[#E0B04C]";
  if (label === "ALTO RISCO") return "text-red-400";
  return "text-[#7A8FA8]";
}

export function InvestorCompliancePanel() {
  const [entityName, setEntityName] = useState("");
  const [entityDoc, setEntityDoc] = useState("");
  const [ddLevel, setDdLevel] = useState<"SDD" | "Padrão" | "EDD">("Padrão");

  const [loadingScan, setLoadingScan] = useState(false);
  const [loadingSocial, setLoadingSocial] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [socialSummary, setSocialSummary] = useState<string | null>(null);
  const [socialSources, setSocialSources] = useState<string[]>([]);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/ma/investor-compliance/scan");
      const data = await res.json();
      setHistory(data.checks ?? []);
    } catch {
      /* histórico é acessório, falha silenciosa não bloqueia a tela */
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  async function handleScan() {
    setError(null);
    setResult(null);
    setSocialSummary(null);
    setSocialSources([]);
    setLoadingScan(true);
    try {
      const res = await fetch("/api/ma/investor-compliance/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity_name: entityName, entity_doc: entityDoc, dd_level: ddLevel }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Falha ao rodar a checagem");
        return;
      }
      setResult(data);
      loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setLoadingScan(false);
    }
  }

  async function handleSocial() {
    if (!result) return;
    setError(null);
    setLoadingSocial(true);
    try {
      const res = await fetch(`/api/ma/investor-compliance/${result.id}/social`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Falha ao buscar perfis sociais");
        return;
      }
      setSocialSummary(data.social_summary_text);
      setSocialSources(data.social_summary_sources ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setLoadingSocial(false);
    }
  }

  async function handlePdf(checkId: string) {
    setError(null);
    setLoadingPdf(true);
    try {
      const res = await fetch(`/api/ma/investor-compliance/${checkId}/pdf`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Falha ao gerar PDF");
        return;
      }
      if (data.pdf_url) window.open(data.pdf_url, "_blank");
      loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally {
      setLoadingPdf(false);
    }
  }

  const canRunSocial = !!result && result.status === "concluido";

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#122036] bg-[#091221] p-5">
        <h2 className="text-sm font-bold text-[#E8EDF5] mb-1">Due Diligence Inicial de Investidor</h2>
        <p className="text-xs text-[#7A8FA8] mb-4">
          Triagem inicial de KYC sobre possível investidor: processos judiciais (polo ativo/passivo), crédito
          simplificado (SCR) e Black List V3. Patrimônio e participação em empresas não estão disponíveis nesta fase.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1">
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#C9A84C] mb-1 block">Nome completo</label>
            <input
              value={entityName}
              onChange={(e) => setEntityName(e.target.value)}
              placeholder="Nome completo"
              className="w-full px-3 py-2.5 rounded-lg bg-[#162744] border border-[#243A66] text-[#F5F1E8] text-sm placeholder:text-[#7A8FA8]/50 focus:outline-none focus:border-[#C9A84C]/50 transition-colors"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#C9A84C] mb-1 block">CPF</label>
            <input
              value={entityDoc}
              onChange={(e) => setEntityDoc(e.target.value)}
              placeholder="000.000.000-00"
              className="w-full px-3 py-2.5 rounded-lg bg-[#162744] border border-[#243A66] text-[#F5F1E8] text-sm placeholder:text-[#7A8FA8]/50 focus:outline-none focus:border-[#C9A84C]/50 transition-colors"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-[#C9A84C] mb-1 block">Nível de DD</label>
            <select
              value={ddLevel}
              onChange={(e) => setDdLevel(e.target.value as "SDD" | "Padrão" | "EDD")}
              className="w-full px-3 py-2.5 rounded-lg bg-[#162744] border border-[#243A66] text-[#F5F1E8] text-sm focus:outline-none focus:border-[#C9A84C]/50 transition-colors"
            >
              <option value="SDD">SDD</option>
              <option value="Padrão">Padrão</option>
              <option value="EDD">EDD</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleScan}
          disabled={loadingScan || !entityName.trim() || entityDoc.replace(/\D/g, "").length !== 11}
          className="mt-4 flex items-center gap-2 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-semibold px-4 py-2.5 hover:bg-[#E8C97A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loadingScan ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Rodar Due Diligence
        </button>

        {error && (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</div>
        )}
      </div>

      {result && (
        <div className="rounded-xl border border-[#122036] bg-[#091221] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {result.risk_label === "BAIXO RISCO" && <ShieldCheck size={18} className="text-emerald-400" />}
              {result.risk_label === "RISCO MÉDIO" && <ShieldAlert size={18} className="text-[#E0B04C]" />}
              {result.risk_label === "ALTO RISCO" && <ShieldAlert size={18} className="text-red-400" />}
              {!result.risk_label && <ShieldQuestion size={18} className="text-[#7A8FA8]" />}
              <div>
                <p className="text-sm font-bold text-[#E8EDF5]">
                  {result.score !== null ? `Score ${result.score}` : "Score não disponível"}
                </p>
                <p className={`text-xs font-semibold ${riskColor(result.risk_label)}`}>
                  {result.risk_label ?? "Nenhuma fonte respondeu, verdito não calculado"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSocial}
                disabled={!canRunSocial || loadingSocial}
                className="flex items-center gap-2 rounded-lg border border-[#243A66] text-[#7A8FA8] text-xs font-semibold px-3 py-2 hover:border-[#C9A84C]/40 hover:text-[#C9A84C] transition-colors disabled:opacity-40"
              >
                {loadingSocial ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Buscar Perfis Sociais
              </button>
              <button
                onClick={() => handlePdf(result.id)}
                disabled={loadingPdf}
                className="flex items-center gap-2 rounded-lg border border-[#C9A84C]/40 text-[#C9A84C] text-xs font-semibold px-3 py-2 hover:bg-[#C9A84C]/10 transition-colors disabled:opacity-40"
              >
                {loadingPdf ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                Gerar PDF
              </button>
            </div>
          </div>

          {result.source_errors.length > 0 && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400 space-y-1">
              {result.source_errors.map((e, i) => (
                <div key={i}>
                  <strong className="uppercase">{e.source}:</strong> {e.message}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-[#122036] bg-[#0d1526] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#C9A84C] mb-2">Processos Judiciais</p>
              <p className="text-xs text-[#7A8FA8] mb-2">
                {Math.max(result.escavador_result?.total_processos ?? 0, result.escavador_result?.processos?.length ?? 0)} processos localizados (Escavador)
              </p>
              {(result.escavador_result?.processos ?? []).slice(0, 5).map((p, i) => (
                <div key={i} className="text-[11px] text-[#7A8FA8] border-t border-[#122036] pt-2 mt-2">
                  <div className="text-[#E8EDF5] font-semibold">{p.numero_cnj}</div>
                  <div>Polo passivo: {p.polo_passivo ?? "Não informado"}</div>
                  <div>Status: {p.status ?? "Não informado"}</div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-[#122036] bg-[#0d1526] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#C9A84C] mb-2">Crédito Simplificado (SCR)</p>
              <p className="text-xs text-[#7A8FA8]">
                Operações: {String((result.checktudo_scr_result?.risk_flags?.scr_quantidade_operacoes as number) ?? "Não informado")}
              </p>
              <p className="text-xs text-[#7A8FA8]">
                Instituições: {String((result.checktudo_scr_result?.risk_flags?.scr_quantidade_instituicoes as number) ?? "Não informado")}
              </p>
            </div>

            <div className="rounded-lg border border-dashed border-[#243A66] bg-[#0d1526] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#7A8FA8] mb-1">Patrimônio</p>
              <p className="text-xs text-[#7A8FA8] italic">Não disponível nesta fase</p>
            </div>

            <div className="rounded-lg border border-dashed border-[#243A66] bg-[#0d1526] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#7A8FA8] mb-1">Participação em Empresas</p>
              <p className="text-xs text-[#7A8FA8] italic">Não disponível nesta fase</p>
            </div>
          </div>

          {result.blacklist_match && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              Correspondência na Black List V3: {result.blacklist_match.name} ({result.blacklist_match.type})
            </div>
          )}

          {socialSummary && (
            <div className="rounded-lg border border-[#122036] bg-[#0d1526] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#C9A84C] mb-2">Perfil de Redes Sociais / LinkedIn</p>
              <p className="text-xs text-[#7A8FA8] whitespace-pre-line">{socialSummary}</p>
              {socialSources.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {socialSources.map((s, i) => (
                    <li key={i} className="text-[10px] text-[#7A8FA8] break-all">{s}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-[#122036] bg-[#091221] p-5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#C9A84C] mb-3">Histórico de Checagens</p>
        {loadingHistory ? (
          <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-[#C9A84C]" /></div>
        ) : history.length === 0 ? (
          <p className="text-xs text-[#7A8FA8] text-center py-6">Nenhuma checagem realizada ainda</p>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg border border-[#122036] bg-[#0d1526] px-3 py-2.5">
                <div>
                  <p className="text-xs font-semibold text-[#E8EDF5]">{h.entity_name}</p>
                  <p className="text-[10px] text-[#7A8FA8]">
                    {maskCpf(h.entity_doc)} · {new Date(h.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-bold ${riskColor(h.risk_label)}`}>{h.risk_label ?? "N/D"}</span>
                  <button
                    onClick={() => handlePdf(h.id)}
                    className="text-[10px] font-semibold text-[#C9A84C] hover:text-[#E8C97A] transition-colors"
                  >
                    {h.pdf_path ? "Reabrir PDF" : "Gerar PDF"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
