"use client";

import { useState } from "react";
import { CheckCircle2, Clock, AlertCircle, FileText, Wallet, TrendingUp, Crown, Shield, RefreshCw, ArrowUpCircle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Profile {
  id: string;
  full_name: string | null;
  role: string;
  email: string;
  created_at: string;
  trial_expires_at: string | null;
  is_active: boolean;
}

interface Contract {
  plano: string;
  valor_mensal: string | null;
  accepted_at: string;
  contract_version: string;
  email: string;
  nome_representante: string | null;
}

interface Commission {
  commission_value: number;
  status: string;
  created_at: string;
  deal_id?: string | null;
  deal_type?: string | null;
  description?: string | null;
}

interface Props {
  profile: Profile;
  contract: Contract | null;
  commissions: Commission[];
}

const moeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const dataFmt = (d: string) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

function getTrialStatus(profile: Profile) {
  const now = Date.now();
  const expires = profile.trial_expires_at
    ? new Date(profile.trial_expires_at).getTime()
    : new Date(profile.created_at).getTime() + 30 * 86400000;
  const daysLeft = Math.max(Math.floor((expires - now) / 86400000), 0);

  if (!profile.is_active) return { label: "Inativa", color: "text-red-400", bg: "bg-red-500/20", icon: <AlertCircle className="w-4 h-4" />, daysLeft: 0 };
  if (daysLeft === 0) return { label: "Expirada", color: "text-red-400", bg: "bg-red-500/20", icon: <AlertCircle className="w-4 h-4" />, daysLeft: 0 };
  if (daysLeft <= 7) return { label: `Vence em ${daysLeft}d`, color: "text-amber-400", bg: "bg-amber-500/20", icon: <Clock className="w-4 h-4" />, daysLeft };
  return { label: "Ativa", color: "text-emerald-400", bg: "bg-emerald-500/20", icon: <CheckCircle2 className="w-4 h-4" />, daysLeft };
}

export function MinhaAssinaturaClient({ profile, contract, commissions }: Props) {
  const planoLabel = profile.role === "PARTNER_PRO" ? "Partner PRO" : "Partner";
  const valorMensal = profile.role === "PARTNER_PRO" ? "R$ 397,00" : "R$ 197,00";
  const comissaoPct = profile.role === "PARTNER_PRO" ? "50%" : "30%";
  const trialStatus = getTrialStatus(profile);

  const [renovacaoStatus, setRenovacaoStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [upgradeStatus, setUpgradeStatus]     = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [confirmRenovar, setConfirmRenovar]   = useState(false);
  const [confirmUpgrade, setConfirmUpgrade]   = useState(false);

  const totalRecebido = commissions.filter(c => c.status === "PAGA").reduce((s, c) => s + c.commission_value, 0);
  const totalPendente = commissions.filter(c => c.status === "A_PAGAR").reduce((s, c) => s + c.commission_value, 0);
  const totalGeral = totalRecebido + totalPendente;

  const expiresDate = profile.trial_expires_at
    ? new Date(profile.trial_expires_at)
    : new Date(new Date(profile.created_at).getTime() + 30 * 86400000);

  const showRenovar = trialStatus.daysLeft <= 15 || trialStatus.daysLeft === 0;

  async function handleRenovar() {
    setConfirmRenovar(false);
    setRenovacaoStatus("loading");
    try {
      const res = await fetch("/api/assinatura/solicitar-renovacao", { method: "POST" });
      setRenovacaoStatus(res.ok ? "ok" : "err");
      if (res.ok) setTimeout(() => setRenovacaoStatus("idle"), 5000);
    } catch {
      setRenovacaoStatus("err");
      setTimeout(() => setRenovacaoStatus("idle"), 4000);
    }
  }

  async function handleUpgrade() {
    setConfirmUpgrade(false);
    setUpgradeStatus("loading");
    try {
      const res = await fetch("/api/assinatura/solicitar-upgrade", { method: "POST" });
      setUpgradeStatus(res.ok ? "ok" : "err");
      if (res.ok) setTimeout(() => setUpgradeStatus("idle"), 5000);
    } catch {
      setUpgradeStatus("err");
      setTimeout(() => setUpgradeStatus("idle"), 4000);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Minha Assinatura</h1>
        <p className="text-sm text-muted-foreground mt-1">Detalhes do seu plano e histórico financeiro</p>
      </div>

      {/* Plano atual */}
      <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-6"
        style={{ boxShadow: "0 0 0 1px rgba(201,168,76,0.08), 0 8px 32px rgba(0,0,0,0.3)" }}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${profile.role === "PARTNER_PRO" ? "bg-[#C9A84C]/20" : "bg-blue-500/20"}`}>
              {profile.role === "PARTNER_PRO"
                ? <Crown className="w-7 h-7 text-[#C9A84C]" />
                : <Shield className="w-7 h-7 text-blue-400" />}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-[#F0ECE4]">V3 {planoLabel}</h2>
                <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${trialStatus.bg} ${trialStatus.color}`}>
                  {trialStatus.icon} {trialStatus.label}
                </span>
              </div>
              <p className="text-sm text-[#7A8FA8]">{valorMensal}/mês · {comissaoPct} de comissão</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#7A8FA8]">Acesso até</p>
            <p className="text-sm font-bold text-[#F0ECE4]">{dataFmt(expiresDate.toISOString())}</p>
          </div>
        </div>

        {/* Detalhes do plano */}
        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3 pt-5 border-t border-[#243A66]">
          {[
            { label: "Plano", value: planoLabel },
            { label: "Mensalidade", value: valorMensal },
            { label: "Comissão", value: comissaoPct },
            { label: "Membro desde", value: new Date(profile.created_at).toLocaleDateString("pt-BR") },
          ].map(item => (
            <div key={item.label}>
              <p className="text-[10px] text-[#7A8FA8] uppercase tracking-wide">{item.label}</p>
              <p className="text-sm font-semibold text-[#F0ECE4] mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Ações */}
        <div className="mt-5 pt-5 border-t border-[#243A66] flex flex-wrap gap-3">
          {/* Botão renovar — aparece quando faltam ≤ 15 dias */}
          {showRenovar && !confirmRenovar && (
            <button
              onClick={() => setConfirmRenovar(true)}
              disabled={renovacaoStatus === "loading"}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 transition-all disabled:opacity-60"
            >
              {renovacaoStatus === "loading"
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <RefreshCw className="w-4 h-4" />}
              {renovacaoStatus === "ok" ? "✓ Solicitação enviada!" : renovacaoStatus === "err" ? "Erro — tente novamente" : "Solicitar Renovação"}
            </button>
          )}
          {showRenovar && confirmRenovar && (
            <div className="flex items-center gap-2 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10">
              <p className="text-xs text-amber-400 font-medium">Confirmar solicitação de renovação por {valorMensal}/mês?</p>
              <button onClick={handleRenovar} className="px-3 py-1 rounded-lg bg-amber-500 text-[#09081A] text-xs font-bold hover:bg-amber-400">Confirmar</button>
              <button onClick={() => setConfirmRenovar(false)} className="px-3 py-1 rounded-lg bg-white/5 text-[#7A8FA8] text-xs">Cancelar</button>
            </div>
          )}
          {/* Upgrade movido para card de comparação abaixo */}
        </div>
      </div>

      {/* Comparativo de planos — apenas para PARTNER (não PRO) */}
      {profile.role === "PARTNER" && (
        <div className="rounded-2xl border border-[#C9A84C]/20 bg-[#C9A84C]/5 p-5">
          <p className="text-xs font-bold text-[#C9A84C] uppercase tracking-widest mb-4">Compare os Planos</p>
          <div className="grid grid-cols-2 gap-4">
            {/* Partner atual */}
            <div className="rounded-xl bg-[#111F35] border border-[#243A66] p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#F0ECE4]">V3 Partner</p>
                  <p className="text-xs text-[#7A8FA8]">Plano atual</p>
                </div>
              </div>
              <p className="text-xl font-bold text-blue-400">R$ 197<span className="text-xs font-normal text-[#7A8FA8]">/mês</span></p>
              <ul className="space-y-1.5 text-xs text-[#7A8FA8]">
                {["30% de comissão", "Acesso a crédito N1 e N2", "CRM completo", "M&A pipeline", "Split Fiscal", "Academy básico"].map(b => (
                  <li key={b} className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-blue-400 flex-shrink-0" />{b}</li>
                ))}
              </ul>
            </div>
            {/* PRO */}
            <div className="rounded-xl bg-[#1A1500] border border-[#C9A84C]/40 p-4 space-y-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[#C9A84C] text-[#09081A] text-[9px] font-black px-2 py-0.5 rounded-bl-lg">PRO</div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#C9A84C]/20 flex items-center justify-center">
                  <Crown className="w-4 h-4 text-[#C9A84C]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#F0ECE4]">V3 Partner PRO</p>
                  <p className="text-xs text-[#C9A84C]">Upgrade disponível</p>
                </div>
              </div>
              <p className="text-xl font-bold text-[#C9A84C]">R$ 397<span className="text-xs font-normal text-[#7A8FA8]">/mês</span></p>
              <ul className="space-y-1.5 text-xs text-[#7A8FA8]">
                {["50% de comissão (+67%)", "Crédito N1, N2 e N3 High Ticket", "Co-branding V3 Partners", "Priority support", "Mesa de Crédito completa", "Academy M&A exclusivo"].map(b => (
                  <li key={b} className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-[#C9A84C] flex-shrink-0" />{b}</li>
                ))}
              </ul>
              {!confirmUpgrade ? (
                <button
                  onClick={() => setConfirmUpgrade(true)}
                  disabled={upgradeStatus === "loading"}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-[#C9A84C] text-[#09081A] hover:bg-[#E8C97A] disabled:opacity-60 transition-all mt-1"
                >
                  {upgradeStatus === "loading" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpCircle className="w-3.5 h-3.5" />}
                  {upgradeStatus === "ok" ? "✓ Solicitação enviada!" : upgradeStatus === "err" ? "Erro — tente novamente" : "Solicitar Upgrade para PRO"}
                </button>
              ) : (
                <div className="mt-1 space-y-2">
                  <p className="text-xs text-[#C9A84C] text-center">Confirmar upgrade para PRO por R$ 397/mês?</p>
                  <div className="flex gap-2">
                    <button onClick={handleUpgrade} className="flex-1 py-2 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-bold">Confirmar</button>
                    <button onClick={() => setConfirmUpgrade(false)} className="flex-1 py-2 rounded-lg bg-white/5 text-[#7A8FA8] text-xs">Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPIs financeiros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Comissões Recebidas", value: totalRecebido, icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, bg: "bg-emerald-500/20", color: "text-emerald-400" },
          { label: "Comissões Pendentes", value: totalPendente, icon: <Clock className="w-4 h-4 text-amber-400" />,          bg: "bg-amber-500/20",  color: "text-amber-400" },
          { label: "Total Gerado",         value: totalGeral,    icon: <TrendingUp className="w-4 h-4 text-[#C9A84C]" />,    bg: "bg-[#C9A84C]/20",  color: "text-[#C9A84C]" },
        ].map(kpi => (
          <div key={kpi.label} className="kpi-card">
            <div className={`w-9 h-9 rounded-xl ${kpi.bg} flex items-center justify-center mb-3`}>{kpi.icon}</div>
            <p className={`text-xl font-bold ${kpi.color}`}>{moeda(kpi.value)}</p>
            <p className="text-sm font-medium text-foreground mt-0.5">{kpi.label}</p>
            <p className="text-xs text-muted-foreground">{commissions.filter(c => kpi.label.includes("Recebida") ? c.status === "PAGA" : kpi.label.includes("Pendente") ? c.status === "A_PAGAR" : true).length} operações</p>
          </div>
        ))}
      </div>

      {/* Contrato assinado */}
      {contract && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-[#C9A84C]/15 flex items-center justify-center">
                <FileText className="w-4 h-4 text-[#C9A84C]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#F0ECE4]">Contrato de Parceria Assinado</p>
                <p className="text-xs text-[#7A8FA8]">Versão {contract.contract_version} · Aceite eletrônico</p>
              </div>
              <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] font-semibold text-emerald-400">Assinado</span>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              {[
                { label: "Plano", value: contract.plano },
                { label: "Valor mensal", value: contract.valor_mensal ?? valorMensal },
                { label: "Data de assinatura", value: dataFmt(contract.accepted_at) },
                { label: "Signatário", value: contract.nome_representante ?? profile.full_name ?? "—" },
                { label: "E-mail", value: contract.email },
              ].map(f => (
                <div key={f.label} className="bg-[#09081A] rounded-lg p-3">
                  <p className="text-[10px] text-[#7A8FA8] uppercase tracking-wide mb-1">{f.label}</p>
                  <p className="font-semibold text-[#F0ECE4] truncate">{f.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Histórico de comissões */}
      {commissions.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[#C9A84C]" />
              <span className="text-sm font-bold text-[#F0ECE4]">Histórico de Comissões</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/30">
                    {["Data", "Operação", "Valor", "Status"].map(h => (
                      <th key={h} className="text-left px-5 py-2.5 text-muted-foreground font-semibold uppercase tracking-wide text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {commissions.slice(0, 20).map((c, i) => (
                    <tr key={i} className="border-b border-border/20 hover:bg-secondary/20">
                      <td className="px-5 py-2.5 text-muted-foreground whitespace-nowrap">{new Date(c.created_at).toLocaleDateString("pt-BR")}</td>
                      <td className="px-5 py-2.5 text-[#F0ECE4] max-w-[200px]">
                        <p className="truncate">{c.description ?? c.deal_type ?? "—"}</p>
                        {c.deal_id && <p className="text-[#7A8FA8] text-[10px]">Ref: {c.deal_id.slice(0, 8)}…</p>}
                      </td>
                      <td className="px-5 py-2.5 font-semibold text-[#F0ECE4] whitespace-nowrap">{moeda(c.commission_value)}</td>
                      <td className="px-5 py-2.5">
                        <span className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full ${
                          c.status === "PAGA" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            : c.status === "A_PAGAR" ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                            : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                        }`}>
                          {c.status === "PAGA" ? "Recebida" : c.status === "A_PAGAR" ? "A Receber" : "Cancelada"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
