import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Building2, Plus, FileImage } from "lucide-react";
import Link from "next/link";
import { DEMO_DEALS } from "@/lib/demo-data";

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

const STAGE_COLORS: Record<string, string> = {
  PROSPECTING: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  QUALIFICATION: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  DUE_DILIGENCE: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  NEGOTIATION: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  CLOSING: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  CLOSED_WON: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  CLOSED_LOST: "bg-red-500/20 text-red-400 border-red-500/30",
};

const STAGE_LABELS: Record<string, string> = {
  PROSPECTING: "Prospecção", QUALIFICATION: "Qualificação",
  DUE_DILIGENCE: "Due Diligence", NEGOTIATION: "Negociação",
  CLOSING: "Fechamento", CLOSED_WON: "Fechado (Ganho)", CLOSED_LOST: "Fechado (Perdido)",
};

export default async function MAPage() {
  let list = DEMO_DEALS;

  if (!IS_DEMO) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data } = await supabase.from("ma_deals").select("*").order("created_at", { ascending: false });
    list = (data ?? []) as typeof DEMO_DEALS;
  }

  const totalValue = list.reduce((s, d) => s + (d.deal_value ?? 0), 0);
  const pipelineValue = list
    .filter((d) => !["CLOSED_WON", "CLOSED_LOST"].includes(d.stage))
    .reduce((s, d) => s + (d.deal_value ?? 0), 0);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">M&A — Fusões e Aquisições</h1>
            <p className="text-xs text-muted-foreground">Pipeline de deals, due diligence e fechamentos</p>
          </div>
        </div>
        <Link href="/ma/novo">
          <Button size="sm" className="bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-bold">
            <Plus className="w-4 h-4 mr-1.5" />Novo Deal
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total de Deals", value: list.length, color: "text-purple-400" },
          { label: "Valor Total", value: formatCurrency(totalValue), color: "text-white" },
          { label: "Pipeline Ativo", value: formatCurrency(pipelineValue), color: "text-amber-400" },
          { label: "Fechados (Ganho)", value: list.filter((d) => d.stage === "CLOSED_WON").length, color: "text-emerald-400" },
        ].map((kpi) => (
          <Card key={kpi.label}><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className={`text-xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
        {Object.entries(STAGE_LABELS).map(([stage, label]) => {
          const count = list.filter((d) => d.stage === stage).length;
          return (
            <div key={stage} className={`p-3 rounded-lg border text-center ${STAGE_COLORS[stage]}`}>
              <p className="text-lg font-bold">{count}</p>
              <p className="text-[10px] leading-tight mt-0.5">{label}</p>
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold">Todos os Deals</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  {["Código", "Empresa Alvo", "Setor", "Valor do Deal", "EBITDA x", "Stage", "Prob.", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((deal) => (
                  <tr key={deal.id} className="data-table-row">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{deal.code}</td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      <Link href={`/ma/${deal.id}`} className="hover:text-[#C9A84C] transition-colors">
                        {deal.target_company}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{deal.sector || "—"}</td>
                    <td className="px-4 py-3 font-semibold text-white">{deal.deal_value ? formatCurrency(deal.deal_value) : "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{deal.ebitda_multiple ? `${deal.ebitda_multiple}x` : "—"}</td>
                    <td className="px-4 py-3">
                      <Badge className={STAGE_COLORS[deal.stage]}>{STAGE_LABELS[deal.stage]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden min-w-12">
                          <div className="h-full bg-purple-500 rounded-full" style={{ width: `${deal.probability_percent}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{deal.probability_percent}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/ma/${deal.id}/criativos`} className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#C9A84C] opacity-70 hover:opacity-100 transition-opacity border border-[#C9A84C]/20 px-2 py-1 rounded">
                        <FileImage className="w-3 h-3" />Kit
                      </Link>
                    </td>
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
