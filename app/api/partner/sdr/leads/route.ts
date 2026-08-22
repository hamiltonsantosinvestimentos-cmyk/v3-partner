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
  const db = svc();
  const { data: conexao } = await db.from("partner_sdr_connections").select("addon_ativo").eq("partner_id", user.id).maybeSingle();
  if (!conexao?.addon_ativo) return null;
  return { user };
}

// GET — lista os contatos (leads) que já falaram com o WhatsApp do partner,
// com preview da última mensagem. Espelha /api/sdr/leads, mas escopado ao
// próprio partner_id em vez de mostrar todo mundo.
export async function GET() {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();

  const { data: allMsgs } = await db
    .from("sdr_conversas")
    .select("phone, content, role, created_at")
    .eq("partner_id", auth.user.id)
    .order("created_at", { ascending: false });

  const phoneMap: Record<string, { last_at: string; preview: string; count: number }> = {};
  for (const row of allMsgs ?? []) {
    if (!phoneMap[row.phone]) {
      phoneMap[row.phone] = { last_at: row.created_at, preview: row.content.slice(0, 80), count: 0 };
    }
    phoneMap[row.phone].count++;
  }

  const { data: leads } = await db
    .from("sdr_leads")
    .select("phone, nome, tags, status, humano_ativo")
    .eq("partner_id", auth.user.id);

  const leadsMap: Record<string, (typeof leads extends (infer T)[] | null ? T : never)> = {};
  for (const l of leads ?? []) leadsMap[l.phone] = l;

  const result = Object.entries(phoneMap)
    .map(([phone, conv]) => {
      const lead = leadsMap[phone];
      return {
        phone,
        nome: lead?.nome ?? null,
        tags: lead?.tags ?? [],
        status: lead?.status ?? "ativo",
        humano_ativo: lead?.humano_ativo ?? false,
        last_message_at: conv.last_at,
        last_message_preview: conv.preview,
        message_count: conv.count,
      };
    })
    .sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));

  return NextResponse.json({ leads: result });
}

// PATCH — atualiza metadados de um lead (nome, tags, status, pausar IA)
export async function PATCH(req: NextRequest) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json() as {
    phone: string; nome?: string; tags?: string[]; status?: string; humano_ativo?: boolean;
  };
  if (!body.phone) return NextResponse.json({ error: "phone obrigatório" }, { status: 400 });

  const updates: Record<string, unknown> = { phone: body.phone, partner_id: auth.user.id, updated_at: new Date().toISOString() };
  if (body.nome !== undefined) updates.nome = body.nome;
  if (body.tags !== undefined) updates.tags = body.tags;
  if (body.status !== undefined) updates.status = body.status;
  if (body.humano_ativo !== undefined) updates.humano_ativo = body.humano_ativo;

  const { error } = await svc().from("sdr_leads").upsert(updates, { onConflict: "phone,partner_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
