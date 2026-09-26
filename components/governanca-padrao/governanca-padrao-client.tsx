"use client";

import { useMemo, useState } from "react";
import { ShieldCheck, AlertTriangle, ListChecks, Layers, Calendar, ExternalLink } from "lucide-react";

export interface GovernanceFeatureRow {
  id: string;
  name: string;
  area: string;
  kind: "route" | "page" | "component" | "lib_compartilhada";
  paths: string[];
  status: "pendente" | "em_auditoria" | "auditado" | "corrigido";
  last_audit_run_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface GovernanceFindingRow {
  id: string;
  feature_id: string;
  audit_run_id: string;
  rule_id: string;
  severity: "bloqueante" | "sugestao";
  summary: string;
  file_path: string | null;
  line_hint: string | null;
  correction_required: string;
  status: "aberto" | "em_correcao" | "corrigido" | "aceito_com_ressalva";
  pr_url: string | null;
  scheduled_for: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<GovernanceFeatureRow["status"], string> = {
  pendente: "Pendente",
  em_auditoria: "Em Auditoria",
  auditado: "Auditado",
  corrigido: "Corrigido",
};

const STATUS_COLOR: Record<GovernanceFeatureRow["status"], string> = {
  pendente: "bg-[#243A66] text-[#9BAFC5]",
  em_auditoria: "bg-[#C9A84C]/20 text-[#E8C97A]",
  auditado: "bg-[#1E4D8C]/25 text-[#9BAFC5]",
  corrigido: "bg-emerald-500/15 text-emerald-400",
};

const FINDING_STATUS_LABEL: Record<GovernanceFindingRow["status"], string> = {
  aberto: "Aberto",
  em_correcao: "Em Correção",
  corrigido: "Corrigido",
  aceito_com_ressalva: "Aceito com Ressalva",
};

function fmtDate(value: string | null): string {
  if (!value) return "sem data";
  return new Date(value + "T00:00:00").toLocaleDateString("pt-BR");
}

function Kpi({ icon: Icon, label, value, accent }: { icon: typeof ShieldCheck; label: string; value: number | string; accent?: string }) {
  return (
    <div className="bg-[#162744] border border-[#243A66] rounded-xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${accent ?? "bg-[#243A66] text-[#C9A84C]"}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[20px] font-bold text-[#F5F1E8] leading-none">{value}</p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#9BAFC5] mt-1">{label}</p>
      </div>
    </div>
  );
}

export function GovernancaPadraoClient({ features, findings }: { features: GovernanceFeatureRow[]; findings: GovernanceFindingRow[] }) {
  const [tab, setTab] = useState<"agenda" | "funcionalidades">("agenda");

  const featureById = useMemo(() => new Map(features.map((f) => [f.id, f])), [features]);

  const totalFeatures = features.length;
  const auditadas = features.filter((f) => f.status === "auditado" || f.status === "corrigido").length;
  const pendentes = totalFeatures - auditadas;
  const achadosAbertos = findings.filter((f) => f.status === "aberto").length;
  const bloqueantesAbertos = findings.filter((f) => f.status === "aberto" && f.severity === "bloqueante").length;

  const agenda = findings.filter((f) => f.status === "aberto" || f.status === "em_correcao");

  if (totalFeatures === 0) {
    return (
      <div className="space-y-5">
        <Header />
        <div className="bg-[#162744] border border-[#243A66] rounded-xl p-10 text-center">
          <ShieldCheck className="w-10 h-10 text-[#9BAFC5] mx-auto mb-3" />
          <p className="text-[#F5F1E8] font-semibold">Nenhuma varredura executada ainda</p>
          <p className="text-[13px] text-[#9BAFC5] mt-1 max-w-md mx-auto">
            A rotina agendada em nuvem ainda não gravou nenhuma funcionalidade auditada
            via <code className="text-[#E8C97A]">POST /api/governance/ingest</code>. Esta
            tela preenche sozinha assim que a primeira rodada do agente
            <code className="text-[#E8C97A]"> @v3-governance-qa</code> for concluída.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Header />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi icon={Layers} label="Funcionalidades" value={totalFeatures} />
        <Kpi icon={ShieldCheck} label="Auditadas" value={`${auditadas} / ${totalFeatures}`} accent="bg-emerald-500/15 text-emerald-400" />
        <Kpi icon={Calendar} label="Pendentes" value={pendentes} />
        <Kpi icon={ListChecks} label="Achados abertos" value={achadosAbertos} />
        <Kpi icon={AlertTriangle} label="Bloqueantes abertos" value={bloqueantesAbertos} accent="bg-red-500/15 text-red-400" />
      </div>

      <div className="flex items-center gap-1 bg-[#0D1929] border border-[#243A66] rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("agenda")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "agenda" ? "bg-[#C9A84C] text-[#09081A]" : "text-[#9BAFC5] hover:text-[#F5F1E8]"}`}
        >
          <Calendar className="w-4 h-4" />
          Agenda de Correção
        </button>
        <button
          onClick={() => setTab("funcionalidades")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "funcionalidades" ? "bg-[#C9A84C] text-[#09081A]" : "text-[#9BAFC5] hover:text-[#F5F1E8]"}`}
        >
          <Layers className="w-4 h-4" />
          Funcionalidades
        </button>
      </div>

      {tab === "agenda" && (
        <div className="bg-[#162744] border border-[#243A66] rounded-xl overflow-hidden">
          {agenda.length === 0 ? (
            <p className="text-center text-[13px] text-[#9BAFC5] py-10">Nenhum achado em aberto — pipeline limpo.</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-[#9BAFC5] border-b border-[#243A66]">
                  <th className="px-4 py-3">Regra</th>
                  <th className="px-4 py-3">Funcionalidade</th>
                  <th className="px-4 py-3">Achado</th>
                  <th className="px-4 py-3">Agendado para</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">PR</th>
                </tr>
              </thead>
              <tbody>
                {agenda.map((f) => (
                  <tr key={f.id} className="border-b border-[#243A66]/50 last:border-0">
                    <td className="px-4 py-3 align-top">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${f.severity === "bloqueante" ? "bg-red-500/15 text-red-400" : "bg-[#243A66] text-[#9BAFC5]"}`}>
                        {f.rule_id}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-[#F5F1E8]">{featureById.get(f.feature_id)?.name ?? "—"}</td>
                    <td className="px-4 py-3 align-top text-[#9BAFC5] max-w-md">
                      <p className="text-[#F5F1E8]">{f.summary}</p>
                      {f.file_path && <p className="text-[11px] mt-0.5">{f.file_path}{f.line_hint ? `:${f.line_hint}` : ""}</p>}
                    </td>
                    <td className="px-4 py-3 align-top text-[#9BAFC5]">{fmtDate(f.scheduled_for)}</td>
                    <td className="px-4 py-3 align-top text-[#9BAFC5]">{FINDING_STATUS_LABEL[f.status]}</td>
                    <td className="px-4 py-3 align-top">
                      {f.pr_url ? (
                        <a href={f.pr_url} target="_blank" rel="noreferrer" className="text-[#E8C97A] hover:underline inline-flex items-center gap-1">
                          Ver PR <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-[#9BAFC5]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "funcionalidades" && (
        <div className="bg-[#162744] border border-[#243A66] rounded-xl overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-[#9BAFC5] border-b border-[#243A66]">
                <th className="px-4 py-3">Funcionalidade</th>
                <th className="px-4 py-3">Área</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {features.map((f) => (
                <tr key={f.id} className="border-b border-[#243A66]/50 last:border-0">
                  <td className="px-4 py-3 text-[#F5F1E8]">{f.name}</td>
                  <td className="px-4 py-3 text-[#9BAFC5]">{f.area}</td>
                  <td className="px-4 py-3 text-[#9BAFC5]">{f.kind}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${STATUS_COLOR[f.status]}`}>{STATUS_LABEL[f.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-[20px] font-bold text-[#F5F1E8]">Governança de Padrão</h1>
      <p className="text-[13px] text-[#9BAFC5] mt-1">
        Varredura sistemática do agente <code className="text-[#E8C97A]">@v3-governance-qa</code> contra o
        checklist de interface, dados e contratos. Rotina diária, ~45 dias para cobrir o portal inteiro.
      </p>
    </div>
  );
}
