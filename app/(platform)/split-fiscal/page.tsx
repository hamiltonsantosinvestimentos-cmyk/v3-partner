import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { STATUS_LABELS, STATUS_COLORS, type OperationStatus } from "@/lib/constants";
import { PieChart, Plus } from "lucide-react";
import Link from "next/link";
import { DEMO_SPLITS } from "@/lib/demo-data";

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

export default async function SplitFiscalPage() {
  let list = DEMO_SPLITS;

  if (!IS_DEMO) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profileData } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").single();
    const role = (profileData as { role: string } | null)?.role || "PARTNER";
    let query = supabase.from("split_fiscal").select("*").order("created_at", { ascending: false });
    if (role === "PARTNER") query = query.eq("partner_id", user?.id ?? "");
    const { data: splits } = await query;
    list = (splits ?? []) as typeof DEMO_SPLITS;
  }

  const totalValue = list.reduce((s, sp) => s + sp.total_value, 0);
  const totalRevenue = list.reduce((s, sp) => s + (sp.partner_revenue ?? 0), 0);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
            <PieChart className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Split Fiscal</h1>
            <p className="text-xs text-muted-foreground">Gestão de splits de receita e tributação</p>
          </div>
        </div>
        <Button size="sm"><Plus className="w-4 h-4 mr-1.5" />Nova Operação</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total de Operações", value: list.length, color: "text-emerald-400" },
          { label: "Volume Total", value: formatCurrency(totalValue), color: "text-white" },
          { label: "Receita Partner", value: formatCurrency(totalRevenue), color: "text-amber-400" },
          { label: "Aprovadas", value: list.filter((s) => s.status === "APPROVED").length, color: "text-emerald-400" },
        ].map((kpi) => (
          <Card key={kpi.label}><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className={`text-xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm font-semibold">Operações Split Fiscal</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  {["Código", "Título", "Valor Total", "Split %", "Receita Partner", "Status", "Data"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((split) => (
                  <tr key={split.id} className="data-table-row cursor-pointer">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{split.code}</td>
                    <td className="px-4 py-3 font-medium text-foreground max-w-48 truncate">{split.title}</td>
                    <td className="px-4 py-3 font-semibold text-white">{formatCurrency(split.total_value)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{split.split_percent ? `${split.split_percent}%` : "—"}</td>
                    <td className="px-4 py-3 font-semibold text-amber-400">{split.partner_revenue ? formatCurrency(split.partner_revenue) : "—"}</td>
                    <td className="px-4 py-3">
                      <Badge className={STATUS_COLORS[split.status as OperationStatus]}>
                        {STATUS_LABELS[split.status as OperationStatus]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(split.created_at)}</td>
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
