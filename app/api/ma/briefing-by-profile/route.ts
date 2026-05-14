import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

export const maxDuration = 60;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

function formatM(v: number | null): string {
  if (!v) return "—";
  if (v >= 1e9) return `R$ ${(v/1e9).toFixed(1)}B`;
  if (v >= 1e6) return `R$ ${(v/1e6).toFixed(1)}M`;
  if (v >= 1e3) return `R$ ${(v/1e3).toFixed(0)}K`;
  return `R$ ${v}`;
}

/**
 * GET /api/ma/briefing-by-profile?investor_id=...
 *
 * Varre todas as fontes de oportunidade compatíveis com um investor_profile:
 * 1. ma_deals (via match_investors_for_deal em sentido inverso)
 * 2. deal_intakes compatíveis
 * 3. deal_opportunities já detectadas compatíveis
 * 4. generated_reports não escaneados (retorna IDs para scan)
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED.includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }

  const investor_id = new URL(req.url).searchParams.get("investor_id");
  if (!investor_id) return NextResponse.json({ error: "investor_id obrigatório" }, { status: 400 });

  // Buscar perfil do investidor
  const { data: inv } = await db
    .from("investor_profiles")
    .select("*")
    .eq("id", investor_id).single();

  if (!inv) return NextResponse.json({ error: "Investidor não encontrado" }, { status: 404 });

  const setores:    string[] = inv.setores ?? [];
  const ufs:        string[] = inv.ufs ?? [];
  const ticketMin:  number   = inv.ticket_min ?? 0;
  const ticketMax:  number   = inv.ticket_max ?? Number.MAX_SAFE_INTEGER;

  // ── 1. ma_deals compatíveis ───────────────────────────────────────────────
  let dealsQuery = db
    .from("ma_deals")
    .select("id, code, target_company, sector, location, deal_value, stage, asset_data");

  if (setores.length > 0) dealsQuery = dealsQuery.in("sector", setores);

  const { data: allDeals } = await dealsQuery.order("deal_value", { ascending: false }).limit(50);

  const dealsMatch = (allDeals ?? []).filter(d => {
    const v = Number(d.deal_value ?? 0);
    const uf = (d.asset_data as Record<string, unknown>)?.uf_extraido as string | undefined;
    const inTicket = (!ticketMin || v >= ticketMin) && (!ticketMax || v <= ticketMax);
    const inUf = ufs.length === 0 || (uf && ufs.includes(uf));
    return inTicket && inUf;
  });

  // ── 2. deal_intakes compatíveis ───────────────────────────────────────────
  let intakesQuery = db
    .from("deal_intakes")
    .select("id, empresa_nome, setor, valor_estimado, tipo_operacao, observacoes, created_at")
    .eq("status", "novo");

  if (setores.length > 0) intakesQuery = intakesQuery.in("setor", setores);

  const { data: allIntakes } = await intakesQuery.order("created_at", { ascending: false }).limit(30);

  const intakesMatch = (allIntakes ?? []).filter(i => {
    const v = Number(i.valor_estimado ?? 0);
    return (!ticketMin || v >= ticketMin) && (!ticketMax || v <= ticketMax);
  });

  // ── 3. deal_opportunities já detectadas compatíveis ──────────────────────
  let oppsQuery = db
    .from("deal_opportunities")
    .select("id, empresa_blind, setor, uf, valor_estimado, tipo_operacao, descricao, contexto, score_relevancia, source_type, created_at")
    .eq("status", "novo");

  if (setores.length > 0) oppsQuery = oppsQuery.in("setor", setores);

  const { data: allOpps } = await oppsQuery.order("score_relevancia", { ascending: false }).limit(30);

  const oppsMatch = (allOpps ?? []).filter(o => {
    const v = Number(o.valor_estimado ?? 0);
    const inTicket = !v || ((!ticketMin || v >= ticketMin) && (!ticketMax || v <= ticketMax));
    const inUf = ufs.length === 0 || !o.uf || ufs.includes(o.uf);
    return inTicket && inUf;
  });

  // ── 4. Relatórios não escaneados ainda ────────────────────────────────────
  const { data: unscannedReports } = await db
    .from("generated_reports")
    .select("id, title, squad_id, created_at")
    .is("opportunities_scanned_at", null)
    .order("created_at", { ascending: false })
    .limit(10);

  // ── Montar resumo ─────────────────────────────────────────────────────────
  const totalFound = dealsMatch.length + intakesMatch.length + oppsMatch.length;

  return NextResponse.json({
    ok:   true,
    investor: {
      id:    inv.id,
      nome:  inv.nome,
      tipo:  inv.tipo,
      criterios_ativos: {
        setores:    setores,
        ufs:        ufs,
        ticket_min: formatM(inv.ticket_min),
        ticket_max: formatM(inv.ticket_max),
      },
    },
    resumo: {
      total_encontrado:      totalFound,
      deals_pipeline:        dealsMatch.length,
      intakes_w2:            intakesMatch.length,
      oportunidades_detectadas: oppsMatch.length,
      relatorios_nao_escaneados: (unscannedReports ?? []).length,
    },
    fontes: {
      // Deals do pipeline M&A
      deals: dealsMatch.map(d => ({
        id:       d.id,
        code:     d.code,
        empresa:  d.target_company,
        setor:    d.sector,
        valor:    formatM(Number(d.deal_value)),
        stage:    d.stage,
        uf:       (d.asset_data as Record<string, unknown>)?.uf_extraido ?? null,
        forja:    (d.asset_data as Record<string, unknown>)?.forja_status ?? null,
        fonte:    "pipeline_ma",
      })),

      // Leads do W2 n8n
      intakes: intakesMatch.map(i => ({
        id:        i.id,
        empresa:   i.empresa_nome,
        setor:     i.setor,
        valor:     formatM(Number(i.valor_estimado)),
        operacao:  i.tipo_operacao,
        obs:       i.observacoes,
        data:      i.created_at,
        fonte:     "intake_w2",
      })),

      // Oportunidades detectadas por IA em relatórios
      oportunidades: oppsMatch.map(o => ({
        id:           o.id,
        empresa:      o.empresa_blind,
        setor:        o.setor,
        uf:           o.uf,
        valor:        formatM(Number(o.valor_estimado)),
        operacao:     o.tipo_operacao,
        descricao:    o.descricao,
        contexto:     o.contexto,
        score:        o.score_relevancia,
        fonte:        `relatorio_${o.source_type}`,
        data:         o.created_at,
      })),

      // Relatórios pendentes de escaneamento
      relatorios_pendentes: (unscannedReports ?? []).map(r => ({
        id:       r.id,
        titulo:   r.title?.slice(0, 80),
        squad:    r.squad_id,
        data:     r.created_at,
        acao:     `POST /api/ma/detect-opportunities { report_id: "${r.id}", save: true }`,
      })),
    },
  });
}
