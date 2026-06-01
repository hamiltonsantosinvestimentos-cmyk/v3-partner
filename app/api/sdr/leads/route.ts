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

// GET /api/sdr/leads — lista todos os leads com metadados
export async function GET() {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();

  // 1. Busca todas as mensagens agrupadas por phone (última mensagem + contagem)
  const { data: allMsgs } = await db
    .from("sdr_conversas")
    .select("phone, content, role, created_at")
    .order("created_at", { ascending: false });

  // Agrupa por phone
  const phoneMap: Record<string, { last_at: string; preview: string; count: number }> = {};
  for (const row of allMsgs ?? []) {
    if (!phoneMap[row.phone]) {
      phoneMap[row.phone] = {
        last_at: row.created_at,
        preview: row.content.slice(0, 80),
        count: 0,
      };
    }
    phoneMap[row.phone].count++;
  }

  // 2. Busca metadados dos leads
  const { data: leads } = await db
    .from("sdr_leads")
    .select("phone, nome, tags, responsavel_id, status, last_message_at, last_message_preview, humano_ativo");

  const leadsMap: Record<string, typeof leads extends (infer T)[] | null ? T : never> = {};
  for (const l of leads ?? []) leadsMap[l.phone] = l;

  // 3. Busca perfis (para o dropdown de responsável)
  const { data: profiles } = await db
    .from("profiles")
    .select("id, full_name, role")
    .in("role", ["ADMIN", "GESTAO"]);

  // 4. Busca nomes dos responsáveis
  const responsavelIds = [...new Set((leads ?? []).map(l => l.responsavel_id).filter(Boolean))];
  const { data: responsaveis } = responsavelIds.length
    ? await db.from("profiles").select("id, full_name").in("id", responsavelIds)
    : { data: [] };
  const responsavelMap: Record<string, string> = {};
  for (const r of responsaveis ?? []) responsavelMap[r.id] = r.full_name ?? "";

  // 5. Monta resultado ordenado por última mensagem
  const result = Object.entries(phoneMap)
    .map(([phone, conv]) => {
      const lead = leadsMap[phone];
      return {
        phone,
        nome: lead?.nome ?? null,
        tags: lead?.tags ?? [],
        responsavel_id: lead?.responsavel_id ?? null,
        responsavel_nome: lead?.responsavel_id ? (responsavelMap[lead.responsavel_id] ?? null) : null,
        status: lead?.status ?? "ativo",
        humano_ativo: lead?.humano_ativo ?? false,
        last_message_at: conv.last_at,
        last_message_preview: conv.preview,
        message_count: conv.count,
      };
    })
    .sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));

  return NextResponse.json({ leads: result, profiles: profiles ?? [] });
}

// PATCH /api/sdr/leads — atualiza metadados de um lead
export async function PATCH(req: NextRequest) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json() as {
    phone: string;
    nome?: string;
    tags?: string[];
    responsavel_id?: string | null;
    status?: string;
    humano_ativo?: boolean;
  };

  if (!body.phone) return NextResponse.json({ error: "phone obrigatório" }, { status: 400 });

  const updateData: Record<string, unknown> = { phone: body.phone, updated_at: new Date().toISOString() };
  if (body.nome !== undefined) updateData.nome = body.nome;
  if (body.tags !== undefined) updateData.tags = body.tags;
  if (body.responsavel_id !== undefined) updateData.responsavel_id = body.responsavel_id;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.humano_ativo !== undefined) updateData.humano_ativo = body.humano_ativo;

  const { error } = await svc()
    .from("sdr_leads")
    .upsert(updateData, { onConflict: "phone" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
