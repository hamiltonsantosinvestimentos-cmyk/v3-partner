"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, CheckCircle2, Circle, Mail, RefreshCw, TrendingUp,
  UserCircle, CreditCard, Search,
  Crown, Loader2, MapPin, AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface PartnerProgress {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  created_at: string;
  is_active: boolean;
  trial_expires_at: string | null;
  last_sign_in_at: string | null;
  steps: {
    welcome_email: boolean;
    profile: boolean;
    crm: boolean;
    proposta: boolean;
  };
  progress: number;
  crmLeads: number;
  proposals: number;
  location: {
    city: string | null;
    state: string | null;
    country: string | null;
    denied: boolean;
    updatedAt: string | null;
  } | null;
}

const STEP_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  welcome_email: { label: "E-mail enviado",   icon: <Mail       className="w-3.5 h-3.5" /> },
  profile:       { label: "Perfil completo",  icon: <UserCircle className="w-3.5 h-3.5" /> },
  crm:           { label: "Lead no CRM",      icon: <Users      className="w-3.5 h-3.5" /> },
  proposta:      { label: "Proposta enviada", icon: <CreditCard className="w-3.5 h-3.5" /> },
};

function StepPill({ done, label, icon }: { done: boolean; label: string; icon: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border
      ${done
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
        : "border-[#1B3050] bg-[#0A1628] text-[#7A8FA8]"
      }`}>
      {done ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
      {icon}
      {label}
    </div>
  );
}

export function AdminOnboardingPanel() {
  const [partners, setPartners] = useState<PartnerProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null); // "partnerId:step"
  const [sent, setSent] = useState<Set<string>>(new Set());    // "partnerId:step"
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "incomplete" | "complete">("all");

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch("/api/onboarding/admin")
      .then((r) => r.json())
      .then((d) => {
        setPartners(d.partners ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function sendReminder(partnerId: string, step: string) {
    const key = `${partnerId}:${step}`;
    setSending(key);
    try {
      await fetch("/api/onboarding/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partner_id: partnerId, step }),
      });
      setSent((prev) => new Set([...prev, key]));
    } finally {
      setSending(null);
    }
  }

  const filtered = partners.filter((p) => {
    const matchSearch =
      !search ||
      (p.full_name?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      p.email.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" ||
      (filter === "complete" && p.progress === 100) ||
      (filter === "incomplete" && p.progress < 100);
    return matchSearch && matchFilter;
  });

  const avgProgress = partners.length
    ? Math.round(partners.reduce((s, p) => s + p.progress, 0) / partners.length)
    : 0;
  const completed   = partners.filter((p) => p.progress === 100).length;
  const incomplete  = partners.filter((p) => p.progress < 100).length;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Partners Total",
            value: partners.length,
            icon: <Users className="w-5 h-5 text-blue-400" />,
            color: "bg-blue-500/20",
            sub: "cadastrados",
          },
          {
            label: "Onboarding Completo",
            value: completed,
            icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
            color: "bg-emerald-500/20",
            sub: `${partners.length ? Math.round((completed / partners.length) * 100) : 0}% do total`,
          },
          {
            label: "Progresso Médio",
            value: `${avgProgress}%`,
            icon: <TrendingUp className="w-5 h-5 text-[#C9A84C]" />,
            color: "bg-[#C9A84C]/20",
            sub: "da rede",
          },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-[#243A66] p-4" style={{ background: "#0D1929" }}>
            <div className="flex items-start justify-between">
              <div className={`w-9 h-9 rounded-xl ${k.color} flex items-center justify-center`}>
                {k.icon}
              </div>
            </div>
            <p className="text-2xl font-bold text-[#F0ECE4] mt-3">{k.value}</p>
            <p className="text-sm text-[#F0ECE4] font-medium">{k.label}</p>
            <p className="text-xs text-[#7A8FA8] mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Filtros e busca */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-[#0D1929] border border-[#243A66] rounded-xl px-3 py-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-[#7A8FA8]" />
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-[#F0ECE4] placeholder-[#7A8FA8] outline-none w-full"
          />
        </div>
        <div className="flex items-center gap-1 bg-[#0D1929] border border-[#243A66] rounded-xl p-1">
          {([
            { key: "all",        label: `Todos (${partners.length})` },
            { key: "incomplete", label: `Incompletos (${incomplete})` },
            { key: "complete",   label: `Completos (${completed})` },
          ] as const).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${filter === f.key
                  ? "bg-[#C9A84C] text-[#09081A]"
                  : "text-[#7A8FA8] hover:text-[#F0ECE4]"
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#243A66] text-xs text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Atualizar
        </button>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-[#243A66] overflow-hidden" style={{ background: "#0D1929" }}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[#C9A84C]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Users className="w-8 h-8 text-[#7A8FA8]" />
            <p className="text-sm text-[#7A8FA8]">Nenhum partner encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1B3050]">
                  {["Partner", "Plano", "Progresso", "Etapas", "Leads CRM", "Propostas", "Cadastrado", "Último acesso", "Localização", "Lembretes por etapa"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-[#7A8FA8] tracking-wider uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-[#1B3050]/50 hover:bg-white/[0.02] transition-colors">
                    {/* Partner */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#243A66] flex items-center justify-center text-xs font-bold text-[#C9A84C] flex-shrink-0">
                          {(p.full_name || p.email)[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-[#F0ECE4]">
                            {p.full_name || "Sem nome"}
                          </p>
                          <p className="text-xs text-[#7A8FA8]">{p.email}</p>
                        </div>
                      </div>
                    </td>
                    {/* Plano */}
                    <td className="px-4 py-4">
                      {p.role === "PARTNER_PRO" ? (
                        <Badge className="bg-[#C9A84C]/20 text-[#E8C97A] border-[#C9A84C]/30 flex items-center gap-1 w-fit">
                          <Crown className="w-3 h-3" /> PRO
                        </Badge>
                      ) : (
                        <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                          Partner
                        </Badge>
                      )}
                    </td>
                    {/* Progresso */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${p.progress}%`,
                              background: p.progress === 100
                                ? "#10B981"
                                : p.progress >= 50
                                ? "#C9A84C"
                                : "#EF4444",
                            }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-[#F0ECE4] w-8 text-right">
                          {p.progress}%
                        </span>
                      </div>
                    </td>
                    {/* Etapas */}
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(p.steps).map(([key, done]) => (
                          <StepPill
                            key={key}
                            done={done}
                            label={STEP_LABELS[key]?.label ?? key}
                            icon={STEP_LABELS[key]?.icon ?? null}
                          />
                        ))}
                      </div>
                    </td>
                    {/* CRM */}
                    <td className="px-4 py-4 text-center">
                      <span className={`text-sm font-bold ${p.crmLeads > 0 ? "text-emerald-400" : "text-[#7A8FA8]"}`}>
                        {p.crmLeads}
                      </span>
                    </td>
                    {/* Propostas */}
                    <td className="px-4 py-4 text-center">
                      <span className={`text-sm font-bold ${p.proposals > 0 ? "text-emerald-400" : "text-[#7A8FA8]"}`}>
                        {p.proposals}
                      </span>
                    </td>
                    {/* Cadastrado */}
                    <td className="px-4 py-4 text-xs text-[#7A8FA8]">
                      {formatDate(p.created_at)}
                    </td>
                    {/* Último acesso */}
                    <td className="px-4 py-4 text-xs">
                      {p.last_sign_in_at ? (
                        <div>
                          <p className="text-[#F0ECE4]">{formatDate(p.last_sign_in_at)}</p>
                          <p className="text-[#7A8FA8] mt-0.5">
                            {(() => {
                              const diff = Math.floor((Date.now() - new Date(p.last_sign_in_at).getTime()) / 86400000);
                              if (diff === 0) return "hoje";
                              if (diff === 1) return "ontem";
                              return `há ${diff} dias`;
                            })()}
                          </p>
                        </div>
                      ) : (
                        <span className="text-[#7A8FA8]">Nunca acessou</span>
                      )}
                    </td>
                    {/* Localização */}
                    <td className="px-4 py-4">
                      {p.location === null ? (
                        <span className="text-xs text-[#7A8FA8]">Não solicitado</span>
                      ) : p.location.denied ? (
                        <div className="flex items-center gap-1.5 text-xs text-amber-400">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>Recusado</span>
                        </div>
                      ) : p.location.city ? (
                        <div className="flex items-start gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs text-[#F0ECE4] font-medium">
                              {p.location.city}{p.location.state ? `, ${p.location.state}` : ""}
                            </p>
                            <p className="text-xs text-[#7A8FA8]">{p.location.country ?? "BR"}</p>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-[#7A8FA8]">Aguardando</span>
                      )}
                    </td>
                    {/* Lembretes por etapa */}
                    <td className="px-4 py-4">
                      {p.progress === 100 ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          Completo
                        </span>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {(Object.entries(p.steps) as [string, boolean][])
                            .filter(([, done]) => !done)
                            .map(([step]) => {
                              const key = `${p.id}:${step}`;
                              const isSending = sending === key;
                              const isSent    = sent.has(key);
                              const meta = STEP_LABELS[step];
                              return (
                                <button
                                  key={step}
                                  onClick={() => sendReminder(p.id, step)}
                                  disabled={!!sending || isSent}
                                  title={`Enviar lembrete: ${meta?.label ?? step}`}
                                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all w-fit
                                    ${isSent
                                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 cursor-default"
                                      : "border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/10"
                                    }`}
                                >
                                  {isSending ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : isSent ? (
                                    <CheckCircle2 className="w-3 h-3" />
                                  ) : (
                                    <Mail className="w-3 h-3" />
                                  )}
                                  {isSent ? "Enviado" : meta?.label ?? step}
                                </button>
                              );
                            })}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
