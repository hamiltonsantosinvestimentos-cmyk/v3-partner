import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** GET /api/marketplace/reviews?product_id=X */
export async function GET(req: NextRequest) {
  const productId = new URL(req.url).searchParams.get("product_id");
  if (!productId) return NextResponse.json({ error: "product_id obrigatório" }, { status: 400 });

  const svc = serviceClient();
  const { data, error } = await svc
    .from("marketplace_product_reviews")
    .select("id, rating, comment, created_at, partner:profiles(full_name)")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reviews: data ?? [] });
}

/** POST /api/marketplace/reviews — partner submits review */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { product_id, rating, comment } = await req.json();
  if (!product_id || !rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "product_id e rating (1-5) obrigatórios" }, { status: 400 });
  }

  const svc = serviceClient();
  const { data, error } = await svc
    .from("marketplace_product_reviews")
    .upsert(
      { product_id, partner_id: user.id, rating, comment: comment ?? null },
      { onConflict: "partner_id,product_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ review: data }, { status: 201 });
}
