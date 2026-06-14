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
  if (!user) return { user: null, profile: null };
  const { data: profile } = await supabase.from("profiles").select("id, full_name, role").eq("id", user.id).single();
  return { user, profile };
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

const createSchema = z.object({
  category:      z.enum(["voo", "carro", "locacao"]),
  title:         z.string().min(3, "Título muito curto").max(200),
  origin:        z.string().max(120).optional().nullable(),
  destination:   z.string().max(120).optional().nullable(),
  start_date:    z.string().optional().nullable(),
  end_date:      z.string().optional().nullable(),
  provider:      z.string().max(120).optional().nullable(),
  target_price:  z.number().optional().nullable(),
  current_price: z.number().optional().nullable(),
  currency:      z.string().max(8).default("BRL"),
  status:        z.enum(["monitorando", "reservado", "concluido", "cancelado"]).default("monitorando"),
  notes:         z.string().max(2000).optional().nullable(),
});

// GET — lista itens de logística por categoria
export async function GET(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(profile?.role as typeof ALLOWED_ROLES[number])) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");

  const svc = serviceClient();
  let query = svc.from("logistics_items").select("*").order("start_date", { ascending: true, nullsFirst: false });
  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

// POST — cria novo item de logística
export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(profile?.role as typeof ALLOWED_ROLES[number])) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const d = parsed.data;

  const svc = serviceClient();
  const { data, error } = await svc.from("logistics_items").insert({
    category:      d.category,
    title:         d.title,
    origin:        d.origin ?? null,
    destination:   d.destination ?? null,
    start_date:    d.start_date ?? null,
    end_date:      d.end_date ?? null,
    provider:      d.provider ?? null,
    target_price:  d.target_price ?? null,
    current_price: d.current_price ?? null,
    currency:      d.currency,
    status:        d.status,
    notes:         d.notes ?? null,
    created_by:    user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Se já entrou com preço atual, registra primeiro ponto do histórico (Voos)
  if (d.category === "voo" && d.current_price != null) {
    await svc.from("logistics_price_history").insert({
      item_id: data.id,
      price: d.current_price,
      currency: d.currency,
      source: "manual",
    });
  }

  logAudit({ userId: user.id, userName: profile?.full_name, action: "CREATE", entity: "logistics_items", entityId: data.id, newData: d });

  return NextResponse.json({ ok: true, item: data });
}
