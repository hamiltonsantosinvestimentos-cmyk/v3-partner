"use client";

import { useState } from "react";
import { Search, User, Building2, CreditCard, Gavel, ShieldCheck, Handshake } from "lucide-react";
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
}

function formatMoney(v: number | null | undefined) {
  if (v === null || v === undefined) return "-";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Casca (MVP) do Registro Central de Cliente, Fase 1, 08/08/2026. Cobre só
// as 4 verticais que já têm v3_client_id: Crédito, Bolsa de Ativos, Credit
// Engine e Partners. M&A, CRM e Consórcios ficam de fora até terem coluna
// normalizada de CPF/CNPJ própria (ver BRIEF aprovado por João).
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
