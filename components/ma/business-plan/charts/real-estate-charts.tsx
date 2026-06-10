"use client";

import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from "recharts";
import type { RealEstateFinancialProjections } from "@/lib/ma/business-plan-schemas/real-estate-v1";
import type { DREEntry, DFCEntry } from "@/types/financial";

const C = {
  navy: "#09081A", nc: "#162744", nm: "#243A66",
  gold: "#C9A84C", goldLt: "#E8C97A",
  cream: "#F5F1E8", muted: "#9BAFC5",
  indigo: "#6366F1", indigoLt: "#a5b4fc",
  red: "#E05555", amber: "#E89B3A", green: "#4ade80",
};

const fmtM = (v: number) =>
  v >= 1e6 ? `R$${(v / 1e6).toFixed(1)}M` : `R$${(v / 1e3).toFixed(0)}K`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mkFmt = (fn: (...args: any[]) => unknown) => fn as any;

const ttStyle = {
  contentStyle: { background: C.nc, border: `1px solid ${C.nm}`, borderRadius: 8, fontSize: 11 },
  labelStyle: { color: C.cream },
};

const ttStyle3s = {
  contentStyle: { background: C.nc, border: `1px solid ${C.indigo}`, borderRadius: 8, fontSize: 11 },
  labelStyle: { color: C.cream },
};

