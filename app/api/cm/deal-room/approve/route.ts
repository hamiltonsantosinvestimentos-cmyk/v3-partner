import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getCaller(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile || !["ADMIN", "GESTAO"].includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ error: "Apenas ADMIN/GESTAO" }, { status: 403 });

  const { access_id, decision } = await req.json();
  if (!access_id || !["aprovado", "reprovado"].includes(decision))
    return NextResponse.json({ error: "access_id e decision (aprovado/reprovado) obrigatorios" }, { status: 422 });

  const { data: access } = await svc()
    .from("cm_deal_room_access")
    .select("id, qualification_status, access_tier")
    .eq("id", access_id)
    .single();

  if (!access) return NextResponse.json({ error: "Acesso nao encontrado" }, { status: 404 });

  const update: Record<string, any> = {
    qualification_status: decision,
    qualified_by: caller.userId,
    qualified_at: new Date().toISOString(),
  };

  if (decision === "aprovado") {
    update.access_tier = "qualified";
  }

  const { error } = await svc()
    .from("cm_deal_room_access")
    .update(update)
    .eq("id", access_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, decision, access_tier: update.access_tier ?? access.access_tier });
}
