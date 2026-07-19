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
  const { data, error } = await svc.from("consorcio_projetos").select("*").is("deleted_at", null).order("created_at", { ascending: false });
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

// DELETE — descontinuado: exclusão agora passa por soft delete + governança
// em POST /api/consorcio/projetos/[id]/delete (ver lib/governance-delete.ts).
export async function DELETE() {
  return NextResponse.json(
    { error: "Use POST /api/consorcio/projetos/{id}/delete — exclusão direta foi descontinuada (soft delete + governança)" },
    { status: 410 }
  );
}
