import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["ADMIN", "GESTAO", "SDR", "CLOSER"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const isAdmin = ["ADMIN", "GESTAO"].includes(profile?.role ?? "");

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const phone = req.nextUrl.searchParams.get("phone");

  // SDR/CLOSER só leem a conversa de leads sem dono ou já atribuídos a eles.
  if (phone && !isAdmin) {
    const { data: lead } = await svc.from("sdr_leads").select("responsavel_id").eq("phone", phone).maybeSingle();
    if (lead?.responsavel_id && lead.responsavel_id !== user.id) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
  }

  let query = svc
    .from("sdr_conversas")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(200);

  if (phone) query = query.eq("phone", phone);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ conversas: data });
}
