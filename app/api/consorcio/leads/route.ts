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
  const svc = serviceClient();
  const { data: profile } = await svc.from("profiles").select("id, full_name, role").eq("id", user.id).single();
  return { user, profile };
}

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

const createSchema = z.object({
  client: z.string().min(2).max(200),
  type: z.string().max(100).default("Imóvel"),
  value: z.number().positive(),
  stage: z.string().max(50).default("lead"),
  responsible: z.string().max(200),
  quota: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  stage: z.string().max(50).optional(),
  notes: z.string().max(2000).optional().nullable(),
  responsible: z.string().max(200).optional(),
});

export async function GET() {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const isAdmin = ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number]);
  if (!isAdmin) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const svc = serviceClient();
  const { data, error } = await svc.from("consorcio_leads").select("*").is("deleted_at", null).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leads: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const isAdmin = ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number]);
  if (!isAdmin) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  const d = parsed.data;
  const svc = serviceClient();
  const { count } = await svc.from("consorcio_leads").select("*", { count: "exact", head: true });
  const code = `CS-26-${String((count ?? 0) + 1).padStart(3, "0")}`;
  const { data, error } = await svc.from("consorcio_leads").insert({
    code, ...d, created_by: user.id,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, lead: data });
}

export async function PATCH(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const isAdmin = ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number]);
  if (!isAdmin) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  const { id, ...fields } = parsed.data;
  const { data, error } = await serviceClient().from("consorcio_leads").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, lead: data });
}

// DELETE — descontinuado: exclusão agora passa por soft delete + governança
// em POST /api/consorcio/leads/[id]/delete (ver lib/governance-delete.ts).
export async function DELETE() {
  return NextResponse.json(
    { error: "Use POST /api/consorcio/leads/{id}/delete — exclusão direta foi descontinuada (soft delete + governança)" },
    { status: 410 }
  );
}
