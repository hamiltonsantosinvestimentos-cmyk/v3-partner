import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const profileData = profile as { role?: string } | null;
  const isAdmin = ["ADMIN", "GESTAO"].includes(profileData?.role ?? "");

  const quinzeDiasAtras = new Date();
  quinzeDiasAtras.setDate(quinzeDiasAtras.getDate() - 15);

  let query = supabase
    .from("crm_leads")
    .select("id", { count: "exact", head: true })
    .not("status", "in", '("won","lost","ganho","perdido")')
    .lt("updated_at", quinzeDiasAtras.toISOString());

  if (!isAdmin) {
    query = query.eq("partner_id", user.id);
  }

  const { count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ count: count ?? 0 });
}
