import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as supabaseServiceClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json();
  const { commission_id, score, comment } = body as {
    commission_id?: string;
    score: number;
    comment?: string;
  };

  if (typeof score !== "number" || score < 0 || score > 10) {
    return NextResponse.json({ error: "Score inválido (0-10)" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("nps_responses")
    .insert({
      partner_id: user.id,
      commission_id: commission_id ?? null,
      score,
      comment: comment ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ response: data });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Check admin/gestao role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["ADMIN", "GESTAO"].includes(profile.role)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const svc = supabaseServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await svc
    .from("nps_responses")
    .select(`
      id,
      score,
      comment,
      created_at,
      commission_id,
      partner_id,
      profiles!nps_responses_partner_id_fkey (
        full_name,
        email
      )
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ responses: data ?? [] });
}
