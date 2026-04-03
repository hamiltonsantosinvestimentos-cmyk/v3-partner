"use client";

import React, { useState, useMemo } from "react";
import {
  DollarSign, Users, FileText, TrendingUp, BarChart3,
  CreditCard, Receipt, ChevronLeft, ChevronRight,
  ArrowUpRight, ArrowDownRight, CheckCircle2, Clock,
  AlertCircle, RefreshCw, Plus, Download, Eye, Trash2, Pencil,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExportButton } from "@/components/financeiro/export-button";
import { Badge } from "@/components/ui/badge";
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

type Tab = "visao-geral" | "folha" | "despesas" | "comissoes" | "dre" | "fluxo" | "impostos";

interface Props {
  role: string;
  userName: string;
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────

const GOLD = "#C4922E";
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
  };
  const labels: Record<string, string> = { CREDITO: "Crédito", MA: "M&A", CONSORCIO: "Consórcio" };
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

  if (!dreAtual) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Comissões a Pagar" value={formatMoeda(comissoesAPagar)} sub="pendentes" icon={CreditCard} color="#F59E0B" />
          <KpiCard label="Impostos a Recolher" value={formatMoeda(impostoAPagar)} sub="meses abertos" icon={Receipt} color="#EF4444" />
          <KpiCard label="Folha do Mês" value={formatMoeda(bruto)} sub={`${DEMO_FUNCIONARIOS.length} colaboradores`} icon={Users} color="#8B5CF6" />
          <KpiCard label="Despesas Fixas" value={formatMoeda(DESPESAS_FIXAS_TEMPLATES.reduce((s, t) => s + t.valor, 0))} sub="mensais recorrentes" icon={FileText} color="#06B6D4" />
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
        <KpiCard label="Receita Bruta" value={formatMoeda(dreAtual.receitas)} sub={`${MESES_PT[dreAtual.mes - 1]}/26`} icon={TrendingUp} color="#C4922E" trend={trendReceita} />
        <KpiCard label="Lucro Líquido" value={formatMoeda(dreAtual.lucroLiquido)} sub="após IR/CSLL" icon={BarChart3} color="#22C55E" trend={18} />
        <KpiCard label="Comissões a Pagar" value={formatMoeda(comissoesAPagar)} sub={`${DEMO_COMISSOES.filter(c => c.status === "A_PAGAR").length} pendentes`} icon={CreditCard} color="#F59E0B" />
        <KpiCard label="Impostos a Recolher" value={formatMoeda(impostoAPagar)} sub="meses abertos" icon={Receipt} color="#EF4444" />
        <KpiCard label="Folha do Mês" value={formatMoeda(bruto)} sub={`${DEMO_FUNCIONARIOS.length} colaboradores`} icon={Users} color="#8B5CF6" />
        <KpiCard label="Despesas Fixas" value={formatMoeda(DESPESAS_FIXAS_TEMPLATES.reduce((s, t) => s + t.valor, 0))} sub="mensais recorrentes" icon={FileText} color="#06B6D4" />
        <KpiCard label="Margem Líquida" value={`${((dreAtual.lucroLiquido / dreAtual.receitas) * 100).toFixed(1)}%`} sub="lucro / receita bruta" icon={TrendingUp} color="#10B981" />
        <KpiCard label="EBITDA" value={formatMoeda(dreAtual.ebitda)} sub={MESES_PT[dreAtual.mes - 1]} icon={BarChart3} color="#C4922E" />
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
                <XAxis dataKey="mes" tick={{ fill: "#5A7490", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#5A7490", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ backgroundColor: "#091221", border: "1px solid rgba(196,146,46,0.2)", borderRadius: 10, fontSize: 12 }} formatter={(v: number) => formatMoeda(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Receita" fill="#C4922E" radius={[4, 4, 0, 0]} />
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
    `w-full h-9 px-3 text-sm rounded-lg border ${err ? "border-red-500/50 bg-red-500/5" : "border-[#122036] bg-[#0F1E35]"} text-white placeholder:text-muted-foreground focus:outline-none focus:border-[#C4922E]/60 transition-colors`;

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
            <p className="text-xs font-semibold text-[#C4922E] uppercase tracking-wider mb-3">Tipo de Contrato</p>
            <div className="flex gap-3">
              {(["CLT", "PJ"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setForm(f => ({ ...FORM_VAZIO, tipoContrato: t, nome: f.nome, cargo: f.cargo, departamento: f.departamento, admissao: f.admissao, status: f.status }))}
                  className={`flex-1 h-12 rounded-xl border-2 text-sm font-bold transition-all ${form.tipoContrato === t ? (t === "PJ" ? "border-purple-500 bg-purple-500/10 text-purple-300" : "border-[#C4922E] bg-[#C4922E]/10 text-[#C4922E]") : "border-[#122036] text-muted-foreground hover:border-[#1e3050]"}`}
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
            <p className="text-xs font-semibold text-[#C4922E] uppercase tracking-wider mb-3">Dados {isPJ ? "do Prestador" : "Pessoais"}</p>
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
            <p className="text-xs font-semibold text-[#C4922E] uppercase tracking-wider mb-3">Remuneração</p>
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
              <p className="text-xs font-semibold text-[#C4922E] uppercase tracking-wider mb-3">Benefícios</p>
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
            <div className={`bg-[#050C18] border rounded-xl p-4 ${isPJ ? "border-purple-500/20" : "border-[#C4922E]/20"}`}>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isPJ ? "text-purple-400" : "text-[#C4922E]"}`}>
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
                    { label: "Sal. Bruto",   value: formatMoeda(bruto),    color: "#C4922E" },
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
          <button onClick={salvar} className={`flex-1 h-10 rounded-xl text-white text-sm font-semibold transition-all ${isPJ ? "bg-purple-600 hover:bg-purple-500" : "bg-[#C4922E] hover:bg-[#E5B96A]"}`}>
            {editando ? "Salvar Alterações" : `Adicionar ${isPJ ? "Prestador PJ" : "Colaborador CLT"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TAB: FOLHA DE PAGAMENTO ──────────────────────────────────────────────────

function FolhaTab() {
  const [mes, setMes] = useState(3);
  const [ano, setAno] = useState(2026);
  const [funcionarios, setFuncionarios] = useState<typeof DEMO_FUNCIONARIOS>([]);
  const [showModal, setShowModal] = useState(false);
  const [editandoFunc, setEditandoFunc] = useState<import("@/lib/demo-data-financeiro").Funcionario | null>(null);

  const excluirFuncionario = (id: string, nome: string) => {
    if (!window.confirm(`Excluir "${nome}" da folha de pagamento?`)) return;
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
          onSalvar={(f) => setFuncionarios(prev => [...prev, f])}
          onEditar={(f) => setFuncionarios(prev => prev.map(x => x.id === f.id ? f : x))}
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
              className="flex items-center gap-1.5 text-xs bg-[#C4922E] text-white px-3 py-1.5 rounded-lg hover:bg-[#E5B96A] transition-all"
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
                  { label: "Bruto CLT + NF PJ", value: formatMoeda(totais.bruto), color: "#C4922E" },
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
                        <span className={`text-[10px] font-bold border px-2 py-0.5 rounded-full ${pj ? "bg-purple-500/20 text-purple-400 border-purple-500/30" : "bg-[#C4922E]/20 text-[#C4922E] border-[#C4922E]/30"}`}>
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
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-[#C4922E] hover:bg-[#C4922E]/10 transition-all"
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
                  <tr className="bg-[#0F1E35] border-t border-[#C4922E]/30">
                    <td className="px-4 py-3 font-bold text-[#C4922E]" colSpan={4}>TOTAIS — {funcionarios.length} colaborador{funcionarios.length !== 1 ? "es" : ""} ({funcionarios.filter(f => f.tipoContrato !== "PJ").length} CLT · {funcionarios.filter(f => f.tipoContrato === "PJ").length} PJ)</td>
                    <td className="px-4 py-3 font-bold text-[#C4922E]">{formatMoeda(totais.bruto)}</td>
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
    `w-full h-9 px-3 text-sm rounded-lg border ${err ? "border-red-500/50 bg-red-500/5" : "border-[#122036] bg-[#0F1E35]"} text-white placeholder:text-muted-foreground focus:outline-none focus:border-[#C4922E]/60 transition-colors`;
  const selectCls = () =>
    `w-full h-9 px-3 text-sm rounded-lg border border-[#122036] bg-[#0F1E35] text-white focus:outline-none focus:border-[#C4922E]/60 transition-colors`;

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
            className="flex-1 h-10 rounded-xl bg-[#C4922E] text-white text-sm font-semibold hover:bg-[#E5B96A] transition-all"
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
  const [mes, setMes] = useState(3);
  const [ano, setAno] = useState(2026);
  const [subtab, setSubtab] = useState<"fixas" | "variaveis">("fixas");
  const [showModal, setShowModal] = useState(false);
  const [templates, setTemplates] = useState([...DESPESAS_FIXAS_TEMPLATES]);
  const [todasVariaveis, setTodasVariaveis] = useState<import("@/lib/demo-data-financeiro").Despesa[]>([]);
  const [editandoFixaTpl, setEditandoFixaTpl] = useState<import("@/lib/demo-data-financeiro").DespesaFixaTemplate | null>(null);
  const [editandoVariavel, setEditandoVariavel] = useState<import("@/lib/demo-data-financeiro").Despesa | null>(null);

  const excluirFixa = (tplId: string, desc: string) => {
    if (!window.confirm(`Excluir despesa fixa "${desc}"? Será removida de todos os meses.`)) return;
    setTemplates(prev => prev.filter(t => t.id !== tplId));
  };
  const excluirVariavel = (id: string, desc: string) => {
    if (!window.confirm(`Excluir despesa "${desc}"?`)) return;
    setTodasVariaveis(prev => prev.filter(d => d.id !== id));
  };

  // Fixas: expande os templates (incluindo os novos) para o mês selecionado
  const fixas = useMemo(() => {
    return templates.map(t => ({
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
      status: "PENDENTE" as const,
    }));
  }, [templates, mes, ano]);

  // Variáveis: todas (demo + novas) filtradas por mês/ano
  const variaveis = useMemo(() => {
    return todasVariaveis.filter(d => d.mes === mes && d.ano === ano);
  }, [todasVariaveis, mes, ano]);

  const totalFixas = fixas.reduce((s, d) => s + d.valor, 0);
  const totalVariaveis = variaveis.reduce((s, d) => s + d.valor, 0);
  const items = subtab === "fixas" ? fixas : variaveis;

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
          onSalvarFixa={(t) => setTemplates(prev => [...prev, t])}
          onEditarFixa={(t) => setTemplates(prev => prev.map(x => x.id === t.id ? t : x))}
          onSalvarVariavel={(d) => setTodasVariaveis(prev => [...prev, d])}
          onEditarVariavel={(d) => setTodasVariaveis(prev => prev.map(x => x.id === d.id ? d : x))}
        />
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <MonthSelector mes={mes} ano={ano} onChange={(m, a) => { setMes(m); setAno(a); }} />
            <div className="flex bg-secondary rounded-lg p-0.5">
              <button onClick={() => setSubtab("fixas")} className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${subtab === "fixas" ? "bg-[#C4922E] text-white" : "text-muted-foreground hover:text-foreground"}`}>
                Fixas <span className="ml-1 opacity-70">{formatMoeda(totalFixas)}</span>
              </button>
              <button onClick={() => setSubtab("variaveis")} className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${subtab === "variaveis" ? "bg-[#C4922E] text-white" : "text-muted-foreground hover:text-foreground"}`}>
                Variáveis <span className="ml-1 opacity-70">{formatMoeda(totalVariaveis)}</span>
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
              className="flex items-center gap-1.5 text-xs bg-[#C4922E] text-white px-3 py-1.5 rounded-lg hover:bg-[#E5B96A] transition-all"
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
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Receipt className="w-7 h-7 opacity-20" />
                          <span>Nenhuma despesa {subtab === "fixas" ? "fixa" : "variável"} neste mês</span>
                          <button onClick={() => setShowModal(true)} className="text-[#C4922E] hover:underline text-xs mt-1">
                            + Adicionar agora
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : items.map((d, i) => (
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
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              if (subtab === "fixas") {
                                const tpl = templates.find(t => d.despesaBaseId === t.id);
                                if (tpl) setEditandoFixaTpl(tpl);
                              } else {
                                setEditandoVariavel(d);
                              }
                            }}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-[#C4922E] hover:bg-[#C4922E]/10 transition-all"
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
                  <tr className="bg-[#0F1E35] border-t border-[#C4922E]/30">
                    <td className="px-4 py-3 font-bold text-[#C4922E]" colSpan={4}>TOTAL {subtab === "fixas" ? "FIXAS" : "VARIÁVEIS"} — {items.length} item{items.length !== 1 ? "s" : ""}</td>
                    <td className="px-4 py-3 font-bold text-[#C4922E]">{formatMoeda(subtab === "fixas" ? totalFixas : totalVariaveis)}</td>
                    <td colSpan={3} />
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

function ComissoesAdminTab() {
  const [filtroTipo, setFiltroTipo] = useState<"TODOS" | "CREDITO" | "MA" | "CONSORCIO">("TODOS");
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | "A_PAGAR" | "PAGA">("TODOS");

  const filtradas = DEMO_COMISSOES.filter(c =>
    (filtroTipo === "TODOS" || c.operacaoTipo === filtroTipo) &&
    (filtroStatus === "TODOS" || c.status === filtroStatus)
  );

  const totalAPagar = DEMO_COMISSOES.filter(c => c.status === "A_PAGAR").reduce((s, c) => s + c.valorComissao, 0);
  const totalPago = DEMO_COMISSOES.filter(c => c.status === "PAGA").reduce((s, c) => s + c.valorComissao, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#091221] border border-[#122036] rounded-xl p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Total a Pagar</p>
          <p className="text-xl font-bold text-amber-400">{formatMoeda(totalAPagar)}</p>
          <p className="text-xs text-muted-foreground mt-1">{DEMO_COMISSOES.filter(c => c.status === "A_PAGAR").length} comissões pendentes</p>
        </div>
        <div className="bg-[#091221] border border-[#122036] rounded-xl p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Total Pago</p>
          <p className="text-xl font-bold text-emerald-400">{formatMoeda(totalPago)}</p>
          <p className="text-xs text-muted-foreground mt-1">{DEMO_COMISSOES.filter(c => c.status === "PAGA").length} comissões liquidadas</p>
        </div>
        <div className="bg-[#091221] border border-[#122036] rounded-xl p-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Total Geral</p>
          <p className="text-xl font-bold text-[#C4922E]">{formatMoeda(totalAPagar + totalPago)}</p>
          <p className="text-xs text-muted-foreground mt-1">{DEMO_COMISSOES.length} operações com comissão</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap justify-between">
        <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-secondary rounded-lg p-0.5">
          {(["TODOS", "CREDITO", "MA", "CONSORCIO"] as const).map(t => {
            const labels = { TODOS: "Todos", CREDITO: "Crédito", MA: "M&A", CONSORCIO: "Consórcio" };
            return (
              <button key={t} onClick={() => setFiltroTipo(t)} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${filtroTipo === t ? "bg-[#C4922E] text-white" : "text-muted-foreground hover:text-foreground"}`}>
                {labels[t]}
              </button>
            );
          })}
        </div>
        <div className="flex bg-secondary rounded-lg p-0.5">
          {(["TODOS", "A_PAGAR", "PAGA"] as const).map(t => {
            const labels = { TODOS: "Todos", A_PAGAR: "A Pagar", PAGA: "Pago" };
            return (
              <button key={t} onClick={() => setFiltroStatus(t)} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${filtroStatus === t ? "bg-[#C4922E] text-white" : "text-muted-foreground hover:text-foreground"}`}>
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
                    <td className="px-4 py-3 text-white">{formatMoeda(c.valorOperacao)}</td>
                    <td className="px-4 py-3 text-[#C4922E] font-semibold">{c.percentualComissao}%</td>
                    <td className="px-4 py-3 font-bold text-white">{formatMoeda(c.valorComissao)}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(c.dataOperacaoFinalizada).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── TAB: DRE ────────────────────────────────────────────────────────────────

function DRETab() {
  const [idx, setIdx] = useState(0);
  if (!DEMO_DRE.length) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Sem dados de DRE cadastrados. Adicione lançamentos para visualizar.
      </div>
    );
  }
  const safeIdx = Math.min(idx, DEMO_DRE.length - 1);
  const d = DEMO_DRE[safeIdx];
  const prev = DEMO_DRE[safeIdx - 1];

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
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0} className="p-1 rounded-lg hover:bg-secondary disabled:opacity-40 transition-colors">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="text-sm font-semibold text-white min-w-[120px] text-center">
            {MESES_PT[d.mes - 1]} / {d.ano}
          </span>
          <button onClick={() => setIdx(Math.min(DEMO_DRE.length - 1, idx + 1))} disabled={idx === DEMO_DRE.length - 1} className="p-1 rounded-lg hover:bg-secondary disabled:opacity-40 transition-colors">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        {prev && <span className="text-xs text-muted-foreground">vs {MESES_PT[prev.mes - 1]}/{prev.ano}</span>}
        <div className="ml-auto">
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
                  const diff = prevVal !== null ? ((Math.abs(l.valor) - Math.abs(prevVal)) / Math.abs(prevVal) * 100) : null;
                  return (
                    <tr key={i} className={`border-b border-border/20 ${l.destaque ? "bg-[#0F1E35]" : ""}`}>
                      <td className={`px-4 py-2.5 ${l.destaque ? "font-bold text-[#C4922E]" : "text-muted-foreground"}`}>{l.label}</td>
                      <td className={`px-4 py-2.5 text-right font-${l.destaque ? "bold" : "medium"} ${l.valor < 0 ? "text-red-400" : l.destaque ? "text-[#C4922E]" : "text-white"}`}>
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
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Evolução 6 Meses</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={DEMO_DRE.map(dr => ({ mes: `${MESES_PT[dr.mes - 1]}/${String(dr.ano).slice(2)}`, Receita: dr.receitas, Lucro: dr.lucroLiquido, EBITDA: dr.ebitda }))}>
                <defs>
                  <linearGradient id="gradRec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C4922E" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#C4922E" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradLuc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#122036" />
                <XAxis dataKey="mes" tick={{ fill: "#5A7490", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#5A7490", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ backgroundColor: "#091221", border: "1px solid rgba(196,146,46,0.2)", borderRadius: 10, fontSize: 12 }} formatter={(v: number) => formatMoeda(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="Receita" stroke="#C4922E" fill="url(#gradRec)" strokeWidth={2} />
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
  const entradas = DEMO_MOVIMENTOS.filter(m => m.tipo === "ENTRADA").reduce((s, m) => s + m.valor, 0);
  const saidas = DEMO_MOVIMENTOS.filter(m => m.tipo === "SAIDA").reduce((s, m) => s + m.valor, 0);
  const saldoFinal = SALDO_INICIAL_MARCO + entradas - saidas;

  let saldoAcum = SALDO_INICIAL_MARCO;
  const movComSaldo = DEMO_MOVIMENTOS.map(m => {
    saldoAcum += m.tipo === "ENTRADA" ? m.valor : -m.valor;
    return { ...m, saldoApos: saldoAcum };
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportButton opts={{
          titulo: "Fluxo de Caixa",
          mes: "Março / 2026",
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
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Saldo Inicial", value: SALDO_INICIAL_MARCO, color: "#5A7490" },
          { label: "Total Entradas", value: entradas, color: "#22C55E" },
          { label: "Total Saídas", value: saidas, color: "#EF4444" },
          { label: "Saldo Final", value: saldoFinal, color: "#C4922E" },
        ].map(k => (
          <div key={k.label} className="bg-[#091221] border border-[#122036] rounded-xl p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{k.label}</p>
            <p className="text-lg font-bold" style={{ color: k.color }}>{formatMoeda(k.value)}</p>
          </div>
        ))}
      </div>

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
                {movComSaldo.map((m, i) => (
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
    `w-full h-9 px-3 text-sm rounded-lg border ${err ? "border-red-500/50 bg-red-500/5" : "border-[#122036] bg-[#0F1E35]"} text-white placeholder:text-muted-foreground focus:outline-none focus:border-[#C4922E]/60 transition-colors`;
  const selectCls = () =>
    `w-full h-9 px-3 text-sm rounded-lg border border-[#122036] bg-[#0F1E35] text-white focus:outline-none focus:border-[#C4922E]/60 transition-colors`;

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
              <p className="text-xs font-semibold text-[#C4922E] uppercase tracking-wider">Valor</p>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={form.calcAuto} onChange={e => setForm(f => ({ ...f, calcAuto: e.target.checked }))} className="accent-[#C4922E]" />
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
                <span className="text-lg font-bold text-[#C4922E]">{formatMoeda(valorFinal)}</span>
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
          <button onClick={salvar} className="flex-1 h-10 rounded-xl bg-[#C4922E] text-white text-sm font-semibold hover:bg-[#E5B96A] transition-all">
            {editando ? "Salvar Alterações" : "Lançar Imposto"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TAB: IMPOSTOS ────────────────────────────────────────────────────────────

function ImpostosTab() {
  const [mes, setMes] = useState(3);
  const [ano, setAno] = useState(2026);
  const [showModal, setShowModal] = useState(false);
  const [impostos, setImpostos] = useState<import("@/lib/demo-data-financeiro").Imposto[]>([]);
  const [editandoImp, setEditandoImp] = useState<import("@/lib/demo-data-financeiro").Imposto | null>(null);

  const excluirImposto = (id: string, desc: string) => {
    if (!window.confirm(`Excluir imposto "${desc}"?`)) return;
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
          onSalvar={(imp) => setImpostos(prev => [...prev, imp])}
          onEditar={(imp) => setImpostos(prev => prev.map(x => x.id === imp.id ? imp : x))}
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
                className="flex items-center gap-1.5 text-xs bg-[#C4922E] text-white px-3 py-1.5 rounded-lg hover:bg-[#E5B96A] transition-all"
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
                          <button onClick={() => setShowModal(true)} className="text-[#C4922E] hover:underline text-xs mt-1">
                            + Lançar agora
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : filtrados.map((imp, i) => (
                    <tr key={imp.id} className={`border-b border-border/20 hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? "" : "bg-[#091221]/40"}`}>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold bg-[#C4922E]/15 text-[#C4922E] border border-[#C4922E]/30 px-2 py-0.5 rounded-full">{imp.tipo}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{imp.descricao}</td>
                      <td className="px-4 py-3 text-white">{imp.baseCalculo > 0 ? formatMoeda(imp.baseCalculo) : "—"}</td>
                      <td className="px-4 py-3 text-[#C4922E] font-semibold">{imp.aliquota > 0 ? `${imp.aliquota}%` : "—"}</td>
                      <td className="px-4 py-3 font-bold text-white">{formatMoeda(imp.valor)}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(imp.vencimento + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-3 font-mono text-muted-foreground text-[10px]">{imp.guia ?? "—"}</td>
                      <td className="px-4 py-3"><StatusBadge status={imp.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button
                            onClick={() => setEditandoImp(imp)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-[#C4922E] hover:bg-[#C4922E]/10 transition-all"
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
                    <tr className="bg-[#0F1E35] border-t border-[#C4922E]/30">
                      <td className="px-4 py-3 font-bold text-[#C4922E]" colSpan={4}>TOTAL — {filtrados.length} imposto{filtrados.length !== 1 ? "s" : ""}</td>
                      <td className="px-4 py-3 font-bold text-[#C4922E]">{formatMoeda(totalMes)}</td>
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

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "visao-geral", label: "Visão Geral", icon: BarChart3 },
  { id: "folha", label: "Folha de Pagamento", icon: Users },
  { id: "despesas", label: "Despesas", icon: FileText },
  { id: "comissoes", label: "Comissões", icon: CreditCard },
  { id: "dre", label: "DRE", icon: TrendingUp },
  { id: "fluxo", label: "Fluxo de Caixa", icon: DollarSign },
  { id: "impostos", label: "Impostos", icon: Receipt },
];

export function FinanceiroClient({ role, userName }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("visao-geral");

  const renderTab = () => {
    switch (activeTab) {
      case "visao-geral": return <VisaoGeralTab />;
      case "folha": return <FolhaTab />;
      case "despesas": return <DespesasTab />;
      case "comissoes": return <ComissoesAdminTab />;
      case "dre": return <DRETab />;
      case "fluxo": return <FluxoCaixaTab />;
      case "impostos": return <ImpostosTab />;
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
                  ? "border-[#C4922E] text-[#C4922E]"
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
