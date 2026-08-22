import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

const PARTNER_ROLES = ["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// GET — histórico de mensagens de um contato (?phone=...), escopado ao
// próprio partner_id. Espelha /api/sdr/conversas.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!PARTNER_ROLES.includes(profile?.role as typeof PARTNER_ROLES[number])) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const db = svc();
  const { data: conexao } = await db.from("partner_sdr_connections").select("addon_ativo").eq("partner_id", user.id).maybeSingle();
  if (!conexao?.addon_ativo) return NextResponse.json({ error: "Add-on não contratado" }, { status: 403 });

  const phone = req.nextUrl.searchParams.get("phone");
  let query = db
    .from("sdr_conversas")
    .select("*")
    .eq("partner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(200);
  if (phone) query = query.eq("phone", phone);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ conversas: data });
}
