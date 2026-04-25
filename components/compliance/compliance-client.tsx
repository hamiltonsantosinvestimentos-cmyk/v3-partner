"use client";

import { useState } from "react";
import {
  ShieldCheck, AlertTriangle, Users, FileSearch,
  Building2, CheckCircle2, Clock, XCircle,
  ChevronDown, ChevronUp, ExternalLink, Info,
} from "lucide-react";

interface ComplianceStats {
  totalPartners: number;
  kycPendentes: number;
  kycAprovados: number;
  kycReprovados: number;
  operacoesCoaf: number;
  dealsAltoValor: number;
  ticketsUrgentes: number;
}

interface ProposalItem {
  id: string;
  value: number;
  status: string;
  level: string;
  created_at: string;
  acima_coaf: boolean;
}

interface DealItem {
  id: string;
  company: string;
  value: number;
  stage: string;
  created_at: string;
}

interface PartnerKycItem {
  id: string;
  name: string;
  kyc_status: string;
  created_at: string;
}

interface ComplianceClientProps {
  userRole: string;
  userName: string;
  stats: ComplianceStats;
  recentProposals: ProposalItem[];
  dealsAltoValor: DealItem[];
  partnerKyc: PartnerKycItem[];
}

function formatCurrency(v: number) {
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(0)}K`;
  return `R$ ${v.toLocaleString("pt-BR")}`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR");
}

function KycBadge({ status }: { status: string }) {
  const s = status?.toUpperCase();
  if (s === "APROVADO") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-900/40 text-emerald-400 border border-emerald-800">
      <CheckCircle2 className="w-2.5 h-2.5" /> Aprovado
    </span>
  );
  if (s === "REPROVADO") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-red-900/40 text-red-400 border border-red-800">
      <XCircle className="w-2.5 h-2.5" /> Reprovado
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-900/40 text-amber-400 border border-amber-800">
      <Clock className="w-2.5 h-2.5" /> Pendente
    </span>
  );
}

function CollapsibleSection({
  title,
  icon,
  badge,
  badgeColor,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ReactNode;
  badge?: string | number;
  badgeColor?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-[#111F35] border border-[#243A66] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#162744]/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-[#C9A84C]">{icon}</span>
          <span className="font-semibold text-foreground text-sm">{title}</span>
          {badge !== undefined && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded"
              style={{ background: `${badgeColor ?? "#C9A84C"}20`, color: badgeColor ?? "#C9A84C" }}
            >
              {badge}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

const CHECKLIST = [
  { item: "Política PLD/FT atualizada (Res. BCB 44/2021)", obrig: "Anual", ref: "BCB 44/2021" },
  { item: "KYC de todos os parceiros ativos realizado", obrig: "Na admissão + revisão anual", ref: "Circular BCB 3.978/2020" },
  { item: "Comunicações COAF enviadas (op. suspeitas)", obrig: "Imediato / mensal", ref: "Lei 9.613/98" },
  { item: "Monitoramento de PEPs (Pessoas Expostas Politicamente)", obrig: "Contínuo", ref: "Circular BCB 3.978/2020" },
  { item: "Treinamento de equipe em PLD/FT", obrig: "Anual", ref: "Res. BCB 44/2021" },
  { item: "Registro de operações suspeitas (ROS)", obrig: "Quando identificado", ref: "COAF" },
  { item: "Avaliação de risco de clientes (ARC)", obrig: "Na admissão + revisão", ref: "Res. BCB 44/2021" },
  { item: "Manutenção de registros por 5 anos", obrig: "Contínuo", ref: "Lei 9.613/98 Art. 10" },
  { item: "Suitability — adequação de produtos ao perfil do cliente", obrig: "Por operação", ref: "Res. CVM 30/2021" },
  { item: "LGPD — consentimento e DPO documentado", obrig: "Contínuo", ref: "Lei 13.709/18" },
];

const LIMITES_COAF = [
  { tipo: "Correspondentes bancários — operações suspeitas", limite: "Qualquer valor", prazo: "Imediato" },
  { tipo: "Correspondentes bancários — operações em espécie", limite: "≥ R$ 50.000", prazo: "Até o dia 15 do mês seguinte" },
  { tipo: "Casas de câmbio", limite: "≥ R$ 10.000", prazo: "Mensal" },
  { tipo: "M&A — due diligence obrigatório", limite: "Qualquer valor com PEP", prazo: "Antes do fechamento" },
  { tipo: "CADE — notificação obrigatória", limite: "Receita combinada > R$ 750M", prazo: "Antes da consumação" },
];

export function ComplianceClient({
  stats,
  recentProposals,
  dealsAltoValor,
  partnerKyc,
}: ComplianceClientProps) {
  const riskLevel = stats.kycPendentes > 5 || stats.operacoesCoaf > 20 ? "ALTO" : stats.kycPendentes > 0 ? "MÉDIO" : "BAIXO";
  const riskColor = riskLevel === "ALTO" ? "#EF4444" : riskLevel === "MÉDIO" ? "#F59E0B" : "#10B981";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard de Compliance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            PLD/FT · COAF · KYC · Res. BCB 44/2021 — Responsável: Robson Lino
          </p>
        </div>
        <div className="text-right">
          <div
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg"
            style={{ background: `${riskColor}18`, color: riskColor, border: `1px solid ${riskColor}40` }}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Risco {riskLevel}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#111F35] border border-[#243A66] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-[#C9A84C]"><Users className="w-4 h-4" /></div>
          <p className="text-2xl font-bold text-foreground">{stats.totalPartners}</p>
          <p className="text-xs text-muted-foreground">Parceiros Ativos</p>
          <p className="text-[10px] text-emerald-400 mt-1">{stats.kycAprovados} KYC aprovados</p>
        </div>
        <div className="bg-[#111F35] border border-[#243A66] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-amber-400"><Clock className="w-4 h-4" /></div>
          <p className="text-2xl font-bold text-foreground">{stats.kycPendentes}</p>
          <p className="text-xs text-muted-foreground">KYC Pendentes</p>
          {stats.kycReprovados > 0 && (
            <p className="text-[10px] text-red-400 mt-1">{stats.kycReprovados} reprovados</p>
          )}
        </div>
        <div className="bg-[#111F35] border border-[#243A66] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-amber-400"><AlertTriangle className="w-4 h-4" /></div>
          <p className="text-2xl font-bold text-foreground">{stats.operacoesCoaf}</p>
          <p className="text-xs text-muted-foreground">Op. acima limiar COAF</p>
          <p className="text-[10px] text-muted-foreground mt-1">últimos 30 dias</p>
        </div>
        <div className="bg-[#111F35] border border-[#243A66] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-[#C9A84C]"><Building2 className="w-4 h-4" /></div>
          <p className="text-2xl font-bold text-foreground">{stats.dealsAltoValor}</p>
          <p className="text-xs text-muted-foreground">Deals M&A ≥ R$ 5M</p>
          <p className="text-[10px] text-muted-foreground mt-1">monitoramento requerido</p>
        </div>
      </div>

      {/* KYC dos parceiros */}
      <CollapsibleSection
        title="Status KYC — Parceiros"
        icon={<Users className="w-4 h-4" />}
        badge={stats.kycPendentes > 0 ? `${stats.kycPendentes} pendentes` : "OK"}
        badgeColor={stats.kycPendentes > 0 ? "#F59E0B" : "#10B981"}
        defaultOpen={stats.kycPendentes > 0}
      >
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {partnerKyc.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhum parceiro cadastrado</p>
          )}
          {partnerKyc.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2 border-b border-[#243A66] last:border-0">
              <div>
                <p className="text-xs font-medium text-foreground">{p.name}</p>
                <p className="text-[10px] text-muted-foreground">Cadastro: {formatDate(p.created_at)}</p>
              </div>
              <KycBadge status={p.kyc_status} />
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Operações acima limiar COAF */}
      <CollapsibleSection
        title="Operações com Limiar COAF (≥ R$ 50.000)"
        icon={<AlertTriangle className="w-4 h-4" />}
        badge={recentProposals.filter((p) => p.acima_coaf).length}
        badgeColor="#F59E0B"
        defaultOpen={false}
      >
        <div className="mb-3 flex items-start gap-2 p-3 rounded-lg bg-amber-900/10 border border-amber-800/30">
          <Info className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300">
            Operações acima de R$ 50.000 realizadas por correspondentes bancários devem ser comunicadas ao COAF até o dia 15 do mês seguinte (Lei 9.613/98).
          </p>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {recentProposals.filter((p) => p.acima_coaf).length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma operação acima do limiar nos últimos 30 dias</p>
          )}
          {recentProposals.filter((p) => p.acima_coaf).map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2 border-b border-[#243A66] last:border-0">
              <div>
                <p className="text-xs font-medium text-foreground">{formatCurrency(p.value)}</p>
                <p className="text-[10px] text-muted-foreground">Mesa {p.level || "N1"} · {formatDate(p.created_at)}</p>
              </div>
              <span className="text-[10px] text-muted-foreground">{p.status}</span>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Deals de alto valor (M&A) */}
      {dealsAltoValor.length > 0 && (
        <CollapsibleSection
          title="Deals M&A ≥ R$ 5M — Monitoramento Requerido"
          icon={<FileSearch className="w-4 h-4" />}
          badge={dealsAltoValor.length}
          badgeColor="#C9A84C"
          defaultOpen={false}
        >
          <div className="mb-3 flex items-start gap-2 p-3 rounded-lg bg-[#C9A84C]/10 border border-[#C9A84C]/20">
            <Info className="w-3.5 h-3.5 text-[#C9A84C] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#E8C97A]">
              Transações M&A envolvendo PEPs requerem due diligence reforçado. Operações com receita combinada {">"}  R$ 750M devem ser notificadas ao CADE antes da consumação.
            </p>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {dealsAltoValor.map((d) => (
              <div key={d.id} className="flex items-center justify-between py-2 border-b border-[#243A66] last:border-0">
                <div>
                  <p className="text-xs font-medium text-foreground">{d.company}</p>
                  <p className="text-[10px] text-muted-foreground">{d.stage} · {formatDate(d.created_at)}</p>
                </div>
                <span className="text-xs font-semibold text-[#C9A84C]">{formatCurrency(d.value)}</span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Limites e obrigações COAF */}
      <CollapsibleSection
        title="Limites e Obrigações de Comunicação"
        icon={<ShieldCheck className="w-4 h-4" />}
        defaultOpen={false}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#243A66]">
                <th className="text-left py-2 text-muted-foreground font-medium">Tipo de Operação</th>
                <th className="text-left py-2 text-muted-foreground font-medium">Limiar</th>
                <th className="text-left py-2 text-muted-foreground font-medium">Prazo</th>
              </tr>
            </thead>
            <tbody>
              {LIMITES_COAF.map((l, i) => (
                <tr key={i} className="border-b border-[#243A66]/50 last:border-0">
                  <td className="py-2.5 text-foreground pr-4">{l.tipo}</td>
                  <td className="py-2.5 font-semibold text-[#C9A84C] whitespace-nowrap pr-4">{l.limite}</td>
                  <td className="py-2.5 text-muted-foreground">{l.prazo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>

      {/* Checklist PLD/FT */}
      <CollapsibleSection
        title="Checklist PLD/FT — Res. BCB 44/2021"
        icon={<CheckCircle2 className="w-4 h-4" />}
        defaultOpen={false}
      >
        <div className="space-y-2">
          {CHECKLIST.map((c, i) => (
            <div key={i} className="flex items-start gap-3 py-2.5 border-b border-[#243A66]/50 last:border-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#C9A84C] mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-foreground">{c.item}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Frequência: {c.obrig}</p>
              </div>
              <span className="text-[10px] text-[#C9A84C] font-semibold whitespace-nowrap">{c.ref}</span>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Links regulatórios */}
      <div className="bg-[#111F35] border border-[#243A66] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Regulamentação de Referência</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {[
            { label: "COAF — Portal de Comunicações", href: "https://www.gov.br/coaf" },
            { label: "BCB — Resolução 44/2021 (PLD/FT)", href: "https://www.bcb.gov.br" },
            { label: "CVM — Resolução 30/2021 (Suitability)", href: "https://www.gov.br/cvm" },
            { label: "LGPD — Lei 13.709/18", href: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm" },
            { label: "CADE — Notificações M&A", href: "https://www.gov.br/cade" },
            { label: "Circular BCB 3.978/2020 (KYC)", href: "https://www.bcb.gov.br" },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-[#C9A84C] transition-colors p-2 rounded hover:bg-[#C9A84C]/5"
            >
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
              {link.label}
            </a>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        Validar regularmente com Robson Lino (Compliance Officer) — V3 Partners
      </p>
    </div>
  );
}
