import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function requireAdmin(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["ADMIN", "GESTAO"].includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

export async function GET(req: NextRequest) {
  const caller = await requireAdmin(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const vertical = new URL(req.url).searchParams.get("vertical");

  let query = svc()
    .from("contract_templates")
    .select("*")
    .eq("is_active", true)
    .order("vertical")
    .order("template_name");

  if (vertical) query = query.eq("vertical", vertical);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(req: NextRequest) {
  const caller = await requireAdmin(req);
  if (!caller || caller.role !== "ADMIN")
    return NextResponse.json({ error: "Apenas ADMIN pode criar templates" }, { status: 403 });

  const { template_name, vertical, body_text_raw, variables_map } = await req.json();

  if (!template_name || !vertical || !body_text_raw)
    return NextResponse.json({ error: "template_name, vertical e body_text_raw obrigatórios" }, { status: 422 });

  const vars = (body_text_raw.match(/\{\{([^}]+)\}\}/g) || []).map((v: string) => v.replace(/\{\{|\}\}/g, "").trim());

  const { data, error } = await svc()
    .from("contract_templates")
    .insert({
      template_name,
      vertical,
      body_text_raw,
      variables_map: variables_map ?? vars.map((v: string) => ({ key: v, label: v.replace(/_/g, " "), source: "auto" })),
      created_by: caller.userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data }, { status: 201 });
}
