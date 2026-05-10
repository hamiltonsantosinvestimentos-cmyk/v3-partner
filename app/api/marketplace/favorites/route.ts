import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** GET /api/marketplace/favorites — partner's favorited products */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = serviceClient();
  const { data, error } = await svc
    .from("marketplace_favorites")
    .select("product_id")
    .eq("partner_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ favorites: (data ?? []).map(f => f.product_id) });
}

/** POST /api/marketplace/favorites — add favorite */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { product_id } = await req.json();
  if (!product_id) return NextResponse.json({ error: "product_id obrigatório" }, { status: 400 });

  const svc = serviceClient();
  const { error } = await svc
    .from("marketplace_favorites")
    .upsert({ partner_id: user.id, product_id }, { onConflict: "partner_id,product_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/** DELETE /api/marketplace/favorites — remove favorite */
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { product_id } = await req.json();
  if (!product_id) return NextResponse.json({ error: "product_id obrigatório" }, { status: 400 });

  const svc = serviceClient();
  const { error } = await svc
    .from("marketplace_favorites")
    .delete()
    .eq("partner_id", user.id)
    .eq("product_id", product_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
