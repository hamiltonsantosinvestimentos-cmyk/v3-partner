import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Building2, MapPin, TrendingUp, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { DEMO_DEALS } from "@/lib/demo-data";
import { ContratoPanel } from "@/components/ma/contrato-panel";
import { DealUpdatesClient } from "@/components/ma/deal-updates-client";

export const dynamic = "force-dynamic";

const IS_DEMO = false;

const STAGE_LABELS: Record<string, string> = {
  PROSPECTING:   "Prospecção",
  QUALIFICATION: "Qualificação",
  IOI:           "Análise de Viabilidade",
  PROPOSAL:      "Estruturação da Oferta",
  DUE_DILIGENCE: "Due Diligence",
  NEGOTIATION:   "Negociação",
  CLOSING:       "Fechamento",
  CLOSED_WON:    "Fechado (Ganho)",
  CLOSED_LOST:   "Fechado (Perdido)",
};

const STAGE_COLORS: Record<string, string> = {
  PROSPECTING:   "bg-gray-500/20 text-gray-400 border-gray-500/30",
  QUALIFICATION: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  IOI:           "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  PROPOSAL:      "bg-amber-500/20 text-amber-400 border-amber-500/30",
  DUE_DILIGENCE: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  NEGOTIATION:   "bg-red-500/20 text-red-400 border-red-500/30",
  CLOSING:       "bg-purple-500/20 text-purple-400 border-purple-500/30",
  CLOSED_WON:    "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  CLOSED_LOST:   "bg-red-500/20 text-red-400 border-red-500/30",
};

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let deal: any = null;
  let userName = "M&A";

  if (IS_DEMO) {
    deal = DEMO_DEALS.find((d) => d.id === id) ?? null;
  } else {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data } = await supabase.from("ma_deals").select("*").eq("id", id).single();
    deal = data;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      userName = (profile as { full_name?: string } | null)?.full_name ?? "M&A";
    }
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
      </div>

      {/* ── Identificação ─────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold tracking-widest uppercase text-[#C9A84C]">
            Identificação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
            {[
              { label: "Empresa / Ativo", value: deal.target_company },
              { label: "Tipo de Participante", value: String(assetData.tipo_participante ?? "—") },
              { label: "Setor", value: deal.sector ?? "—" },
              { label: "Tipo de Operação", value: String(assetData.tipoOperacao ?? "—") },
              { label: "Localização", value: deal.location ?? "—" },
              { label: "CNPJ", value: String(assetData.cnpj || "—") },
              { label: "Ano de Fundação", value: String(assetData.founding_year || "—") },
              { label: "Código do Deal", value: deal.code ?? "—" },
            ].map(({ label, value }) => (
              <div key={label}>
                <dt className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</dt>
                <dd className="text-xs font-medium text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* ── Descrição ──────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold tracking-widest uppercase text-[#C9A84C]">
            Descrição
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {assetData.descricao_ptbr && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Descrição</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{String(assetData.descricao_ptbr)}</p>
            </div>
          )}
          {assetData.produtos_servicos && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Produtos / Serviços</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{String(assetData.produtos_servicos)}</p>
            </div>
          )}
          {diferenciais.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Diferenciais</p>
              <div className="space-y-1.5">
                {diferenciais.map((d: string, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-2.5 bg-[#162744]/50 border-l-2 border-[#C9A84C] rounded-r">
                    <TrendingUp className="w-3.5 h-3.5 text-[#C9A84C] mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">{d}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {assetData.mercado_atendido && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Mercado Atendido</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{String(assetData.mercado_atendido)}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── PASSO 3 — Dados Financeiros ─────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold tracking-widest uppercase text-[#C9A84C]">
            Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
            <div>
              <dt className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Valor Pretendido</dt>
              <dd className="text-sm font-bold text-[#E8C97A]">{deal.deal_value ? formatCurrency(deal.deal_value) : "—"}</dd>
            </div>
            {assetData.divida_total && (
              <div>
                <dt className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Dívida Total</dt>
                <dd className="text-xs font-medium text-foreground">R$ {String(assetData.divida_total)}</dd>
              </div>
            )}
          </dl>
          {assetData.financeiro && (() => {
            const fin = assetData.financeiro as { receita?: Record<string, string>; ebitda?: Record<string, string>; lucro?: Record<string, string> };
            const anos = ["2023", "2024", "2025"];
            const hasData = anos.some(a => fin.receita?.[a] || fin.ebitda?.[a] || fin.lucro?.[a]);
            if (!hasData) return null;
            const fmtVal = (v?: string) => v ? `R$ ${v}` : "—";
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pb-2 pr-4 w-24"></th>
                      {anos.map(a => <th key={a} className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pb-2 px-2">{a}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#243A66]/50">
                    {fin.receita && anos.some(a => fin.receita![a]) && (
                      <tr>
                        <td className="py-2 pr-4 font-medium text-[#F0ECE4]">Receita</td>
                        {anos.map(a => <td key={a} className="py-2 px-2 text-right text-[#E8C97A]">{fmtVal(fin.receita?.[a])}</td>)}
                      </tr>
                    )}
                    {fin.ebitda && anos.some(a => fin.ebitda![a]) && (
                      <tr>
                        <td className="py-2 pr-4 font-medium text-[#F0ECE4]">EBITDA</td>
                        {anos.map(a => <td key={a} className="py-2 px-2 text-right text-[#E8C97A]">{fmtVal(fin.ebitda?.[a])}</td>)}
                      </tr>
                    )}
                    {fin.lucro && anos.some(a => fin.lucro![a]) && (
                      <tr>
                        <td className="py-2 pr-4 font-medium text-[#F0ECE4]">Lucro</td>
                        {anos.map(a => <td key={a} className="py-2 px-2 text-right text-[#E8C97A]">{fmtVal(fin.lucro?.[a])}</td>)}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* ── PASSO 4 — Situação Jurídica ─────────────────────────── */}
      {assetData.juridico && (() => {
        const jur = assetData.juridico as { licencas?: string; tem_processos?: boolean; detalhes_processos?: string; tem_pendencias?: boolean };
        return (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold tracking-widest uppercase text-[#C9A84C]">
                Jurídico
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm mb-3">
                <div>
                  <dt className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Processos Judiciais</dt>
                  <dd className={`text-xs font-semibold ${jur.tem_processos ? "text-red-400" : "text-emerald-400"}`}>
                    {jur.tem_processos ? "Sim" : "Não"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Pendências Fiscais</dt>
                  <dd className={`text-xs font-semibold ${jur.tem_pendencias ? "text-red-400" : "text-emerald-400"}`}>
                    {jur.tem_pendencias ? "Sim" : "Não"}
                  </dd>
                </div>
                {jur.licencas && (
                  <div>
                    <dt className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Licenças / Alvarás</dt>
                    <dd className="text-xs font-medium text-foreground">{jur.licencas}</dd>
                  </div>
                )}
              </dl>
              {jur.tem_processos && jur.detalhes_processos && (
                <div className="pt-3 border-t border-[#243A66]">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Detalhes dos Processos</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{jur.detalhes_processos}</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* ── PASSO 5 — Contato & Comissionamento ─────────────────── */}
      {assetData.contato && (() => {
        const ct = assetData.contato as { nome?: string; email?: string; telefone?: string };
        return (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold tracking-widest uppercase text-[#C9A84C]">
                Contato
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
                {[
                  { label: "Nome", value: ct.nome ?? "—" },
                  { label: "E-mail", value: ct.email ?? "—" },
                  { label: "Telefone / WhatsApp", value: ct.telefone ?? "—" },
                  ...(assetData.comissionamento ? [{ label: "Comissionamento (%)", value: `${String(assetData.comissionamento)}%` }] : []),
                ].map(({ label, value }) => (
                  <div key={label}>
                    <dt className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</dt>
                    <dd className="text-xs font-medium text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
              {assetData.info_adicionais && (
                <div className="pt-3 border-t border-[#243A66]">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Informações Adicionais</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{String(assetData.info_adicionais)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* ── PASSO 6 — Documentos ────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold tracking-widest uppercase text-[#C9A84C]">
            Documentos
            {Array.isArray(assetData.documentos) && (assetData.documentos as unknown[]).length > 0 && (
              <span className="ml-2 text-[10px] font-normal text-muted-foreground normal-case">
                ({(assetData.documentos as unknown[]).length} arquivo{(assetData.documentos as unknown[]).length !== 1 ? "s" : ""})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Array.isArray(assetData.documentos) && (assetData.documentos as unknown[]).length > 0 ? (
            <div className="space-y-2">
              {(assetData.documentos as { nome: string; tamanho: number; tipo: string }[]).map((doc, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-[#162744] border border-[#243A66]">
                  <span className="text-xs text-[#F0ECE4]">{doc.nome}</span>
                  <span className="text-[10px] text-muted-foreground">{(doc.tamanho / 1024 / 1024).toFixed(1)} MB</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhum documento enviado.</p>
          )}
        </CardContent>
      </Card>

      {/* NDA / Mandato — Contrato e Assinatura */}
      <div>
        <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-3">
          Contrato e Assinatura
        </p>
        <ContratoPanel deal={deal} dealCode={deal.code} isDemo={IS_DEMO} />
      </div>

      {/* Atualizações do Deal */}
      <DealUpdatesClient
        dealId={deal.id}
        comments={Array.isArray(deal.comments) ? deal.comments : []}
        deal={{
          target_company:      deal.target_company,
          sector:              deal.sector,
          location:            deal.location ?? "",
          deal_value:          deal.deal_value,
          probability_percent: deal.probability_percent,
          notes:               deal.notes,
          stage:               deal.stage,
          asset_data:          assetData,
        }}
        userName={userName}
      />

    </div>
  );
}
