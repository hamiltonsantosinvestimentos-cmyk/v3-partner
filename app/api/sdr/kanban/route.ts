import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { lookupProspeccaoLeadsByPhones, ensureProspeccaoLead } from "@/lib/sdr-prospeccao-sync";
import { SDR_INTERNO_PARTNER_ID } from "@/lib/sdr-agent";

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "SDR", "CLOSER"] as const;
const ADMIN_ROLES = ["ADMIN", "GESTAO"] as const;
const ETAPAS = ["prospect", "contatado", "interessado", "trial", "convertido", "perdido"];

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function authGuard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("id, full_name, role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as typeof ALLOWED_ROLES[number])) return null;
  return { user, profile: profile as { id: string; full_name: string; role: string } };
}

// GET /api/sdr/kanban — leads do WhatsApp com etapa de Prospecção. ADMIN/GESTAO veem
// todos; SDR/CLOSER veem só os que são responsáveis.
export async function GET() {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const isAdmin = ADMIN_ROLES.includes(auth.profile.role as typeof ADMIN_ROLES[number]);

  const db = svc();

  let query = db
    .from("sdr_leads")
    .select("phone, nome, tags, responsavel_id, status, last_message_at, last_message_preview, canal")
    .eq("partner_id", SDR_INTERNO_PARTNER_ID)
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (!isAdmin) query = query.eq("responsavel_id", auth.user.id);

  const { data: leads, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const phones = (leads ?? []).map(l => l.phone);
  const prospeccaoByPhone = await lookupProspeccaoLeadsByPhones(phones);

  const responsavelIds = [...new Set((leads ?? []).map(l => l.responsavel_id).filter(Boolean))] as string[];
  const { data: responsaveis } = responsavelIds.length
    ? await db.from("profiles").select("id, full_name").in("id", responsavelIds)
    : { data: [] };
  const responsavelMap: Record<string, string> = {};
  for (const r of responsaveis ?? []) responsavelMap[r.id] = r.full_name ?? "";

  const result = (leads ?? []).map(l => ({
    phone: l.phone,
    nome: l.nome,
    tags: l.tags ?? [],
    responsavel_id: l.responsavel_id,
    responsavel_nome: l.responsavel_id ? (responsavelMap[l.responsavel_id] ?? null) : null,
    status: l.status,
    canal: l.canal ?? "whatsapp",
    last_message_at: l.last_message_at,
    last_message_preview: l.last_message_preview,
    prospeccao_lead_id: prospeccaoByPhone[l.phone]?.id ?? null,
    etapa: prospeccaoByPhone[l.phone]?.etapa ?? "prospect",
  }));

  // Equipe (pro filtro "responsável" — só faz sentido pro admin, que vê todo mundo)
  const { data: equipe } = isAdmin
    ? await db.from("profiles").select("id, full_name, role").in("role", ["ADMIN", "GESTAO", "SDR", "CLOSER"]).order("full_name")
    : { data: [] };

  return NextResponse.json({ leads: result, equipe: equipe ?? [], isAdmin });
}

// PATCH /api/sdr/kanban — move um lead de etapa (cria o prospeccao_leads vinculado se ainda não existir)
export async function PATCH(req: NextRequest) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const isAdmin = ADMIN_ROLES.includes(auth.profile.role as typeof ADMIN_ROLES[number]);

  const { phone, etapa } = await req.json() as { phone: string; etapa: string };
  if (!phone || !ETAPAS.includes(etapa)) {
    return NextResponse.json({ error: "phone e etapa (válida) são obrigatórios" }, { status: 400 });
  }

  const db = svc();
  const { data: lead } = await db.from("sdr_leads").select("nome, responsavel_id").eq("phone", phone).eq("partner_id", SDR_INTERNO_PARTNER_ID).single();

  if (!isAdmin && lead?.responsavel_id !== auth.user.id) {
    return NextResponse.json({ error: "Você só pode mover leads dos quais é responsável" }, { status: 403 });
  }

  let responsavelNome: string | null = null;
  if (lead?.responsavel_id) {
    const { data: resp } = await db.from("profiles").select("full_name").eq("id", lead.responsavel_id).single();
    responsavelNome = resp?.full_name ?? null;
  }

  const linked = await ensureProspeccaoLead({
    phone,
    nome: lead?.nome ?? null,
    responsavel_id: lead?.responsavel_id ?? null,
    responsavel_nome: responsavelNome,
  });

  if (linked.etapa === etapa) {
    return NextResponse.json({ id: linked.id, etapa: linked.etapa });
  }

  const updates: Record<string, unknown> = { etapa };
  if (etapa === "convertido") updates.convertido_em = new Date().toISOString();

  const { error } = await db.from("prospeccao_leads").update(updates).eq("id", linked.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from("prospeccao_historico").insert({
    lead_id: linked.id,
    etapa_anterior: linked.etapa,
    etapa_nova: etapa,
    nota: `Movido no Kanban de WhatsApp por ${auth.profile.full_name}`,
    created_by: auth.user.id,
  });

  return NextResponse.json({ id: linked.id, etapa });
}
