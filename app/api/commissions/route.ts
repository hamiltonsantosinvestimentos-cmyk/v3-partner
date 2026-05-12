import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { notifyNovaComissao, notifyComissaoPaga } from "@/lib/email";
import { createNotification } from "@/lib/notify";

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

const ADMIN_ROLES = ["ADMIN", "GESTAO", "FINANCEIRO"] as const;

const createSchema = z.object({
  partner_id:           z.string().uuid("Partner obrigatório"),
  operation_type:       z.enum(["CREDITO", "MA", "CONSORCIO", "SPLIT_FISCAL", "MARKETPLACE"]),
  operation_id:         z.string().uuid().optional().nullable(),
  operation_code:       z.string().max(50).optional().nullable(),
  operation_description: z.string().min(3).max(300),
  operation_value:      z.number().positive("Valor deve ser positivo"),
  commission_percent:   z.number().min(0).max(100),
  status:               z.enum(["A_PAGAR", "PAGA", "CANCELADA"]).default("A_PAGAR"),
  operation_closed_at:  z.string().optional().nullable(),
  payment_date:         z.string().optional().nullable(),
  notes:                z.string().max(1000).optional().nullable(),
});

const patchSchema = z.object({
  id:             z.string().uuid(),
  status:         z.enum(["A_PAGAR", "PAGA", "CANCELADA"]).optional(),
  payment_date:   z.string().optional().nullable(),
  commission_percent: z.number().min(0).max(100).optional(),
  operation_value:    z.number().positive().optional(),
  notes:          z.string().max(1000).optional().nullable(),
});

// GET — lista comissões
export async function GET(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status        = searchParams.get("status");
  const partnerId     = searchParams.get("partner_id");
  const operationType = searchParams.get("operation_type");
  const isAdmin       = ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number]);

  const svc = serviceClient();
  let query = svc
    .from("commissions")
    .select(`
      id, code, partner_id, operation_type, operation_id, operation_code,
      operation_description, operation_value, commission_percent, commission_value,
      status, operation_closed_at, payment_date, notes, created_at
    `)
    .order("created_at", { ascending: false });

  if (!isAdmin) query = query.eq("partner_id", user.id);
  if (isAdmin && partnerId) query = query.eq("partner_id", partnerId);
  if (status)        query = query.eq("status", status.toUpperCase());
  if (operationType) query = query.eq("operation_type", operationType.toUpperCase());

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ commissions: data ?? [] });
}

// POST — cria comissão (ADMIN/GESTAO/FINANCEIRO)
export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const isAdmin = ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number]);
  if (!isAdmin) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const d = parsed.data;

  const svc = serviceClient();
  const { count } = await svc.from("commissions").select("*", { count: "exact", head: true });
  const code = `COM-26-${String((count ?? 0) + 1).padStart(4, "0")}`;

  const { data, error } = await svc.from("commissions").insert({
    code,
    partner_id:            d.partner_id,
    operation_type:        d.operation_type,
    operation_id:          d.operation_id ?? null,
    operation_code:        d.operation_code ?? null,
    operation_description: d.operation_description,
    operation_value:       d.operation_value,
    commission_percent:    d.commission_percent,
    status:                d.status,
    operation_closed_at:   d.operation_closed_at ?? null,
    payment_date:          d.payment_date ?? null,
    notes:                 d.notes ?? null,
    created_by:            user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAudit({ userId: user.id, userName: profile?.full_name, action: "CREATE", entity: "commissions" as never, entityId: data.id, newData: d as Record<string, unknown> });

  // Notifica partner por e-mail (fire and forget)
  const svcEmail = serviceClient();
  const { data: partnerUser } = await svcEmail.auth.admin.getUserById(d.partner_id);
  const partnerEmail = partnerUser?.user?.email;
  const { data: partnerProfile } = await svcEmail
    .from("profiles").select("full_name").eq("id", d.partner_id).single();
  if (partnerEmail) {
    notifyNovaComissao({
      partnerEmail,
      partnerName:          partnerProfile?.full_name ?? "Partner",
      commissionCode:       data.code,
      operationDescription: d.operation_description,
      operationType:        d.operation_type,
      commissionValue:      data.commission_value ?? (d.operation_value * d.commission_percent / 100),
      paymentDate:          d.payment_date ?? null,
    });
  }

  // Notificação in-app para o partner (nova comissão registrada)
  const commValue = data.commission_value ?? (d.operation_value * d.commission_percent / 100);
  const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(commValue);
  createNotification({
    user_id: d.partner_id,
    type: "commission",
    title: "Nova comissão registrada",
    message: `${data.code} — ${d.operation_description} · ${formatted}`,
    action_url: "/comissoes",
  });

  return NextResponse.json({ ok: true, commission: data });
}

// PATCH — atualiza comissão (ADMIN/GESTAO/FINANCEIRO)
export async function PATCH(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const isAdmin = ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number]);
  if (!isAdmin) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { id, ...fields } = parsed.data;
  const updateData: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() };

  // Marca payment_date automático quando status → PAGA
  if (fields.status === "PAGA" && !fields.payment_date) {
    updateData.payment_date = new Date().toISOString().split("T")[0];
  }

  const { data, error } = await serviceClient()
    .from("commissions").update(updateData).eq("id", id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAudit({ userId: user.id, userName: profile?.full_name, action: "UPDATE", entity: "commissions" as never, entityId: id, newData: fields as Record<string, unknown> });

  // Notifica partner quando comissão for paga (fire and forget)
  if (fields.status === "PAGA") {
    const svcEmail = serviceClient();
    const { data: commission } = await svcEmail
      .from("commissions")
      .select("partner_id, code, operation_description, commission_value")
      .eq("id", id)
      .single();
    if (commission?.partner_id) {
      const { data: partnerUser } = await svcEmail.auth.admin.getUserById(commission.partner_id);
      const partnerEmail = partnerUser?.user?.email;
      const { data: partnerProfile } = await svcEmail
        .from("profiles").select("full_name").eq("id", commission.partner_id).single();
      if (partnerEmail) {
        notifyComissaoPaga({
          partnerEmail,
          partnerName:          partnerProfile?.full_name ?? "Partner",
          commissionCode:       commission.code,
          operationDescription: commission.operation_description,
          commissionValue:      commission.commission_value ?? 0,
        });
      }
      // Notificação in-app para o partner
      const valFormatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(commission.commission_value ?? 0);
      createNotification({
        user_id: commission.partner_id,
        type: "commission",
        title: "Comissão paga 💰",
        message: `${commission.code} — ${commission.operation_description} · ${valFormatted}`,
        action_url: "/comissoes",
      });
    }
  }

  return NextResponse.json({ ok: true, commission: data });
}

// DELETE — somente ADMIN
export async function DELETE(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (profile?.role !== "ADMIN") return NextResponse.json({ error: "Apenas administradores podem excluir" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  const { error } = await serviceClient().from("commissions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAudit({ userId: user.id, userName: profile?.full_name, action: "DELETE", entity: "commissions" as never, entityId: id });

  return NextResponse.json({ ok: true });
}
