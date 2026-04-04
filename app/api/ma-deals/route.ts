import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { z } from "zod";
import { logAudit } from "@/lib/audit";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getAuthedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null, supabase };
  const { data: profile } = await supabase.from("profiles").select("id, full_name, role").eq("id", user.id).single();
  return { user, profile, supabase };
}

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

const createSchema = z.object({
  company: z.string().min(1, "Nome da empresa obrigatório").max(200),
  title:   z.string().max(200).optional(),
  sector:  z.string().max(100).optional().nullable(),
  value:   z.number().positive().optional().nullable(),
  notes:   z.string().max(2000).optional().nullable(),
  code:    z.string().max(50).optional(),
});

const patchSchema = z.object({
  id:                  z.string().uuid("ID inválido"),
  target_company:      z.string().min(1).max(200).optional(),
  sector:              z.string().max(100).optional().nullable(),
  deal_value:          z.number().positive().optional().nullable(),
  stage:               z.enum(["PROSPECTING","QUALIFICATION","DUE_DILIGENCE","NEGOTIATION","CLOSING","CLOSED_WON","CLOSED_LOST"]).optional(),
  probability_percent: z.number().int().min(0).max(100).optional().nullable(),
  notes:               z.string().max(2000).optional().nullable(),
  assigned_to:         z.string().uuid().optional().nullable(),
  expected_close_date: z.string().optional().nullable(),
});

// GET — lista deals (partner vê os seus, admin vê todos)
export async function GET(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = serviceClient();
  const { searchParams } = new URL(req.url);
  const stage = searchParams.get("stage");
  const isAdmin = ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number]);

  let query = svc
    .from("ma_deals")
    .select(`
      id, code, title, target_company, sector, deal_value, ebitda_multiple,
      stage, probability_percent, expected_close_date, created_at, notes, assigned_to,
      partner:profiles!ma_deals_assigned_to_fkey(id, full_name)
    `)
    .order("created_at", { ascending: false });

  if (!isAdmin) {
    query = query.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`);
  }
  if (stage) {
    query = query.eq("stage", stage.toUpperCase());
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deals: data ?? [] });
}

// POST — cria novo deal M&A
export async function POST(req: NextRequest) {
  const { user, profile, supabase } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const d = parsed.data;

  const { count } = await supabase.from("ma_deals").select("*", { count: "exact", head: true });
  const code = d.code ?? `MA-26-${String((count ?? 0) + 1).padStart(3, "0")}`;

  const { data, error } = await supabase.from("ma_deals").insert({
    code,
    title:               d.company,
    target_company:      d.company,
    sector:              d.sector ?? null,
    deal_value:          d.value ?? null,
    stage:               "PROSPECTING",
    probability_percent: 10,
    notes:               d.notes ?? null,
    assigned_to:         user.id,
    created_by:          user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    card: {
      id:          data.id,
      code:        data.code,
      company:     data.target_company,
      sector:      data.sector ?? "",
      value:       data.deal_value ?? 0,
      stage:       "prospeccao",
      responsible: profile?.full_name ?? "Partner",
      probability: data.probability_percent ?? 10,
      createdAt:   data.created_at?.split("T")[0] ?? "",
      notes:       data.notes ?? "",
    },
  });
}

// PATCH — atualiza deal (stage, valor, notas, assigned_to)
export async function PATCH(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { id, ...fields } = parsed.data;
  const svc = serviceClient();
  const isAdmin = ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number]);

  // Verifica ownership se não é admin
  if (!isAdmin) {
    const { data: existing } = await svc
      .from("ma_deals").select("assigned_to, created_by").eq("id", id).single();
    if (!existing || (existing.assigned_to !== user.id && existing.created_by !== user.id)) {
      return NextResponse.json({ error: "Sem permissão para editar este deal" }, { status: 403 });
    }
  }

  const { data, error } = await svc
    .from("ma_deals")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAudit({ userId: user.id, userName: profile?.full_name, action: "UPDATE", entity: "ma_deals", entityId: id, newData: fields as Record<string, unknown> });

  return NextResponse.json({ ok: true, deal: data });
}

// DELETE — somente ADMIN
export async function DELETE(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (profile?.role !== "ADMIN") {
    return NextResponse.json({ error: "Apenas administradores podem excluir deals" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  const { error } = await serviceClient().from("ma_deals").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAudit({ userId: user.id, userName: profile?.full_name, action: "DELETE", entity: "ma_deals", entityId: id });

  return NextResponse.json({ ok: true });
}
