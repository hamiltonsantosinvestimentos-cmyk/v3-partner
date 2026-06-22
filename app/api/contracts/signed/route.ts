import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function requireRole(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["ADMIN", "GESTAO"].includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

export async function GET(req: NextRequest) {
  const caller = await requireRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data, error } = await svc()
    .from("operation_contracts")
    .select("id, contract_title, vertical, status_signature, signed_at, commission_percent, parties, created_at")
    .eq("status_signature", "assinado")
    .order("signed_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const grouped: Record<string, any[]> = {};
  for (const c of data ?? []) {
    const v = c.vertical ?? "outros";
    if (!grouped[v]) grouped[v] = [];
    grouped[v].push(c);
  }

  return NextResponse.json({ contracts: data ?? [], grouped });
}
