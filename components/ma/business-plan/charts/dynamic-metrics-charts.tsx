"use client";

// Generic, sector-agnostic Recharts chart primitives for Business Plan panels.
// Designed to work across all 4 V3 verticals: Real Estate, Agronegócio, Commodities, Securitização.
// dataKey props are typed as string — Recharts accepts string for any Record data.
// Only the Tooltip formatter uses the mkFmt cast (Recharts internal type complexity).

import {
  AreaChart, Area,
  BarChart, Bar, Cell,
  XAxis, YAxis,
  CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

// ── Palette ──────────────────────────────────────────────────────────────────

const C = {
  nd: "#09081A", nc: "#162744", nm: "#243A66",
  go: "#C9A84C", gl: "#E8C97A",
  cr: "#F5F1E8", mu: "#9BAFC5",
};

const ttStyle = {
  contentStyle: {
    background: C.nc,
    border: `1px solid ${C.nm}`,
    borderRadius: 8,
    fontSize: 11,
    color: C.cr,
  },
  labelStyle: { color: C.cr },
  itemStyle: { color: C.mu },
};

// Recharts Tooltip.formatter has a complex internal generic type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mkFmt = (fn: (...args: any[]) => unknown) => fn as any;

// ── Types ─────────────────────────────────────────────────────────────────────

export type ChartRow = Record<string, unknown>;

export interface SeriesConfig {
  key: string;
  label: string;
  color?: string;
  gradientId?: string;
}

export interface ChartTimeSeriesProps {
  title: string;
  data: ChartRow[];
  xKey: string;
  series: SeriesConfig[];
  height?: number;
  formatY?: (v: number) => string;
}

export interface ScenarioEntry {
  label: string;
  [key: string]: unknown;
}

export interface ChartCenariosAgrupadoProps {
  title?: string;
  scenarios: Record<string, ScenarioEntry>;
  valueKey: string;       // required — no default to force explicit intent (RE uses "valuation", Agro uses "valor_terminal_brl")
  secondaryKey?: string;  // optional second bar (e.g., "cagr_pct")
  formatY?: (v: number) => string;
  formatSecondary?: (v: number) => string;
}

// ── Default formatters ────────────────────────────────────────────────────────

function fmtBRL(v: number): string {
  if (v >= 1e9) return `R$${(v / 1e9).toFixed(1)}Bi`;
  if (v >= 1e6) return `R$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `R$${(v / 1e3).toFixed(0)}K`;
  return `R$${v.toFixed(0)}`;
}

// ── GradientDefs (injected once per chart) ────────────────────────────────────

function GradientDefs({ series, prefix }: { series: SeriesConfig[]; prefix: string }) {
  return (
    <defs>
      {series.map((s) => {
        const id = `${prefix}-${s.gradientId ?? s.key}`;
        const color = s.color ?? C.go;
        return (
          <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        );
      })}
    </defs>
  );
}

// ── ChartTimeSeries ───────────────────────────────────────────────────────────
// Generic area chart for any time-series array.
// xKey: field used for X axis labels (string coerced for display).
// series: each entry adds one Area with its own gradient and color.

export function ChartTimeSeries({
  title,
  data,
  xKey,
  series,
  height = 220,
  formatY = fmtBRL,
}: ChartTimeSeriesProps) {
  const idPrefix = `ts-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div>
      <p className="text-[10px] font-semibold mb-2" style={{ color: C.gl }}>{title}</p>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <GradientDefs series={series} prefix={idPrefix} />
          <CartesianGrid strokeDasharray="3 3" stroke={C.nm} strokeOpacity={0.4} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 9, fill: C.mu }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => formatY(v)}
            tick={{ fontSize: 9, fill: C.mu }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            formatter={mkFmt((v: number, name: string) => [formatY(v), name])}
            {...ttStyle}
          />
          {series.map((s) => {
            const gradId = `${idPrefix}-${s.gradientId ?? s.key}`;
            const color = s.color ?? C.go;
            return (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradId})`}
                dot={false}
                activeDot={{ r: 4, fill: color, stroke: C.nd, strokeWidth: 2 }}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Scenario bar color map (order: base → expansao/otimista → pessimista/conservador)

const SCENARIO_COLORS: Record<string, string> = {
  base:        C.go,
  expansao:    C.gl,
  otimista:    C.gl,
  pessimista:  C.mu,
  conservador: C.mu,
};

function getScenarioColor(key: string, idx: number): string {
  return SCENARIO_COLORS[key.toLowerCase()]
    ?? [C.go, C.gl, C.mu, "#6366F1"][idx % 4];
}

// ── ChartCenariosAgrupado ─────────────────────────────────────────────────────
// Generic scenario comparison bar chart.
// scenarios: any Record where each value has at least a `label` string and the `valueKey` numeric field.
// valueKey: must be declared explicitly by the caller — no hardcoded field name.

export function ChartCenariosAgrupado({
  title = "Comparativo de Cenários",
  scenarios,
  valueKey,
  formatY = fmtBRL,
}: ChartCenariosAgrupadoProps) {
  // Build flat array for Recharts: [{ key, label, value, color }]
  const barData = Object.entries(scenarios).map(([key, entry], idx) => ({
    key,
    // Use "label" field for X axis; fall back to capitalized key
    label: typeof entry.label === "string" ? entry.label : key,
    value: typeof entry[valueKey] === "number" ? Number(entry[valueKey]) : 0,
    color: getScenarioColor(key, idx),
  }));

  if (barData.length === 0) return null;

  return (
    <div>
      <p className="text-[10px] font-semibold mb-2" style={{ color: C.gl }}>{title}</p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke={C.nm} strokeOpacity={0.4} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: C.mu }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => formatY(v)}
            tick={{ fontSize: 9, fill: C.mu }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            formatter={mkFmt((v: number) => [formatY(v), valueKey])}
            {...ttStyle}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {barData.map((entry) => (
              <Cell key={entry.key} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
