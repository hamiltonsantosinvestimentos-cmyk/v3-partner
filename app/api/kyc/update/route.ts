import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

const ALLOWED_ROLES = ["ADMIN", "MESA_OPERACIONAL"];

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED_ROLES.includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const { partner_id, kyc_status, kyc_data } = body;

  if (!partner_id) {
    return NextResponse.json({ error: "partner_id obrigatório" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (kyc_status !== undefined) updates.kyc_status = kyc_status;
  if (kyc_data !== undefined) updates.kyc_data = kyc_data;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
  }

  const { error } = await svc
    .from("profiles")
    .update(updates)
    .eq("id", partner_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
