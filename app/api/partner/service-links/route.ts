import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "PARTNER", "PARTNER_PRO", "MESA_OPERACIONAL"];

// GET — lista links do partner autenticado
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED_ROLES.includes((profile as { role: string } | null)?.role ?? "")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const db = svc();
  const isAdmin = ["ADMIN", "GESTAO"].includes((profile as { role: string }).role);

  const query = db
    .from("partner_service_links")
    .select(`
      id, token, title, service_type, description, price_cents,
      active, total_uses, total_paid_cents, created_at,
      partner_service_orders(count)
    `)
    .order("created_at", { ascending: false });

  if (!isAdmin) query.eq("partner_id", user.id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ links: data ?? [] });
}

// POST — cria novo link de serviço
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role, full_name").eq("id", user.id).single();
  const p = profile as { role: string; full_name: string } | null;
  if (!ALLOWED_ROLES.includes(p?.role ?? "")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = await req.json() as {
    title?: string;
    service_type?: string;
    description?: string;
    price_cents?: number;
  };

  if (!body.title?.trim()) return NextResponse.json({ error: "Título obrigatório" }, { status: 400 });

  const VALID_TYPES = ["credit_analysis", "ma_intake", "due_diligence", "captacao"];
  if (!VALID_TYPES.includes(body.service_type ?? "")) {
    return NextResponse.json({ error: "Tipo de serviço inválido" }, { status: 400 });
  }

  const token = randomBytes(20).toString("hex");
  const db = svc();

  const { data, error } = await db
    .from("partner_service_links")
    .insert({
      partner_id:   user.id,
      token,
      title:        body.title.trim(),
      service_type: body.service_type,
      description:  body.description?.trim() ?? null,
      price_cents:  Math.max(0, Math.round(body.price_cents ?? 0)),
      active:       true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, link: data });
}

// PATCH — ativa/desativa link
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json() as { id?: string; active?: boolean };
  if (!body.id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  const db = svc();
  const { error } = await db
    .from("partner_service_links")
    .update({ active: body.active })
    .eq("id", body.id)
    .eq("partner_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
