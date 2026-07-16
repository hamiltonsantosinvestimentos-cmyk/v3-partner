import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** GET /api/cm/deal-intermediaries/fill/[token] — contexto publico p/ o Mandatario preencher */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data: fillToken } = await svc()
    .from("cm_intermediary_fill_tokens")
    .select("id, listing_id, side, status, mandatario_partner_id, cm_asset_listings(anonymous_id), profiles(full_name)")
    .eq("token", token)
    .single();

  if (!fillToken) return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });

  if (fillToken.status === "preenchido") {
    return NextResponse.json({
      status: "preenchido",
      anonymous_id: (fillToken.cm_asset_listings as any)?.anonymous_id,
      side: fillToken.side,
    });
  }

  return NextResponse.json({
    status: "pendente",
    anonymous_id: (fillToken.cm_asset_listings as any)?.anonymous_id,
    side: fillToken.side,
    mandatario_nome: (fillToken.profiles as any)?.full_name,
  });
}

/** POST /api/cm/deal-intermediaries/fill/[token] — Mandatario envia a distribuicao de percentuais */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data: fillToken } = await svc()
    .from("cm_intermediary_fill_tokens")
    .select("id, listing_id, side, status, mandatario_partner_id")
    .eq("token", token)
    .single();

  if (!fillToken) return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });
  if (fillToken.status === "preenchido") {
    return NextResponse.json({ error: "Este link já foi preenchido. Solicite um novo à Mesa V3." }, { status: 409 });
  }

  const body = await req.json();
  const rows: { intermediary_name: string; intermediary_document?: string; percentage: number }[] = body.rows;

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "Informe ao menos um intermediário" }, { status: 422 });
  }
  if (rows.some((r) => !r.intermediary_name?.trim() || !r.percentage)) {
    return NextResponse.json({ error: "Cada linha precisa de nome e percentual" }, { status: 422 });
  }

  const somaPercentual = rows.reduce((s, r) => s + Number(r.percentage), 0);
  if (Math.abs(somaPercentual - 100) > 0.01) {
    return NextResponse.json({ error: `Os percentuais somam ${somaPercentual}%, precisam somar exatamente 100%` }, { status: 422 });
  }

  const { error: insertError } = await svc()
    .from("cm_deal_intermediaries")
    .insert(
      rows.map((r) => ({
        listing_id: fillToken.listing_id,
        side: fillToken.side,
        mandatario_partner_id: fillToken.mandatario_partner_id,
        intermediary_name: r.intermediary_name.trim(),
        intermediary_document: r.intermediary_document?.trim() || null,
        percentage: Number(r.percentage),
      }))
    );

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  await svc()
    .from("cm_intermediary_fill_tokens")
    .update({ status: "preenchido", submitted_at: new Date().toISOString() })
    .eq("id", fillToken.id);

  return NextResponse.json({ success: true });
}
