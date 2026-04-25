import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// GET — lista audit logs (ADMIN/GESTAO only)
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!["ADMIN", "GESTAO"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const entity    = searchParams.get("entity");
  const entityId  = searchParams.get("entity_id");
  const userId    = searchParams.get("user_id");
  const limit     = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);

  const svc = serviceClient();
  let query = svc
    .from("audit_logs")
    .select("id, user_id, user_name, action, entity, entity_id, new_data, old_data, ip_address, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (entity)   query = query.eq("entity", entity);
  if (entityId) query = query.eq("entity_id", entityId);
  if (userId)   query = query.eq("user_id", userId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data ?? [] });
}

// POST — registrar uma ação de auditoria (uso interno via server-side)
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role, full_name, email").eq("id", user.id).single();
  if (!["ADMIN", "GESTAO", "FINANCEIRO"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }

  const body = await req.json();
  const { action, entity, entity_id, new_data, old_data } = body;

  const svc = serviceClient();
  const { error: insErr } = await svc.from("audit_logs").insert({
    user_id: user.id,
    user_name: (profile as { role: string; full_name: string | null; email: string } | null)?.full_name ?? (profile as { role: string; full_name: string | null; email: string } | null)?.email ?? user.email,
    action,
    entity,
    entity_id,
    new_data: new_data ?? null,
    old_data: old_data ?? null,
    ip_address: req.headers.get("x-forwarded-for") ?? null,
  });

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
