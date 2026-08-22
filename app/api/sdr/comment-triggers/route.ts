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
  const { data: profile } = await svc().from("profiles").select("id, full_name, role").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number])) return null;
  return { user, profile };
}

// GET — lista gatilhos de Comment-to-DM + últimos eventos disparados
export async function GET() {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const [{ data: triggers, error: triggersErr }, { data: events, error: eventsErr }] = await Promise.all([
    svc().from("sdr_comment_triggers").select("*").order("created_at", { ascending: false }),
    svc().from("sdr_comment_events").select("*").order("created_at", { ascending: false }).limit(50),
  ]);

  if (triggersErr) return NextResponse.json({ error: triggersErr.message }, { status: 500 });
  if (eventsErr) return NextResponse.json({ error: eventsErr.message }, { status: 500 });

  return NextResponse.json({ triggers: triggers ?? [], events: events ?? [] });
}

// POST — cria novo gatilho
export async function POST(req: NextRequest) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json() as {
    nome?: string;
    media_id?: string | null;
    media_url?: string | null;
    palavras_chave?: string[];
    mensagem_dm?: string;
    resposta_publica?: string | null;
  };

  if (!body.nome?.trim() || !body.mensagem_dm?.trim() || !body.palavras_chave?.length) {
    return NextResponse.json({ error: "nome, mensagem_dm e ao menos uma palavra-chave são obrigatórios" }, { status: 422 });
  }

  const { data, error } = await svc()
    .from("sdr_comment_triggers")
    .insert({
      nome: body.nome.trim(),
      media_id: body.media_id?.trim() || null,
      media_url: body.media_url?.trim() || null,
      palavras_chave: body.palavras_chave.map((p) => p.trim()).filter(Boolean),
      mensagem_dm: body.mensagem_dm.trim(),
      resposta_publica: body.resposta_publica?.trim() || null,
      created_by: auth.user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ trigger: data });
}
