import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

const PARTNER_ROLES = ["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function authGuard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!PARTNER_ROLES.includes(profile?.role as typeof PARTNER_ROLES[number])) return null;
  return { user };
}

// GET — detalhe da campanha + fila de contatos (só se for do próprio partner)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;

  const db = svc();
  const [{ data: campanha }, { data: contatos }] = await Promise.all([
    db.from("sdr_campanhas_whatsapp").select("*").eq("id", id).eq("partner_id", auth.user.id).single(),
    db.from("sdr_campanha_whatsapp_contatos").select("*").eq("campanha_id", id).order("created_at", { ascending: true }),
  ]);

  if (!campanha) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
  return NextResponse.json({ campanha, contatos: contatos ?? [] });
}

// PATCH — atualiza nome/mensagem/intervalo/status (nunca dispara envio)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;

  const body = await req.json() as {
    nome?: string; mensagem_template?: string; intervalo_segundos?: number;
    status?: "rascunho" | "pronta_para_envio" | "pausada";
  };

  const updates: Record<string, unknown> = {};
  if (body.nome !== undefined) updates.nome = body.nome.trim();
  if (body.mensagem_template !== undefined) updates.mensagem_template = body.mensagem_template;
  if (body.intervalo_segundos !== undefined) updates.intervalo_segundos = Math.max(5, body.intervalo_segundos);
  if (body.status !== undefined) {
    if (!["rascunho", "pronta_para_envio", "pausada"].includes(body.status)) {
      return NextResponse.json({ error: "status inválido" }, { status: 400 });
    }
    updates.status = body.status;
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });

  const { data, error } = await svc()
    .from("sdr_campanhas_whatsapp")
    .update(updates)
    .eq("id", id)
    .eq("partner_id", auth.user.id)
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campanha: data });
}

// DELETE — remove a campanha e seus contatos
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;

  const { error } = await svc().from("sdr_campanhas_whatsapp").delete().eq("id", id).eq("partner_id", auth.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