// ── 1. Receita histórica + projetada ────────────────────────────────────────
export function ChartReceita({ fp }: { fp: RealEstateFinancialProjections }) {
  if (!fp.receita?.length) return null;

  const typeColor: Record<string, string> = {
    realizado: C.gold,
    projetado_base: C.goldLt,
    projetado_expansao: C.muted,
  };

  const data = fp.receita.map(r => ({ ano: String(r.ano), valor: r.valor, tipo: r.tipo }));

  return (
    <div className="rounded-xl border p-4" style={{ background: C.nc, borderColor: C.nm }}>
      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: C.goldLt }}>
        Receita — Histórico &amp; Projeção
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.nm} vertical={false} />
          <XAxis dataKey="ano" tick={{ fill: C.muted, fontSize: 9 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={fmtM} tick={{ fill: C.muted, fontSize: 9 }} axisLine={false} tickLine={false} width={54} />
          <Tooltip formatter={mkFmt((v: number) => [fmtM(v), "Receita"])} {...ttStyle} />
          <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
            {data.map((e, i) => <Cell key={i} fill={typeColor[e.tipo] ?? C.muted} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-3">
        {[
          { label: "Realizado", color: C.gold },
          { label: "Projetado base", color: C.goldLt },
          { label: "Projetado expansão", color: C.muted },
        ].map(l => (
          <span key={l.label} className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: l.color }} />
            <span className="text-[9px]" style={{ color: C.muted }}>{l.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── 2. NOI Mensal ─────────────────────────────────────────────────────────
export function ChartNOI({ fp }: { fp: RealEstateFinancialProjections }) {
  if (!fp.noi_mensal?.length) return null;

  const data = fp.noi_mensal.map(n => ({
    mes: n.mes.replace(/^(\d{4})-(\d{2})$/, (_: string, y: string, m: string) => `${m}/${y.slice(2)}`),
    valor: n.valor,
  }));

  return (
    <div className="rounded-xl border p-4" style={{ background: C.nc, borderColor: C.nm }}>
      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: C.goldLt }}>
        NOI Mensal
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="re-noi-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="20%" stopColor={C.gold} stopOpacity={0.3} />
              <stop offset="100%" stopColor={C.gold} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={C.nm} vertical={false} />
          <XAxis dataKey="mes" tick={{ fill: C.muted, fontSize: 9 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={fmtM} tick={{ fill: C.muted, fontSize: 9 }} axisLine={false} tickLine={false} width={54} />
          <Tooltip formatter={mkFmt((v: number) => [fmtM(v), "NOI"])} {...ttStyle} />
          <Area
            dataKey="valor"
            stroke={C.gold}
            strokeWidth={2}
            fill="url(#re-noi-grad)"
            dot={{ r: 3, fill: C.gold, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── 3. Vacância por Pavimento ─────────────────────────────────────────────
export function ChartVacancia({ fp }: { fp: RealEstateFinancialProjections }) {
  if (!fp.vacancia_pct?.length) return null;

  const data = [...fp.vacancia_pct]
    .map(v => ({ pavimento: v.pavimento, pct: typeof v.pct === "number" ? v.pct : Number(v.pct) }))
    .sort((a, b) => b.pct - a.pct);

  const barColor = (pct: number) => (pct >= 80 ? C.red : pct >= 40 ? C.amber : C.gold);
  const h = Math.max(120, data.length * 44);

  return (
    <div className="rounded-xl border p-4" style={{ background: C.nc, borderColor: C.nm }}>
      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: C.goldLt }}>
        Vacância por Pavimento
      </p>
      <ResponsiveContainer width="100%" height={h}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 32, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.nm} horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fill: C.muted, fontSize: 9 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="pavimento"
            tick={{ fill: C.cream, fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            width={90}
          />
          <Tooltip formatter={mkFmt((v: number) => [`${v}%`, "Vacância"])} {...ttStyle} />
          <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
            {data.map((e, i) => <Cell key={i} fill={barColor(e.pct)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── 4. Cenários de Valuation ──────────────────────────────────────────────
export function ChartCenarios({ fp }: { fp: RealEstateFinancialProjections }) {
  if (!fp.scenarios || Object.keys(fp.scenarios).length === 0) return null;

  const data = Object.entries(fp.scenarios).map(([nome, s]) => ({
    nome: nome.charAt(0).toUpperCase() + nome.slice(1),
    valuation: Math.round((s.valuation ?? 0) / 1e6),
    noi: Math.round((s.noi_anual ?? 0) / 1e6),
  }));

  return (
    <div className="rounded-xl border p-4" style={{ background: C.nc, borderColor: C.nm }}>
      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: C.goldLt }}>
        Cenários de Valuation (R$ M)
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.nm} vertical={false} />
          <XAxis dataKey="nome" tick={{ fill: C.cream, fontSize: 9 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: C.muted, fontSize: 9 }} axisLine={false} tickLine={false} width={36} />
          <Tooltip
            formatter={mkFmt((v: number, name: string) => [
              `R$ ${v}M`,
              name === "valuation" ? "Valuation" : "NOI Anual",
            ])}
            {...ttStyle}
          />
          <Legend wrapperStyle={{ fontSize: 9, color: C.muted }} />
          <Bar dataKey="valuation" name="Valuation" fill={C.gold} radius={[4, 4, 0, 0]} />
          <Bar dataKey="noi" name="NOI Anual" fill={C.muted} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── 5. DRE Projetada (3-Statement) ────────────────────────────────────────
export function ChartDRE({ dre }: { dre: DREEntry[] }) {
  if (!dre?.length) return null;

  const data = dre.map(d => ({
    ano: String(d.ano),
    receita: d.receita_liquida,
    ebitda: d.ebitda,
    lucro: d.lucro_liquido,
  }));

  return (
    <div className="rounded-lg border p-4" style={{ background: C.navy, borderColor: C.indigo }}>
      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: C.indigoLt }}>
        DRE Projetada — Receita · EBITDA · Lucro
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.nm} vertical={false} />
          <XAxis dataKey="ano" tick={{ fill: C.muted, fontSize: 9 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={fmtM} tick={{ fill: C.muted, fontSize: 9 }} axisLine={false} tickLine={false} width={54} />
          <Tooltip
            formatter={mkFmt((v: number, name: string) => [
              fmtM(v),
              name === "receita" ? "Receita Líquida" : name === "ebitda" ? "EBITDA" : "Lucro Líquido",
            ])}
            {...ttStyle3s}
          />
          <Legend wrapperStyle={{ fontSize: 9 }} />
          <Bar dataKey="receita" name="Receita" fill={C.gold} radius={[3, 3, 0, 0]} />
          <Bar dataKey="ebitda" name="EBITDA" fill={C.indigoLt} radius={[3, 3, 0, 0]} />
          <Bar dataKey="lucro" name="Lucro Líquido" fill={C.green} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── 6. DFC Projetada (3-Statement) ────────────────────────────────────────
export function ChartDFC({ dfc }: { dfc: DFCEntry[] }) {
  if (!dfc?.length) return null;

  const data = dfc.map(d => ({
    ano: String(d.ano),
    fco: d.fluxo_caixa_operacional,
    capex: d.capex,
    fcl: d.fluxo_caixa_livre,
  }));

  return (
    <div className="rounded-lg border p-4" style={{ background: C.navy, borderColor: C.indigo }}>
      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: C.indigoLt }}>
        DFC Projetada — FCO · Capex · FCL
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.nm} vertical={false} />
          <XAxis dataKey="ano" tick={{ fill: C.muted, fontSize: 9 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={fmtM} tick={{ fill: C.muted, fontSize: 9 }} axisLine={false} tickLine={false} width={54} />
          <Tooltip
            formatter={mkFmt((v: number, name: string) => [
              fmtM(v),
              name === "fco" ? "Fluxo Operacional" : name === "capex" ? "Capex" : "Fluxo de Caixa Livre",
            ])}
            {...ttStyle3s}
          />
          <Legend wrapperStyle={{ fontSize: 9 }} />
          <Bar dataKey="fco" name="FCO" fill={C.gold} radius={[3, 3, 0, 0]} />
          <Bar dataKey="capex" name="Capex" fill={C.red} radius={[3, 3, 0, 0]} />
          <Bar dataKey="fcl" name="FCL" fill={C.indigoLt} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
