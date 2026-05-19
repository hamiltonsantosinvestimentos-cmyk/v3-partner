import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { data: profile } = await svc()
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "PARTNER") {
    return NextResponse.json({ eligible: false });
  }

  // Busca comissões pagas ou aprovadas do partner
  const { data: commissions } = await svc()
    .from("commissions")
    .select("amount, status")
    .eq("partner_id", user.id)
    .in("status", ["paid", "approved"]);

  const totalDeals = commissions?.length ?? 0;
  const totalAmount = commissions?.reduce((acc, c) => acc + (c.amount ?? 0), 0) ?? 0;

  // Ganho extra que teria se fosse PRO (50% vs 30%)
  const extraEarned = totalAmount * (50 / 30 - 1);

  const eligible = totalDeals >= 3 || totalAmount >= 5000;

  return NextResponse.json({
    eligible,
    totalDeals,
    totalAmount,
    extraEarned,
  });
}
