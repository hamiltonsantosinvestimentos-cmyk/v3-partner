import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

const ALLOWED = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
const EDITABLE_STATUSES = ["draft"];

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };
  const { data: profile } = await svc().from("profiles").select("id, full_name, role").eq("id", user.id).single();
  return { user, profile };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, profile } = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED.includes(profile?.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await svc()
    .from("commercial_proposals")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ proposal: data });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, profile } = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED.includes(profile?.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: existing } = await svc()
    .from("commercial_proposals").select("status").eq("id", id).single();

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!EDITABLE_STATUSES.includes(existing.status)) {
    return NextResponse.json({ error: "Apenas propostas em rascunho podem ser editadas" }, { status: 422 });
  }

  const body = await req.json();
  const allowed_fields = ["title", "service_type", "recipient_name", "recipient_email",
    "recipient_company", "value", "description", "deal_id",
    "partner_id", "partner_name", "partner_email"];
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed_fields.includes(k)));

  const { error } = await svc().from("commercial_proposals").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
