"use client";

import { useState } from "react";
import { Search, User, Building2, CreditCard, Gavel, ShieldCheck, Handshake, Building, FileCheck2, FileSignature, TrendingUp, TrendingDown, Minus, Lightbulb } from "lucide-react";
import Link from "next/link";

interface ClientResult {
  found: boolean;
  document_number?: string;
  document_type?: string;
  client?: { id: string; document_number: string; document_type: string; legal_name: string | null; first_seen_vertical: string | null; first_seen_at: string };
  credito?: { id: string; code: string; title: string; client_name: string; credit_line: string; requested_value: number; stage: string; status: string; created_at: string }[];
  bolsa_de_ativos?: { id: string; numero_interno: string | null; seller_name: string; asset_type: string; valor_face: number; listing_status: string; created_at: string }[];
  credit_engine?: { id: string; tier: string; score_total: number; analysis_type: string; created_at: string }[];
  partners?: { id: string; nome_completo: string; plano: string; status: string; created_at: string }[];
  ma?: { id: string; role: "comprador" | "vendedor" | "intermediario" | null; status: "prospecto" | "a_performar" | "performado"; created_at: string; ma_deals: { id: string; code: string; title: string; stage: string } | null }[];
  kyc?: { id: string; score: number; risk_label: string; verdict: string; dd_level: string; created_at: string }[];
  contratos?: { id: string; contract_code: string | null; contract_title: string; vertical: string; status_signature: string; created_at: string }[];
  risco?: {
    trajetoria: Record<string, { dimension: string; score_atual: number; classificacao_atual: string; score_anterior: number | null; direcao: string; created_at: string }>;
    sugestoes: { id: string; dimension: string; suggestion: string; status: string; created_at: string }[];
  };
}

const ROLE_LABELS: Record<string, string> = { comprador: "Comprador", vendedor: "Vendedor", intermediario: "Intermediário" };
const MA_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  prospecto:   { label: "Prospecto",   color: "#9BAFC5", bg: "rgba(155,175,197,0.1)" },
  a_performar: { label: "A Performar", color: "#F59E0B", bg: "rgba(245,158,11,0.1)" },
  performado:  { label: "Performado",  color: "#10B981", bg: "rgba(16,185,129,0.1)" },
};
const DIRECAO_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  melhorando:       { label: "Melhorando",      color: "#10B981", icon: <TrendingUp size={14} /> },
  piorando:         { label: "Piorando",        color: "#EF4444", icon: <TrendingDown size={14} /> },
  estavel:          { label: "Estável",         color: "#9BAFC5", icon: <Minus size={14} /> },
  primeira_analise: { label: "Primeira análise", color: "#C9A84C", icon: <Minus size={14} /> },
};
const DIMENSAO_LABELS: Record<string, string> = { credito: "Crédito", compliance: "Compliance / KYC" };

