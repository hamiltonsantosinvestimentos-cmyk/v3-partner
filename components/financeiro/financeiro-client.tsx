"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  DollarSign, Users, FileText, TrendingUp, BarChart3,
  CreditCard, Receipt, ChevronLeft, ChevronRight,
  ArrowUpRight, ArrowDownRight, CheckCircle2, Clock,
  AlertCircle, RefreshCw, Plus, Download, Eye, Trash2, Pencil,
  Crown, ShieldCheck, XCircle, Loader2, Ban, RotateCcw, Building2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExportButton } from "@/components/financeiro/export-button";
import { Badge } from "@/components/ui/badge";
import { MetricasClient } from "@/components/financeiro/metricas-client";
import { CoraPanel } from "@/components/financeiro/cora-panel";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  DEMO_FUNCIONARIOS, DEMO_DESPESAS_VARIAVEIS, DESPESAS_FIXAS_TEMPLATES,
  expandirDespesasFixas, DEMO_COMISSOES, DEMO_DRE, DEMO_MOVIMENTOS,
  DEMO_IMPOSTOS, MESES_PT, formatMoeda, totalFolha, SALDO_INICIAL_MARCO,
  type Comissao,
} from "@/lib/demo-data-financeiro";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Tab = "metricas" | "visao-geral" | "folha" | "despesas" | "comissoes" | "dre" | "fluxo" | "impostos" | "assinaturas" | "cora";

interface Props {
  role: string;
  userName: string;
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────

const GOLD = "#C9A84C";
const NAVY3 = "#0F1E35";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PAGO: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    PAGA: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    ATIVO: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    A_PAGAR: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    PENDENTE: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    PREVISTO: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    FERIAS: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    AFASTADO: "bg-red-500/20 text-red-400 border-red-500/30",
    VENCIDA: "bg-red-500/20 text-red-400 border-red-500/30",
    CANCELADA: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };
  const labels: Record<string, string> = {
    PAGO: "Pago", PAGA: "Paga", ATIVO: "Ativo", A_PAGAR: "A Pagar",
    PENDENTE: "Pendente", PREVISTO: "Previsto", FERIAS: "Férias",
    AFASTADO: "Afastado", VENCIDA: "Vencida", CANCELADA: "Cancelada",
  };
  return (
    <span className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full ${map[status] ?? "bg-gray-500/20 text-gray-400 border-gray-500/30"}`}>
      {labels[status] ?? status}
    </span>
  );
}

function TipoComissaoBadge({ tipo }: { tipo: string }) {
  const map: Record<string, string> = {
    CREDITO: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    MA: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    CONSORCIO: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    MARKETPLACE: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  };
  const labels: Record<string, string> = { CREDITO: "Crédito", MA: "M&A", CONSORCIO: "Consórcio", MARKETPLACE: "Marketplace" };
  return (
    <span className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full ${map[tipo] ?? ""}`}>
      {labels[tipo] ?? tipo}
    </span>
  );
}

function MonthSelector({ mes, ano, onChange }: { mes: number; ano: number; onChange: (m: number, a: number) => void }) {
  const prev = () => {
    if (mes === 1) onChange(12, ano - 1);
    else onChange(mes - 1, ano);
  };
  const next = () => {
    if (mes === 12) onChange(1, ano + 1);
    else onChange(mes + 1, ano);
  };
  return (
    <div className="flex items-center gap-2">
      <button onClick={prev} className="p-1 rounded-lg hover:bg-secondary transition-colors">
        <ChevronLeft className="w-4 h-4 text-muted-foreground" />
      </button>
      <span className="text-sm font-semibold text-white min-w-[90px] text-center">
        {MESES_PT[mes - 1]} / {ano}
      </span>
      <button onClick={next} className="p-1 rounded-lg hover:bg-secondary transition-colors">
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  );
}

