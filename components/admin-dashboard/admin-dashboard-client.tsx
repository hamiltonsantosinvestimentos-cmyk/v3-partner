"use client";

import { Users, TrendingUp, Wallet, UserPlus, Activity, Crown, Shield, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ComunicadosPanel } from "./comunicados-panel";

const moeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface PartnerRow {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  created_at: string;
  is_active: boolean;
}

interface CommissionRow {
  commission_value: number;
  status: string;
  partner_id: string;
  created_at: string;
}

interface CadastroRow {
  id: string;
  full_name: string;
  email: string;
  status: string;
  created_at: string;
}

interface Props {
  totalPartners: number;
  totalPro: number;
  totalPartnerBase: number;
  volumeMes: number;
  comissoesAPagar: number;
  cadastrosPendentes: number;
  recentPartners: PartnerRow[];
  recentCommissions: CommissionRow[];
  recentCadastros: CadastroRow[];
}

function KpiCard({ label, value, sub, icon, color }: { label: string; value: string | number; sub?: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="kpi-card">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>{icon}</div>
      <p className="text-2xl font-bold text-[#F0ECE4]">{value}</p>
      <p className="text-sm font-medium text-foreground mt-0.5">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export function AdminDashboardClient({
  totalPartners, totalPro, totalPartnerBase,
  volumeMes, comissoesAPagar, cadastrosPendentes,
  recentPartners, recentCommissions, recentCadastros,
}: Props) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Painel Administrativo</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral da plataforma e rede de partners</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard
          label="Partners Ativos"
          value={totalPartners}
          sub={`${totalPro} PRO · ${totalPartnerBase} Base`}
          icon={<Users className="w-5 h-5 text-blue-400" />}
          color="bg-blue-500/20"
        />
        <KpiCard
          label="Volume no Mês"
          value={moeda(volumeMes)}
          sub="propostas de crédito"
          icon={<TrendingUp className="w-5 h-5 text-[#C9A84C]" />}
          color="bg-[#C9A84C]/20"
        />
        <KpiCard
          label="Comissões a Pagar"
          value={moeda(comissoesAPagar)}
          sub="aguardando liquidação"
          icon={<Wallet className="w-5 h-5 text-amber-400" />}
          color="bg-amber-500/20"
        />
        <KpiCard
          label="Cadastros Pendentes"
          value={cadastrosPendentes}
          sub="aguardando aprovação"
          icon={<UserPlus className="w-5 h-5 text-emerald-400" />}
          color="bg-emerald-500/20"
        />
        <KpiCard
          label="Partner PRO"
          value={totalPro}
          sub="50% comissão · co-branding"
          icon={<Crown className="w-5 h-5 text-[#C9A84C]" />}
          color="bg-[#C9A84C]/15"
        />
        <KpiCard
          label="Partner Base"
          value={totalPartnerBase}
          sub="30% comissão"
          icon={<Shield className="w-5 h-5 text-blue-400" />}
          color="bg-blue-500/15"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Partners recentes */}
        <Card>
          <CardContent className="p-0">
            <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#C9A84C]" />
              <span className="text-sm font-bold text-[#F0ECE4]">Partners Recentes</span>
            </div>
            <div className="divide-y divide-border/20">
              {recentPartners.length === 0 && (
                <p className="px-5 py-4 text-xs text-muted-foreground">Nenhum partner encontrado.</p>
              )}
              {recentPartners.map(p => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/10">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${p.role === "PARTNER_PRO" ? "bg-[#C9A84C]/15" : "bg-blue-500/15"}`}>
                    {p.role === "PARTNER_PRO"
                      ? <Crown className="w-4 h-4 text-[#C9A84C]" />
                      : <Shield className="w-4 h-4 text-blue-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#F0ECE4] truncate">{p.full_name ?? p.email}</p>
                    <p className="text-[10px] text-[#7A8FA8] truncate">{p.email}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                      {p.is_active ? "Ativo" : "Inativo"}
                    </span>
                    <p className="text-[10px] text-[#7A8FA8] mt-0.5">{new Date(p.created_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Comissões recentes */}
        <Card>
          <CardContent className="p-0">
            <div className="px-5 py-4 border-b border-border/40 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[#C9A84C]" />
              <span className="text-sm font-bold text-[#F0ECE4]">Comissões Recentes</span>
            </div>
            <div className="divide-y divide-border/20">
              {recentCommissions.length === 0 && (
                <p className="px-5 py-4 text-xs text-muted-foreground">Nenhuma comissão encontrada.</p>
              )}
              {recentCommissions.map((c, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3 hover:bg-secondary/10">
                  <div className="flex items-center gap-2">
                    {c.status === "PAGA"
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      : c.status === "A_PAGAR"
                      ? <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      : <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                    <div>
                      <p className="text-xs font-semibold text-[#F0ECE4]">{moeda(c.commission_value)}</p>
                      <p className="text-[10px] text-[#7A8FA8]">{new Date(c.created_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full ${
                    c.status === "PAGA" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                      : c.status === "A_PAGAR" ? "bg-amber-500/15 text-amber-400 border-amber-500/25"
                      : "bg-gray-500/15 text-gray-400 border-gray-500/25"
                  }`}>
                    {c.status === "PAGA" ? "Paga" : c.status === "A_PAGAR" ? "A Pagar" : "Cancelada"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Comunicados aos Partners */}
      <ComunicadosPanel />

      {/* Cadastros pendentes */}
      {recentCadastros.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-bold text-[#F0ECE4]">Cadastros Pendentes</span>
              </div>
              {cadastrosPendentes > 0 && (
                <a href="/admin-cadastros" className="text-xs text-[#C9A84C] hover:underline">Ver todos →</a>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/30">
                    {["Nome", "E-mail", "Status", "Data"].map(h => (
                      <th key={h} className="text-left px-5 py-2.5 text-muted-foreground font-semibold uppercase tracking-wide text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentCadastros.map(c => (
                    <tr key={c.id} className="border-b border-border/20 hover:bg-secondary/20">
                      <td className="px-5 py-2.5 font-semibold text-[#F0ECE4]">{c.full_name}</td>
                      <td className="px-5 py-2.5 text-muted-foreground">{c.email}</td>
                      <td className="px-5 py-2.5">
                        <span className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full ${
                          c.status === "PENDENTE" ? "bg-amber-500/15 text-amber-400 border-amber-500/25"
                          : c.status === "APROVADO" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                          : "bg-red-500/15 text-red-400 border-red-500/25"
                        }`}>{c.status}</span>
                      </td>
                      <td className="px-5 py-2.5 text-muted-foreground">{new Date(c.created_at).toLocaleDateString("pt-BR")}</td>
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
