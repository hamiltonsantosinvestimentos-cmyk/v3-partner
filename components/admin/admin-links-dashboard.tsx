"use client";

import { useEffect, useState } from "react";
import { Loader2, Link2, Wallet, MousePointerClick, AlertTriangle } from "lucide-react";

const N2 = "#13223A", N3 = "#162744", N4 = "#243A66";
const GO = "#C9A84C", GL = "#E8C97A", CR = "#F5F1E8", MU = "#9BAFC5";

interface AdminLink {
  id: string;
  token: string;
  title: string;
  service_type: string;
  price_cents: number;
  active: boolean;
  total_uses: number;
  total_paid_cents: number;
  created_at: string;
  expires_at: string | null;
  partner: { full_name?: string } | null;
  credit_desk_proposals: { code: string; client_name: string } | null;
  ma_deals: { code: string; target_company: string | null; title: string } | null;
}

function fmt(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}
// Correção 14/09/2026, achada testando ao vivo: Math.ceil() de uma diferença
// negativa pequena (expirado há menos de 24h) vira -0/0, e "-0 >= 0" é true
// em JS -- um link recém-expirado contava como "ativo" nos KPIs. isExpired()
// usa comparação de data direta pra essa decisão; daysUntil() só formata a
// contagem regressiva de quem ainda não expirou.
function isExpired(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}
function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

const SERVICE_LABEL: Record<string, string> = {
  credit_analysis: "Análise de Crédito",
  ma_intake: "Intake M&A",
  due_diligence: "Due Diligence",
  captacao: "Formulário de Interesse",
};

function StatusCell({ link }: { link: AdminLink }) {
  if (!link.active) return <span style={{ color: MU, fontSize: 11, fontWeight: 700 }}>Inativo</span>;
  if (!link.expires_at) return <span style={{ color: "#4ade80", fontSize: 11, fontWeight: 700 }}>Ativo · sem prazo</span>;
  if (isExpired(link.expires_at)) return <span style={{ color: "#f87171", fontSize: 11, fontWeight: 700 }}>Expirado</span>;
  const days = daysUntil(link.expires_at);
  const soon = days <= 3;
  return (
    <span style={{ color: soon ? "#f87171" : "#4ade80", fontSize: 11, fontWeight: 700 }}>
      {days === 0 ? "Expira hoje" : `Ativo · ${days}d`}
    </span>
  );
}

export function AdminLinksDashboard() {
  const [links, setLinks] = useState<AdminLink[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/partner/service-links")
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setLinks(d.links ?? []); })
      .catch(() => setError("Erro de rede."));
  }, []);

  if (error) return <div style={{ color: "#f87171", fontSize: 13 }}>{error}</div>;
  if (!links) return <div style={{ textAlign: "center", padding: 40 }}><Loader2 size={24} color={GO} className="animate-spin" /></div>;

  const ativos = links.filter(l => l.active && (!l.expires_at || !isExpired(l.expires_at)));
  const expirandoEm3d = links.filter(l => l.active && l.expires_at && !isExpired(l.expires_at) && daysUntil(l.expires_at) <= 3);
  const receitaTotal = links.reduce((a, l) => a + l.total_paid_cents, 0);

  const kpi = { background: N2, border: `1px solid ${N4}`, borderRadius: 10, padding: "16px 20px" };
  const kLabel = { fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: GL, marginBottom: 6 };
  const kVal = { fontSize: 22, fontWeight: 800, color: CR };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 24 }}>
        <div style={kpi}>
          <div style={kLabel}><Link2 size={10} style={{ display: "inline", marginRight: 4 }} />Total de links</div>
          <div style={kVal}>{links.length}</div>
        </div>
        <div style={kpi}>
          <div style={kLabel}><MousePointerClick size={10} style={{ display: "inline", marginRight: 4 }} />Ativos agora</div>
          <div style={kVal}>{ativos.length}</div>
        </div>
        <div style={kpi}>
          <div style={kLabel}><AlertTriangle size={10} style={{ display: "inline", marginRight: 4 }} />Expirando em ≤3 dias</div>
          <div style={{ ...kVal, color: expirandoEm3d.length > 0 ? "#f87171" : CR }}>{expirandoEm3d.length}</div>
        </div>
        <div style={kpi}>
          <div style={kLabel}><Wallet size={10} style={{ display: "inline", marginRight: 4 }} />Receita total gerada</div>
          <div style={{ ...kVal, color: GO }}>{fmt(receitaTotal)}</div>
        </div>
      </div>

      {links.length === 0 ? (
        <div style={{ background: N2, border: `1px solid ${N4}`, borderRadius: 10, padding: 40, textAlign: "center", color: MU, fontSize: 13 }}>
          Nenhum Link de Serviço criado ainda por nenhum partner.
        </div>
      ) : (
        <div style={{ background: N2, border: `1px solid ${N4}`, borderRadius: 10, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${N4}` }}>
                {["Partner", "Link", "Tipo", "Vínculo", "Preço", "Status", "Usos", "Receita", "Criado em"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 14px", color: GL, fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {links.map(l => (
                <tr key={l.id} style={{ borderBottom: `1px solid ${N3}` }}>
                  <td style={{ padding: "10px 14px", color: CR, fontWeight: 600, whiteSpace: "nowrap" }}>{l.partner?.full_name ?? "—"}</td>
                  <td style={{ padding: "10px 14px", color: CR, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title}</td>
                  <td style={{ padding: "10px 14px", color: MU }}>{SERVICE_LABEL[l.service_type] ?? l.service_type}</td>
                  <td style={{ padding: "10px 14px", color: MU, fontSize: 11 }}>
                    {l.credit_desk_proposals ? `${l.credit_desk_proposals.code}` : l.ma_deals ? `${l.ma_deals.code}` : "—"}
                  </td>
                  <td style={{ padding: "10px 14px", color: GO, fontWeight: 700 }}>{fmt(l.price_cents)}</td>
                  <td style={{ padding: "10px 14px" }}><StatusCell link={l} /></td>
                  <td style={{ padding: "10px 14px", color: CR }}>{l.total_uses}</td>
                  <td style={{ padding: "10px 14px", color: l.total_paid_cents > 0 ? "#4ade80" : MU }}>{fmt(l.total_paid_cents)}</td>
                  <td style={{ padding: "10px 14px", color: MU, whiteSpace: "nowrap" }}>{fmtDate(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