function KpiCard({ label, value, sub, icon: Icon, color, trend }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string; trend?: number;
}) {
  return (
    <div className="kpi-card">
      <div className="flex items-start justify-between">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center`} style={{ background: `${color}20` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        {trend !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${trend >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-xl font-bold text-white">{value}</p>
        <p className="text-sm text-foreground font-medium mt-0.5">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── TAB: VISÃO GERAL ─────────────────────────────────────────────────────────

function VisaoGeralTab() {
  const comissoesAPagar = DEMO_COMISSOES.filter(c => c.status === "A_PAGAR").reduce((s, c) => s + c.valorComissao, 0);
  const impostoAPagar = DEMO_IMPOSTOS.filter(i => i.status === "A_PAGAR" || i.status === "PREVISTO").reduce((s, i) => s + i.valor, 0);
  const { bruto } = totalFolha();
  const chartData = DEMO_DRE.map(d => ({
    mes: `${MESES_PT[d.mes - 1]}/${String(d.ano).slice(2)}`,
    Receita: d.receitas,
    Despesas: d.custosOperacionais + d.despesasAdmin + d.despesasComerciais + d.despesasFinanceiras,
    Resultado: d.lucroLiquido,
  }));

  const dreAtual = DEMO_DRE[DEMO_DRE.length - 1];
  const dreMesAnterior = DEMO_DRE[DEMO_DRE.length - 2];

  // Carrega despesas reais do mês atual para mostrar em aberto vs pagas
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();
  const [despesasAberto, setDespesasAberto] = React.useState(0);
  const [despesasPagas, setDespesasPagas] = React.useState(0);

  React.useEffect(() => {
    Promise.all([
      fetch("/api/financeiro?type=despesa_fixa").then(r => r.json()),
      fetch("/api/financeiro?type=despesa_variavel").then(r => r.json()),
      fetch("/api/financeiro?type=despesa_fixa_paga").then(r => r.json()),
    ]).then(([fixasJson, variaveisJson, pagasJson]) => {
      const templates: Array<{ id: string; valor: number }> =
        (fixasJson.records ?? []).map((r: { id: string; data: { id: string; valor: number } }) => ({ ...r.data, _dbId: r.id }));
      const variaveis: Array<{ mes: number; ano: number; valor: number; status: string }> =
        (variaveisJson.records ?? []).map((r: { data: { mes: number; ano: number; valor: number; status: string } }) => r.data);
      const fixasPagasSet = new Set<string>(
        (pagasJson.records ?? [])
          .map((r: { data: { despesaBaseId: string; mes: number; ano: number } }) =>
            `${r.data.despesaBaseId}-${r.data.mes}-${r.data.ano}`)
      );

      // Fixas do mês: soma as pagas e as em aberto
      let fixaAberto = 0, fixaPaga = 0;
      for (const t of templates) {
        const key = `${t.id}-${mesAtual}-${anoAtual}`;
        if (fixasPagasSet.has(key)) fixaPaga += t.valor;
        else fixaAberto += t.valor;
      }

      // Variáveis do mês
      const varMes = variaveis.filter(d => d.mes === mesAtual && d.ano === anoAtual);
      const varAberto = varMes.filter(d => d.status !== "PAGA").reduce((s, d) => s + d.valor, 0);
      const varPaga   = varMes.filter(d => d.status === "PAGA").reduce((s, d) => s + d.valor, 0);

      setDespesasAberto(fixaAberto + varAberto);
      setDespesasPagas(fixaPaga + varPaga);
    }).catch(() => {});
  }, [mesAtual, anoAtual]);

  if (!dreAtual) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Comissões a Pagar" value={formatMoeda(comissoesAPagar)} sub="pendentes" icon={CreditCard} color="#F59E0B" />
          <KpiCard label="Impostos a Recolher" value={formatMoeda(impostoAPagar)} sub="meses abertos" icon={Receipt} color="#EF4444" />
          <KpiCard label="Folha do Mês" value={formatMoeda(bruto)} sub={`${DEMO_FUNCIONARIOS.length} colaboradores`} icon={Users} color="#8B5CF6" />
          <KpiCard label="Despesas em Aberto" value={formatMoeda(despesasAberto)} sub={`${MESES_PT[mesAtual - 1]}/${anoAtual}`} icon={Clock} color="#F59E0B" />
          <KpiCard label="Despesas Pagas" value={formatMoeda(despesasPagas)} sub={`${MESES_PT[mesAtual - 1]}/${anoAtual}`} icon={CheckCircle2} color="#22C55E" />
        </div>
        <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
          Cadastre lançamentos no DRE para visualizar o painel financeiro.
        </div>
      </div>
    );
  }

  const trendReceita = dreMesAnterior
    ? Math.round(((dreAtual.receitas - dreMesAnterior.receitas) / dreMesAnterior.receitas) * 100)
    : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Receita Bruta" value={formatMoeda(dreAtual.receitas)} sub={`${MESES_PT[dreAtual.mes - 1]}/26`} icon={TrendingUp} color="#C9A84C" trend={trendReceita} />
        <KpiCard label="Lucro Líquido" value={formatMoeda(dreAtual.lucroLiquido)} sub="após IR/CSLL" icon={BarChart3} color="#22C55E" trend={18} />
        <KpiCard label="Comissões a Pagar" value={formatMoeda(comissoesAPagar)} sub={`${DEMO_COMISSOES.filter(c => c.status === "A_PAGAR").length} pendentes`} icon={CreditCard} color="#F59E0B" />
        <KpiCard label="Impostos a Recolher" value={formatMoeda(impostoAPagar)} sub="meses abertos" icon={Receipt} color="#EF4444" />
        <KpiCard label="Folha do Mês" value={formatMoeda(bruto)} sub={`${DEMO_FUNCIONARIOS.length} colaboradores`} icon={Users} color="#8B5CF6" />
        <KpiCard label="Despesas em Aberto" value={formatMoeda(despesasAberto)} sub={`${MESES_PT[mesAtual - 1]}/${anoAtual} · fixas + variáveis`} icon={Clock} color="#F59E0B" />
        <KpiCard label="Despesas Pagas" value={formatMoeda(despesasPagas)} sub={`${MESES_PT[mesAtual - 1]}/${anoAtual} · fixas + variáveis`} icon={CheckCircle2} color="#22C55E" />
        <KpiCard label="Margem Líquida" value={`${((dreAtual.lucroLiquido / dreAtual.receitas) * 100).toFixed(1)}%`} sub="lucro / receita bruta" icon={TrendingUp} color="#10B981" />
        <KpiCard label="EBITDA" value={formatMoeda(dreAtual.ebitda)} sub={MESES_PT[dreAtual.mes - 1]} icon={BarChart3} color="#C9A84C" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Receita vs Despesa vs Resultado</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#122036" />
                <XAxis dataKey="mes" tick={{ fill: "#7A8FA8", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#7A8FA8", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ backgroundColor: "#091221", border: "1px solid rgba(196,146,46,0.2)", borderRadius: 10, fontSize: 12 }} formatter={(v) => formatMoeda(Number(v) || 0)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Receita" fill="#C9A84C" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Despesas" fill="#3B5273" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Resultado" fill="#22C55E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Comissões por Tipo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            {(["CREDITO", "MA", "CONSORCIO"] as const).map(tipo => {
              const total = DEMO_COMISSOES.filter(c => c.operacaoTipo === tipo).reduce((s, c) => s + c.valorComissao, 0);
              const grand = DEMO_COMISSOES.reduce((s, c) => s + c.valorComissao, 0);
              const pct = grand > 0 ? (total / grand * 100).toFixed(0) : "0";
              const labels: Record<string, string> = { CREDITO: "Crédito", MA: "M&A", CONSORCIO: "Consórcio" };
              const colors = { CREDITO: "#3B82F6", MA: "#8B5CF6", CONSORCIO: "#F59E0B" };
              return (
                <div key={tipo}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{labels[tipo]}</span>
                    <span className="text-white font-semibold">{formatMoeda(total)} <span className="text-muted-foreground font-normal">({pct}%)</span></span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: colors[tipo] }} />
                  </div>
                </div>
              );
            })}
            <div className="pt-2 border-t border-border/40">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Comissões</span>
                <span className="text-white font-bold">{formatMoeda(DEMO_COMISSOES.reduce((s, c) => s + c.valorComissao, 0))}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Cálculos de folha ───────────────────────────────────────────────────────

function calcINSS(bruto: number): number {
  // Tabela progressiva 2025 (simplificada com teto)
  const faixas = [
    { ate: 1320.00,   aliq: 0.075 },
    { ate: 2571.29,   aliq: 0.09 },
    { ate: 3856.94,   aliq: 0.12 },
    { ate: 7507.49,   aliq: 0.14 },
  ];
  if (bruto > 7507.49) return 908.86; // teto INSS
  let inss = 0, anterior = 0;
  for (const f of faixas) {
    if (bruto <= f.ate) { inss += (bruto - anterior) * f.aliq; break; }
    inss += (f.ate - anterior) * f.aliq;
    anterior = f.ate;
  }
  return Math.round(inss * 100) / 100;
}

function calcIRRF(bruto: number, inss: number): number {
  const base = bruto - inss;
  if (base <= 2259.20) return 0;
  if (base <= 2826.65) return Math.round((base * 0.075 - 169.44) * 100) / 100;
  if (base <= 3751.05) return Math.round((base * 0.15 - 381.44) * 100) / 100;
  if (base <= 4664.68) return Math.round((base * 0.225 - 662.77) * 100) / 100;
  return Math.round((base * 0.275 - 896.00) * 100) / 100;
}

// ─── Modal: Novo Colaborador ──────────────────────────────────────────────────

interface NovoFuncionarioForm {
  tipoContrato: "CLT" | "PJ";
  nome: string; cargo: string; departamento: string; admissao: string;
  cnpj: string; razaoSocial: string;
  salarioBruto: string; vt: string; vr: string; planoSaude: string; outros: string;
  status: "ATIVO" | "FERIAS" | "AFASTADO";
}

const FORM_VAZIO: NovoFuncionarioForm = {
  tipoContrato: "CLT",
  nome: "", cargo: "", departamento: "", admissao: "",
  cnpj: "", razaoSocial: "",
  salarioBruto: "", vt: "", vr: "", planoSaude: "", outros: "", status: "ATIVO",
};

function NovoColaboradorModal({
  onClose, onSalvar, onEditar, editando,
}: {
  onClose: () => void;
  onSalvar: (f: import("@/lib/demo-data-financeiro").Funcionario) => void;
  onEditar?: (f: import("@/lib/demo-data-financeiro").Funcionario) => void;
  editando?: import("@/lib/demo-data-financeiro").Funcionario;
}) {
  const [form, setForm] = useState<NovoFuncionarioForm>(editando ? {
    tipoContrato: editando.tipoContrato ?? "CLT",
    nome: editando.nome, cargo: editando.cargo, departamento: editando.departamento,
    admissao: editando.admissao, cnpj: editando.cnpj ?? "", razaoSocial: editando.razaoSocial ?? "",
    salarioBruto: String(editando.salarioBruto),
    vt: String(editando.beneficios.vt), vr: String(editando.beneficios.vr),
    planoSaude: String(editando.beneficios.planoSaude), outros: String(editando.beneficios.outros),
    status: editando.status,
  } : FORM_VAZIO);
  const [errors, setErrors] = useState<Partial<Record<keyof NovoFuncionarioForm, string>>>({});

  const isPJ = form.tipoContrato === "PJ";
  const bruto = parseFloat(form.salarioBruto) || 0;
  const inss  = isPJ ? 0 : calcINSS(bruto);
  const fgts  = isPJ ? 0 : Math.round(bruto * 0.08 * 100) / 100;
  const irrf  = isPJ ? 0 : calcIRRF(bruto, inss);
  const vtN   = parseFloat(form.vt)  || 0;
  const vrN   = parseFloat(form.vr)  || 0;
  const psN   = parseFloat(form.planoSaude) || 0;
  const ouN   = parseFloat(form.outros) || 0;
  const liquido = isPJ ? bruto : Math.round((bruto - inss - irrf) * 100) / 100;

  const set = (k: keyof NovoFuncionarioForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const validar = () => {
    const e: typeof errors = {};
    if (!form.nome.trim())          e.nome = "Obrigatório";
    if (!form.cargo.trim())         e.cargo = "Obrigatório";
    if (!form.departamento.trim())  e.departamento = "Obrigatório";
    if (!form.admissao)             e.admissao = "Obrigatório";
    if (!bruto || bruto < 1)        e.salarioBruto = "Informe o valor mensal";
    if (!isPJ && bruto < 1412)      e.salarioBruto = "Mínimo R$ 1.412,00 (salário mínimo 2025)";
    if (isPJ && !form.cnpj.trim())  e.cnpj = "Obrigatório para PJ";
    if (isPJ && !form.razaoSocial.trim()) e.razaoSocial = "Obrigatório para PJ";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const salvar = () => {
    if (!validar()) return;
    const novo: import("@/lib/demo-data-financeiro").Funcionario = {
      id: editando ? editando.id : `func-${Date.now()}`,
      nome: form.nome.trim(),
      cargo: form.cargo.trim(),
      departamento: form.departamento.trim(),
      admissao: form.admissao,
      tipoContrato: form.tipoContrato,
      ...(isPJ && { cnpj: form.cnpj.trim(), razaoSocial: form.razaoSocial.trim() }),
      salarioBruto: bruto,
      beneficios: isPJ ? { vt: 0, vr: 0, planoSaude: 0, outros: 0 } : { vt: vtN, vr: vrN, planoSaude: psN, outros: ouN },
      inss, fgts, irrf, salarioLiquido: liquido,
      status: form.status,
    };
    if (editando) { onEditar?.(novo); } else { onSalvar(novo); }
    onClose();
  };

  const inputCls = (err?: string) =>
    `w-full h-9 px-3 text-sm rounded-lg border ${err ? "border-red-500/50 bg-red-500/5" : "border-[#122036] bg-[#0F1E35]"} text-white placeholder:text-muted-foreground focus:outline-none focus:border-[#C9A84C]/60 transition-colors`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#091221] border border-[#122036] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/40">
          <div>
            <h2 className="text-lg font-bold text-white">{editando ? "Editar Colaborador" : "Novo Colaborador"}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isPJ ? "Contrato PJ — empresa não recolhe INSS/FGTS/IRRF" : "INSS, FGTS e IRRF calculados automaticamente"}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Tipo de Contrato */}
          <div>
            <p className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wider mb-3">Tipo de Contrato</p>
            <div className="flex gap-3">
              {(["CLT", "PJ"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setForm(f => ({ ...FORM_VAZIO, tipoContrato: t, nome: f.nome, cargo: f.cargo, departamento: f.departamento, admissao: f.admissao, status: f.status }))}
                  className={`flex-1 h-12 rounded-xl border-2 text-sm font-bold transition-all ${form.tipoContrato === t ? (t === "PJ" ? "border-purple-500 bg-purple-500/10 text-purple-300" : "border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]") : "border-[#122036] text-muted-foreground hover:border-[#1e3050]"}`}
                >
                  {t === "CLT" ? "🏢 CLT" : "🤝 PJ — Pessoa Jurídica"}
                </button>
              ))}
            </div>
            {isPJ && (
              <div className="mt-2 p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg">
                <p className="text-[10px] text-purple-300">
                  <strong>Contrato PJ:</strong> A V3 paga o valor combinado diretamente à empresa/CNPJ do prestador. Não há encargos trabalhistas (INSS patronal, FGTS, 13º, férias). O prestador é responsável pelos próprios impostos.
                </p>
              </div>
            )}
          </div>

          {/* Dados pessoais */}
          <div>
            <p className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wider mb-3">Dados {isPJ ? "do Prestador" : "Pessoais"}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Nome {isPJ ? "do Responsável" : "Completo"} *</label>
                <input value={form.nome} onChange={set("nome")} placeholder={isPJ ? "Ex: Carlos Mendes" : "Ex: João da Silva"} className={inputCls(errors.nome)} />
                {errors.nome && <p className="text-[10px] text-red-400 mt-1">{errors.nome}</p>}
              </div>

              {/* Campos exclusivos PJ */}
              {isPJ && (
                <>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">CNPJ *</label>
                    <input value={form.cnpj} onChange={set("cnpj")} placeholder="00.000.000/0001-00" className={inputCls(errors.cnpj)} />
                    {errors.cnpj && <p className="text-[10px] text-red-400 mt-1">{errors.cnpj}</p>}
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Razão Social / Nome da Empresa *</label>
                    <input value={form.razaoSocial} onChange={set("razaoSocial")} placeholder="Ex: Mendes Consultoria LTDA" className={inputCls(errors.razaoSocial)} />
                    {errors.razaoSocial && <p className="text-[10px] text-red-400 mt-1">{errors.razaoSocial}</p>}
                  </div>
                </>
              )}

              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Cargo / Função *</label>
                <input value={form.cargo} onChange={set("cargo")} placeholder="Ex: Consultor Financeiro" className={inputCls(errors.cargo)} />
                {errors.cargo && <p className="text-[10px] text-red-400 mt-1">{errors.cargo}</p>}
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Departamento *</label>
                <input value={form.departamento} onChange={set("departamento")} placeholder="Ex: Financeiro" className={inputCls(errors.departamento)} />
                {errors.departamento && <p className="text-[10px] text-red-400 mt-1">{errors.departamento}</p>}
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Data de {isPJ ? "Início" : "Admissão"} *</label>
                <input type="date" value={form.admissao} onChange={set("admissao")} className={inputCls(errors.admissao)} />
                {errors.admissao && <p className="text-[10px] text-red-400 mt-1">{errors.admissao}</p>}
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Status</label>
                <select value={form.status} onChange={set("status")} className={inputCls()}>
                  <option value="ATIVO">Ativo</option>
                  <option value="FERIAS">Férias</option>
                  <option value="AFASTADO">Afastado</option>
                </select>
              </div>
            </div>
          </div>

          {/* Remuneração */}
          <div>
            <p className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wider mb-3">Remuneração</p>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">
                {isPJ ? "Valor Mensal Pago (R$) — Nota Fiscal *" : "Salário Bruto (R$) *"}
              </label>
              <input
                type="number" min={isPJ ? "1" : "1412"} step="100"
                value={form.salarioBruto} onChange={set("salarioBruto")}
                placeholder={isPJ ? "Ex: 12000" : "Ex: 8500"}
                className={inputCls(errors.salarioBruto)}
              />
              {errors.salarioBruto && <p className="text-[10px] text-red-400 mt-1">{errors.salarioBruto}</p>}
            </div>
          </div>

          {/* Benefícios — apenas CLT */}
          {!isPJ && (
            <div>
              <p className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wider mb-3">Benefícios</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {([["vt", "Vale Transporte"], ["vr", "Vale Refeição"], ["planoSaude", "Plano de Saúde"], ["outros", "Outros"]] as const).map(([k, lbl]) => (
                  <div key={k}>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">{lbl}</label>
                    <input type="number" min="0" step="10" value={(form as any)[k]} onChange={set(k as keyof NovoFuncionarioForm)} placeholder="0,00" className={inputCls()} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview calculado */}
          {bruto >= 1 && (
            <div className={`bg-[#09081A] border rounded-xl p-4 ${isPJ ? "border-purple-500/20" : "border-[#C9A84C]/20"}`}>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isPJ ? "text-purple-400" : "text-[#C9A84C]"}`}>
                {isPJ ? "Resumo do Contrato PJ" : "Cálculo Automático"}
              </p>
              {isPJ ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                  {[
                    { label: "Valor Mensal (NF)", value: formatMoeda(bruto), color: "#A855F7" },
                    { label: "Encargos V3", value: "R$ 0,00", color: "#22C55E" },
                    { label: "Custo Total Empresa", value: formatMoeda(bruto), color: "#A855F7" },
                  ].map(k => (
                    <div key={k.label} className="bg-[#091221] rounded-lg p-3">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">{k.label}</p>
                      <p className="text-sm font-bold" style={{ color: k.color }}>{k.value}</p>
                    </div>
                  ))}
                </div>
              ) : bruto >= 1412 ? (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                  {[
                    { label: "Sal. Bruto",   value: formatMoeda(bruto),    color: "#C9A84C" },
                    { label: "INSS (desc.)", value: formatMoeda(inss),     color: "#EF4444" },
                    { label: "FGTS (emp.)",  value: formatMoeda(fgts),     color: "#F59E0B" },
                    { label: "IRRF (desc.)", value: formatMoeda(irrf),     color: "#EF4444" },
                    { label: "Sal. Líquido", value: formatMoeda(liquido),  color: "#22C55E" },
                  ].map(k => (
                    <div key={k.label} className="bg-[#091221] rounded-lg p-3">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">{k.label}</p>
                      <p className="text-sm font-bold" style={{ color: k.color }}>{k.value}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-border/40">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-border/50 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-all">
            Cancelar
          </button>
          <button onClick={salvar} className={`flex-1 h-10 rounded-xl text-white text-sm font-semibold transition-all ${isPJ ? "bg-purple-600 hover:bg-purple-500" : "bg-[#C9A84C] hover:bg-[#E8C97A]"}`}>
            {editando ? "Salvar Alterações" : `Adicionar ${isPJ ? "Prestador PJ" : "Colaborador CLT"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TAB: FOLHA DE PAGAMENTO ──────────────────────────────────────────────────

function FolhaTab() {
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [funcionarios, setFuncionarios] = useState<typeof DEMO_FUNCIONARIOS>([]);
  const [showModal, setShowModal] = useState(false);
  const [editandoFunc, setEditandoFunc] = useState<import("@/lib/demo-data-financeiro").Funcionario | null>(null);

  // Carrega do Supabase na montagem
  React.useEffect(() => {
    fetch("/api/financeiro?type=funcionario")
      .then(r => r.json())
      .then(json => {
        if (json.records?.length) {
          setFuncionarios(json.records.map((r: { id: string; data: typeof DEMO_FUNCIONARIOS[0] }) => ({ ...r.data, _dbId: r.id })));
        }
      })
      .catch(() => {});
  }, []);

  const excluirFuncionario = async (id: string, nome: string) => {
    if (!window.confirm(`Excluir "${nome}" da folha de pagamento?`)) return;
    const func = funcionarios.find(f => f.id === id) as (typeof DEMO_FUNCIONARIOS[0] & { _dbId?: string });
    if (func?._dbId) {
      await fetch(`/api/financeiro?id=${func._dbId}`, { method: "DELETE" }).catch(() => {});
    }
    setFuncionarios(prev => prev.filter(f => f.id !== id));
  };

  const totais = funcionarios.reduce((acc, f) => ({
    bruto:      acc.bruto      + f.salarioBruto,
    inss:       acc.inss       + f.inss,
    fgts:       acc.fgts       + f.fgts,
    irrf:       acc.irrf       + f.irrf,
    beneficios: acc.beneficios + Object.values(f.beneficios).reduce((a, b) => a + b, 0),
    liquido:    acc.liquido    + f.salarioLiquido,
  }), { bruto: 0, inss: 0, fgts: 0, irrf: 0, beneficios: 0, liquido: 0 });

  return (
    <>
      {(showModal || editandoFunc) && (
        <NovoColaboradorModal
          editando={editandoFunc ?? undefined}
          onClose={() => { setShowModal(false); setEditandoFunc(null); }}
          onSalvar={async (f) => {
            try {
              const res = await fetch("/api/financeiro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "funcionario", data: f }) });
              const json = await res.json();
              if (json.record) { setFuncionarios(prev => [...prev, { ...f, _dbId: json.record.id } as typeof f]); return; }
            } catch {}
            setFuncionarios(prev => [...prev, f]);
          }}
          onEditar={async (f) => {
            const existing = funcionarios.find(x => x.id === f.id) as (typeof DEMO_FUNCIONARIOS[0] & { _dbId?: string });
            if (existing?._dbId) {
              await fetch("/api/financeiro", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: existing._dbId, data: f }) }).catch(() => {});
            }
            setFuncionarios(prev => prev.map(x => x.id === f.id ? { ...f, _dbId: existing?._dbId } as typeof f : x));
          }}
        />
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <MonthSelector mes={mes} ano={ano} onChange={(m, a) => { setMes(m); setAno(a); }} />
          <div className="flex gap-2">
            <ExportButton opts={{
              titulo: "Folha de Pagamento",
              mes: `${MESES_PT[mes - 1]} / ${ano}`,
              orientacao: "landscape",
              colunas: [
                { header: "Colaborador", key: "nome", width: 25 },
                { header: "Cargo", key: "cargo", width: 20 },
                { header: "Depto.", key: "departamento", width: 18 },
                { header: "Contrato", key: "tipoContrato", width: 10 },
                { header: "Admissão", key: "admissao", format: "date", width: 14 },
                { header: "Sal. Bruto", key: "salarioBruto", format: "moeda", width: 16 },
                { header: "INSS", key: "inss", format: "moeda", width: 14 },
                { header: "FGTS", key: "fgts", format: "moeda", width: 14 },
                { header: "IRRF", key: "irrf", format: "moeda", width: 14 },
                { header: "Sal. Líquido", key: "salarioLiquido", format: "moeda", width: 16 },
                { header: "Status", key: "status", width: 10 },
              ],
              dados: funcionarios.map(f => ({ ...f, tipoContrato: f.tipoContrato ?? "CLT" })),
              totais: {
                label: "TOTAL",
                valores: { nome: "TOTAL", salarioBruto: totais.bruto, inss: totais.inss, fgts: totais.fgts, irrf: totais.irrf, salarioLiquido: totais.liquido },
              },
            }} />
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 text-xs bg-[#C9A84C] text-white px-3 py-1.5 rounded-lg hover:bg-[#E8C97A] transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Novo Colaborador
            </button>
          </div>
        </div>

        {/* Totais */}
        {(() => {
          const totalPJ = funcionarios.filter(f => f.tipoContrato === "PJ").reduce((s, f) => s + f.salarioBruto, 0);
          const qtdPJ = funcionarios.filter(f => f.tipoContrato === "PJ").length;
          return (
            <div className="space-y-2">
              <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: "Bruto CLT + NF PJ", value: formatMoeda(totais.bruto), color: "#C9A84C" },
                  { label: "INSS (desc. CLT)", value: formatMoeda(totais.inss), color: "#EF4444" },
                  { label: "FGTS (emp. CLT)", value: formatMoeda(totais.fgts), color: "#F59E0B" },
                  { label: "IRRF (desc. CLT)", value: formatMoeda(totais.irrf), color: "#EF4444" },
                  { label: "Benefícios CLT", value: formatMoeda(totais.beneficios), color: "#8B5CF6" },
                  { label: "Total Pago / Líquido", value: formatMoeda(totais.liquido), color: "#22C55E" },
                ].map(k => (
                  <div key={k.label} className="bg-[#091221] border border-[#122036] rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{k.label}</p>
                    <p className="text-sm font-bold" style={{ color: k.color }}>{k.value}</p>
                  </div>
                ))}
              </div>
              {qtdPJ > 0 && (
                <div className="flex items-center gap-3 px-3 py-2 bg-purple-500/5 border border-purple-500/20 rounded-lg text-xs">
                  <span className="text-purple-400 font-semibold">🤝 Contratos PJ:</span>
                  <span className="text-purple-300">{qtdPJ} prestador{qtdPJ !== 1 ? "es" : ""}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-purple-300 font-semibold">{formatMoeda(totalPJ)}/mês em notas fiscais</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-emerald-400 text-[10px]">Encargos patronais: R$ 0,00 — sem INSS/FGTS/13º/férias</span>
                </div>
              )}
            </div>
          );
        })()}

        {/* Tabela */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/40">
                    {["Colaborador", "Cargo / Depto.", "Contrato", "Admissão", "Bruto / NF", "INSS", "FGTS", "IRRF", "Benefícios", "Líquido / Pago", "Status", "Ações"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-muted-foreground font-semibold uppercase tracking-wide text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {funcionarios.map((f, i) => {
                    const pj = f.tipoContrato === "PJ";
                    return (
                    <tr key={f.id} className={`border-b border-border/20 hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? "" : "bg-[#091221]/40"}`}>
                      <td className="px-4 py-3 font-medium text-white whitespace-nowrap">
                        {f.nome}
                        {pj && f.razaoSocial && (
                          <div className="text-[10px] text-purple-400 font-normal">{f.razaoSocial}</div>
                        )}
                        {pj && f.cnpj && (
                          <div className="text-[10px] text-muted-foreground/60 font-mono">{f.cnpj}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div>{f.cargo}</div>
                        <div className="text-[10px] text-muted-foreground/60">{f.departamento}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold border px-2 py-0.5 rounded-full ${pj ? "bg-purple-500/20 text-purple-400 border-purple-500/30" : "bg-[#C9A84C]/20 text-[#C9A84C] border-[#C9A84C]/30"}`}>
                          {pj ? "PJ" : "CLT"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(f.admissao + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-3 font-semibold text-white">{formatMoeda(f.salarioBruto)}</td>
                      <td className="px-4 py-3 text-red-400">{pj ? <span className="text-muted-foreground/40">—</span> : formatMoeda(f.inss)}</td>
                      <td className="px-4 py-3 text-amber-400">{pj ? <span className="text-muted-foreground/40">—</span> : formatMoeda(f.fgts)}</td>
                      <td className="px-4 py-3 text-red-400">{pj ? <span className="text-muted-foreground/40">—</span> : formatMoeda(f.irrf)}</td>
                      <td className="px-4 py-3 text-purple-400">{pj ? <span className="text-muted-foreground/40">—</span> : formatMoeda(Object.values(f.beneficios).reduce((a, b) => a + b, 0))}</td>
                      <td className="px-4 py-3 font-bold" style={{ color: pj ? "#A855F7" : "#22C55E" }}>{formatMoeda(f.salarioLiquido)}</td>
                      <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button
                            onClick={() => setEditandoFunc(f)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-all"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => excluirFuncionario(f.id, f.nome)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[#0F1E35] border-t border-[#C9A84C]/30">
                    <td className="px-4 py-3 font-bold text-[#C9A84C]" colSpan={4}>TOTAIS — {funcionarios.length} colaborador{funcionarios.length !== 1 ? "es" : ""} ({funcionarios.filter(f => f.tipoContrato !== "PJ").length} CLT · {funcionarios.filter(f => f.tipoContrato === "PJ").length} PJ)</td>
                    <td className="px-4 py-3 font-bold text-[#C9A84C]">{formatMoeda(totais.bruto)}</td>
                    <td className="px-4 py-3 font-bold text-red-400">{formatMoeda(totais.inss)}</td>
                    <td className="px-4 py-3 font-bold text-amber-400">{formatMoeda(totais.fgts)}</td>
                    <td className="px-4 py-3 font-bold text-red-400">{formatMoeda(totais.irrf)}</td>
                    <td className="px-4 py-3 font-bold text-purple-400">{formatMoeda(totais.beneficios)}</td>
                    <td className="px-4 py-3 font-bold text-emerald-400">{formatMoeda(totais.liquido)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// ─── Modal: Nova Despesa ──────────────────────────────────────────────────────

const CATEGORIAS = ["Aluguel", "Utilities", "Software/SaaS", "Contabilidade", "Jurídico", "Marketing", "RH", "Operacional", "Viagem", "Alimentação", "Equipamentos", "Outros"];

interface NovaDespesaFixaForm {
  descricao: string; categoria: string; fornecedor: string;
  valor: string; diaVencimento: string;
}
interface NovaDespesaVariavelForm {
  descricao: string; categoria: string; fornecedor: string;
  valor: string; vencimento: string; status: "PENDENTE" | "PAGA";
}

function NovaDespesaModal({
  tipo, mes, ano, onClose,
  editandoFixa, editandoVariavel,
  onSalvarFixa, onEditarFixa, onSalvarVariavel, onEditarVariavel,
}: {
  tipo: "fixas" | "variaveis"; mes: number; ano: number;
  onClose: () => void;
  editandoFixa?: import("@/lib/demo-data-financeiro").DespesaFixaTemplate;
  editandoVariavel?: import("@/lib/demo-data-financeiro").Despesa;
  onSalvarFixa: (t: import("@/lib/demo-data-financeiro").DespesaFixaTemplate) => void;
  onEditarFixa: (t: import("@/lib/demo-data-financeiro").DespesaFixaTemplate) => void;
  onSalvarVariavel: (d: import("@/lib/demo-data-financeiro").Despesa) => void;
  onEditarVariavel: (d: import("@/lib/demo-data-financeiro").Despesa) => void;
}) {
  const [fixaForm, setFixaForm] = useState<NovaDespesaFixaForm>(editandoFixa ? {
    descricao: editandoFixa.descricao, categoria: editandoFixa.categoria,
    fornecedor: editandoFixa.fornecedor, valor: String(editandoFixa.valor),
    diaVencimento: String(editandoFixa.diaVencimento),
  } : { descricao: "", categoria: "Outros", fornecedor: "", valor: "", diaVencimento: "10" });
  const [varForm, setVarForm] = useState<NovaDespesaVariavelForm>(editandoVariavel ? {
    descricao: editandoVariavel.descricao, categoria: editandoVariavel.categoria,
    fornecedor: editandoVariavel.fornecedor ?? "", valor: String(editandoVariavel.valor),
    vencimento: editandoVariavel.vencimento ?? "", status: editandoVariavel.status as "PENDENTE" | "PAGA",
  } : { descricao: "", categoria: "Outros", fornecedor: "", valor: "", vencimento: "", status: "PENDENTE" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const inputCls = (err?: string) =>
    `w-full h-9 px-3 text-sm rounded-lg border ${err ? "border-red-500/50 bg-red-500/5" : "border-[#122036] bg-[#0F1E35]"} text-white placeholder:text-muted-foreground focus:outline-none focus:border-[#C9A84C]/60 transition-colors`;
  const selectCls = () =>
    `w-full h-9 px-3 text-sm rounded-lg border border-[#122036] bg-[#0F1E35] text-white focus:outline-none focus:border-[#C9A84C]/60 transition-colors`;

  const salvarFixa = () => {
    const e: Record<string, string> = {};
    if (!fixaForm.descricao.trim()) e.descricao = "Obrigatório";
    if (!fixaForm.fornecedor.trim()) e.fornecedor = "Obrigatório";
    const val = parseFloat(fixaForm.valor);
    if (!val || val <= 0) e.valor = "Informe um valor válido";
    const dia = parseInt(fixaForm.diaVencimento);
    if (!dia || dia < 1 || dia > 31) e.diaVencimento = "Dia inválido (1–31)";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    const tpl = { id: editandoFixa ? editandoFixa.id : `tpl-${Date.now()}`, descricao: fixaForm.descricao.trim(), categoria: fixaForm.categoria, valor: val, fornecedor: fixaForm.fornecedor.trim(), diaVencimento: dia, ativa: true };
    if (editandoFixa) { onEditarFixa(tpl); } else { onSalvarFixa(tpl); }
    onClose();
  };

  const salvarVariavel = () => {
    const e: Record<string, string> = {};
    if (!varForm.descricao.trim()) e.descricao = "Obrigatório";
    if (!varForm.fornecedor.trim()) e.fornecedor = "Obrigatório";
    const val = parseFloat(varForm.valor);
    if (!val || val <= 0) e.valor = "Informe um valor válido";
    if (!varForm.vencimento) e.vencimento = "Obrigatório";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    const desp = { id: editandoVariavel ? editandoVariavel.id : `var-${Date.now()}`, descricao: varForm.descricao.trim(), categoria: varForm.categoria, tipo: "VARIAVEL" as const, valor: val, mes, ano, autoReplicada: false, despesaBaseId: null, fornecedor: varForm.fornecedor.trim(), vencimento: varForm.vencimento, status: varForm.status };
    if (editandoVariavel) { onEditarVariavel(desp); } else { onSalvarVariavel(desp); }
    onClose();
  };

  const isFixa = tipo === "fixas";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#091221] border border-[#122036] rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/40">
          <div>
            <h2 className="text-lg font-bold text-white">
              {editandoFixa ? "Editar Despesa Fixa" : editandoVariavel ? "Editar Despesa Variável" : isFixa ? "Nova Despesa Fixa" : "Nova Despesa Variável"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isFixa
                ? "Será replicada automaticamente para todos os meses futuros"
                : `Lançamento para ${MESES_PT[mes - 1]}/${ano}`}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {isFixa ? (
            <>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Descrição *</label>
                <input value={fixaForm.descricao} onChange={e => setFixaForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Aluguel Sede" className={inputCls(errors.descricao)} />
                {errors.descricao && <p className="text-[10px] text-red-400 mt-1">{errors.descricao}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Categoria</label>
                  <select value={fixaForm.categoria} onChange={e => setFixaForm(f => ({ ...f, categoria: e.target.value }))} className={selectCls()}>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Fornecedor *</label>
                  <input value={fixaForm.fornecedor} onChange={e => setFixaForm(f => ({ ...f, fornecedor: e.target.value }))} placeholder="Ex: Imobiliária XYZ" className={inputCls(errors.fornecedor)} />
                  {errors.fornecedor && <p className="text-[10px] text-red-400 mt-1">{errors.fornecedor}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Valor Mensal (R$) *</label>
                  <input type="number" min="1" step="10" value={fixaForm.valor} onChange={e => setFixaForm(f => ({ ...f, valor: e.target.value }))} placeholder="Ex: 3500" className={inputCls(errors.valor)} />
                  {errors.valor && <p className="text-[10px] text-red-400 mt-1">{errors.valor}</p>}
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Dia de Vencimento *</label>
                  <input type="number" min="1" max="31" value={fixaForm.diaVencimento} onChange={e => setFixaForm(f => ({ ...f, diaVencimento: e.target.value }))} placeholder="Ex: 10" className={inputCls(errors.diaVencimento)} />
                  {errors.diaVencimento && <p className="text-[10px] text-red-400 mt-1">{errors.diaVencimento}</p>}
                </div>
              </div>
              {parseFloat(fixaForm.valor) > 0 && (
                <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg text-xs text-blue-300">
                  <RefreshCw className="w-3 h-3 inline mr-1" />
                  Esta despesa de <strong>{formatMoeda(parseFloat(fixaForm.valor))}</strong> será lançada automaticamente todo mês no dia <strong>{fixaForm.diaVencimento || "—"}</strong>.
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Descrição *</label>
                <input value={varForm.descricao} onChange={e => setVarForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Campanha Google Ads" className={inputCls(errors.descricao)} />
                {errors.descricao && <p className="text-[10px] text-red-400 mt-1">{errors.descricao}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Categoria</label>
                  <select value={varForm.categoria} onChange={e => setVarForm(f => ({ ...f, categoria: e.target.value }))} className={selectCls()}>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Fornecedor *</label>
                  <input value={varForm.fornecedor} onChange={e => setVarForm(f => ({ ...f, fornecedor: e.target.value }))} placeholder="Ex: Google LLC" className={inputCls(errors.fornecedor)} />
                  {errors.fornecedor && <p className="text-[10px] text-red-400 mt-1">{errors.fornecedor}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Valor (R$) *</label>
                  <input type="number" min="1" step="10" value={varForm.valor} onChange={e => setVarForm(f => ({ ...f, valor: e.target.value }))} placeholder="Ex: 2000" className={inputCls(errors.valor)} />
                  {errors.valor && <p className="text-[10px] text-red-400 mt-1">{errors.valor}</p>}
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Data de Vencimento *</label>
                  <input type="date" value={varForm.vencimento} onChange={e => setVarForm(f => ({ ...f, vencimento: e.target.value }))} className={inputCls(errors.vencimento)} />
                  {errors.vencimento && <p className="text-[10px] text-red-400 mt-1">{errors.vencimento}</p>}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Status</label>
                <select value={varForm.status} onChange={e => setVarForm(f => ({ ...f, status: e.target.value as "PENDENTE" | "PAGA" }))} className={selectCls()}>
                  <option value="PENDENTE">Pendente</option>
                  <option value="PAGA">Paga</option>
                </select>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 p-5 border-t border-border/40">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-border/50 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-all">
            Cancelar
          </button>
          <button
            onClick={isFixa ? salvarFixa : salvarVariavel}
            className="flex-1 h-10 rounded-xl bg-[#C9A84C] text-white text-sm font-semibold hover:bg-[#E8C97A] transition-all"
          >
            {editandoFixa || editandoVariavel ? "Salvar Alterações" : isFixa ? "Adicionar Despesa Fixa" : "Adicionar Despesa Variável"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TAB: DESPESAS ────────────────────────────────────────────────────────────

function DespesasTab() {
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [subtab, setSubtab] = useState<"fixas" | "variaveis">("fixas");
  const [filtroStatus, setFiltroStatus] = useState<"ABERTAS" | "PAGAS">("ABERTAS");
  const [showModal, setShowModal] = useState(false);
  const [templates, setTemplates] = useState<import("@/lib/demo-data-financeiro").DespesaFixaTemplate[]>([]);
  const [todasVariaveis, setTodasVariaveis] = useState<import("@/lib/demo-data-financeiro").Despesa[]>([]);
  const [editandoFixaTpl, setEditandoFixaTpl] = useState<import("@/lib/demo-data-financeiro").DespesaFixaTemplate | null>(null);
  const [editandoVariavel, setEditandoVariavel] = useState<import("@/lib/demo-data-financeiro").Despesa | null>(null);
  // Rastreia quais despesas fixas foram pagas por mês: key = `${despesaBaseId}-${mes}-${ano}`, value = dbId
  const [fixasPagas, setFixasPagas] = useState<Map<string, string>>(new Map());
  const [marcandoPago, setMarcandoPago] = useState<string | null>(null);

  // Carrega do Supabase na montagem
  React.useEffect(() => {
    fetch("/api/financeiro?type=despesa_fixa")
      .then(r => r.json())
      .then(json => { if (json.records?.length) setTemplates(json.records.map((r: { id: string; data: import("@/lib/demo-data-financeiro").DespesaFixaTemplate }) => ({ ...r.data, _dbId: r.id }))); })
      .catch(() => {});
    fetch("/api/financeiro?type=despesa_variavel")
      .then(r => r.json())
      .then(json => { if (json.records?.length) setTodasVariaveis(json.records.map((r: { id: string; data: import("@/lib/demo-data-financeiro").Despesa }) => ({ ...r.data, _dbId: r.id }))); })
      .catch(() => {});
    fetch("/api/financeiro?type=despesa_fixa_paga")
      .then(r => r.json())
      .then(json => {
        if (json.records?.length) {
          const map = new Map<string, string>();
          json.records.forEach((r: { id: string; data: { despesaBaseId: string; mes: number; ano: number } }) => {
            map.set(`${r.data.despesaBaseId}-${r.data.mes}-${r.data.ano}`, r.id);
          });
          setFixasPagas(map);
        }
      })
      .catch(() => {});
  }, []);

  const excluirFixa = async (tplId: string, desc: string) => {
    if (!window.confirm(`Excluir despesa fixa "${desc}"? Será removida de todos os meses.`)) return;
    const tpl = templates.find(t => t.id === tplId) as (import("@/lib/demo-data-financeiro").DespesaFixaTemplate & { _dbId?: string });
    if (tpl?._dbId) await fetch(`/api/financeiro?id=${tpl._dbId}`, { method: "DELETE" }).catch(() => {});
    setTemplates(prev => prev.filter(t => t.id !== tplId));
  };
  const excluirVariavel = async (id: string, desc: string) => {
    if (!window.confirm(`Excluir despesa "${desc}"?`)) return;
    const desp = todasVariaveis.find(d => d.id === id) as (import("@/lib/demo-data-financeiro").Despesa & { _dbId?: string });
    if (desp?._dbId) await fetch(`/api/financeiro?id=${desp._dbId}`, { method: "DELETE" }).catch(() => {});
    setTodasVariaveis(prev => prev.filter(d => d.id !== id));
  };

  // Fixas: expande os templates para o mês selecionado, aplicando status de pagamento
  const fixas = useMemo(() => {
    return templates.map(t => {
      const fixaKey = `${t.id}-${mes}-${ano}`;
      const paga = fixasPagas.has(fixaKey);
      return {
        id: `fix-${t.id}-${mes}-${ano}`,
        descricao: t.descricao,
        categoria: t.categoria,
        tipo: "FIXA" as const,
        valor: t.valor,
        mes, ano,
        autoReplicada: true,
        despesaBaseId: t.id,
        fornecedor: t.fornecedor,
        vencimento: `${ano}-${String(mes).padStart(2, "0")}-${String(t.diaVencimento).padStart(2, "0")}`,
        status: paga ? "PAGA" as const : "PENDENTE" as const,
        _fixaKey: fixaKey,
      };
    });
  }, [templates, mes, ano, fixasPagas]);

  // Variáveis: todas (demo + novas) filtradas por mês/ano
  const variaveis = useMemo(() => {
    return todasVariaveis.filter(d => d.mes === mes && d.ano === ano);
  }, [todasVariaveis, mes, ano]);

  const totalFixas = fixas.reduce((s, d) => s + d.valor, 0);
  const totalVariaveis = variaveis.reduce((s, d) => s + d.valor, 0);
  const items = subtab === "fixas" ? fixas : variaveis;

  // Filtra por status
  const itemsFiltrados = useMemo(() => {
    if (filtroStatus === "ABERTAS") return items.filter(d => d.status !== "PAGA");
    if (filtroStatus === "PAGAS")   return items.filter(d => d.status === "PAGA");
    return items;
  }, [items, filtroStatus]);

  const totalAberto = items.filter(d => d.status !== "PAGA").reduce((s, d) => s + d.valor, 0);
  const totalPago   = items.filter(d => d.status === "PAGA").reduce((s, d) => s + d.valor, 0);

  async function handleMarcarPago(d: typeof items[0]) {
    setMarcandoPago(d.id);
    try {
      if (subtab === "variaveis") {
        const existing = todasVariaveis.find(x => x.id === d.id) as (import("@/lib/demo-data-financeiro").Despesa & { _dbId?: string });
        if (existing?._dbId) {
          await fetch("/api/financeiro", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: existing._dbId, data: { ...existing, status: "PAGA" } }),
          });
        }
        setTodasVariaveis(prev => prev.map(x => x.id === d.id ? { ...x, status: "PAGA" as const } : x));
      } else {
        // Fixa: salva registro de pagamento no Supabase
        const res = await fetch("/api/financeiro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "despesa_fixa_paga", data: { despesaBaseId: d.despesaBaseId, mes, ano } }),
        });
        const json = await res.json();
        const key = (d as typeof d & { _fixaKey?: string })._fixaKey ?? `${d.despesaBaseId}-${mes}-${ano}`;
        setFixasPagas(prev => new Map(prev).set(key, json.record?.id ?? "ok"));
      }
    } finally { setMarcandoPago(null); }
  }

  return (
    <>
      {(showModal || editandoFixaTpl || editandoVariavel) && (
        <NovaDespesaModal
          tipo={editandoVariavel ? "variaveis" : subtab}
          mes={mes}
          ano={ano}
          editandoFixa={editandoFixaTpl ?? undefined}
          editandoVariavel={editandoVariavel ?? undefined}
          onClose={() => { setShowModal(false); setEditandoFixaTpl(null); setEditandoVariavel(null); }}
          onSalvarFixa={async (t) => {
            try {
              const res = await fetch("/api/financeiro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "despesa_fixa", data: t }) });
              const json = await res.json();
              if (json.record) { setTemplates(prev => [...prev, { ...t, _dbId: json.record.id } as typeof t]); return; }
            } catch {}
            setTemplates(prev => [...prev, t]);
          }}
          onEditarFixa={async (t) => {
            const existing = templates.find(x => x.id === t.id) as (import("@/lib/demo-data-financeiro").DespesaFixaTemplate & { _dbId?: string });
            if (existing?._dbId) await fetch("/api/financeiro", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: existing._dbId, data: t }) }).catch(() => {});
            setTemplates(prev => prev.map(x => x.id === t.id ? { ...t, _dbId: existing?._dbId } as typeof t : x));
          }}
          onSalvarVariavel={async (d) => {
            try {
              const res = await fetch("/api/financeiro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "despesa_variavel", data: d }) });
              const json = await res.json();
              if (json.record) { setTodasVariaveis(prev => [...prev, { ...d, _dbId: json.record.id } as typeof d]); return; }
            } catch {}
            setTodasVariaveis(prev => [...prev, d]);
          }}
          onEditarVariavel={async (d) => {
            const existing = todasVariaveis.find(x => x.id === d.id) as (import("@/lib/demo-data-financeiro").Despesa & { _dbId?: string });
            if (existing?._dbId) await fetch("/api/financeiro", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: existing._dbId, data: d }) }).catch(() => {});
            setTodasVariaveis(prev => prev.map(x => x.id === d.id ? { ...d, _dbId: existing?._dbId } as typeof d : x));
          }}
        />
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <MonthSelector mes={mes} ano={ano} onChange={(m, a) => { setMes(m); setAno(a); }} />
            <div className="flex bg-secondary rounded-lg p-0.5">
              <button onClick={() => setSubtab("fixas")} className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${subtab === "fixas" ? "bg-[#C9A84C] text-white" : "text-muted-foreground hover:text-foreground"}`}>
                Fixas <span className="ml-1 opacity-70">{formatMoeda(totalFixas)}</span>
              </button>
              <button onClick={() => setSubtab("variaveis")} className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${subtab === "variaveis" ? "bg-[#C9A84C] text-white" : "text-muted-foreground hover:text-foreground"}`}>
                Variáveis <span className="ml-1 opacity-70">{formatMoeda(totalVariaveis)}</span>
              </button>
            </div>
            {/* Filtro Em Aberto / Pagas */}
            <div className="flex bg-secondary rounded-lg p-0.5">
              <button onClick={() => setFiltroStatus("ABERTAS")} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${filtroStatus === "ABERTAS" ? "bg-amber-500/30 text-amber-400" : "text-muted-foreground hover:text-foreground"}`}>
                <Clock className="w-3 h-3" /> Em Aberto
                <span className="ml-0.5 font-bold">{items.filter(d => d.status !== "PAGA").length}</span>
              </button>
              <button onClick={() => setFiltroStatus("PAGAS")} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${filtroStatus === "PAGAS" ? "bg-emerald-500/30 text-emerald-400" : "text-muted-foreground hover:text-foreground"}`}>
                <CheckCircle2 className="w-3 h-3" /> Pagas
                <span className="ml-0.5 font-bold">{items.filter(d => d.status === "PAGA").length}</span>
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <ExportButton opts={{
              titulo: subtab === "fixas" ? "Despesas Fixas" : "Despesas Variáveis",
              mes: `${MESES_PT[mes - 1]} / ${ano}`,
              colunas: [
                { header: "Descrição", key: "descricao", width: 28 },
                { header: "Categoria", key: "categoria", width: 18 },
                { header: "Fornecedor", key: "fornecedor", width: 22 },
                { header: "Vencimento", key: "vencimento", format: "date", width: 14 },
                { header: "Valor", key: "valor", format: "moeda", width: 16 },
                { header: "Status", key: "status", width: 12 },
              ],
              dados: items,
              totais: { label: "TOTAL", valores: { descricao: "TOTAL", valor: subtab === "fixas" ? totalFixas : totalVariaveis } },
            }} />
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 text-xs bg-[#C9A84C] text-white px-3 py-1.5 rounded-lg hover:bg-[#E8C97A] transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Nova {subtab === "fixas" ? "Despesa Fixa" : "Despesa Variável"}
            </button>
          </div>
        </div>

        {subtab === "fixas" && (
          <div className="flex items-center gap-2 p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl text-xs text-blue-400">
            <RefreshCw className="w-3.5 h-3.5 flex-shrink-0" />
            Despesas fixas são replicadas automaticamente todo mês. Ao adicionar uma nova, ela aparecerá em todos os meses automaticamente.
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/40">
                    {["Descrição", "Categoria", "Fornecedor", "Vencimento", "Valor", "Status", subtab === "fixas" ? "Origem" : "", "Ações"].filter(Boolean).map(h => (
                      <th key={h} className="text-left px-4 py-3 text-muted-foreground font-semibold uppercase tracking-wide text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {itemsFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Receipt className="w-7 h-7 opacity-20" />
                          <span>
                            {filtroStatus === "PAGAS" ? "Nenhuma despesa paga neste mês" :
                             filtroStatus === "ABERTAS" ? "Nenhuma despesa em aberto neste mês 🎉" :
                             `Nenhuma despesa ${subtab === "fixas" ? "fixa" : "variável"} neste mês`}
                          </span>
                          {filtroStatus === "ABERTAS" && (
                            <button onClick={() => setShowModal(true)} className="text-[#C9A84C] hover:underline text-xs mt-1">
                              + Adicionar agora
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : itemsFiltrados.map((d, i) => (
                    <tr key={d.id} className={`border-b border-border/20 hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? "" : "bg-[#091221]/40"}`}>
                      <td className="px-4 py-3 font-medium text-white">{d.descricao}</td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">{d.categoria}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{d.fornecedor}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {d.vencimento ? new Date(d.vencimento + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="px-4 py-3 font-semibold text-white">{formatMoeda(d.valor)}</td>
                      <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                      {subtab === "fixas" && (
                        <td className="px-4 py-3">
                          <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">Auto</span>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex gap-1 items-center">
                          {/* Botão Pago — apenas para despesas em aberto */}
                          {d.status !== "PAGA" && (
                            <button
                              onClick={() => handleMarcarPago(d)}
                              disabled={marcandoPago === d.id}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-50 transition-all whitespace-nowrap"
                              title="Marcar como pago"
                            >
                              {marcandoPago === d.id
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <CheckCircle2 className="w-3 h-3" />}
                              Pago
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (subtab === "fixas") {
                                const tpl = templates.find(t => d.despesaBaseId === t.id);
                                if (tpl) setEditandoFixaTpl(tpl);
                              } else {
                                setEditandoVariavel(d);
                              }
                            }}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-all"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (subtab === "fixas") {
                                const tpl = templates.find(t => d.despesaBaseId === t.id);
                                if (tpl) excluirFixa(tpl.id, tpl.descricao);
                              } else {
                                excluirVariavel(d.id, d.descricao);
                              }
                            }}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#0F1E35] border-t border-[#C9A84C]/30">
                    <td className="px-4 py-3 font-bold text-[#C9A84C]" colSpan={3}>
                      TOTAL — {itemsFiltrados.length} item{itemsFiltrados.length !== 1 ? "s" : ""}
                    </td>
                    <td className="px-4 py-2" colSpan={2}>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-amber-400 font-semibold">Em aberto: {formatMoeda(totalAberto)}</span>
                        <span className="text-[10px] text-emerald-400 font-semibold">Pago: {formatMoeda(totalPago)}</span>
                      </div>
                    </td>
                    <td colSpan={subtab === "fixas" ? 3 : 2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// ─── TAB: COMISSÕES (VISÃO FINANCEIRO/ADMIN) ──────────────────────────────────

// ─── NPS Admin Panel ──────────────────────────────────────────────────────────

interface NpsResponseAdmin {
  id: string;
  score: number;
  comment: string | null;
  created_at: string;
  commission_id: string | null;
  partner_id: string;
  profiles: { full_name: string | null; email: string } | null;
}

function NpsAdminPanel() {
  const [responses, setResponses] = useState<NpsResponseAdmin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/nps")
      .then(r => r.json())
      .then(({ responses: data }) => {
        if (Array.isArray(data)) setResponses(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const avg = responses.length > 0
    ? responses.reduce((s, r) => s + r.score, 0) / responses.length
    : null;

  // NPS = %promotores(9-10) - %detratores(0-6)
  const promotores = responses.filter(r => r.score >= 9).length;
  const detratores = responses.filter(r => r.score <= 6).length;
  const npsScore = responses.length > 0
    ? Math.round(((promotores - detratores) / responses.length) * 100)
    : null;

  function npsBadge(score: number) {
    if (score > 50) return { label: "Excelente", cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
    if (score > 0)  return { label: "Bom",       cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" };
    return               { label: "Ruim",       cls: "bg-red-500/20 text-red-400 border-red-500/30" };
  }

  const last5 = responses.slice(0, 5);

  return (
    <div className="mt-6 bg-[#091221] border border-[#1A2D4A] rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#F0ECE4] tracking-wide uppercase">
          NPS dos Partners
        </h3>
        {!loading && responses.length > 0 && npsScore !== null && (
          <span className={`text-[10px] font-bold border px-2.5 py-0.5 rounded-full ${npsBadge(npsScore).cls}`}>
            {npsBadge(npsScore).label}
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-[#7A8FA8]">Carregando NPS...</p>
      ) : responses.length === 0 ? (
        <p className="text-xs text-[#7A8FA8]">Nenhuma resposta NPS ainda.</p>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#111F35] border border-[#243A66] rounded-lg p-3">
              <p className="text-[10px] text-[#7A8FA8] uppercase tracking-wide mb-1">Score NPS</p>
              <p className="text-xl font-bold text-[#C9A84C]">{npsScore}</p>
              <p className="text-[10px] text-[#7A8FA8]">{responses.length} respostas</p>
            </div>
            <div className="bg-[#111F35] border border-[#243A66] rounded-lg p-3">
              <p className="text-[10px] text-[#7A8FA8] uppercase tracking-wide mb-1">Média</p>
              <p className="text-xl font-bold text-[#F0ECE4]">{avg !== null ? avg.toFixed(1) : "—"}</p>
              <p className="text-[10px] text-[#7A8FA8]">de 10</p>
            </div>
            <div className="bg-[#111F35] border border-[#243A66] rounded-lg p-3">
              <p className="text-[10px] text-[#7A8FA8] uppercase tracking-wide mb-1">Promotores</p>
              <p className="text-xl font-bold text-emerald-400">{promotores}</p>
              <p className="text-[10px] text-[#7A8FA8]">{detratores} detratores</p>
            </div>
          </div>

          {/* Últimas 5 respostas */}
          <div className="space-y-2">
            <p className="text-[10px] text-[#7A8FA8] uppercase tracking-wide font-semibold">Últimas respostas</p>
            {last5.map(r => (
              <div key={r.id} className="flex items-start gap-3 bg-[#111F35] border border-[#243A66] rounded-lg p-3">
                <span className={`min-w-[2rem] h-8 flex items-center justify-center rounded-lg text-sm font-bold border ${
                  r.score >= 9 ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                  : r.score >= 7 ? "bg-amber-500/20 border-amber-500/30 text-amber-400"
                  : "bg-red-500/20 border-red-500/30 text-red-400"
                }`}>
                  {r.score}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#F0ECE4]">
                    {r.profiles?.full_name ?? r.profiles?.email ?? "Partner"}
                  </p>
                  {r.comment && (
                    <p className="text-[11px] text-[#7A8FA8] mt-0.5 line-clamp-2">{r.comment}</p>
                  )}
                  <p className="text-[10px] text-[#3A5070] mt-0.5">
                    {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ComissoesAdminTab() {
  const [filtroTipo, setFiltroTipo] = useState<"TODOS" | "CREDITO" | "MA" | "CONSORCIO" | "MARKETPLACE">("TODOS");
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | "A_PAGAR" | "PAGA">("TODOS");
  const [filtroPartner, setFiltroPartner] = useState<string>("TODOS");
  const [buscaPartner, setBuscaPartner] = useState("");
  const [mktComissoes, setMktComissoes] = useState<Comissao[]>([]);

  useEffect(() => {
    fetch("/api/marketplace/leads?admin=true")
      .then(r => r.json())
      .then(({ leads }) => {
        if (!leads) return;
        const statusMap: Record<string, "A_PAGAR" | "PAGA" | "CANCELADA"> = {
          NEW: "A_PAGAR", IN_PROGRESS: "A_PAGAR", PENDING: "A_PAGAR",
          CONVERTED: "PAGA", LOST: "CANCELADA",
        };
        const converted = (leads as Array<{
          id: string; created_at: string; status: string;
          product?: { name: string; partner_commission_percent: number | null; commission_percent: number } | null;
          partner?: { full_name: string } | null;
        }>)
          .map((l): Comissao => ({
            id: `MKT-${l.id}`,
            codigo: `MKT-${l.id.slice(0, 8).toUpperCase()}`,
            partnerId: "",
            partnerNome: l.partner?.full_name ?? "Partner",
            operacaoTipo: "MARKETPLACE",
            operacaoId: l.id,
            operacaoCodigo: `MKT-${l.id.slice(0, 8).toUpperCase()}`,
            operacaoDescricao: `Marketplace — ${l.product?.name ?? "Produto"}`,
            valorOperacao: 0,
            percentualComissao: l.product?.partner_commission_percent ?? l.product?.commission_percent ?? 0,
            valorComissao: 0,
            mes: new Date(l.created_at).getMonth() + 1,
            ano: new Date(l.created_at).getFullYear(),
            dataOperacaoFinalizada: l.created_at,
            status: statusMap[l.status] ?? "A_PAGAR",
            dataPagamento: null,
            observacoes: null,
          }));
        setMktComissoes(converted);
      })
      .catch(() => {});
  }, []);

  const todasComissoes = useMemo(() => [...DEMO_COMISSOES, ...mktComissoes], [mktComissoes]);

  // Lista única de partners presentes nas comissões
  const parceiros = useMemo(() => {
    const nomes = Array.from(new Set(todasComissoes.map(c => c.partnerNome))).sort();
    return nomes;
  }, [todasComissoes]);

  const filtradas = todasComissoes.filter(c =>
    (filtroTipo === "TODOS" || c.operacaoTipo === filtroTipo) &&
    (filtroStatus === "TODOS" || c.status === filtroStatus) &&
    (filtroPartner === "TODOS" || c.partnerNome === filtroPartner) &&
    (!buscaPartner || c.partnerNome.toLowerCase().includes(buscaPartner.toLowerCase()) || c.operacaoDescricao.toLowerCase().includes(buscaPartner.toLowerCase()))
  );

  // Extrato por partner selecionado
  const extratoPartner = filtroPartner !== "TODOS" ? {
    totalPago: filtradas.filter(c => c.status === "PAGA").reduce((s, c) => s + c.valorComissao, 0),
    totalPendente: filtradas.filter(c => c.status === "A_PAGAR").reduce((s, c) => s + c.valorComissao, 0),
    totalOperacoes: filtradas.length,
    mediaMensal: (() => {
      const meses = new Set(filtradas.map(c => `${c.ano}-${c.mes}`));
      const total = filtradas.reduce((s, c) => s + c.valorComissao, 0);
      return meses.size > 0 ? total / meses.size : 0;
    })(),
  } : null;

  const totalAPagar = todasComissoes.filter(c => c.status === "A_PAGAR").reduce((s, c) => s + c.valorComissao, 0);
  const totalPago = todasComissoes.filter(c => c.status === "PAGA").reduce((s, c) => s + c.valorComissao, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#091221] border border-[#122036] rounded-xl p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Total a Pagar</p>
          <p className="text-xl font-bold text-amber-400">{formatMoeda(totalAPagar)}</p>
          <p className="text-xs text-muted-foreground mt-1">{todasComissoes.filter(c => c.status === "A_PAGAR").length} comissões pendentes</p>
        </div>
        <div className="bg-[#091221] border border-[#122036] rounded-xl p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Total Pago</p>
          <p className="text-xl font-bold text-emerald-400">{formatMoeda(totalPago)}</p>
          <p className="text-xs text-muted-foreground mt-1">{todasComissoes.filter(c => c.status === "PAGA").length} comissões liquidadas</p>
        </div>
        <div className="bg-[#091221] border border-[#122036] rounded-xl p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Total Geral</p>
          <p className="text-xl font-bold text-[#C9A84C]">{formatMoeda(totalAPagar + totalPago)}</p>
          <p className="text-xs text-muted-foreground mt-1">{todasComissoes.length} operações com comissão{mktComissoes.length > 0 ? ` · ${mktComissoes.length} marketplace` : ""}</p>
        </div>
      </div>

      {/* Seletor de partner para extrato individual */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Buscar partner ou operação..."
          value={buscaPartner}
          onChange={e => setBuscaPartner(e.target.value)}
          className="bg-card border border-border/40 rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-[#C9A84C]/40 w-56"
        />
        <select
          value={filtroPartner}
          onChange={e => setFiltroPartner(e.target.value)}
          className="bg-card border border-border/40 rounded-lg px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-[#C9A84C]/40"
        >
          <option value="TODOS">Todos os partners</option>
          {parceiros.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Extrato do partner selecionado */}
      {extratoPartner && (
        <div className="grid grid-cols-4 gap-3 bg-[#C9A84C]/5 border border-[#C9A84C]/20 rounded-xl p-4">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Extrato — {filtroPartner}</p>
            <p className="text-lg font-bold text-[#C9A84C]">{formatMoeda(extratoPartner.totalPago + extratoPartner.totalPendente)}</p>
            <p className="text-xs text-muted-foreground">total acumulado</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Recebido</p>
            <p className="text-lg font-bold text-emerald-400">{formatMoeda(extratoPartner.totalPago)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Pendente</p>
            <p className="text-lg font-bold text-amber-400">{formatMoeda(extratoPartner.totalPendente)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Média / Mês</p>
            <p className="text-lg font-bold text-white">{formatMoeda(extratoPartner.mediaMensal)}</p>
            <p className="text-xs text-muted-foreground">{extratoPartner.totalOperacoes} operações</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap justify-between">
        <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-secondary rounded-lg p-0.5">
          {(["TODOS", "CREDITO", "MA", "CONSORCIO", "MARKETPLACE"] as const).map(t => {
            const labels = { TODOS: "Todos", CREDITO: "Crédito", MA: "M&A", CONSORCIO: "Consórcio", MARKETPLACE: "Marketplace" };
            return (
              <button key={t} onClick={() => setFiltroTipo(t)} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${filtroTipo === t ? "bg-[#C9A84C] text-white" : "text-muted-foreground hover:text-foreground"}`}>
                {labels[t]}
              </button>
            );
          })}
        </div>
        <div className="flex bg-secondary rounded-lg p-0.5">
          {(["TODOS", "A_PAGAR", "PAGA"] as const).map(t => {
            const labels = { TODOS: "Todos", A_PAGAR: "A Pagar", PAGA: "Pago" };
            return (
              <button key={t} onClick={() => setFiltroStatus(t)} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${filtroStatus === t ? "bg-[#C9A84C] text-white" : "text-muted-foreground hover:text-foreground"}`}>
                {labels[t]}
              </button>
            );
          })}
        </div>
        </div>
        <ExportButton opts={{
          titulo: "Comissões",
          subtitulo: filtroTipo !== "TODOS" ? filtroTipo : undefined,
          orientacao: "landscape",
          colunas: [
            { header: "Código", key: "codigo", width: 14 },
            { header: "Partner", key: "partnerNome", width: 22 },
            { header: "Operação", key: "operacaoDescricao", width: 30 },
            { header: "Tipo", key: "operacaoTipo", width: 12 },
            { header: "Vlr. Operação", key: "valorOperacao", format: "moeda", width: 18 },
            { header: "% Comissão", key: "percentualComissao", format: "percent", width: 13 },
            { header: "Vlr. Comissão", key: "valorComissao", format: "moeda", width: 18 },
            { header: "Finalizada em", key: "dataOperacaoFinalizada", format: "date", width: 16 },
            { header: "Status", key: "status", width: 12 },
          ],
          dados: filtradas,
          totais: { label: "TOTAL", valores: { codigo: "TOTAL", valorComissao: filtradas.reduce((s, c) => s + c.valorComissao, 0) } },
        }} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40">
                  {["Código", "Partner", "Operação", "Tipo", "Vlr. Operação", "% Comissão", "Vlr. Comissão", "Finalizada em", "Status"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-muted-foreground font-semibold uppercase tracking-wide text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradas.map((c, i) => (
                  <tr key={c.id} className={`border-b border-border/20 hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? "" : "bg-[#091221]/40"}`}>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{c.codigo}</td>
                    <td className="px-4 py-3 font-medium text-white whitespace-nowrap">{c.partnerNome}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[180px] truncate" title={c.operacaoDescricao}>{c.operacaoDescricao}</td>
                    <td className="px-4 py-3"><TipoComissaoBadge tipo={c.operacaoTipo} /></td>
                    <td className="px-4 py-3 text-white">{c.operacaoTipo === "MARKETPLACE" ? <span className="text-muted-foreground">—</span> : formatMoeda(c.valorOperacao)}</td>
                    <td className="px-4 py-3 text-[#C9A84C] font-semibold">{c.percentualComissao}%</td>
                    <td className="px-4 py-3 font-bold text-white">{c.operacaoTipo === "MARKETPLACE" ? <span className="text-muted-foreground text-xs">a calcular</span> : formatMoeda(c.valorComissao)}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(c.dataOperacaoFinalizada).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <NpsAdminPanel />
    </div>
  );
}

// ─── Modal: Novo Lançamento DRE ──────────────────────────────────────────────

function NovoDREModal({ open, onClose, onSalvar }: {
  open: boolean;
  onClose: () => void;
  onSalvar: (d: import("@/lib/demo-data-financeiro").DREMes) => void;
}) {
  const hoje = new Date();
  const [mes, setMes] = useState(String(hoje.getMonth() + 1));
  const [ano, setAno] = useState(String(hoje.getFullYear()));
  const [receitas, setReceitas] = useState("");
  const [deducoes, setDeducoes] = useState("");
  const [custosOp, setCustosOp] = useState("");
  const [despAdmin, setDespAdmin] = useState("");
  const [despCom, setDespCom] = useState("");
  const [despFin, setDespFin] = useState("");
  const [saving, setSaving] = useState(false);

  function parse(v: string) { return parseFloat(v.replace(/\D/g, "").replace(",", ".")) || 0; }

  const r = parse(receitas);
  const ded = parse(deducoes);
  const cop = parse(custosOp);
  const da = parse(despAdmin);
  const dc = parse(despCom);
  const df = parse(despFin);
  const recLiq = r - ded;
  const lucroBruto = recLiq - cop;
  const ebitda = lucroBruto - da - dc - df;
  const irpj = ebitda > 0 ? ebitda * 0.15 : 0;
  const csll = ebitda > 0 ? ebitda * 0.09 : 0;
  const lucroLiq = ebitda - irpj - csll;

  async function handleSalvar() {
    if (!r) return;
    setSaving(true);
    const entry: import("@/lib/demo-data-financeiro").DREMes = {
      mes: parseInt(mes), ano: parseInt(ano),
      receitas: r, deducoes: ded, receitaLiquida: recLiq,
      custosOperacionais: cop, lucroBruto,
      despesasAdmin: da, despesasComerciais: dc, despesasFinanceiras: df,
      ebitda, irpj, csll, lucroLiquido: lucroLiq,
    };
    try {
      await fetch("/api/financeiro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "dre", data: entry }),
      });
    } catch {}
    onSalvar(entry);
    setSaving(false);
    onClose();
    setReceitas(""); setDeducoes(""); setCustosOp(""); setDespAdmin(""); setDespCom(""); setDespFin("");
  }

  if (!open) return null;

  const Field = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder="0,00"
        className="w-full h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-bold text-white">Novo Lançamento DRE</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-white transition-colors">
            <ChevronRight className="w-4 h-4 rotate-180" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Mês *</label>
              <select value={mes} onChange={e => setMes(e.target.value)}
                className="w-full h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none">
                {MESES_PT.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Ano *</label>
              <select value={ano} onChange={e => setAno(e.target.value)}
                className="w-full h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none">
                {[2024, 2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          <div className="border-t border-border pt-3 space-y-3">
            <p className="text-xs font-bold text-[#C9A84C] uppercase tracking-wider">Receitas</p>
            <Field label="Receita Bruta (R$) *" value={receitas} onChange={setReceitas} />
            <Field label="(-) Impostos sobre Receita (R$)" value={deducoes} onChange={setDeducoes} />
          </div>

          <div className="border-t border-border pt-3 space-y-3">
            <p className="text-xs font-bold text-[#C9A84C] uppercase tracking-wider">Custos e Despesas</p>
            <Field label="(-) Custos Operacionais (R$)" value={custosOp} onChange={setCustosOp} />
            <Field label="(-) Despesas Administrativas (R$)" value={despAdmin} onChange={setDespAdmin} />
            <Field label="(-) Despesas Comerciais / Comissões (R$)" value={despCom} onChange={setDespCom} />
            <Field label="(-) Despesas Financeiras (R$)" value={despFin} onChange={setDespFin} />
          </div>

          {r > 0 && (
            <div className="border-t border-border pt-3 space-y-2 bg-secondary/30 rounded-xl p-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Prévia calculada</p>
              {[
                { label: "Receita Líquida", valor: recLiq },
                { label: "Lucro Bruto", valor: lucroBruto },
                { label: "EBITDA", valor: ebitda },
                { label: "IRPJ (15%)", valor: -irpj },
                { label: "CSLL (9%)", valor: -csll },
                { label: "Lucro Líquido", valor: lucroLiq, bold: true },
              ].map(row => (
                <div key={row.label} className="flex justify-between text-xs">
                  <span className={`text-muted-foreground ${row.bold ? "font-bold text-white" : ""}`}>{row.label}</span>
                  <span className={`font-medium ${row.valor < 0 ? "text-red-400" : row.bold ? "text-emerald-400" : "text-white"}`}>{formatMoeda(row.valor)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-border flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-white transition-colors">Cancelar</button>
          <button onClick={handleSalvar} disabled={!r || saving}
            className="px-4 py-2 text-sm font-bold bg-primary text-[#09081A] rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors">
            {saving ? "Salvando..." : "Salvar Lançamento"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TAB: DRE ────────────────────────────────────────────────────────────────

function DRETab() {
  const [registros, setRegistros] = useState<import("@/lib/demo-data-financeiro").DREMes[]>([]);
  const [idx, setIdx] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [carregando, setCarregando] = useState(true);

  React.useEffect(() => {
    fetch("/api/financeiro?type=dre")
      .then(r => r.json())
      .then(json => {
        if (json.records?.length) {
          const dados = json.records.map((r: { data: import("@/lib/demo-data-financeiro").DREMes }) => r.data);
          dados.sort((a: import("@/lib/demo-data-financeiro").DREMes, b: import("@/lib/demo-data-financeiro").DREMes) => a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes);
          setRegistros(dados);
          setIdx(dados.length - 1);
        }
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  function handleSalvar(entry: import("@/lib/demo-data-financeiro").DREMes) {
    setRegistros(prev => {
      const novo = [...prev, entry].sort((a, b) => a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes);
      setIdx(novo.length - 1);
      return novo;
    });
  }

  if (carregando) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Carregando...</div>;
  }

  if (!registros.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground text-sm">Nenhum lançamento DRE cadastrado.</p>
        <button onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-primary text-[#09081A] rounded-lg hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Novo Lançamento
        </button>
        <NovoDREModal open={modalOpen} onClose={() => setModalOpen(false)} onSalvar={handleSalvar} />
      </div>
    );
  }

  const safeIdx = Math.min(idx, registros.length - 1);
  const d = registros[safeIdx];
  const prev = registros[safeIdx - 1];

  const linhas = [
    { label: "RECEITA BRUTA", valor: d.receitas, destaque: true },
    { label: "(-) Impostos sobre Receita", valor: -d.deducoes },
    { label: "= RECEITA LÍQUIDA", valor: d.receitaLiquida, destaque: true },
    { label: "(-) Custos Operacionais", valor: -d.custosOperacionais },
    { label: "= LUCRO BRUTO", valor: d.lucroBruto, destaque: true },
    { label: "(-) Despesas Administrativas", valor: -d.despesasAdmin },
    { label: "(-) Despesas Comerciais / Comissões", valor: -d.despesasComerciais },
    { label: "(-) Despesas Financeiras", valor: -d.despesasFinanceiras },
    { label: "= EBITDA", valor: d.ebitda, destaque: true },
    { label: "(-) IRPJ (15%)", valor: -d.irpj },
    { label: "(-) CSLL (9%)", valor: -d.csll },
    { label: "= LUCRO LÍQUIDO", valor: d.lucroLiquido, destaque: true },
  ];

  return (
    <div className="space-y-4">
      <NovoDREModal open={modalOpen} onClose={() => setModalOpen(false)} onSalvar={handleSalvar} />

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0} className="p-1 rounded-lg hover:bg-secondary disabled:opacity-40 transition-colors">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="text-sm font-semibold text-white min-w-[120px] text-center">
            {MESES_PT[d.mes - 1]} / {d.ano}
          </span>
          <button onClick={() => setIdx(Math.min(registros.length - 1, idx + 1))} disabled={idx === registros.length - 1} className="p-1 rounded-lg hover:bg-secondary disabled:opacity-40 transition-colors">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        {prev && <span className="text-xs text-muted-foreground">vs {MESES_PT[prev.mes - 1]}/{prev.ano}</span>}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-primary text-[#09081A] rounded-lg hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Novo Lançamento
          </button>
          <ExportButton opts={{
            titulo: "DRE",
            mes: `${MESES_PT[d.mes - 1]} / ${d.ano}`,
            colunas: [
              { header: "Linha", key: "label", width: 40 },
              { header: "Valor", key: "valor", format: "moeda", width: 20 },
            ],
            dados: linhas.map(l => ({ label: l.label, valor: l.valor })),
          }} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              DRE — {MESES_PT[d.mes - 1]}/{d.ano}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <tbody>
                {linhas.map((l, i) => {
                  const prevVal = prev ? (() => {
                    const prevLinhas = [prev.receitas, -prev.deducoes, prev.receitaLiquida, -prev.custosOperacionais, prev.lucroBruto, -prev.despesasAdmin, -prev.despesasComerciais, -prev.despesasFinanceiras, prev.ebitda, -prev.irpj, -prev.csll, prev.lucroLiquido];
                    return prevLinhas[i];
                  })() : null;
                  const diff = prevVal !== null && prevVal !== 0 ? ((Math.abs(l.valor) - Math.abs(prevVal)) / Math.abs(prevVal) * 100) : null;
                  return (
                    <tr key={i} className={`border-b border-border/20 ${l.destaque ? "bg-[#0F1E35]" : ""}`}>
                      <td className={`px-4 py-2.5 ${l.destaque ? "font-bold text-[#C9A84C]" : "text-muted-foreground"}`}>{l.label}</td>
                      <td className={`px-4 py-2.5 text-right font-${l.destaque ? "bold" : "medium"} ${l.valor < 0 ? "text-red-400" : l.destaque ? "text-[#C9A84C]" : "text-white"}`}>
                        {formatMoeda(l.valor)}
                      </td>
                      <td className="px-4 py-2.5 text-right w-20">
                        {diff !== null && (
                          <span className={`text-[10px] ${diff >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {diff >= 0 ? "+" : ""}{diff.toFixed(0)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Evolução — Todos os Meses</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={registros.map(dr => ({ mes: `${MESES_PT[dr.mes - 1]}/${String(dr.ano).slice(2)}`, Receita: dr.receitas, Lucro: dr.lucroLiquido, EBITDA: dr.ebitda }))}>
                <defs>
                  <linearGradient id="gradRec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#C9A84C" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradLuc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#122036" />
                <XAxis dataKey="mes" tick={{ fill: "#7A8FA8", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#7A8FA8", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ backgroundColor: "#091221", border: "1px solid rgba(196,146,46,0.2)", borderRadius: 10, fontSize: 12 }} formatter={(v) => formatMoeda(Number(v) || 0)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="Receita" stroke="#C9A84C" fill="url(#gradRec)" strokeWidth={2} />
                <Area type="monotone" dataKey="Lucro" stroke="#22C55E" fill="url(#gradLuc)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── TAB: FLUXO DE CAIXA ─────────────────────────────────────────────────────

function FluxoCaixaTab() {
  const [movimentos, setMovimentos] = useState<(import("@/lib/demo-data-financeiro").MovimentoCaixa)[]>([]);
  const [loadingFluxo, setLoadingFluxo] = useState(true);

  useEffect(() => {
    fetch("/api/financeiro?type=ASSINATURA_PAGAMENTO")
      .then(r => r.json())
      .then((d: { records?: Array<{ id: string; data: { partnerNome?: string; valor?: number; mes?: number; ano?: number; dataPagamento?: string }; created_at: string }> }) => {
        const records = d.records ?? [];
        const movs = records.map(r => ({
          id: r.id,
          data: r.data.dataPagamento ?? r.created_at.split("T")[0],
          descricao: `Assinatura — ${r.data.partnerNome ?? "Partner"}`,
          tipo: "ENTRADA" as const,
          categoria: "Assinatura",
          valor: r.data.valor ?? 0,
          mes: r.data.mes ?? new Date(r.created_at).getMonth() + 1,
          ano: r.data.ano ?? new Date(r.created_at).getFullYear(),
        }));
        movs.sort((a, b) => a.data.localeCompare(b.data));
        setMovimentos(movs);
      })
      .catch(() => {})
      .finally(() => setLoadingFluxo(false));
  }, []);

  const entradas = movimentos.filter(m => m.tipo === "ENTRADA").reduce((s, m) => s + m.valor, 0);
  const saidas = movimentos.filter(m => m.tipo === "SAIDA").reduce((s, m) => s + m.valor, 0);
  const saldoFinal = entradas - saidas;

  let saldoAcum = 0;
  const movComSaldo = movimentos.map(m => {
    saldoAcum += m.tipo === "ENTRADA" ? m.valor : -m.valor;
    return { ...m, saldoApos: saldoAcum };
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportButton opts={{
          titulo: "Fluxo de Caixa",
          mes: new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
          colunas: [
            { header: "Data", key: "data", format: "date", width: 14 },
            { header: "Descrição", key: "descricao", width: 35 },
            { header: "Categoria", key: "categoria", width: 18 },
            { header: "Tipo", key: "tipo", width: 10 },
            { header: "Valor", key: "valor", format: "moeda", width: 18 },
            { header: "Saldo Após", key: "saldoApos", format: "moeda", width: 18 },
          ],
          dados: movComSaldo,
        }} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Entradas", value: entradas, color: "#22C55E" },
          { label: "Total Saídas", value: saidas, color: "#EF4444" },
          { label: "Saldo", value: saldoFinal, color: "#C9A84C" },
        ].map(k => (
          <div key={k.label} className="bg-[#091221] border border-[#122036] rounded-xl p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{k.label}</p>
            <p className="text-lg font-bold" style={{ color: k.color }}>{formatMoeda(k.value)}</p>
          </div>
        ))}
      </div>

      {loadingFluxo ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando movimentos...
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/40">
                    {["Data", "Descrição", "Categoria", "Tipo", "Valor", "Saldo Após"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-muted-foreground font-semibold uppercase tracking-wide text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {movComSaldo.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-muted-foreground text-xs">
                        Nenhum movimento registrado. Registre pagamentos na aba Assinaturas.
                      </td>
                    </tr>
                  ) : movComSaldo.map((m, i) => (
                    <tr key={m.id} className={`border-b border-border/20 hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? "" : "bg-[#091221]/40"}`}>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(m.data + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-3 text-white">{m.descricao}</td>
                      <td className="px-4 py-3"><span className="text-[10px] bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">{m.categoria}</span></td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1 ${m.tipo === "ENTRADA" ? "text-emerald-400" : "text-red-400"}`}>
                          {m.tipo === "ENTRADA" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {m.tipo === "ENTRADA" ? "Entrada" : "Saída"}
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-semibold ${m.tipo === "ENTRADA" ? "text-emerald-400" : "text-red-400"}`}>
                        {m.tipo === "ENTRADA" ? "+" : "-"}{formatMoeda(m.valor)}
                      </td>
                      <td className="px-4 py-3 font-bold text-white">{formatMoeda(m.saldoApos)}</td>
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

// ─── TAB: IMPOSTOS ───────────────────────────────────────────────────────────

// ─── Modal: Novo Imposto ──────────────────────────────────────────────────────

const TIPOS_IMPOSTO = ["ISS", "PIS", "COFINS", "IRPJ", "CSLL", "IRRF", "INSS", "FGTS", "IOF", "ICMS", "IPI", "Outros"];

interface NovoImpostoForm {
  tipo: string; descricao: string; baseCalculo: string;
  aliquota: string; valor: string; vencimento: string;
  guia: string; status: "PREVISTO" | "A_PAGAR" | "PAGO";
  calcAuto: boolean;
}

function NovoImpostoModal({
  mes, ano, onClose, onSalvar, onEditar, editando,
}: {
  mes: number; ano: number; onClose: () => void;
  onSalvar: (imp: import("@/lib/demo-data-financeiro").Imposto) => void;
  onEditar?: (imp: import("@/lib/demo-data-financeiro").Imposto) => void;
  editando?: import("@/lib/demo-data-financeiro").Imposto;
}) {
  const [form, setForm] = useState<NovoImpostoForm>(editando ? {
    tipo: editando.tipo, descricao: editando.descricao,
    baseCalculo: editando.baseCalculo > 0 ? String(editando.baseCalculo) : "",
    aliquota: editando.aliquota > 0 ? String(editando.aliquota) : "",
    valor: String(editando.valor), vencimento: editando.vencimento,
    guia: editando.guia ?? "", status: editando.status,
    calcAuto: editando.baseCalculo > 0 && editando.aliquota > 0,
  } : {
    tipo: "ISS", descricao: "", baseCalculo: "", aliquota: "",
    valor: "", vencimento: "", guia: "", status: "A_PAGAR", calcAuto: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const baseN = parseFloat(form.baseCalculo) || 0;
  const aliqN = parseFloat(form.aliquota) || 0;
  const valorCalculado = form.calcAuto && baseN > 0 && aliqN > 0
    ? Math.round(baseN * (aliqN / 100) * 100) / 100
    : 0;
  const valorFinal = form.calcAuto ? valorCalculado : (parseFloat(form.valor) || 0);

  const inputCls = (err?: string) =>
    `w-full h-9 px-3 text-sm rounded-lg border ${err ? "border-red-500/50 bg-red-500/5" : "border-[#122036] bg-[#0F1E35]"} text-white placeholder:text-muted-foreground focus:outline-none focus:border-[#C9A84C]/60 transition-colors`;
  const selectCls = () =>
    `w-full h-9 px-3 text-sm rounded-lg border border-[#122036] bg-[#0F1E35] text-white focus:outline-none focus:border-[#C9A84C]/60 transition-colors`;

  const salvar = () => {
    const e: Record<string, string> = {};
    if (!form.descricao.trim()) e.descricao = "Obrigatório";
    if (!form.vencimento) e.vencimento = "Obrigatório";
    if (valorFinal <= 0) e.valor = "Valor deve ser maior que zero";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    const imp = {
      id: editando ? editando.id : `imp-${Date.now()}`,
      tipo: form.tipo, descricao: form.descricao.trim(), mes, ano,
      baseCalculo: baseN, aliquota: aliqN, valor: valorFinal,
      vencimento: form.vencimento,
      dataPagamento: form.status === "PAGO" ? (editando?.dataPagamento ?? new Date().toISOString().split("T")[0]) : null,
      guia: form.guia.trim() || null, status: form.status,
    };
    if (editando) { onEditar?.(imp); } else { onSalvar(imp); }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#091221] border border-[#122036] rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/40">
          <div>
            <h2 className="text-lg font-bold text-white">{editando ? "Editar Imposto" : "Lançar Imposto"}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Conforme informado pelo contador · {MESES_PT[mes - 1]}/{ano}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Tipo + Descrição */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Tipo de Imposto</label>
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} className={selectCls()}>
                {TIPOS_IMPOSTO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Descrição *</label>
              <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: ISS sobre serviços Mar/26" className={inputCls(errors.descricao)} />
              {errors.descricao && <p className="text-[10px] text-red-400 mt-1">{errors.descricao}</p>}
            </div>
          </div>

          {/* Cálculo */}
          <div className="p-3 bg-[#0F1E35] border border-[#122036] rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">Valor</p>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={form.calcAuto} onChange={e => setForm(f => ({ ...f, calcAuto: e.target.checked }))} className="accent-[#C9A84C]" />
                Calcular automaticamente (base × alíquota)
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Base de Cálculo (R$)</label>
                <input type="number" min="0" step="100" value={form.baseCalculo} onChange={e => setForm(f => ({ ...f, baseCalculo: e.target.value }))} placeholder="Ex: 80000" className={inputCls()} disabled={!form.calcAuto} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Alíquota (%)</label>
                <input type="number" min="0" max="100" step="0.01" value={form.aliquota} onChange={e => setForm(f => ({ ...f, aliquota: e.target.value }))} placeholder="Ex: 3.00" className={inputCls()} disabled={!form.calcAuto} />
              </div>
            </div>
            {!form.calcAuto && (
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Valor Informado pelo Contador (R$) *</label>
                <input type="number" min="0" step="10" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="Ex: 2400" className={inputCls(errors.valor)} />
                {errors.valor && <p className="text-[10px] text-red-400 mt-1">{errors.valor}</p>}
              </div>
            )}
            {valorFinal > 0 && (
              <div className="flex items-center justify-between pt-1 border-t border-[#1e3050]">
                <span className="text-xs text-muted-foreground">Valor do imposto:</span>
                <span className="text-lg font-bold text-[#C9A84C]">{formatMoeda(valorFinal)}</span>
              </div>
            )}
            {errors.valor && !form.valor && <p className="text-[10px] text-red-400">{errors.valor}</p>}
          </div>

          {/* Vencimento + Guia + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Data de Vencimento *</label>
              <input type="date" value={form.vencimento} onChange={e => setForm(f => ({ ...f, vencimento: e.target.value }))} className={inputCls(errors.vencimento)} />
              {errors.vencimento && <p className="text-[10px] text-red-400 mt-1">{errors.vencimento}</p>}
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Nº Guia / DARF</label>
              <input value={form.guia} onChange={e => setForm(f => ({ ...f, guia: e.target.value }))} placeholder="Ex: DARF-2026-0312" className={inputCls()} />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1">Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as "PREVISTO" | "A_PAGAR" | "PAGO" }))} className={selectCls()}>
              <option value="PREVISTO">Previsto</option>
              <option value="A_PAGAR">A Pagar</option>
              <option value="PAGO">Pago</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-border/40">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-border/50 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-all">
            Cancelar
          </button>
          <button onClick={salvar} className="flex-1 h-10 rounded-xl bg-[#C9A84C] text-white text-sm font-semibold hover:bg-[#E8C97A] transition-all">
            {editando ? "Salvar Alterações" : "Lançar Imposto"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TAB: IMPOSTOS ────────────────────────────────────────────────────────────

function ImpostosTab() {
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [showModal, setShowModal] = useState(false);
  const [impostos, setImpostos] = useState<import("@/lib/demo-data-financeiro").Imposto[]>([]);
  const [editandoImp, setEditandoImp] = useState<import("@/lib/demo-data-financeiro").Imposto | null>(null);

  // Carrega do Supabase na montagem
  React.useEffect(() => {
    fetch("/api/financeiro?type=imposto")
      .then(r => r.json())
      .then(json => { if (json.records?.length) setImpostos(json.records.map((r: { id: string; data: import("@/lib/demo-data-financeiro").Imposto }) => ({ ...r.data, _dbId: r.id }))); })
      .catch(() => {});
  }, []);

  const excluirImposto = async (id: string, desc: string) => {
    if (!window.confirm(`Excluir imposto "${desc}"?`)) return;
    const imp = impostos.find(i => i.id === id) as (import("@/lib/demo-data-financeiro").Imposto & { _dbId?: string });
    if (imp?._dbId) await fetch(`/api/financeiro?id=${imp._dbId}`, { method: "DELETE" }).catch(() => {});
    setImpostos(prev => prev.filter(i => i.id !== id));
  };

  const filtrados = impostos.filter(i => i.mes === mes && i.ano === ano);
  const totalMes = filtrados.reduce((s, i) => s + i.valor, 0);
  const totalAPagar = filtrados.filter(i => i.status !== "PAGO").reduce((s, i) => s + i.valor, 0);
  const totalPago = filtrados.filter(i => i.status === "PAGO").reduce((s, i) => s + i.valor, 0);

  return (
    <>
      {(showModal || editandoImp) && (
        <NovoImpostoModal
          mes={mes} ano={ano}
          editando={editandoImp ?? undefined}
          onClose={() => { setShowModal(false); setEditandoImp(null); }}
          onSalvar={async (imp) => {
            try {
              const res = await fetch("/api/financeiro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "imposto", data: imp }) });
              const json = await res.json();
              if (json.record) { setImpostos(prev => [...prev, { ...imp, _dbId: json.record.id } as typeof imp]); return; }
            } catch {}
            setImpostos(prev => [...prev, imp]);
          }}
          onEditar={async (imp) => {
            const existing = impostos.find(x => x.id === imp.id) as (import("@/lib/demo-data-financeiro").Imposto & { _dbId?: string });
            if (existing?._dbId) await fetch("/api/financeiro", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: existing._dbId, data: imp }) }).catch(() => {});
            setImpostos(prev => prev.map(x => x.id === imp.id ? { ...imp, _dbId: existing?._dbId } as typeof imp : x));
          }}
        />
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <MonthSelector mes={mes} ano={ano} onChange={(m, a) => { setMes(m); setAno(a); }} />
          <div className="flex items-center gap-4">
            <div className="flex gap-4 text-sm">
              <span className="text-muted-foreground">Total: <span className="text-white font-bold">{formatMoeda(totalMes)}</span></span>
              <span className="text-amber-400">A recolher: <span className="font-bold">{formatMoeda(totalAPagar)}</span></span>
              <span className="text-emerald-400">Pago: <span className="font-bold">{formatMoeda(totalPago)}</span></span>
            </div>
            <div className="flex gap-2">
              <ExportButton opts={{
                titulo: "Impostos",
                mes: `${MESES_PT[mes - 1]} / ${ano}`,
                colunas: [
                  { header: "Imposto", key: "tipo", width: 10 },
                  { header: "Descrição", key: "descricao", width: 30 },
                  { header: "Base de Cálculo", key: "baseCalculo", format: "moeda", width: 18 },
                  { header: "Alíquota", key: "aliquota", format: "percent", width: 12 },
                  { header: "Valor", key: "valor", format: "moeda", width: 16 },
                  { header: "Vencimento", key: "vencimento", format: "date", width: 14 },
                  { header: "Guia/DARF", key: "guia", width: 18 },
                  { header: "Status", key: "status", width: 12 },
                ],
                dados: filtrados,
                totais: { label: "TOTAL", valores: { tipo: "TOTAL", valor: totalMes } },
              }} />
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-1.5 text-xs bg-[#C9A84C] text-white px-3 py-1.5 rounded-lg hover:bg-[#E8C97A] transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Lançar Imposto
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-xs text-amber-400">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          Lance os impostos conforme guias informadas pelo contador. Valores e alíquotas podem ser calculados automaticamente ou inseridos manualmente.
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/40">
                    {["Imposto", "Descrição", "Base de Cálculo", "Alíquota", "Valor", "Vencimento", "Guia/DARF", "Status", "Ações"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-muted-foreground font-semibold uppercase tracking-wide text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Receipt className="w-7 h-7 opacity-20" />
                          <span>Nenhum imposto lançado neste período</span>
                          <button onClick={() => setShowModal(true)} className="text-[#C9A84C] hover:underline text-xs mt-1">
                            + Lançar agora
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : filtrados.map((imp, i) => (
                    <tr key={imp.id} className={`border-b border-border/20 hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? "" : "bg-[#091221]/40"}`}>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold bg-[#C9A84C]/15 text-[#C9A84C] border border-[#C9A84C]/30 px-2 py-0.5 rounded-full">{imp.tipo}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{imp.descricao}</td>
                      <td className="px-4 py-3 text-white">{imp.baseCalculo > 0 ? formatMoeda(imp.baseCalculo) : "—"}</td>
                      <td className="px-4 py-3 text-[#C9A84C] font-semibold">{imp.aliquota > 0 ? `${imp.aliquota}%` : "—"}</td>
                      <td className="px-4 py-3 font-bold text-white">{formatMoeda(imp.valor)}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(imp.vencimento + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-3 font-mono text-muted-foreground text-[10px]">{imp.guia ?? "—"}</td>
                      <td className="px-4 py-3"><StatusBadge status={imp.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button
                            onClick={() => setEditandoImp(imp)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-all"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => excluirImposto(imp.id, imp.descricao)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {filtrados.length > 0 && (
                  <tfoot>
                    <tr className="bg-[#0F1E35] border-t border-[#C9A84C]/30">
                      <td className="px-4 py-3 font-bold text-[#C9A84C]" colSpan={4}>TOTAL — {filtrados.length} imposto{filtrados.length !== 1 ? "s" : ""}</td>
                      <td className="px-4 py-3 font-bold text-[#C9A84C]">{formatMoeda(totalMes)}</td>
                      <td colSpan={4} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// ─── TAB: ASSINATURAS ─────────────────────────────────────────────────────────

interface PartnerRow {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  created_at: string;
  trial_expires_at: string | null;
  is_active: boolean;
}

interface CoraSubRow {
  id: string;
  status: string;
  cora_invoice_id?: string;
  amount_cents: number;
  due_date: string;
  pix_emv?: string;
  paid_at?: string;
}

interface PaymentRecord {
  id: string;
  data: {
    partnerId: string;
    partnerNome: string;
    partnerRole: string;
    valor: number;
    mes: number;
    ano: number;
    observacoes: string;
    dataPagamento: string;
  };
  created_at: string;
}

interface PendingNotif {
  message: string;
  type: string;
  created_at: string;
}

function calcStatus(p: PartnerRow): { label: string; color: string; dias: number } {
  if (!p.is_active) return { label: "Suspensa", color: "text-red-400", dias: 0 };
  const expires = p.trial_expires_at
    ? new Date(p.trial_expires_at).getTime()
    : new Date(p.created_at).getTime() + 30 * 86400000;
  const dias = Math.max(Math.floor((expires - Date.now()) / 86400000), 0);
  if (dias === 0) return { label: "Vencida", color: "text-red-400", dias: 0 };
  if (dias <= 7) return { label: `Vence em ${dias}d`, color: "text-amber-400", dias };
  if (dias <= 15) return { label: `Vence em ${dias}d`, color: "text-yellow-400", dias };
  return { label: "Ativa", color: "text-emerald-400", dias };
}

function PlanBadge({ role }: { role: string }) {
  if (role === "PARTNER_PRO")
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold border px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border-amber-500/30">
        <Crown className="w-3 h-3" /> PRO
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold border px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border-blue-500/30">
      <ShieldCheck className="w-3 h-3" /> Partner
    </span>
  );
}

function AssinaturasTab() {
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [pendingNotifs, setPendingNotifs] = useState<PendingNotif[]>([]);
  const [coraByPartner, setCoraByPartner] = useState<Record<string, CoraSubRow>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [gerandoLote, setGerandoLote] = useState(false);
  const [loteResult, setLoteResult] = useState<{ ok: number; skip: number } | null>(null);

  // Modal de pagamento
  const [showPayModal, setShowPayModal] = useState(false);
  const [payPartner, setPayPartner] = useState<PartnerRow | null>(null);
  const [payObs, setPayObs] = useState("");
  const [payLoading, setPayLoading] = useState(false);

  // Filtro/busca
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"todos" | "ativas" | "vencendo" | "vencidas" | "suspensas">("todos");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/financeiro/assinaturas");
      if (res.ok) {
        const d = await res.json();
        setPartners(d.partners ?? []);
        setPayments(d.payments ?? []);
        setPendingNotifs(d.pendingNotifs ?? []);
        setCoraByPartner(d.coraByPartner ?? {});
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function doAction(partnerId: string, action: string) {
    setActionLoading(partnerId + action);
    try {
      const res = await fetch("/api/financeiro/assinaturas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId, action }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        alert(d.error ?? `Erro ao executar ação (${res.status})`);
      }
      await fetchData();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleGerarCobraLote() {
    // Gera cobranças Cora para todos partners sem cobrança pendente
    const semCobranca = partners.filter(p => {
      const sub = coraByPartner[p.id];
      return !sub || !["PENDING", "OPEN"].includes(sub.status);
    });
    if (semCobranca.length === 0) return;
    setGerandoLote(true); setLoteResult(null);
    let ok = 0; let skip = 0;
    for (const p of semCobranca) {
      try {
        const res = await fetch("/api/financeiro/assinaturas", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ partnerId: p.id, action: "gerar_cobranca_cora" }),
        });
        if (res.ok) ok++; else skip++;
      } catch { skip++; }
    }
    setLoteResult({ ok, skip });
    setGerandoLote(false);
    await fetchData();
  }

  async function handlePagar() {
    if (!payPartner) return;
    setPayLoading(true);
    const now = new Date();
    const valor = payPartner.role === "PARTNER_PRO" ? 397 : 197;
    try {
      await fetch("/api/financeiro/assinaturas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerId: payPartner.id,
          partnerNome: payPartner.full_name ?? payPartner.email,
          partnerRole: payPartner.role,
          valor,
          mes: now.getMonth() + 1,
          ano: now.getFullYear(),
          observacoes: payObs,
        }),
      });
      setShowPayModal(false);
      setPayObs("");
      await fetchData();
    } finally {
      setPayLoading(false);
    }
  }

  // KPIs
  const totalPartners = partners.length;
  const totalPRO = partners.filter(p => p.role === "PARTNER_PRO").length;
  const ativos = partners.filter(p => {
    const s = calcStatus(p);
    return p.is_active && s.dias > 0;
  });
  const mrr = ativos.reduce((s, p) => s + (p.role === "PARTNER_PRO" ? 397 : 197), 0);
  const vencendo = partners.filter(p => { const s = calcStatus(p); return s.dias > 0 && s.dias <= 15; }).length;
  const inadimplentes = partners.filter(p => { const s = calcStatus(p); return !p.is_active || s.dias === 0; }).length;

  // Gráfico MRR mensal (últimos 6 meses simulados a partir de pagamentos)
  const mrrChart = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const m = d.getMonth() + 1;
      const a = d.getFullYear();
      const total = payments
        .filter(p => p.data.mes === m && p.data.ano === a)
        .reduce((s, p) => s + p.data.valor, 0);
      return { mes: `${MESES_PT[m - 1]}/${String(a).slice(2)}`, Receita: total };
    });
  }, [payments]);

  // Filtro de partners
  const filtered = useMemo(() => {
    return partners.filter(p => {
      const s = calcStatus(p);
      const nome = (p.full_name ?? p.email).toLowerCase();
      if (search && !nome.includes(search.toLowerCase())) return false;
      if (filterStatus === "ativas") return p.is_active && s.dias > 15;
      if (filterStatus === "vencendo") return s.dias > 0 && s.dias <= 15;
      if (filterStatus === "vencidas") return p.is_active && s.dias === 0;
      if (filterStatus === "suspensas") return !p.is_active;
      return true;
    });
  }, [partners, search, filterStatus]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        Carregando assinaturas...
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="MRR" value={formatMoeda(mrr)} sub={`${ativos.length} ativos`} icon={DollarSign} color="#C9A84C" />
        <KpiCard label="Partners PRO" value={String(totalPRO)} sub={`de ${totalPartners} total`} icon={Crown} color="#F59E0B" />
        <KpiCard label="Vencendo em 15d" value={String(vencendo)} sub="necessitam renovação" icon={Clock} color="#EF4444" />
        <KpiCard label="Inadimplentes" value={String(inadimplentes)} sub="vencidos ou suspensos" icon={AlertCircle} color="#6B7280" />
      </div>

      {/* Alertas de pendências */}
      {pendingNotifs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Solicitações Pendentes ({pendingNotifs.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingNotifs.slice(0, 5).map((n, i) => (
              <div key={i} className="flex items-start justify-between text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                <span className="text-amber-200">{n.message}</span>
                <span className="text-muted-foreground ml-4 whitespace-nowrap">
                  {new Date(n.created_at).toLocaleDateString("pt-BR")}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Gráfico de receita mensal de assinaturas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Receita de Assinaturas — Últimos 6 Meses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={mrrChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#122036" />
              <XAxis dataKey="mes" tick={{ fill: "#7A8FA8", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#7A8FA8", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: "#091221", border: "1px solid rgba(196,146,46,0.2)", borderRadius: 10, fontSize: 12 }}
                formatter={(v) => formatMoeda(Number(v) || 0)}
              />
              <Bar dataKey="Receita" fill="#C9A84C" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Filtros e busca */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Buscar partner..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-card border border-border/40 rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-[#C9A84C]/40 w-52"
        />
        {(["todos", "ativas", "vencendo", "vencidas", "suspensas"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilterStatus(f)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all capitalize ${
              filterStatus === f
                ? "border-[#C9A84C] text-[#C9A84C] bg-[#C9A84C]/10"
                : "border-border/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {loteResult && (
            <span className="text-xs text-emerald-400">{loteResult.ok} geradas{loteResult.skip > 0 ? `, ${loteResult.skip} ignoradas` : ""}</span>
          )}
          <button
            onClick={handleGerarCobraLote}
            disabled={gerandoLote}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/20 transition-colors disabled:opacity-50"
          >
            {gerandoLote ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            Gerar Cobranças Cora
          </button>
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border/40 px-3 py-1.5 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Atualizar
          </button>
        </div>
      </div>

      {/* Tabela de partners */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-3">Partner</th>
                  <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-3">Plano</th>
                  <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-3">Mensalidade</th>
                  <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-3">Status</th>
                  <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-3">Vencimento</th>
                  <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-3">Cobrança Cora</th>
                  <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted-foreground py-10 text-sm">
                      Nenhum partner encontrado.
                    </td>
                  </tr>
                )}
                {filtered.map(p => {
                  const status = calcStatus(p);
                  const valor = p.role === "PARTNER_PRO" ? 397 : 197;
                  const expDate = p.trial_expires_at
                    ? new Date(p.trial_expires_at).toLocaleDateString("pt-BR")
                    : new Date(new Date(p.created_at).getTime() + 30 * 86400000).toLocaleDateString("pt-BR");
                  const isLoadingAny = actionLoading?.startsWith(p.id);

                  return (
                    <tr key={p.id} className="border-b border-border/20 hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{p.full_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{p.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <PlanBadge role={p.role} />
                      </td>
                      <td className="px-4 py-3 font-medium text-[#C9A84C]">
                        {formatMoeda(valor)}<span className="text-xs text-muted-foreground">/mês</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold ${status.color}`}>{status.label}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{expDate}</td>
                      <td className="px-4 py-3">
                        {(() => {
                          const sub = coraByPartner[p.id];
                          if (!sub) {
                            return (
                              <button
                                onClick={() => doAction(p.id, "gerar_cobranca_cora")}
                                disabled={!!isLoadingAny}
                                className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-colors disabled:opacity-40"
                              >
                                {actionLoading === p.id + "gerar_cobranca_cora" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                                Gerar
                              </button>
                            );
                          }
                          const isPending = ["PENDING", "OPEN"].includes(sub.status);
                          const isPaid = sub.status === "PAID";
                          return (
                            <div className="space-y-0.5">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                isPaid ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                : isPending ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                : "bg-red-500/20 text-red-400 border-red-500/30"
                              }`}>
                                {isPaid ? "Pago" : isPending ? "Pendente" : "Cancelado"}
                              </span>
                              <p className="text-[10px] text-muted-foreground">
                                Vence {new Date(sub.due_date + "T12:00:00").toLocaleDateString("pt-BR")}
                              </p>
                              {isPending && (
                                <button
                                  onClick={() => doAction(p.id, "gerar_cobranca_cora")}
                                  disabled={!!isLoadingAny}
                                  className="text-[10px] text-[#C9A84C] hover:underline disabled:opacity-40"
                                >
                                  Nova cobrança
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Registrar pagamento */}
                          <button
                            onClick={() => { setPayPartner(p); setShowPayModal(true); }}
                            title="Registrar pagamento"
                            className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/30 hover:bg-[#C9A84C]/20 transition-colors"
                          >
                            <Plus className="w-3 h-3" /> Pagar
                          </button>

                          {/* Renovar */}
                          <button
                            onClick={() => doAction(p.id, "renovar")}
                            title="Renovar +30 dias"
                            disabled={!!isLoadingAny}
                            className="p-1.5 rounded-lg text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
                          >
                            {actionLoading === p.id + "renovar"
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <RotateCcw className="w-3.5 h-3.5" />}
                          </button>

                          {/* Upgrade para PRO (só para PARTNER) */}
                          {p.role === "PARTNER" && (
                            <button
                              onClick={() => doAction(p.id, "upgrade")}
                              title="Upgrade para PRO"
                              disabled={!!isLoadingAny}
                              className="p-1.5 rounded-lg text-amber-400 border border-amber-500/20 hover:bg-amber-500/10 transition-colors disabled:opacity-40"
                            >
                              {actionLoading === p.id + "upgrade"
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Crown className="w-3.5 h-3.5" />}
                            </button>
                          )}

                          {/* Suspender / Reativar */}
                          {p.is_active ? (
                            <button
                              onClick={() => doAction(p.id, "suspender")}
                              title="Suspender acesso"
                              disabled={!!isLoadingAny}
                              className="p-1.5 rounded-lg text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                            >
                              {actionLoading === p.id + "suspender"
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Ban className="w-3.5 h-3.5" />}
                            </button>
                          ) : (
                            <button
                              onClick={() => doAction(p.id, "reativar")}
                              title="Reativar acesso"
                              disabled={!!isLoadingAny}
                              className="p-1.5 rounded-lg text-blue-400 border border-blue-500/20 hover:bg-blue-500/10 transition-colors disabled:opacity-40"
                            >
                              {actionLoading === p.id + "reativar"
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <CheckCircle2 className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Histórico de pagamentos recentes */}
      {payments.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Histórico de Pagamentos Registrados
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2">Partner</th>
                    <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2">Plano</th>
                    <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2">Valor</th>
                    <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2">Ref.</th>
                    <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2">Data</th>
                    <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 py-2">Obs.</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.slice(0, 20).map(pay => (
                    <tr key={pay.id} className="border-b border-border/20 hover:bg-white/[0.02]">
                      <td className="px-4 py-2 text-foreground">{pay.data.partnerNome}</td>
                      <td className="px-4 py-2"><PlanBadge role={pay.data.partnerRole} /></td>
                      <td className="px-4 py-2 font-medium text-emerald-400">{formatMoeda(pay.data.valor)}</td>
                      <td className="px-4 py-2 text-muted-foreground">{MESES_PT[pay.data.mes - 1]}/{pay.data.ano}</td>
                      <td className="px-4 py-2 text-muted-foreground">{new Date(pay.data.dataPagamento).toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">{pay.data.observacoes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de pagamento */}
      {showPayModal && payPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111F35] border border-border/40 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Registrar Pagamento</h2>
              <button onClick={() => setShowPayModal(false)} className="text-muted-foreground hover:text-foreground">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">Partner: <span className="text-foreground font-medium">{payPartner.full_name ?? payPartner.email}</span></p>
              <p className="text-muted-foreground">Plano: <span className="text-foreground font-medium">{payPartner.role === "PARTNER_PRO" ? "Partner PRO" : "Partner"}</span></p>
              <p className="text-muted-foreground">Valor: <span className="text-[#C9A84C] font-bold">{formatMoeda(payPartner.role === "PARTNER_PRO" ? 397 : 197)}</span></p>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Observações (opcional)</label>
              <input
                type="text"
                value={payObs}
                onChange={e => setPayObs(e.target.value)}
                placeholder="Ex: Pix recebido em 24/04"
                className="w-full bg-card border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-[#C9A84C]/40"
              />
            </div>
            <p className="text-xs text-muted-foreground">O acesso do partner será renovado por +30 dias automaticamente.</p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowPayModal(false)}
                className="flex-1 border border-border/40 text-muted-foreground rounded-lg py-2 text-sm hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handlePagar}
                disabled={payLoading}
                className="flex-1 bg-[#C9A84C] text-[#09081A] font-bold rounded-lg py-2 text-sm hover:bg-[#E8C97A] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {payLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirmar Pagamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "metricas", label: "Métricas", icon: TrendingUp },
  { id: "visao-geral", label: "Visão Geral", icon: BarChart3 },
  { id: "folha", label: "Folha de Pagamento", icon: Users },
  { id: "despesas", label: "Despesas", icon: FileText },
  { id: "comissoes", label: "Comissões", icon: CreditCard },
  { id: "dre", label: "DRE", icon: TrendingUp },
  { id: "fluxo", label: "Fluxo de Caixa", icon: DollarSign },
  { id: "impostos", label: "Impostos", icon: Receipt },
  { id: "assinaturas", label: "Assinaturas", icon: Crown },
  { id: "cora", label: "Cora Bank", icon: Building2 },
];

export function FinanceiroClient({ role, userName }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("visao-geral");

  const renderTab = () => {
    switch (activeTab) {
      case "metricas": return <MetricasClient />;
      case "visao-geral": return <VisaoGeralTab />;
      case "folha": return <FolhaTab />;
      case "despesas": return <DespesasTab />;
      case "comissoes": return <ComissoesAdminTab />;
      case "dre": return <DRETab />;
      case "fluxo": return <FluxoCaixaTab />;
      case "impostos": return <ImpostosTab />;
      case "assinaturas": return <AssinaturasTab />;
      case "cora": return <CoraPanel />;
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Financeiro — <span className="gradient-text">Gestão Completa</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visão 360° das finanças da empresa · {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground border border-border/40 px-3 py-1.5 rounded-lg">
            {role === "ADMIN" ? "Administrador" : "Financeiro"}
          </span>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 overflow-x-auto border-b border-border/40 pb-0 scrollbar-none">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all -mb-px ${
                isActive
                  ? "border-[#C9A84C] text-[#C9A84C]"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div>{renderTab()}</div>
    </div>
  );
}
