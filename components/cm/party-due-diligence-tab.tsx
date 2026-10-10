"use client";

// Aba Due Diligence da Ficha de Qualificacao, Entrega 1 (08/10/2026).
// BRIEF: 06_Operacional/SOPs/2026-10-08_Operacional_BRIEF-Aba-Due-Diligence-Ficha-Qualificacao_v1.md
// Nesta entrega: so parte PJ (CNPJ); sem nome ou CPF de socio; SCR detalhado do CPF desabilitado.
// Confirmacao de consulta em modal V3 que so fecha por botao (nunca clicando fora).

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Dica } from "@/components/shared/dica";
import { aviso } from "@/lib/aviso";
import { ddSummaryLines } from "@/lib/cm/dd-summary";

export type DdToolId = "receita" | "blacklist" | "escavador" | "datajud" | "scr_cnpj" | "scr_cpf";

const TOOL_LABELS: Record<DdToolId, string> = {
  receita: "Receita / CNPJ",
  blacklist: "Black List V3",
  escavador: "Escavador",
  datajud: "Datajud",
  scr_cnpj: "SCR do CNPJ",
  scr_cpf: "SCR do CPF",
};
const PAID_TOOLS: DdToolId[] = ["escavador", "scr_cnpj", "scr_cpf"];

type DdRun = {
  id: string;
  tool: DdToolId;
  status: "ok" | "sem_dados" | "nao_consultado";
  result_summary: Record<string, any>;
  contract_code: string | null;
  reuse_reason?: string | null;
  has_raw?: boolean;
  requested_by_name?: string;
  created_at: string;
};

export type DdInitial = {
  report_block_reason?: string | null;
  document: { kind: "cpf" | "cnpj" | null; available: boolean; reason?: string };
  pf_blocked_reason: string | null;
  contract_code: string | null;
  tools: DdToolId[];
  recent_days: number;
  recent: DdRun[];
  runs: DdRun[];
};

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

const STATUS_BADGE: Record<DdRun["status"], { text: string; cls: string }> = {
  ok: { text: "CONSULTADO", cls: "text-emerald-400 border-emerald-400/40" },
  sem_dados: { text: "SEM DADOS", cls: "text-[#E8C97A] border-[#C9A84C]/40" },
  nao_consultado: { text: "NÃO CONSULTADO", cls: "text-[#E24B4A] border-[#E24B4A]/40" },
};

function summaryLines(run: DdRun): string[] {
  return ddSummaryLines(run.tool, run.status, run.result_summary);
}

type Pending = { tool: DdToolId; recent: DdRun | null };

