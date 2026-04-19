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
  name: z.string().min(2).max(200),
  type: z.enum(["IMOVEL","VEICULO","SERVICO","OUTROS"]).default("IMOVEL"),
  credit_value: z.number().positive(),
  client: z.string().min(2).max(200),
  admin: z.string().min(1).max(200),
  status: z.enum(["EM_ANDAMENTO","CONCLUIDO","AGUARDANDO","CANCELADO"]).default("AGUARDANDO"),
});

export async function GET() {
  const { user } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const svc = serviceClient();
  const { data, error } = await svc.from("consorcio_projetos").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projetos: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { user } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  const d = parsed.data;
  const svc = serviceClient();
  const { data, error } = await svc.from("consorcio_projetos").insert({
    ...d, created_by: user.id,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, projeto: data });
}

export async function DELETE(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number])) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
  const { error } = await serviceClient().from("consorcio_projetos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
