"use client";

import { useState } from "react";
import { Loader2, FileBarChart2, ExternalLink, Sparkles } from "lucide-react";

export interface SociosReport {
  id: string;
  title: string;
  created_at: string;
}

type Periodo = "semanal" | "mensal";
type Mesa = "todas" | "ma" | "bolsa_ativos";

const MESA_LABELS: Record<Mesa, string> = {
  todas: "Mesa M&A + Bolsa de Ativos",
  ma: "Mesa M&A",
  bolsa_ativos: "Bolsa de Ativos",
};

interface Props {
  userName: string;
  reports: SociosReport[];
}

// Portal dos Sócios, Fase 1 (05/09/2026): painel de governança restrito a
// ADMIN, com filtro de Mesa + Período e geração sob demanda do Relatório
// Gerencial (reaproveita POST /api/socios/relatorio-gerencial, que por sua
// vez reaproveita a mesma lib do cron já agendado, sem lógica duplicada).
export function SociosClient({ userName, reports: initialReports }: Props) {
  const [mesa, setMesa] = useState<Mesa>("todas");
  const [periodo, setPeriodo] = useState<Periodo>("semanal");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [reports, setReports] = useState<SociosReport[]>(initialReports);

  async function gerarAgora() {
    setGerando(true);
    setErro(null);
    try {
      const res = await fetch("/api/socios/relatorio-gerencial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: periodo, mesa }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErro(json.error ?? "Falha ao gerar o relatório.");
        return;
      }
      if (json.report_id) {
        setReports((prev) => [{ id: json.report_id, title: `Relatório Gerencial ${periodo === "semanal" ? "Semanal" : "Mensal"}, ${MESA_LABELS[mesa]} (${json.period})`, created_at: new Date().toISOString() }, ...prev]);
        window.open(`/api/relatorios/generated?id=${json.report_id}`, "_blank");
      }
    } catch {
      setErro("Falha de rede ao gerar o relatório. Tente novamente.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-[#F0ECE4]">Painel da Diretoria</h1>
        <p className="text-sm text-[#7A8FA8] mt-1">
          Bem-vindo(a), {userName || "Diretoria"}. Governança e relatórios gerenciais da Mesa M&A e Bolsa de Ativos, restrito aos sócios.
        </p>
      </div>

      <div className="rounded-xl border border-[#243A66] bg-[#162744] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <FileBarChart2 className="w-4 h-4 text-[#C9A84C]" />
          <h2 className="text-sm font-semibold text-[#F0ECE4]">Relatório Gerencial</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#7A8FA8] mb-1.5 block">Mesa</label>
            <select
              value={mesa}
              onChange={(e) => setMesa(e.target.value as Mesa)}
              className="w-full h-9 rounded-lg border border-[#243A66] bg-[#09081A] text-[#F0ECE4] text-sm px-3 focus:outline-none focus:border-[#C9A84C]/50"
            >
              <option value="todas">Mesa M&amp;A + Bolsa de Ativos</option>
              <option value="ma">Mesa M&amp;A</option>
              <option value="bolsa_ativos">Bolsa de Ativos</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#7A8FA8] mb-1.5 block">Período</label>
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as Periodo)}
              className="w-full h-9 rounded-lg border border-[#243A66] bg-[#09081A] text-[#F0ECE4] text-sm px-3 focus:outline-none focus:border-[#C9A84C]/50"
            >
              <option value="semanal">Semanal (últimos 7 dias)</option>
              <option value="mensal">Mensal (mês anterior)</option>
            </select>
          </div>
        </div>

        {erro && <p className="text-xs text-red-400">{erro}</p>}

        <button
          onClick={gerarAgora}
          disabled={gerando}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-semibold text-sm transition-colors disabled:opacity-50"
        >
          {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {gerando ? "Gerando..." : "Gerar Relatório Agora"}
        </button>
        <p className="text-[11px] text-[#5A7490]">
          Também gerado automaticamente toda segunda-feira (semanal) e no dia 1 de cada mês (mensal). Aparece aqui e em <code className="text-[#9BAFC5]">/relatorios</code> para as próprias mesas.
        </p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-[#F0ECE4] mb-3">Relatórios já gerados</h2>
        {reports.length === 0 ? (
          <p className="text-xs text-[#7A8FA8]">Nenhum relatório gerado ainda para este filtro. Clique em "Gerar Relatório Agora".</p>
        ) : (
          <div className="space-y-2">
            {reports.map((r) => (
              <a
                key={r.id}
                href={`/api/relatorios/generated?id=${r.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-lg border border-[#243A66] bg-[#162744] px-4 py-3 hover:border-[#C9A84C]/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm text-[#F0ECE4] truncate">{r.title}</p>
                  <p className="text-[10px] text-[#7A8FA8] mt-0.5">{new Date(r.created_at).toLocaleString("pt-BR")}</p>
                </div>
                <ExternalLink className="w-4 h-4 text-[#7A8FA8] flex-shrink-0" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
