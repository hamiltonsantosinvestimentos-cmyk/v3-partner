import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

// Rota pública — sem Supabase Auth. Acesso via token único do Deal Room, lado buyer.
function svc() {
  return sc(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type RouteContext = { params: Promise<{ token: string }> };

type PedidoCompraBody = {
  empresa?: string;
  cnpj?: string;
  contato_nome?: string;
  contato_email?: string;
  contato_telefone?: string;
  observacoes?: string;
};

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as PedidoCompraBody;

  if (!body.empresa?.trim() || !body.contato_nome?.trim() || !body.contato_email?.trim()) {
    return NextResponse.json({ error: "empresa, contato_nome e contato_email são obrigatórios" }, { status: 422 });
  }

  const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
                 ?? req.headers.get("x-real-ip")
                 ?? "unknown";

  const db = svc();

  // Validar token e checar lado do acesso
  const { data: invite, error } = await db
    .from("deal_room_invites")
    .select("id, status, token_expires_at, access_side, deal_rooms(deal_id)")
    .eq("token", token)
    .single();

  if (error || !invite) {
    return NextResponse.json({ error: "Link inválido ou não encontrado." }, { status: 404 });
  }

  if (invite.status === "revoked") {
    return NextResponse.json({ error: "Este link foi revogado." }, { status: 410 });
  }

  if (new Date(invite.token_expires_at) < new Date()) {
    return NextResponse.json({ error: "Este link expirou." }, { status: 410 });
  }

  if (invite.access_side !== "buyer") {
    return NextResponse.json({ error: "Pedido de compra disponível apenas para acesso do lado comprador." }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dealId = (invite.deal_rooms as any)?.deal_id as string | undefined;
  if (!dealId) {
    return NextResponse.json({ error: "Deal não encontrado para esta sala." }, { status: 404 });
  }

  const { data: deal, error: dealErr } = await db
    .from("ma_deals")
    .select("asset_data")
    .eq("id", dealId)
    .single();

  if (dealErr || !deal) {
    return NextResponse.json({ error: "Erro ao carregar deal." }, { status: 500 });
  }

  const assetData = (deal.asset_data as Record<string, unknown>) ?? {};
  assetData.pedido_compra = {
    empresa: body.empresa.trim(),
    cnpj: body.cnpj?.trim() || null,
    contato_nome: body.contato_nome.trim(),
    contato_email: body.contato_email.trim(),
    contato_telefone: body.contato_telefone?.trim() || null,
    observacoes: body.observacoes?.trim() || null,
    submitted_via_invite_id: invite.id,
    submitted_ip: ipAddress,
    submitted_at: new Date().toISOString(),
  };

  const { error: updateErr } = await db
    .from("ma_deals")
    .update({ asset_data: assetData })
    .eq("id", dealId);

  if (updateErr) {
    return NextResponse.json({ error: "Erro ao salvar pedido de compra." }, { status: 500 });
  }

  return NextResponse.json({ saved: true, saved_at: new Date().toISOString() });
}
