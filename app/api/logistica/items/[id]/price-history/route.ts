import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { z } from "zod";

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
  price:    z.number(),
  currency: z.string().max(8).default("BRL"),
  source:   z.string().max(60).optional().nullable(),
});

// GET — histórico de preços de um item (Voos)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(profile?.role as typeof ALLOWED_ROLES[number])) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const svc = serviceClient();
  const { data, error } = await svc
    .from("logistics_price_history")
    .select("*")
    .eq("item_id", id)
    .order("checked_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ history: data ?? [] });
}

// POST — adiciona ponto de histórico de preço manualmente
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  // Idempotência — evita duplicar snapshot se o último preço registrado nos
  // últimos 15 min já tem o mesmo valor (proteção contra polling repetido do n8n/Amadeus)
  const { data: last } = await svc
    .from("logistics_price_history")
    .select("id, price, currency, checked_at")
    .eq("item_id", id)
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const FIFTEEN_MIN_MS = 15 * 60 * 1000;
  if (
    last &&
    last.price === d.price &&
    last.currency === d.currency &&
    Date.now() - new Date(last.checked_at).getTime() < FIFTEEN_MIN_MS
  ) {
    return NextResponse.json({ ok: true, entry: last, deduped: true });
  }

  const { data, error } = await svc.from("logistics_price_history").insert({
    item_id: id,
    price: d.price,
    currency: d.currency,
    source: d.source ?? "manual",
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await svc.from("logistics_items").update({ current_price: d.price, currency: d.currency, updated_at: new Date().toISOString() }).eq("id", id);

  return NextResponse.json({ ok: true, entry: data });
}