export function PartyDueDiligenceTab({ qualificationId, partyName, initial }: { qualificationId: string; partyName: string; initial: DdInitial }) {
  const [data, setData] = useState<DdInitial>(initial);
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState("");
  const [running, setRunning] = useState<DdToolId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<{ id: string; contract_code: string; file_name: string; folder_path: string; created_at: string; created_by_name: string; expires_br: string }[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [access, setAccess] = useState<{ days: number; alert_limit: number; items: { who: string; contract_code: string; party_short: string; ip_masked: string; at_br: string; above_usual: boolean }[] } | null>(null);
  const [rawView, setRawView] = useState<{ loading: boolean; error: string | null; data: unknown } | null>(null);

  const loadReports = useCallback(async () => {
    const res = await fetch(`/api/cm/qualifications/party/${qualificationId}/due-diligence/reports`);
    if (res.ok) setReports((await res.json()).reports ?? []);
  }, [qualificationId]);

  useEffect(() => {
    void loadReports();
    // Monitoramento: so ADMIN com a permissao; qualquer outro recebe 403 e a secao nao aparece.
    fetch("/api/cm/due-diligence/access").then(async (res) => { if (res.ok) setAccess(await res.json()); }).catch(() => {});
  }, [loadReports]);

  async function generateReport() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/cm/qualifications/party/${qualificationId}/due-diligence/reports`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { aviso(json.error ?? "Não foi possível gerar o relatório"); return; }
      aviso("Relatório gerado e guardado na pasta de compliance.");
      await loadReports();
    } catch {
      aviso("Erro de conexão: o relatório não foi gerado");
    } finally {
      setGenerating(false);
    }
  }

  async function openReport(reportId: string) {
    // A janela abre de forma sincrona no clique, senao o bloqueador de pop-up barra.
    const win = window.open("", "_blank");
    try {
      const res = await fetch(`/api/cm/qualifications/party/${qualificationId}/due-diligence/reports/${reportId}/open`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) { win?.close(); aviso(json.error ?? "Não foi possível abrir o relatório"); return; }
      if (win) win.location.href = json.url;
      // a abertura acabou de ser registrada: atualiza o monitoramento
      fetch("/api/cm/due-diligence/access").then(async (r) => { if (r.ok) setAccess(await r.json()); }).catch(() => {});
    } catch {
      win?.close();
      aviso("Erro de conexão ao abrir o relatório");
    }
  }

  async function openRaw(runId: string) {
    setRawView({ loading: true, error: null, data: null });
    try {
      const res = await fetch(`/api/cm/qualifications/party/${qualificationId}/due-diligence/runs/${runId}/raw`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setRawView({ loading: false, error: json.error ?? "Não foi possível abrir o detalhe", data: null }); return; }
      setRawView({ loading: false, error: null, data: json.raw });
    } catch {
      setRawView({ loading: false, error: "Erro de conexão", data: null });
    }
  }

  const reload = useCallback(async () => {
    const res = await fetch(`/api/cm/qualifications/party/${qualificationId}/due-diligence`);
    if (res.ok) setData(await res.json());
  }, [qualificationId]);

  const available = data.document.available;
  const recentFor = (tool: DdToolId) => data.recent.find((r) => r.tool === tool) ?? null;

  async function execute(force: boolean) {
    if (!pending) return;
    const tool = pending.tool;
    setRunning(tool);
    setError(null);
    try {
      const res = await fetch(`/api/cm/qualifications/party/${qualificationId}/due-diligence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool, force, reason: force ? reason : undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409 && json.recent) {
        setPending({ tool, recent: json.recent });
        return;
      }
      if (!res.ok) { setError(json.error ?? "Não foi possível consultar"); setPending(null); return; }
      setPending(null);
      setReason("");
      await reload();
    } catch {
      setError("Erro de conexão: a consulta não foi concluída");
      setPending(null);
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[12px] text-[#9BAFC5]">
        <ShieldCheck size={14} className="text-[#C9A84C]" />
        <span>
          {data.contract_code ? <>Contrato de origem: <span className="text-[#F5F1E8] font-semibold">{data.contract_code}</span></> : "Parte sem contrato de origem vinculado ao lote"}
        </span>
      </div>

      {!available && (
        <p className="text-[12px] text-[#9BAFC5] bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-3">
          {data.pf_blocked_reason ?? data.document.reason ?? "Consultas indisponíveis para esta parte"}
        </p>
      )}

      {data.recent.length > 0 && (
        <div className="bg-[#12112A] border border-[#C9A84C]/30 rounded-lg p-3 space-y-1">
          <p className="text-[12px] font-bold text-[#E8C97A] uppercase">Due Diligence recente (menos de {data.recent_days} dias)</p>
          {data.recent.map((r) => (
            <p key={r.id} className="text-[12px] text-[#F5F1E8]">
              {TOOL_LABELS[r.tool]} feita em {fmtDate(r.created_at)}{r.contract_code ? ` (${r.contract_code})` : ""}. Evite refazer: o resumo está no histórico abaixo.
            </p>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[12px] font-bold text-[#E8C97A] uppercase">Consultas</p>
        <div className="flex flex-wrap gap-2">
          {data.tools.map((tool) => (
            <button
              key={tool}
              type="button"
              disabled={!available || running !== null}
              onClick={() => { setError(null); setReason(""); setPending({ tool, recent: recentFor(tool) }); }}
              className="text-[12px] font-semibold text-[#F5F1E8] border border-[#C9A84C]/40 rounded px-3 py-1.5 hover:border-[#C9A84C] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            >
              {running === tool && <Loader2 size={12} className="animate-spin" />} {TOOL_LABELS[tool]}
            </button>
          ))}
          {data.document.kind === "cnpj" && (
            <button
              type="button"
              disabled
              title="Disponível em entrega seguinte"
              className="text-[12px] font-semibold text-[#9BAFC5] border border-[#9BAFC5]/20 rounded px-3 py-1.5 opacity-40 cursor-not-allowed"
            >
              SCR detalhado de sócio
            </button>
          )}
        </div>
        {data.document.kind === "cnpj" && (
          <p className="text-[12px] text-[#9BAFC5]/80">Consulta dos sócios (nome, CPF e SCR detalhado): disponível em entrega seguinte.</p>
        )}
        {error && <p className="text-[12px] text-[#E24B4A]">{error}</p>}
      </div>

      <div className="space-y-2 pt-2 border-t border-[#9BAFC5]/10">
        <p className="text-[12px] font-bold text-[#E8C97A] uppercase">Histórico desta parte <Dica id="consultas" /></p>
        {data.runs.length === 0 && <p className="text-[12px] text-[#9BAFC5]">Nenhuma consulta feita para esta parte</p>}
        {data.runs.map((r) => (
          <div key={r.id} className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-2.5 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12px] text-[#F5F1E8] font-bold">{TOOL_LABELS[r.tool]}</p>
              <span className="inline-flex items-center gap-1"><span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${STATUS_BADGE[r.status].cls}`}>{STATUS_BADGE[r.status].text}</span>{r.status === "nao_consultado" && <Dica id="selo_nao_consultado" />}{r.status === "sem_dados" && <Dica id="selo_sem_dados" />}</span>
            </div>
            {summaryLines(r).map((l, i) => <p key={i} className="text-[12px] text-[#9BAFC5]">{l}</p>)}
            {r.has_raw && (
              <span className="inline-flex items-center gap-1"><button type="button" onClick={() => openRaw(r.id)} className="text-[12px] font-semibold text-[#E8C97A] underline">
                Ver detalhe (a abertura fica registrada)
              </button><Dica id={r.tool === "scr_cnpj" || r.tool === "scr_cpf" ? "scr_detalhe" : "revelar_dado"} /></span>
            )}
            <p className="text-[11px] text-[#9BAFC5]/70">
              {r.requested_by_name ?? "Usuário"} · {fmtDateTime(r.created_at)}{r.contract_code ? ` · ${r.contract_code}` : ""}
              {r.reuse_reason ? ` · Nova consulta: ${r.reuse_reason}` : ""}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-2 pt-2 border-t border-[#9BAFC5]/10">
        <p className="text-[12px] font-bold text-[#E8C97A] uppercase">Relatórios de compliance <Dica id="gerar_relatorio" /></p>
        <p className="text-[12px] text-[#9BAFC5]">Pasta: Compliance/DueDiligence. O relatório é guardado por 12 meses e cada abertura fica registrada. <Dica id="pasta_compliance" /></p>
        <button
          type="button"
          onClick={generateReport}
          disabled={generating || !!data.report_block_reason || !data.document.available}
          title={data.report_block_reason ?? undefined}
          className="text-[12px] font-semibold text-[#F5F1E8] border border-[#C9A84C]/40 rounded px-3 py-1.5 hover:border-[#C9A84C] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
        >
          {generating && <Loader2 size={12} className="animate-spin" />} Gerar relatório
        </button>
        {data.report_block_reason && <p className="text-[12px] text-[#9BAFC5]">{data.report_block_reason}</p>}
        {reports && reports.length === 0 && <p className="text-[12px] text-[#9BAFC5]">Nenhum relatório gerado para esta parte</p>}
        {(reports ?? []).map((r) => (
          <div key={r.id} className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-2.5 space-y-1">
            <p className="text-[12px] text-[#F5F1E8] font-bold break-all">{r.file_name}</p>
            <p className="text-[11px] text-[#9BAFC5]">{fmtDateTime(r.created_at)} · {r.created_by_name} · será apagado em {r.expires_br}</p>
            <button type="button" onClick={() => openReport(r.id)} className="text-[12px] font-semibold text-[#E8C97A] underline">
              Abrir (a abertura fica registrada)
            </button>
          </div>
        ))}
      </div>

      {access && (
        <div className="space-y-2 pt-2 border-t border-[#9BAFC5]/10">
          <p className="text-[12px] font-bold text-[#E8C97A] uppercase">Acessos aos relatórios (últimos {access.days} dias) <Dica id="acessos_relatorios" /></p>
          {access.items.length === 0 && <p className="text-[12px] text-[#9BAFC5]">Nenhum relatório foi aberto no período</p>}
          {access.items.map((a, i) => (
            <p key={i} className="text-[12px] text-[#9BAFC5]">
              <span className="text-[#F5F1E8]">{a.who}</span> · {a.at_br} · {a.contract_code} · parte {a.party_short} · IP {a.ip_masked}
              {a.above_usual && <span className="ml-2 text-[#F5B942] font-bold">Acesso acima do usual</span>}
            </p>
          ))}
        </div>
      )}

      {rawView && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/75 p-4">
          <div role="dialog" aria-modal="true" aria-label="Detalhe da consulta" className="w-full max-w-lg max-h-[80vh] overflow-y-auto bg-[#09081A] border border-[#C9A84C]/40 rounded-xl p-4 space-y-3">
            <p className="text-sm font-bold text-[#F5F1E8]">Detalhe da consulta</p>
            {rawView.loading && <Loader2 size={16} className="animate-spin text-[#C9A84C]" />}
            {rawView.error && <p className="text-[12px] text-[#E24B4A]">{rawView.error}</p>}
            {rawView.data != null && (
              <pre className="whitespace-pre-wrap break-words text-[11px] text-[#9BAFC5]">{JSON.stringify(rawView.data, null, 2)}</pre>
            )}
            <div className="flex justify-end">
              <button type="button" onClick={() => setRawView(null)} className="text-[12px] font-semibold text-[#F5F1E8] border border-[#9BAFC5]/30 rounded px-3 py-1.5">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {pending && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/75 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="dd-confirm-title" className="w-full max-w-md bg-[#09081A] border border-[#C9A84C]/40 rounded-xl p-4 space-y-3">
            <p id="dd-confirm-title" className="text-sm font-bold text-[#F5F1E8]">
              {pending.recent ? "Já existe consulta recente" : `Consultar ${TOOL_LABELS[pending.tool]}`}{" "}
              <Dica id={pending.recent ? "consulta_recente" : pending.tool === "scr_cnpj" || pending.tool === "scr_cpf" ? "scr" : "consultas"} />
            </p>
            <p className="text-[12px] text-[#9BAFC5]">Parte: <span className="text-[#F5F1E8]">{partyName}</span></p>
            {pending.recent ? (
              <>
                <p className="text-[12px] text-[#F5F1E8]">
                  {TOOL_LABELS[pending.tool]} já foi consultada em {fmtDate(pending.recent.created_at)}{pending.recent.contract_code ? ` (${pending.recent.contract_code})` : ""}. Reaproveite o resultado do histórico para evitar retrabalho e custo.
                </p>
                <label className="block text-[12px] text-[#9BAFC5]">
                  Motivo para consultar de novo (mínimo de 10 caracteres)
                  <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="mt-1 w-full bg-[#12112A] border border-[#9BAFC5]/20 rounded p-2 text-[12px] text-[#F5F1E8]" />
                </label>
              </>
            ) : (
              <p className="text-[12px] text-[#F5F1E8]">
                {PAID_TOOLS.includes(pending.tool) ? "Esta é uma consulta paga e fica registrada em seu nome. Deseja continuar?" : "A consulta fica registrada em seu nome. Deseja continuar?"}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPending(null)} disabled={running !== null} className="text-[12px] font-semibold text-[#F5F1E8] border border-[#9BAFC5]/30 rounded px-3 py-1.5 disabled:opacity-50">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => execute(!!pending.recent)}
                disabled={running !== null || (!!pending.recent && reason.trim().length < 10)}
                className="text-[12px] font-semibold text-[#09081A] bg-[#C9A84C] rounded px-3 py-1.5 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {running !== null && <Loader2 size={12} className="animate-spin" />} {pending.recent ? "Consultar mesmo assim" : "Consultar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
