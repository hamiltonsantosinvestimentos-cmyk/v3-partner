import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "ADMIN") return null;
  return user.id;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireAdmin();
  if (!userId) return NextResponse.json({ error: "Apenas ADMIN" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { template_name, body_text_raw, is_active } = body;

  const updates: Record<string, any> = {};
  if (template_name !== undefined) updates.template_name = template_name;
  if (is_active !== undefined) updates.is_active = is_active;
  if (body_text_raw !== undefined) {
    updates.body_text_raw = body_text_raw;
    updates.version = svc().rpc("", {});
    const vars = (body_text_raw.match(/\{\{([^}]+)\}\}/g) || []).map((v: string) => v.replace(/\{\{|\}\}/g, "").trim());
    updates.variables_map = vars.map((v: string) => ({ key: v, label: v.replace(/_/g, " "), source: "auto" }));
  }

  const { data: current } = await svc().from("contract_templates").select("version").eq("id", id).single();
  if (body_text_raw !== undefined) updates.version = (current?.version ?? 0) + 1;

  const { data, error } = await svc()
    .from("contract_templates")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireAdmin();
  if (!userId) return NextResponse.json({ error: "Apenas ADMIN" }, { status: 403 });

  const { id } = await params;
  const { error } = await svc()
    .from("contract_templates")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
