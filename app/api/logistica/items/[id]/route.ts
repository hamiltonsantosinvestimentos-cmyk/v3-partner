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

const patchSchema = z.object({
  title:         z.string().min(3).max(200).optional(),
  origin:        z.string().max(120).optional().nullable(),
  destination:   z.string().max(120).optional().nullable(),
  start_date:    z.string().optional().nullable(),
  end_date:      z.string().optional().nullable(),
  provider:      z.string().max(120).optional().nullable(),
  target_price:  z.number().optional().nullable(),
  current_price: z.number().optional().nullable(),
  currency:      z.string().max(8).optional(),
  status:        z.enum(["monitorando", "reservado", "concluido", "cancelado"]).optional(),
  notes:         z.string().max(2000).optional().nullable(),
});

// PATCH — atualiza item de logística
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(profile?.role as typeof ALLOWED_ROLES[number])) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const fields = parsed.data;

  const svc = serviceClient();
  const { data: existing } = await svc.from("logistics_items").select("category, current_price, currency").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });

  const { data, error } = await svc
    .from("logistics_items")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Registra novo ponto de histórico de preço quando current_price muda (Voos)
  if (existing.category === "voo" && fields.current_price != null && fields.current_price !== existing.current_price) {
    await svc.from("logistics_price_history").insert({
      item_id: id,
      price: fields.current_price,
      currency: fields.currency ?? existing.currency,
      source: "manual",
    });
  }

  logAudit({ userId: user.id, userName: profile?.full_name, action: "UPDATE", entity: "logistics_items", entityId: id, newData: fields });

  return NextResponse.json({ ok: true, item: data });
}

// DELETE — remove item de logística
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(profile?.role as typeof ALLOWED_ROLES[number])) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { error } = await serviceClient().from("logistics_items").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAudit({ userId: user.id, userName: profile?.full_name, action: "DELETE", entity: "logistics_items", entityId: id });

  return NextResponse.json({ ok: true });
}
