import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { z } from "zod";
import { issueV3Code } from "@/lib/v3-codes";

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
  type: z.enum(["IMOVEL", "VEICULO", "SERVICO", "OUTROS"]),
  credit_value: z.number().positive(),
  admin: z.string().min(1).max(200),
  group_name: z.string().max(50).optional().nullable(),
  quota: z.string().max(50).optional().nullable(),
  status: z.enum(["DISPONIVEL","NEGOCIACAO","VENDIDA","UTILIZADA"]).default("DISPONIVEL"),
  asking_price: z.number().positive(),
  discount: z.number().min(0).max(100),
});

export async function GET() {
  const { user } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const svc = serviceClient();
  const { data, error } = await svc.from("consorcio_cartas").select("*").is("deleted_at", null).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cartas: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  const d = parsed.data;
  const svc = serviceClient();

  // Codigo emitido pelo banco. O calculo anterior (COUNT(*)+1) estava a uma
  // exclusao de quebrar: sao 301 cartas com numeracao perfeitamente densa, entao
  // apagar qualquer uma faria COUNT+1 apontar para um codigo ja existente e toda
  // emissao de carta passaria a falhar com 23505, exatamente como aconteceu em
  // ma_deals em 05/08/2026.
  // As 301 cartas no formato CARTA-26-NNN permanecem intocadas: a serie CS vale
  // da emissao em diante, conforme decisao de congelar o historico (05/08/2026).
  const code = await issueV3Code("CS", null, svc);

  const { data, error } = await svc.from("consorcio_cartas").insert({
    code, ...d, created_by: user.id,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  void profile; // used for auth context
  return NextResponse.json({ ok: true, carta: data });
}

// DELETE — descontinuado: exclusão agora passa por soft delete + governança
// em POST /api/consorcio/cartas/[id]/delete (ver lib/governance-delete.ts).
export async function DELETE() {
  return NextResponse.json(
    { error: "Use POST /api/consorcio/cartas/{id}/delete — exclusão direta foi descontinuada (soft delete + governança)" },
    { status: 410 }
  );
}
