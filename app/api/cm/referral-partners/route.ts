import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

async function getCaller(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

/** GET /api/cm/referral-partners — lista partners de referencia leves (sem login) */
export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data, error } = await svc()
    .from("cm_referral_partners")
    .select("id, full_name, contact")
    .order("full_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ partners: data ?? [] });
}

/** POST /api/cm/referral-partners — cria um novo partner de referencia leve */
export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { full_name, contact } = await req.json();
  if (!full_name || !full_name.trim()) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 422 });
  }

  const { data, error } = await svc()
    .from("cm_referral_partners")
    .insert({ full_name: full_name.trim(), contact: contact?.trim() || null, created_by: caller.userId })
    .select("id, full_name, contact")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ partner: data }, { status: 201 });
}
