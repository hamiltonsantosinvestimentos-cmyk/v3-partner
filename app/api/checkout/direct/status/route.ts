import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// GET — polling de status do pagamento (público, via order_id query param)
export async function GET(req: NextRequest) {
  const orderId = new URL(req.url).searchParams.get("order_id");
  if (!orderId) return NextResponse.json({ error: "order_id obrigatório" }, { status: 400 });

  const db = svc();
  const { data, error } = await db
    .from("partner_service_orders")
    .select("id, status, intake_token")
    .eq("id", orderId)
    .eq("source", "direct")
    .single();

  if (error || !data) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });

  return NextResponse.json({
    status: data.status,
    intake_token: data.status === "PAID" ? data.intake_token : null,
  });
}
