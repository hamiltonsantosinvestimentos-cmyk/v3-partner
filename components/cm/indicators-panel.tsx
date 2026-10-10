"use client";

// Aba Indicadores e gargalos da Mesa de Capitais (Bloco 4, 08/10/2026), somente leitura.
// Os numeros vem de /api/cm/indicators (so agregados, nenhum identificador de ativo ou comprador).

import { useEffect, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { Dica } from "@/components/shared/dica";

type StageRow = { key: string; label: string; count: number; stalled: number; median_days: number | null; estimated: number };
type Funnel = {
  stages: StageRow[];
  terminals: { key: string; label: string; count: number }[];
  total_active: number;
  estimated_total: number;
  updated_at_fallback_total: number;
  bottleneck: { key: string; label: string; stalled: number; pct: number; of: number } | null;
};
type StageTime = { key: string; label: string; n: number; median_days: number | null };
type Data = {
  generated_at_br: string;
  period: { key: string; label: string };
  venda: Funnel;
  compra: Funnel;
  tempo_mediano: { venda: StageTime[]; compra: StageTime[] };
  motivos: { label: string; count: number }[];
  total_recusas: number;
  oldest_transition_br: string | null;
};

const PERIODS = [
  { key: "30", label: "30 dias" },
  { key: "90", label: "90 dias" },
  { key: "180", label: "180 dias" },
  { key: "tudo", label: "Tudo" },
];

function FunnelBlock({ title, funnel, note }: { title: string; funnel: Funnel; note?: string }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-bold text-[#F5F1E8]">{title}</h3>
      {note && <p className="text-[12px] text-[#9BAFC5]">{note}</p>}
      {funnel.bottleneck ? (
        <div className="flex items-start gap-2 rounded-lg border border-[#C9A84C]/40 bg-[#12112A] p-3">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-[#C9A84C]" />
          <p className="text-[12px] text-[#F5F1E8]">
            Gargalo atual: <span className="font-bold text-[#E8C97A]">{funnel.bottleneck.label}</span>, com {funnel.bottleneck.stalled} item(ns) parado(s) há mais de 30 dias
            ({funnel.bottleneck.pct}% dos ativos do funil, n = {funnel.bottleneck.of}).
          </p>
        </div>
      ) : (
        <p className="text-[12px] text-[#9BAFC5]">
          {funnel.total_active < 5
            ? `Amostra pequena (n = ${funnel.total_active}): gargalo não calculado.`
            : "Nenhum item parado há mais de 30 dias em quantidade que caracterize gargalo."}
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-[#9BAFC5]/10">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#243A66] bg-[#13223A] text-left text-[#E8C97A]">
              <th className="px-3 py-2 font-bold">Etapa</th>
              <th className="px-3 py-2 font-bold text-right">Itens</th>
              <th className="px-3 py-2 font-bold text-right">Parados há mais de 30 dias <Dica id="parado_30_dias" /></th>
              <th className="px-3 py-2 font-bold text-right">Idade mediana na etapa</th>
            </tr>
          </thead>
          <tbody>
            {funnel.stages.map((s) => (
              <tr key={s.key} className="border-b border-[#9BAFC5]/10">
                <td className="px-3 py-1.5 text-[#F5F1E8]">{s.label}</td>
                <td className="px-3 py-1.5 text-right text-[#F5F1E8]">{s.count}</td>
                <td className="px-3 py-1.5 text-right text-[#F5F1E8]">{s.count === 0 ? "-" : s.stalled}</td>
                <td className="px-3 py-1.5 text-right text-[#9BAFC5]">
                  {s.count === 0 ? "-" : s.median_days === null ? `Sem dados suficientes (n = ${s.count})` : `${s.median_days} dia(s)`}
                </td>
              </tr>
            ))}
            {funnel.terminals.map((t) => (
              <tr key={t.key} className="border-b border-[#9BAFC5]/10 bg-[#12112A]/50">
                <td className="px-3 py-1.5 text-[#9BAFC5]">{t.label} (etapa final)</td>
                <td className="px-3 py-1.5 text-right text-[#9BAFC5]">{t.count}</td>
                <td className="px-3 py-1.5 text-right text-[#9BAFC5]">-</td>
                <td className="px-3 py-1.5 text-right text-[#9BAFC5]">-</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {funnel.estimated_total > 0 && (
        <p className="text-[11px] text-[#9BAFC5]/80">
          {funnel.estimated_total}{" "}item(ns) sem transição registrada: a idade é estimada pela data de criação e vale como &quot;no máximo&quot;.
          {funnel.updated_at_fallback_total > 0 ? ` ${funnel.updated_at_fallback_total} usam a data da última edição, que pode subestimar o tempo parado.` : ""}
        </p>
      )}
    </section>
  );
}

function StageTimeBlock({ title, rows }: { title: string; rows: StageTime[] }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-bold text-[#F5F1E8]">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-[#9BAFC5]/10">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#243A66] bg-[#13223A] text-left text-[#E8C97A]">
              <th className="px-3 py-2 font-bold">Etapa</th>
              <th className="px-3 py-2 font-bold text-right">Tempo mediano entre entrada e saída</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-[#9BAFC5]/10">
                <td className="px-3 py-1.5 text-[#F5F1E8]">{r.label}</td>
                <td className="px-3 py-1.5 text-right text-[#9BAFC5]">
                  {r.median_days === null ? `Sem dados suficientes (n = ${r.n})` : `${r.median_days} dia(s) (n = ${r.n})`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function IndicatorsPanel() {
  const [period, setPeriod] = useState("90");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetch(`/api/cm/indicators?period=${period}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok) { setError(json.error ?? "Não foi possível carregar os indicadores"); setData(null); return; }
        setData(json);
      })
      .catch(() => { if (alive) setError("Erro de conexão ao carregar os indicadores"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [period]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-[#F5F1E8]">Indicadores e gargalos</h2>
          <p className="text-[12px] text-[#9BAFC5]">Retrato atual do funil e histórico do período. Só agregados, sem identificar ativo ou comprador.</p>
        </div>
        <div className="flex gap-1" role="group" aria-label="Período">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={`rounded border px-3 py-1.5 text-[12px] font-semibold ${period === p.key ? "border-[#C9A84C] bg-[#C9A84C]/15 text-[#E8C97A]" : "border-[#9BAFC5]/20 text-[#9BAFC5] hover:text-[#F5F1E8]"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-[#C9A84C]" /></div>}
      {!loading && error && <p className="rounded-lg border border-[#9BAFC5]/10 bg-[#12112A] p-3 text-xs text-[#E24B4A]">{error}</p>}

      {!loading && data && (
        <>
          <FunnelBlock title="Funil de venda (ativos)" funnel={data.venda} />
          <FunnelBlock
            title="Funil de compra (demandas)"
            funnel={data.compra}
            note="A etapa Aguardando Formulário agrupa as demandas pendentes e as de reunião validada."
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <StageTimeBlock title={`Tempo por etapa, venda (${data.period.label.toLowerCase()})`} rows={data.tempo_mediano.venda} />
            <StageTimeBlock title={`Tempo por etapa, compra (${data.period.label.toLowerCase()})`} rows={data.tempo_mediano.compra} />
          </div>

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-[#F5F1E8]">Motivos de recusa ({data.period.label.toLowerCase()})</h3>
            {data.motivos.length === 0 ? (
              <p className="text-[12px] text-[#9BAFC5]">Nenhuma recusa registrada no período.</p>
            ) : (
              <ul className="space-y-1">
                {data.motivos.map((m) => (
                  <li key={m.label} className="flex justify-between rounded border border-[#9BAFC5]/10 bg-[#12112A] px-3 py-1.5 text-xs">
                    <span className="text-[#F5F1E8]">{m.label}</span>
                    <span className="font-bold text-[#E8C97A]">{m.count}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-[#9BAFC5]/80">
              n = {data.total_recusas} recusa(s){data.oldest_transition_br ? `; transição mais antiga do período: ${data.oldest_transition_br}` : ""}.
            </p>
          </section>

          <p className="border-t border-[#9BAFC5]/10 pt-3 text-[11px] text-[#9BAFC5]/70">Consulta em {data.generated_at_br} (horário de Brasília).</p>
        </>
      )}
    </div>
  );
}
