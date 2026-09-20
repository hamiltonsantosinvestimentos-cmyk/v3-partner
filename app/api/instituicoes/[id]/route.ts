import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

async function getRole(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await svc().from("profiles").select("role").eq("id", user.id).single();
    return (data?.role as string) ?? null;
  } catch {
    return null;
  }
}

const EDITABLE_FIELDS = [
  "nome", "cnpj", "email", "status",
  "contato_nome", "contato_telefone", "contato_email",
  "portal_url", "portal_usuario", "portal_senha", "observacoes",
];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = await getRole();
  if (!ALLOWED_ROLES.includes(role ?? "")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }
  const { id } = await params;

  const body = await req.json();
  const fields: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in body) fields[key] = body[key];
  }

  const { data, error } = await svc()
    .from("instituicoes")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ instituicao: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = await getRole();
  if (!["ADMIN", "GESTAO"].includes(role ?? "")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }
  const { id } = await params;

  const { error } = await svc().from("instituicoes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Anexos (apresentação e SCR/autorização) ficam no Storage, fora do banco:
  // sem isso ficariam órfãos, e o SCR tem dado de cliente. Best-effort.
  try {
    const storage = svc().storage.from("instituicoes-anexos");
    for (const tipo of ["apresentacao", "scr_autorizacao"]) {
      const { data: files } = await storage.list(`${id}/${tipo}`, { limit: 100 });
      const paths = (files ?? []).filter((f) => f.id).map((f) => `${id}/${tipo}/${f.name}`);
      if (paths.length) await storage.remove(paths);
    }
  } catch (e) {
    console.error("Falha ao limpar anexos da instituição excluída:", e);
  }
  return NextResponse.json({ ok: true });
}