function formatMoney(v: number | null | undefined) {
  if (v === null || v === undefined) return "-";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Registro Central de Cliente (Client 360). Fase 1 (08/08): Crédito, Bolsa
// de Ativos, Credit Engine, Partners. Fase D (11/08): M&A (papel + ciclo de
// vida por deal), KYC, contratos, e trajetória de risco por dimensão
// (crédito e compliance nunca fundidos num indicador só, ver migration
// 20260811b). CRM e Consórcios ficam de fora até terem coluna normalizada
// de CPF/CNPJ própria.
export function ClientesSearchClient() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClientResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/clientes/${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao buscar cliente");
        return;
      }
      setResult(data);
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "0 24px 48px" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <User size={24} color="#C9A84C" />
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#F5F1E8", margin: 0 }}>Clientes</h1>
        </div>
        <p style={{ fontSize: 12, color: "#9BAFC5", margin: 0 }}>
          Registro Central de Cliente (Client 360) · tudo vinculado a um CPF/CNPJ entre as verticais V3
        </p>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
          <Search size={14} color="#9BAFC5" style={{ position: "absolute", left: 10, top: 12 }} />
          <input
            type="text"
            placeholder="Buscar por CPF ou CNPJ..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            style={{
              background: "#13223A", border: "1px solid #162744", borderRadius: 8,
              padding: "10px 12px 10px 32px", color: "#F5F1E8", fontSize: 13,
              outline: "none", width: "100%",
            }}
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading}
          style={{
            background: "rgba(201,168,76,.15)", border: "1px solid rgba(201,168,76,.35)",
            borderRadius: 8, padding: "0 20px", cursor: loading ? "default" : "pointer",
            color: "#C9A84C", fontWeight: 700, fontSize: 13,
          }}
        >
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </div>

      {error && (
        <div style={{ padding: 16, background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 8, color: "#f87171", fontSize: 12, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {result && !result.found && (
        <div style={{ padding: 40, textAlign: "center", color: "#9BAFC5", fontSize: 13, background: "#13223A", border: "1px solid #162744", borderRadius: 12 }}>
          Nenhum registro encontrado para este CPF/CNPJ.
        </div>
      )}

      {result?.found && result.client && (
        <div>
          <div style={{ background: "#13223A", border: "1px solid #162744", borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              {result.client.document_type === "CNPJ" ? <Building2 size={18} color="#C9A84C" /> : <User size={18} color="#C9A84C" />}
              <span style={{ fontSize: 16, fontWeight: 700, color: "#F5F1E8" }}>
                {result.client.legal_name || "(nome não registrado)"}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#9BAFC5" }}>
              {result.client.document_type} {result.client.document_number} · primeiro registro em {result.client.first_seen_vertical ?? "-"} ({new Date(result.client.first_seen_at).toLocaleDateString("pt-BR")})
            </div>
          </div>

          {result.risco && Object.keys(result.risco.trajetoria).length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 12 }}>
              {Object.values(result.risco.trajetoria).map(t => {
                const dir = DIRECAO_META[t.direcao] ?? DIRECAO_META.estavel;
                return (
                  <div key={t.dimension} style={{ background: "#13223A", border: "1px solid #162744", borderRadius: 12, padding: 16 }}>
                    <div style={{ fontSize: 10, color: "#9BAFC5", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                      Risco · {DIMENSAO_LABELS[t.dimension] ?? t.dimension}
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 22, fontWeight: 800, color: "#F5F1E8" }}>{t.score_atual}</span>
                      <span style={{ fontSize: 12, color: "#9BAFC5" }}>{t.classificacao_atual}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: dir.color, fontSize: 11, fontWeight: 700 }}>
                      {dir.icon} {dir.label}
                      {t.score_anterior !== null && <span style={{ color: "#9BAFC5", fontWeight: 400 }}>(era {t.score_anterior})</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {result.risco && result.risco.sugestoes.length > 0 && (
            <div style={{ background: "rgba(201,168,76,.06)", border: "1px solid rgba(201,168,76,.25)", borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Lightbulb size={15} color="#E8C97A" />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#F5F1E8" }}>Sugestões de Melhoria Constante</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {result.risco.sugestoes.map(s => (
                  <div key={s.id} style={{ fontSize: 12, color: "#F5F1E8" }}>
                    <span style={{ color: "#E8C97A", fontWeight: 700 }}>{DIMENSAO_LABELS[s.dimension] ?? s.dimension}:</span> {s.suggestion}
                  </div>
                ))}
              </div>
            </div>
          )}

          <ResultSection
            icon={<CreditCard size={16} color="#10B981" />}
            title="Crédito"
            count={result.credito?.length ?? 0}
            href="/mesa-credito"
          >
            {(result.credito ?? []).map(p => (
              <RowItem key={p.id} title={`${p.code} · ${p.credit_line}`} sub={`${p.stage} · ${formatMoney(p.requested_value)}`} />
            ))}
          </ResultSection>

          <ResultSection
            icon={<Gavel size={16} color="#C9A84C" />}
            title="Bolsa de Ativos"
            count={result.bolsa_de_ativos?.length ?? 0}
            href="/bolsa/mesa"
          >
            {(result.bolsa_de_ativos ?? []).map(l => (
              <RowItem key={l.id} title={`${l.numero_interno ?? l.id.slice(0, 8)} · ${l.asset_type}`} sub={`${l.listing_status} · ${formatMoney(l.valor_face)}`} />
            ))}
          </ResultSection>

          <ResultSection
            icon={<ShieldCheck size={16} color="#6366F1" />}
            title="Credit Engine (Análises)"
            count={result.credit_engine?.length ?? 0}
          >
            {(result.credit_engine ?? []).map(c => (
              <RowItem key={c.id} title={`Tier ${c.tier} · Score ${c.score_total}/1000`} sub={c.analysis_type} />
            ))}
          </ResultSection>

          <ResultSection
            icon={<Handshake size={16} color="#F59E0B" />}
            title="Cadastro de Partner"
            count={result.partners?.length ?? 0}
          >
            {(result.partners ?? []).map(p => (
              <RowItem key={p.id} title={p.nome_completo} sub={`${p.plano} · ${p.status}`} />
            ))}
          </ResultSection>

          <ResultSection
            icon={<Building size={16} color="#3B82F6" />}
            title="M&A"
            count={result.ma?.length ?? 0}
            href="/mesa-ma"
          >
            {(result.ma ?? []).map(m => {
              const meta = MA_STATUS_META[m.status] ?? MA_STATUS_META.prospecto;
              return (
                <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 10px", background: "#162744", borderRadius: 6 }}>
                  <div>
                    <div style={{ color: "#F5F1E8", fontWeight: 600, fontSize: 12 }}>{m.ma_deals?.code ?? "-"} · {m.ma_deals?.title ?? ""}</div>
                    <div style={{ color: "#9BAFC5", fontSize: 11, marginTop: 2 }}>{m.role ? ROLE_LABELS[m.role] : "Papel indefinido"}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, color: meta.color, background: meta.bg, flexShrink: 0 }}>{meta.label}</span>
                </div>
              );
            })}
          </ResultSection>

          <ResultSection
            icon={<FileCheck2 size={16} color="#EF4444" />}
            title="KYC (Análises de Compliance)"
            count={result.kyc?.length ?? 0}
          >
            {(result.kyc ?? []).map(k => (
              <RowItem key={k.id} title={`${k.verdict} · Score ${k.score}`} sub={`${k.risk_label} · ${k.dd_level}`} />
            ))}
          </ResultSection>

          <ResultSection
            icon={<FileSignature size={16} color="#E8C97A" />}
            title="Contratos"
            count={result.contratos?.length ?? 0}
          >
            {(result.contratos ?? []).map(c => (
              <RowItem key={c.id} title={c.contract_code ?? c.contract_title} sub={`${c.contract_title} · ${c.status_signature}`} />
            ))}
          </ResultSection>
        </div>
      )}
    </div>
  );
}

function ResultSection({ icon, title, count, href, children }: { icon: React.ReactNode; title: string; count: number; href?: string; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <div style={{ background: "#13223A", border: "1px solid #162744", borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {icon}
          <span style={{ fontSize: 13, fontWeight: 700, color: "#F5F1E8" }}>{title}</span>
          <span style={{ fontSize: 10, color: "#9BAFC5" }}>({count})</span>
        </div>
        {href && (
          <Link href={href} style={{ fontSize: 10, color: "#C9A84C", textDecoration: "none" }}>
            Ver na mesa →
          </Link>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}

function RowItem({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ padding: "8px 10px", background: "#162744", borderRadius: 6, fontSize: 12 }}>
      <div style={{ color: "#F5F1E8", fontWeight: 600 }}>{title}</div>
      <div style={{ color: "#9BAFC5", fontSize: 11, marginTop: 2 }}>{sub}</div>
    </div>
  );
}
