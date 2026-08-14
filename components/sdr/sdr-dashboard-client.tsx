"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Users, MessageCircle, TrendingUp, Crown, Loader2, AlertCircle, RefreshCw, UserX,
} from "lucide-react";

const GOLD = "#C9A84C";
const GOLD_LIGHT = "#E8C97A";
const NAVY_CARD = "#162744";
const NAVY_MED = "#243A66";
const MUTED = "#7A8FA8";
const CREAM = "#F0ECE4";

const ETAPA_LABELS: Record<string, string> = {
  prospect: "Prospect",
  contatado: "Contatado",
  interessado: "Interessado",
  trial: "Trial",
  convertido: "Convertido",
  perdido: "Perdido",
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  GESTAO: "Gestão",
  SDR: "SDR",
  CLOSER: "Closer",
};

type DashData = {
  totalLeads: number;
  mensagensHoje: number;
  taxaConversao: number;
  convertidos: number;
  funil: { etapa: string; count: number }[];
  evolucao7dias: { date: string; novos: number }[];
  porResponsavel?: { id: string; nome: string; role: string; totalLeads: number; convertidos: number; mensagensHoje: number }[];
  semResponsavel?: number;
};

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string; icon: React.ElementType; color: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 p-4 flex items-start gap-3" style={{ background: NAVY_CARD }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${color}20` }}>
        <Icon className="w-4.5 h-4.5" style={{ color }} />
      </div>
      <div>
        <p className="text-xl font-bold" style={{ color: CREAM }}>{value}</p>
        <p className="text-[11px] font-semibold" style={{ color: MUTED }}>{label}</p>
        {sub && <p className="text-[10px] mt-0.5" style={{ color: MUTED }}>{sub}</p>}
      </div>
    </div>
  );
}

