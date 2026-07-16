import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { valor_face, desagio, tir, prazo_meses, commission_percent, divisao_partes, taxa_estruturacao, taxa_intermediacao } = body;

  if (!valor_face) {
    return NextResponse.json({ error: "Campo obrigatório: valor_face" }, { status: 422 });
  }
  if (!desagio && !tir) {
    return NextResponse.json({ error: "Informe desagio OU tir" }, { status: 422 });
  }

  const { data: financials } = await svc().rpc("calculate_cm_financials", {
    p_valor_face: Number(valor_face),
    p_desagio: desagio ? Number(desagio) : null,
    p_tir: tir ? Number(tir) : null,
    p_prazo_meses: prazo_meses ? Number(prazo_meses) : 12,
  });

  let commission = null;
  let commissionPrecision = null;
  if (commission_percent) {
    const { data: split } = await svc().rpc("calculate_cm_commission_split", {
      p_valor_face: Number(valor_face),
      p_commission_percent: Number(commission_percent),
    });
    commission = split;

    // Precisao de 4 casas decimais para o rateio percentual (resolve a dizima periodica
    // da "cordinha de caranguejo") — arredonda em cada etapa da divisao, nao na fracao exata.
    // Ex: 5% / 3 partes = 1.6667%, dividido por 2 lados (compra/venda) = 0.8334% por lado.
    // Correcao Mesa Operacional 2026-07-15.
    const partes = divisao_partes ? Number(divisao_partes) : 3;
    const estruturacao = taxa_estruturacao ? Number(taxa_estruturacao) : 0;
    const comissaoPorParte = Number((Number(commission_percent) / partes).toFixed(4));
    const comissaoSplitLado = Number((comissaoPorParte / 2).toFixed(4));
    const somaPercentuais = Number((Number(commission_percent) + estruturacao).toFixed(4));

    // Taxa de Intermediacao: campo separado e opcional (nao obrigatorio). So existe quando a V3
    // tambem atua como intermediaria na operacao (alem de estruturar), pode ser maior que a
    // Taxa de Estruturacao. Quando preenchida, marca a flag v3_atua_como_intermediaria.
    const v3AtuaComoIntermediaria = taxa_intermediacao !== undefined && taxa_intermediacao !== null && taxa_intermediacao !== "";
    const taxaIntermediacaoPercent = v3AtuaComoIntermediaria ? Number(taxa_intermediacao) : null;
    const comissaoTotalComIntermediacao = v3AtuaComoIntermediaria
      ? Number((Number(commission_percent) + Number(taxaIntermediacaoPercent)).toFixed(4))
      : null;

    commissionPrecision = {
      divisao_partes: partes,
      taxa_estruturacao_percent: estruturacao,
      comissao_por_parte_percent: comissaoPorParte,
      comissao_split_lado: comissaoSplitLado,
      diferenca_para_100_percent: Number((100 - somaPercentuais).toFixed(4)),
      v3_atua_como_intermediaria: v3AtuaComoIntermediaria,
      taxa_intermediacao_percent: taxaIntermediacaoPercent,
      comissao_total_com_intermediacao_percent: comissaoTotalComIntermediacao,
    };
  }

  return NextResponse.json({ financials, commission, commission_precision: commissionPrecision });
}
