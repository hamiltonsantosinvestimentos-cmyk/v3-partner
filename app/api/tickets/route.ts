import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { createNotification, notifyByRoles } from "@/lib/notify";

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
  title:       z.string().min(3, "Título muito curto").max(200),
  description: z.string().max(2000).optional().nullable(),
  category:    z.enum(["compliance","tecnico","juridico","onboarding","operacional"]).default("operacional"),
  priority:    z.enum(["LOW","MEDIUM","HIGH","URGENT"]).default("MEDIUM"),
  due_date:    z.string().optional().nullable(),
});

const patchSchema = z.object({
  id:          z.string().uuid("ID inválido"),
  status:      z.enum(["PENDING","IN_REVIEW","APPROVED","REJECTED","COMPLETED","CANCELLED"]).optional(),
  assigned_to: z.string().uuid().optional().nullable(),
  resolution:  z.string().max(2000).optional().nullable(),
  priority:    z.enum(["LOW","MEDIUM","HIGH","URGENT"]).optional(),
  due_date:    z.string().optional().nullable(),
  title:       z.string().min(3).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
});

// GET — lista tickets (partner vê os seus, admin/mesa vê todos)
export async function GET(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status   = searchParams.get("status");
  const priority = searchParams.get("priority");
  const category = searchParams.get("category");
  const isAdmin  = ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number]);

  const svc = serviceClient();
  let query = svc
    .from("operational_tickets")
    .select(`
      id, code, title, description, category, priority,
      status, due_date, resolved_at, resolution, tags, created_at,
      requester:profiles!operational_tickets_requester_id_fkey(id, full_name),
      assignee:profiles!operational_tickets_assigned_to_fkey(id, full_name)
    `)
    .order("created_at", { ascending: false });

  if (!isAdmin) {
    query = query.or(`requester_id.eq.${user.id},assigned_to.eq.${user.id}`);
  }
  if (status)   query = query.eq("status", status.toUpperCase());
  if (priority) query = query.eq("priority", priority.toUpperCase());
  if (category) query = query.eq("category", category.toLowerCase());

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tickets: data ?? [] });
}

// POST — cria novo ticket
export async function POST(req: NextRequest) {
  const { user, supabase } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const d = parsed.data;

  const { count } = await supabase
    .from("operational_tickets").select("*", { count: "exact", head: true });
  const code = `TICK-26-${String((count ?? 0) + 1).padStart(4, "0")}`;

  const { data, error } = await supabase.from("operational_tickets").insert({
    code,
    title:        d.title,
    description:  d.description ?? null,
    category:     d.category,
    priority:     d.priority,
    status:       "PENDING",
    requester_id: user.id,
    due_date:     d.due_date ?? null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notificações in-app (fire-and-forget)
  const priorityLabel: Record<string, string> = { LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta", URGENT: "Urgente" };
  // Confirmação para o solicitante
  createNotification({
    user_id: user.id,
    type: "ticket",
    title: "Ticket registrado",
    message: `${code} — ${d.title} (${priorityLabel[d.priority] ?? d.priority})`,
    action_url: "/mesa-operacional",
  });
  // Alerta para equipe operacional
  notifyByRoles(["ADMIN", "GESTAO", "MESA_OPERACIONAL"], {
    type: "ticket",
    title: `Novo Ticket ${d.priority === "URGENT" ? "🚨 URGENTE" : ""} — ${code}`,
    message: d.title,
    action_url: "/mesa-operacional",
  });

  return NextResponse.json({ ok: true, ticket: data });
}

// PATCH — atualiza ticket (status, assigned_to, resolução)
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

  // Partner só pode atualizar seus próprios tickets
  if (!isAdmin) {
    const { data: existing } = await svc
      .from("operational_tickets")
      .select("requester_id, assigned_to").eq("id", id).single();
    if (!existing || (existing.requester_id !== user.id && existing.assigned_to !== user.id)) {
      return NextResponse.json({ error: "Sem permissão para editar este ticket" }, { status: 403 });
    }
    // Partner não pode reatribuir tickets
    delete (fields as Record<string, unknown>).assigned_to;
  }

  // Marca resolved_at quando concluído
  const updateData: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() };
  if (fields.status === "COMPLETED" || fields.status === "RESOLVED") {
    updateData.resolved_at = new Date().toISOString();
  }

  const { data, error } = await svc
    .from("operational_tickets")
    .update(updateData)
    .eq("id", id)
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAudit({ userId: user.id!, userName: profile?.full_name, action: "UPDATE", entity: "operational_tickets", entityId: id, newData: fields as Record<string, unknown> });

  // Notifica solicitante quando ticket é resolvido
  if ((fields.status === "COMPLETED" || fields.status === "CANCELLED") && data?.requester_id && data.requester_id !== user.id) {
    const statusLabel = fields.status === "COMPLETED" ? "resolvido" : "cancelado";
    createNotification({
      user_id: data.requester_id,
      type: "ticket",
      title: `Ticket ${statusLabel}`,
      message: `${data.code ?? ""} — ${data.title ?? ""}`,
      action_url: "/mesa-operacional",
    });
  }

  return NextResponse.json({ ok: true, ticket: data });
}

// DELETE — somente ADMIN
export async function DELETE(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (profile?.role !== "ADMIN") {
    return NextResponse.json({ error: "Apenas administradores podem excluir tickets" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  const { error } = await serviceClient().from("operational_tickets").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAudit({ userId: user.id!, userName: profile?.full_name, action: "DELETE", entity: "operational_tickets", entityId: id });

  return NextResponse.json({ ok: true });
}
