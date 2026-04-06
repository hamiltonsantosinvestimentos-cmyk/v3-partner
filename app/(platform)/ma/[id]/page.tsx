import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Building2, MapPin, TrendingUp, FileImage, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { DEMO_DEALS } from "@/lib/demo-data";
import { ForjaPanel } from "@/components/ma/forja-panel";
import { ContratoPanel } from "@/components/ma/contrato-panel";

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

const STAGE_LABELS: Record<string, string> = {
  PROSPECTING: "Prospecção", QUALIFICATION: "Qualificação",
  DUE_DILIGENCE: "Due Diligence", NEGOTIATION: "Negociação",
  CLOSING: "Fechamento", CLOSED_WON: "Fechado (Ganho)", CLOSED_LOST: "Fechado (Perdido)",
};

const STAGE_COLORS: Record<string, string> = {
  PROSPECTING: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  QUALIFICATION: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  DUE_DILIGENCE: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  NEGOTIATION: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  CLOSING: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  CLOSED_WON: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  CLOSED_LOST: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let deal: any = null;

  if (IS_DEMO) {
    deal = DEMO_DEALS.find((d) => d.id === id) ?? null;
  } else {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data } = await supabase.from("ma_deals").select("*").eq("id", id).single();
    deal = data;
  }

  if (!deal) notFound();

  const assetData = deal.asset_data ?? {};
  const metricas = assetData.metricas ?? [];
  const diferenciais = assetData.diferenciais ?? [];

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link href="/ma" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />M&A Pipeline
        </Link>
        <span className="text-muted-foreground/40 text-xs">/</span>
        <span className="text-xs text-foreground font-medium">{deal.target_company}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold tracking-widest uppercase text-[#C9A84C] opacity-70">
                {deal.code}
              </span>
              <Badge className={STAGE_COLORS[deal.stage]}>
                {STAGE_LABELS[deal.stage]}
              </Badge>
            </div>
            <h1 className="text-xl font-bold text-white">{deal.target_company}</h1>
            {(deal.location || deal.sector) && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                {deal.location && <><MapPin className="w-3 h-3" />{deal.location}</>}
                {deal.location && deal.sector && <span className="opacity-40">·</span>}
                {deal.sector}
              </p>
            )}
          </div>
        </div>
        <Link href={`/ma/${deal.id}/criativos`}>
          <Button size="sm" className="flex items-center gap-1.5 bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-semibold">
            <FileImage className="w-4 h-4" />
            Kit de Criativos
          </Button>
        </Link>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Valor do Deal", value: deal.deal_value ? formatCurrency(deal.deal_value) : "—", color: "text-[#E8C97A]" },
          { label: "Múltiplo EBITDA", value: deal.ebitda_multiple ? `${deal.ebitda_multiple}x` : "—", color: "text-white" },
          { label: "Probabilidade", value: `${deal.probability_percent ?? 0}%`, color: "text-purple-400" },
          { label: "Receita TTM", value: deal.revenue_ttm ? formatCurrency(deal.revenue_ttm) : "—", color: "text-white" },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className={`text-xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Métricas do asset_data + descrição */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Tese de investimento */}
        {assetData.tese_investimento && (
          <Card className="border-[#C9A84C]/20 bg-[#C9A84C]/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold tracking-widest uppercase text-[#C9A84C]">
                Tese de Investimento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {assetData.tese_investimento}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Métricas do ativo */}
        {metricas.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold tracking-widest uppercase text-[#C9A84C]">
                Métricas do Ativo
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {metricas.map((m: { label: string; value: string; sub?: string }, i: number) => (
                <div key={i} className="bg-[#162744] border border-[#243A66] rounded p-3">
                  <p className="text-[10px] font-bold tracking-widest uppercase text-[#C9A84C] mb-1">{m.label}</p>
                  <p className="text-sm font-bold text-[#E8C97A]">{m.value}</p>
                  {m.sub && <p className="text-[10px] text-muted-foreground mt-0.5">{m.sub}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Diferenciais */}
      {diferenciais.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold tracking-widest uppercase text-[#C9A84C]">
              Diferenciais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {diferenciais.map((d: string, i: number) => (
              <div key={i} className="flex items-start gap-3 p-2.5 bg-[#162744]/50 border-l-2 border-[#C9A84C] rounded-r">
                <TrendingUp className="w-3.5 h-3.5 text-[#C9A84C] mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">{d}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Dados da operação */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold tracking-widest uppercase text-[#C9A84C]">
            Dados da Operação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            {[
              { label: "Código", value: deal.code },
              { label: "Processo V3", value: assetData.processo_v3 ?? "—" },
              { label: "Reg. Oficial", value: assetData.processo_regulatorio ?? "—" },
              { label: "Localização", value: deal.location ?? "—" },
              { label: "Setor", value: deal.sector ?? "—" },
              { label: "Fechamento Previsto", value: deal.expected_close_date ?? "—" },
            ].map(({ label, value }) => (
              <div key={label}>
                <dt className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</dt>
                <dd className="text-xs font-medium text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* Notas */}
      {deal.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold tracking-widest uppercase text-[#C9A84C]">Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">{deal.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* FORJA — Validador M&A */}
      <div>
        <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-3">
          Validação e Geração de Criativos
        </p>
        <ForjaPanel deal={deal} dealId={deal.id} />
      </div>

      {/* Contrato — NDA / Mandato */}
      <div>
        <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-3">
          Contrato e Assinatura
        </p>
        <ContratoPanel deal={deal} dealCode={deal.code} isDemo={IS_DEMO} />
      </div>

      {/* CTA Criativos */}
      <div className="border border-[#C9A84C]/20 bg-[#C9A84C]/5 rounded-lg p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase text-[#C9A84C] mb-1">Kit de Divulgação</p>
          <p className="text-sm font-semibold text-white">Gerar CIM · Teaser · LinkedIn Post · Story</p>
          <p className="text-xs text-muted-foreground mt-0.5">PT-BR e EN — pronto para download em PDF e imagem</p>
        </div>
        <Link href={`/ma/${deal.id}/criativos`}>
          <Button className="bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-bold flex items-center gap-1.5">
            <FileImage className="w-4 h-4" />Acessar Criativos
          </Button>
        </Link>
      </div>

    </div>
  );
}
