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
  const svc = serviceClient();
  const { data: profile } = await svc.from("profiles").select("id, full_name, role").eq("id", user.id).single();
  return { user, profile, supabase };
}

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

const createSchema = z.object({
  company:             z.string().min(1, "Nome da empresa obrigatório").max(200),
  title:               z.string().max(300).optional(),
  sector:              z.string().max(100).optional().nullable(),
  value:               z.number().nonnegative().optional().nullable(),
  notes:               z.string().max(5000).optional().nullable(),
  code:                z.string().max(50).optional(),
  tipo_participante:   z.enum(["Vendedor", "Investidor"]).optional(),
  location:            z.string().max(200).optional().nullable(),
  asset_data:          z.record(z.string(), z.unknown()).optional(),
  probability_percent: z.number().int().min(0).max(100).optional(),
  assigned_to:         z.string().uuid().optional(),
});

const dealCommentSchema = z.object({
  id:         z.string(),
  text:       z.string().max(2000),
  author:     z.string().max(100),
  created_at: z.string(),
});

const patchSchema = z.object({
  id:                  z.string().uuid("ID inválido"),
  target_company:      z.string().min(1).max(200).optional(),
  sector:              z.string().max(100).optional().nullable(),
  location:            z.string().max(200).optional().nullable(),
  deal_value:          z.number().positive().optional().nullable(),
  stage:               z.enum(["PROSPECTING","QUALIFICATION","IOI","PROPOSAL","DUE_DILIGENCE","NEGOTIATION","CLOSING","CLOSED_WON","CLOSED_LOST"]).optional(),
  probability_percent: z.number().int().min(0).max(100).optional().nullable(),
  notes:               z.string().max(2000).optional().nullable(),
  comments:            z.array(dealCommentSchema).optional(),
  assigned_to:         z.string().uuid().optional().nullable(),
  expected_close_date: z.string().optional().nullable(),
  asset_data:          z.record(z.string(), z.unknown()).optional(),
});

// Monta select com join de partner — usa nome da coluna para evitar problema com nome do FK constraint
const DEAL_SELECT = `
  id, code, title, target_company, sector, deal_value, ebitda_multiple,
  stage, probability_percent, expected_close_date, created_at, updated_at,
  notes, comments, assigned_to, created_by, asset_data, location,
  partner:profiles!assigned_to(id, full_name)
`;

// GET — lista deals (partner vê os seus, admin vê todos)
export async function GET(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = serviceClient();
  const { searchParams } = new URL(req.url);
  const stage = searchParams.get("stage");
  const isAdmin = ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number]);

  let query = svc.from("ma_deals").select(DEAL_SELECT).order("created_at", { ascending: false });

  if (!isAdmin) {
    query = query.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`);
  }
  if (stage) {
    query = query.eq("stage", stage.toUpperCase());
  }

  const { data, error } = await query;
  if (error) {
    console.error("[ma-deals GET] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ deals: data ?? [] });
}

// POST — cria novo deal M&A
export async function POST(req: NextRequest) {
  try {
    const { user, profile } = await getAuthedUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: JSON.stringify(parsed.error.flatten().fieldErrors) }, { status: 400 });
    }
    const d = parsed.data;

    const svcPost = serviceClient();
    const { count } = await svcPost.from("ma_deals").select("*", { count: "exact", head: true });
    const code = d.code ?? `MA-26-${String((count ?? 0) + 1).padStart(3, "0")}`;

    const insertPayload = {
      code,
      title:               d.title ?? d.company,
      target_company:      d.company,
      sector:              d.sector ?? null,
      deal_value:          d.value ?? null,
      stage:               "PROSPECTING" as const,
      probability_percent: d.probability_percent ?? 10,
      notes:               d.notes ?? null,
      assigned_to:         d.assigned_to ?? user.id,
      created_by:          user.id,
      location:            d.location ?? null,
      asset_data: {
        ...(d.tipo_participante ? { tipo_participante: d.tipo_participante } : {}),
        ...(d.asset_data ?? {}),
      },
    };

    const { data, error } = await svcPost
      .from("ma_deals")
      .insert(insertPayload)
      .select("id, code, target_company, sector, deal_value, probability_percent, created_at, notes, assigned_to")
      .single();

    if (error) {
      console.error("[ma-deals POST] Supabase error:", JSON.stringify(error));
      return NextResponse.json({ error: `${error.message} | ${error.details ?? ""} | code: ${error.code ?? ""}` }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Nenhum dado retornado após inserção" }, { status: 500 });
    }

    logAudit({
      userId: user.id, userName: profile?.full_name,
      action: "CREATE", entity: "ma_deals", entityId: data.id,
      newData: { code, company: d.company, assigned_to: insertPayload.assigned_to },
    });

    // Notificações in-app (fire-and-forget)
    const partnerName = profile?.full_name ?? "Partner";
    // Confirmação para o próprio partner
    createNotification({
      user_id: user.id,
      type: "deal",
      title: "Deal enviado para análise",
      message: `${code} — ${d.company} foi recebido pela Mesa M&A`,
      action_url: "/ma",
    });
    // Alerta para ADMIN e GESTAO
    notifyByRoles(["ADMIN", "GESTAO"], {
      type: "deal",
      title: `Novo Deal M&A — ${code}`,
      message: `${partnerName} cadastrou: ${d.company}${d.sector ? ` · ${d.sector}` : ""}`,
      action_url: "/mesa-ma",
    });

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
        assigned_to: data.assigned_to,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ma-deals POST] Uncaught exception:", msg);
    return NextResponse.json({ error: `Exceção interna: ${msg}` }, { status: 500 });
  }
}

// PATCH — atualiza deal
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

  if (!isAdmin) {
    const { data: existing } = await svc.from("ma_deals").select("assigned_to, created_by").eq("id", id).single();
    if (!existing || (existing.assigned_to !== user.id && existing.created_by !== user.id)) {
      return NextResponse.json({ error: "Sem permissão para editar este deal" }, { status: 403 });
    }
  }

  const { data, error } = await svc
    .from("ma_deals")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

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