function FunilVisual({ funil }: { funil: { etapa: string; count: number }[] }) {
  const visiveis = funil.filter(f => f.etapa !== "perdido");
  const perdidos = funil.find(f => f.etapa === "perdido")?.count ?? 0;
  const max = Math.max(...visiveis.map(f => f.count), 1);
  const colors = [MUTED, "#60A5FA", "#F59E0B", "#A78BFA", GOLD];

  return (
    <div className="rounded-2xl border border-white/5 p-5" style={{ background: NAVY_CARD }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>Funil (etapas de Prospecção)</p>
        {perdidos > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">{perdidos} perdidos</span>
        )}
      </div>
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {visiveis.map((f, i) => (
          <div key={f.etapa} className="flex flex-col items-center shrink-0 min-w-[80px]">
            <div className="w-full rounded-xl mb-2 flex items-end justify-center" style={{ height: 64, background: `${colors[i]}15` }}>
              <div
                className="w-full rounded-xl transition-all duration-500"
                style={{ height: `${Math.max(8, (f.count / max) * 56)}px`, background: `linear-gradient(to top, ${colors[i]}, ${colors[i]}80)` }}
              />
            </div>
            <p className="text-2xl font-bold" style={{ color: colors[i] }}>{f.count}</p>
            <p className="text-[10px] font-semibold text-center mt-0.5" style={{ color: MUTED }}>{ETAPA_LABELS[f.etapa] ?? f.etapa}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Evolucao7Dias({ data }: { data: { date: string; novos: number }[] }) {
  const max = Math.max(...data.map(d => d.novos), 1);
  return (
    <div className="rounded-2xl border border-white/5 p-5" style={{ background: NAVY_CARD }}>
      <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: GOLD }}>Novos Leads WhatsApp — Últimos 7 dias</p>
      <div className="flex items-end gap-2 h-28">
        {data.map(d => {
          const pct = max > 0 ? d.novos / max : 0;
          const minH = d.novos > 0 ? 8 : 4;
          return (
            <div key={d.date} className="flex flex-col items-center flex-1 gap-1">
              <span className="text-[10px] font-bold" style={{ color: d.novos > 0 ? GOLD_LIGHT : MUTED }}>{d.novos > 0 ? d.novos : ""}</span>
              <div
                className="w-full rounded-t-lg transition-all duration-500"
                style={{ height: `${Math.max(minH, pct * 72)}px`, background: d.novos > 0 ? `linear-gradient(to top, ${GOLD}, ${GOLD_LIGHT}80)` : NAVY_MED }}
              />
              <span className="text-[9px]" style={{ color: MUTED }}>{fmtDate(d.date)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PorResponsavel({ lista, semResponsavel }: {
  lista: NonNullable<DashData["porResponsavel"]>;
  semResponsavel?: number;
}) {
  const max = Math.max(...lista.map(l => l.totalLeads), 1);
  return (
    <div className="rounded-2xl border border-white/5 p-5 flex flex-col gap-3" style={{ background: NAVY_CARD }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4" style={{ color: GOLD }} />
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>Por Responsável</p>
        </div>
        {!!semResponsavel && (
          <span className="text-[10px] flex items-center gap-1" style={{ color: MUTED }}>
            <UserX className="w-3 h-3" /> {semResponsavel} sem responsável
          </span>
        )}
      </div>
      {lista.filter(l => l.totalLeads > 0).length === 0 && (
        <p className="text-xs text-center py-4" style={{ color: MUTED }}>Nenhum lead atribuído ainda</p>
      )}
      {lista.filter(l => l.totalLeads > 0).map(l => {
        const initials = l.nome.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
        const pct = Math.round((l.totalLeads / max) * 100);
        return (
          <div key={l.id} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold" style={{ background: `${GOLD}20`, color: GOLD }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-semibold truncate" style={{ color: CREAM }}>
                  {l.nome.split(" ")[0]} <span className="text-[9px] font-normal" style={{ color: MUTED }}>· {ROLE_LABELS[l.role] ?? l.role}</span>
                </span>
                <span className="text-[11px] shrink-0 ml-2" style={{ color: MUTED }}>
                  <span className="font-bold" style={{ color: GOLD }}>{l.totalLeads}</span> leads · {l.convertidos} conv. · {l.mensagensHoje} hoje
                </span>
              </div>
              <div className="w-full rounded-full h-1.5" style={{ background: NAVY_MED }}>
                <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: `linear-gradient(to right, ${GOLD}, ${GOLD_LIGHT})` }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SdrDashboardClient({ userName, role }: { userName: string; role: string }) {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true); setErr(null);
    fetch("/api/sdr/dashboard")
      .then(r => r.json())
      .then(j => { if (j.error) setErr(j.error); else setData(j); })
      .catch(() => setErr("Erro ao carregar"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const isAdmin = role === "ADMIN" || role === "GESTAO";

  return (
    <div className="space-y-5 p-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">Dashboard WhatsApp</h2>
          <p className="text-xs mt-0.5" style={{ color: MUTED }}>
            {userName} · {isAdmin ? "Visão de todos os responsáveis" : "Seus números"}
          </p>
        </div>
        <button onClick={load} className="p-1.5 rounded-xl border border-white/10 hover:border-white/20 transition-colors">
          <RefreshCw className="w-4 h-4" style={{ color: MUTED }} />
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-48 gap-2" style={{ color: MUTED }}>
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: GOLD }} />
          <span className="text-sm">Carregando…</span>
        </div>
      )}

      {err && !loading && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" /> {err}
        </div>
      )}

      {data && !loading && !err && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Total de Leads" value={data.totalLeads} icon={Users} color="#60A5FA" />
            <KpiCard label="Mensagens Hoje" value={data.mensagensHoje} icon={MessageCircle} color="#25D366" />
            <KpiCard label="Taxa de Conversão" value={`${data.taxaConversao}%`} icon={TrendingUp} color={GOLD} />
            <KpiCard label="Convertidos" value={data.convertidos} icon={Crown} color="#34D399" />
          </div>

          <FunilVisual funil={data.funil} />
          <Evolucao7Dias data={data.evolucao7dias} />

          {isAdmin && data.porResponsavel && (
            <PorResponsavel lista={data.porResponsavel} semResponsavel={data.semResponsavel} />
          )}
        </>
      )}
    </div>
  );
}
