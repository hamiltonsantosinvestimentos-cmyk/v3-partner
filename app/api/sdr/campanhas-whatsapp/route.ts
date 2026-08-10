import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

const ADMIN_ROLES = ["ADMIN", "GESTAO"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function authGuard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("id, full_name, role").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number])) return null;
  return { user, profile };
}

// GET — lista campanhas de envio em massa (fila, sem disparo)
export async function GET() {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: campanhas } = await svc()
    .from("sdr_campanhas_whatsapp")
    .select("*")
    .order("created_at", { ascending: false });

  return NextResponse.json({ campanhas: campanhas ?? [] });
}

// POST — cria uma nova fila de campanha (rascunho, sem contatos ainda)
export async function POST(req: NextRequest) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json() as {
    nome: string;
    mensagem_template?: string;
    intervalo_segundos?: number;
  };

  if (!body.nome?.trim()) return NextResponse.json({ error: "nome é obrigatório" }, { status: 400 });

  const { data: campanha, error } = await svc()
    .from("sdr_campanhas_whatsapp")
    .insert({
      nome: body.nome.trim(),
      mensagem_template: body.mensagem_template ?? "",
      intervalo_segundos: Math.max(5, body.intervalo_segundos ?? 30),
      status: "rascunho",
      created_by: auth.user.id,
    })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campanha });
}
