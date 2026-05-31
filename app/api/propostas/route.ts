import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

const BLOCKED_META_KEYS = ["cpf", "cnpj", "document", "documento"];
const ALLOWED = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

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

export async function GET() {
  const { user, profile } = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED.includes(profile?.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await svc()
    .from("commercial_proposals")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ proposals: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { user, profile } = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED.includes(profile?.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { title, service_type, recipient_name, recipient_email, recipient_company,
          value, description, deal_id, partner_id, partner_name, partner_email } = body;

  if (!title?.trim() || !recipient_name?.trim() || !recipient_email?.trim()) {
    return NextResponse.json({ error: "title, recipient_name e recipient_email são obrigatórios" }, { status: 422 });
  }

  // Sanitizar metadata — BLOCO-04 compliance
  const rawMeta = body.metadata ?? {};
  const safeMetadata = Object.fromEntries(
    Object.entries(rawMeta).filter(([k]) => !BLOCKED_META_KEYS.includes(k.toLowerCase()))
  );

  const { count } = await svc().from("commercial_proposals").select("*", { count: "exact", head: true });
  const code = `PRO-26-${String((count ?? 0) + 1).padStart(4, "0")}`;

  const { data, error } = await svc()
    .from("commercial_proposals")
    .insert({
      code, title: title.trim(), service_type: service_type ?? "outro",
      recipient_name: recipient_name.trim(),
      recipient_email: recipient_email.trim().toLowerCase(),
      recipient_company: recipient_company?.trim() ?? null,
      value: value ? Number(value) : null,
      description: description?.trim() ?? null,
      deal_id: deal_id || null,
      partner_id: partner_id || null,
      partner_name: partner_name?.trim() ?? null,
      partner_email: partner_email?.trim().toLowerCase() ?? null,
      created_by: user.id,
      status: "draft",
      metadata: safeMetadata,
    })
    .select()
    .single();

  if (error) {
    void svc().from("execution_errors").insert({ workflow: "api/propostas POST", error_message: error.message, severity: "medium" });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ proposal: data });
}
