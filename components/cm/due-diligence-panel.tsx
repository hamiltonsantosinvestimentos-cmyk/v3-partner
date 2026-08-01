"use client";

import React, { useState, useEffect } from "react";
import { Search, Loader2, ShieldCheck, ExternalLink, Scale, Clock } from "lucide-react";

interface EscavadorProcesso {
  numero_cnj: string;
  polo_ativo: string | null;
  polo_passivo: string | null;
  tribunal: string | null;
  status: string | null;
  valor_causa: number | null;
}

interface EscavadorResult {
  total_processos: number;
  processos: EscavadorProcesso[];
}

interface HistoryRecord {
  id: string;
  query_type: string;
  query_value: string;
  result: EscavadorResult;
  created_at: string;
}

interface Props {
  listingId: string;
  anonymousId: string;
  sellerCpfCnpj: string | null;
  onClose: () => void;
}

function formatCurrencyBRL(v: number | null) {
  if (v === null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function DueDiligencePanel({ listingId, anonymousId, sellerCpfCnpj, onClose }: Props) {
  const [valor, setValor] = useState(sellerCpfCnpj ?? "");
  const [tipo, setTipo] = useState<"cpf" | "cnpj">(
    (sellerCpfCnpj?.replace(/\D/g, "").length ?? 0) > 11 ? "cnpj" : "cpf"
  );
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EscavadorResult | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoadingHistory(true);
    fetch(`/api/cm/listings/${listingId}/due-diligence/escavador`)
      .then((r) => r.json())
      .then((json) => { if (!cancelled) setHistory(json.records ?? []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingHistory(false); });
    return () => { cancelled = true; };
  }, [listingId]);

  async function handleBuscar() {
    const v = valor.trim();
    if (!v || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/cm/listings/${listingId}/due-diligence/escavador`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, valor: v }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro ao consultar Escavador.");
        return;
      }
      setResult(json);
      setHistory((prev) => [{ id: json.record_id, query_type: tipo, query_value: v, result: json, created_at: new Date().toISOString() }, ...prev]);
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg bg-[#09081A] border border-[#C9A84C]/30 rounded-xl overflow-hidden flex flex-col" style={{ height: "70vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#C9A84C]/20 bg-[#12112A]">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-[#C9A84C]" />
            <span className="text-sm font-bold text-[#F5F1E8]">Due Diligence</span>
            <span className="text-[10px] font-bold text-[#C9A84C] tracking-wider">{anonymousId}</span>
          </div>
          <button onClick={onClose} className="text-[#9BAFC5] hover:text-[#F5F1E8] text-lg leading-none">&times;</button>
        </div>

        {/* Ferramentas */}
        <div className="px-4 py-3 border-b border-[#9BAFC5]/10 bg-[#12112A] space-y-3">
          <div className="flex gap-2">
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as "cpf" | "cnpj")}
              className="bg-[#162744] border border-[#9BAFC5]/15 rounded-lg px-2 py-2 text-xs text-[#F5F1E8] focus:border-[#C9A84C]/40 focus:outline-none"
            >
              <option value="cpf">CPF</option>
              <option value="cnpj">CNPJ</option>
            </select>
            <input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleBuscar()}
              placeholder="CPF/CNPJ do cedente"
              className="flex-1 bg-[#162744] border border-[#9BAFC5]/15 rounded-lg px-3 py-2 text-xs text-[#F5F1E8] placeholder:text-[#9BAFC5]/40 focus:border-[#C9A84C]/40 focus:outline-none"
            />
            <button
              onClick={handleBuscar}
              disabled={loading || !valor.trim()}
              className="px-3 py-2 bg-[#C9A84C] text-[#09081A] rounded-lg disabled:opacity-30 hover:bg-[#D4B96A] transition flex items-center gap-1"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            </button>
          </div>

          <a
            href="https://validar.iti.gov.br"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-3 py-2 border border-[#C9A84C]/40 rounded-lg text-xs font-bold text-[#C9A84C] hover:bg-[#C9A84C]/10 transition"
          >
            <ExternalLink size={13} />
            Validar Assinatura gov.br
          </a>
        </div>

        {/* Resultado + histórico */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {error && (
            <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</div>
          )}

          {loadingHistory && (
            <div className="text-center py-8 text-[#9BAFC5] text-sm">
              <Loader2 size={20} className="mx-auto mb-2 animate-spin text-[#C9A84C]" />
              <p>Carregando histórico...</p>
            </div>
          )}

          {!loadingHistory && history.length === 0 && !result && (
            <div className="text-center py-12 text-[#9BAFC5] text-sm">
              <Scale size={36} className="mx-auto mb-3 opacity-30" />
              <p>Nenhuma checagem de processos judiciais ainda neste ativo.</p>
              <p className="text-xs mt-1 opacity-60">Busque pelo CPF/CNPJ do cedente acima.</p>
            </div>
          )}

          {history.map((rec) => (
            <div key={rec.id} className="bg-[#162744] border border-[#9BAFC5]/10 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-[#E8C97A] uppercase tracking-wider">
                  {rec.query_type.toUpperCase()} {rec.query_value}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-[#9BAFC5]">
                  <Clock size={10} />
                  {new Date(rec.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                </span>
              </div>
              <p className="text-xs text-[#F5F1E8] mb-2">{rec.result.total_processos} processo(s) encontrado(s)</p>
              {rec.result.processos.slice(0, 5).map((p) => (
                <div key={p.numero_cnj} className="text-[11px] text-[#9BAFC5] border-t border-[#9BAFC5]/10 pt-2 mt-2">
                  <p className="text-[#F5F1E8]">{p.numero_cnj} · {p.tribunal ?? "—"}</p>
                  <p>{p.polo_ativo ?? "—"} × {p.polo_passivo ?? "—"}</p>
                  <p>Status: {p.status ?? "—"} · Valor da causa: {formatCurrencyBRL(p.valor_causa)}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
