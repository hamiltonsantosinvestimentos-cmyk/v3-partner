import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

// GET — agregados publicos de volume em originacao por vertical, para a
// animacao de contadores do site institucional (v3partners.com.br).
//
// Expoe SOMENTE somas arredondadas, nunca linha de deal/proposta/carta
// individual, nome de cliente, CPF/CNPJ ou qualquer outro dado sensivel.
// A definicao de "volume em originacao" foi confirmada por Joao Lemos em
// 12/08/2026: soma tudo que esta ativo no funil (nao descartado/recusado),
// nao apenas o que ja fechou — porque hoje quase nada fechou ainda, e um
// numero "so fechado" ficaria proximo de zero em quase toda vertical.
//
// Janela de 90 dias (adicionada 13/08/2026, decisao explicita de Joao):
// na checagem de 12/08 nenhuma linha do banco passava de 180 dias, entao a
// janela ainda nao mudava o numero de verdade — mas sem ela, um deal parado
// ha 1+ ano em PROSPECTING continuaria contando pra sempre, inflando o
// numero aos poucos. Corte por created_at, aplicado nas 3 fontes.
//
// Fontes reais, cada uma documentada porque a definicao de "ativo" varia
// por tabela:
//   - ma_deals: soma deal_value de tudo que nao foi soft-deletado e foi
//     criado nos ultimos 90 dias. Os 5 stages reais hoje (PROSPECTING/
//     QUALIFICATION/NEGOTIATION/PROPOSAL/DUE_DILIGENCE) sao todos pipeline
//     ativo — nao existe stage de "deal perdido/descartado" hoje.
//   - credit_desk_proposals: soma requested_value dos ultimos 90 dias,
//     EXCLUINDO stage DECLINADO e REPROVADO (a Mesa ja recusou essas
//     propostas — contar como "em originacao" seria enganoso). Junta com
//     regras_linhas_credito via credit_line_id para separar nacional/
//     internacional; propostas sem credit_line_id (legado) entram no total
//     geral de credito mas nao no subconjunto internacional, por falta de
//     classificacao real.
//   - consorcio_cartas: soma credit_value dos ultimos 90 dias, de tudo que
//     nao foi soft-deletado (hoje so existem os status DISPONIVEL e
//     NEGOCIACAO em producao). NOTA: em 12/08/2026 as 263 linhas reais
//     tinham created_at no mesmo dia, sinal de reimportacao/migracao em
//     massa, nao de cadastro real naquele dia — entao o corte de 90 dias
//     nao filtra nada hoje, mas passa a filtrar de verdade assim que o
//     dado tiver historico real.
export const revalidate = 21600; // 6h
const WINDOW_DAYS = 90;

const ALLOWED_ORIGINS = [
  "https://v3partners.com.br",
  "https://www.v3partners.com.br",
];

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const CREDIT_EXCLUDED_STAGES = ["DECLINADO", "REPROVADO"];

export async function GET(req: NextRequest) {
  const headers = corsHeaders(req.headers.get("origin"));
  const supabase = svc();

  const cutoffIso = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [maRes, creditRes, linhasRes, consorcioRes] = await Promise.all([
    supabase.from("ma_deals").select("deal_value").is("deleted_at", null).gte("created_at", cutoffIso),
    supabase
      .from("credit_desk_proposals")
      .select("requested_value, credit_line_id, stage")
      .is("deleted_at", null)
      .gte("created_at", cutoffIso),
    supabase.from("regras_linhas_credito").select("id, escopo"),
    supabase.from("consorcio_cartas").select("credit_value").is("deleted_at", null).gte("created_at", cutoffIso),
  ]);

  if (maRes.error || creditRes.error || linhasRes.error || consorcioRes.error) {
    return NextResponse.json(
      { error: "Falha ao calcular estatisticas" },
      { status: 500, headers }
    );
  }

  const maTotal = (maRes.data ?? []).reduce((sum, r) => sum + (r.deal_value ?? 0), 0);

  const escopoByLinha = new Map((linhasRes.data ?? []).map((l) => [l.id, l.escopo]));
  let creditoTotal = 0;
  let creditoInternacional = 0;
  for (const r of creditRes.data ?? []) {
    if (CREDIT_EXCLUDED_STAGES.includes(r.stage ?? "")) continue;
    const valor = r.requested_value ?? 0;
    creditoTotal += valor;
    if (r.credit_line_id && escopoByLinha.get(r.credit_line_id) === "internacional") {
      creditoInternacional += valor;
    }
  }

  const consorcioTotal = (consorcioRes.data ?? []).reduce((sum, r) => sum + (r.credit_value ?? 0), 0);

  return NextResponse.json(
    {
      ma: Math.round(maTotal),
      credito: Math.round(creditoTotal),
      credito_internacional: Math.round(creditoInternacional),
      consorcio: Math.round(consorcioTotal),
      updated_at: new Date().toISOString(),
    },
    { headers }
  );
}
