import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { syncSdrLeadToProspeccao, lookupProspeccaoEtapaByPhones } from "@/lib/sdr-prospeccao-sync";
import { SDR_INTERNO_PARTNER_ID } from "@/lib/sdr-agent";

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "SDR", "CLOSER"] as const;
const ADMIN_ROLES = ["ADMIN", "GESTAO"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function authGuard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("id, full_name, role").eq("id", user.id).single();
  if (!ALLOWED_ROLES.includes(profile?.role as typeof ALLOWED_ROLES[number])) return null;
  return { user, profile };
}

// GET /api/sdr/leads — lista leads com metadados. ADMIN/GESTAO veem todos;
// SDR/CLOSER veem só os que são responsáveis (ou ainda sem dono).
export async function GET() {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const isAdmin = ADMIN_ROLES.includes(auth.profile?.role as typeof ADMIN_ROLES[number]);

  const db = svc();

  // 1. Busca todas as mensagens agrupadas por phone (última mensagem + contagem)
  // Rota interna da V3 (bot próprio) -- filtra fora dados de instâncias white
  // label de partners, que têm o próprio painel em /api/partner/sdr/*.
  const { data: allMsgs } = await db
    .from("sdr_conversas")
    .select("phone, content, role, created_at")
    .is("partner_id", null)
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
    .select("phone, nome, tags, responsavel_id, status, last_message_at, last_message_preview, humano_ativo, canal")
    .eq("partner_id", SDR_INTERNO_PARTNER_ID);

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

  // 5. Etapa vinculada no Kanban de Prospecção de Partners (por telefone)
  const prospeccaoEtapaByPhone = await lookupProspeccaoEtapaByPhones(Object.keys(phoneMap));

  // 6. Monta resultado ordenado por última mensagem
  const result = Object.entries(phoneMap)
    .filter(([phone]) => {
      if (isAdmin) return true;
      const lead = leadsMap[phone];
      return !lead?.responsavel_id || lead.responsavel_id === auth.user.id;
    })
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
        canal: lead?.canal ?? "whatsapp",
        last_message_at: conv.last_at,
        last_message_preview: conv.preview,
        message_count: conv.count,
        prospeccao_etapa: prospeccaoEtapaByPhone[phone] ?? null,
      };
    })
    .sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));

  return NextResponse.json({ leads: result, profiles: profiles ?? [] });
}

// PATCH /api/sdr/leads — atualiza metadados de um lead. ADMIN/GESTAO podem
// mexer em qualquer lead; SDR/CLOSER só em leads sem dono (pra se autoatribuir)
// ou já atribuídos a eles mesmos.
export async function PATCH(req: NextRequest) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const isAdmin = ADMIN_ROLES.includes(auth.profile?.role as typeof ADMIN_ROLES[number]);

  const body = await req.json() as {
    phone: string;
    nome?: string;
    tags?: string[];
    responsavel_id?: string | null;
    status?: string;
    humano_ativo?: boolean;
  };

  if (!body.phone) return NextResponse.json({ error: "phone obrigatório" }, { status: 400 });

  if (!isAdmin) {
    const { data: existing } = await svc().from("sdr_leads").select("responsavel_id").eq("phone", body.phone).eq("partner_id", SDR_INTERNO_PARTNER_ID).maybeSingle();
    if (existing?.responsavel_id && existing.responsavel_id !== auth.user.id) {
      return NextResponse.json({ error: "Esse lead já tem outro responsável" }, { status: 403 });
    }
  }

  const updateData: Record<string, unknown> = { phone: body.phone, partner_id: SDR_INTERNO_PARTNER_ID, updated_at: new Date().toISOString() };
  if (body.nome !== undefined) updateData.nome = body.nome;
  if (body.tags !== undefined) updateData.tags = body.tags;
  if (body.responsavel_id !== undefined) updateData.responsavel_id = body.responsavel_id;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.humano_ativo !== undefined) updateData.humano_ativo = body.humano_ativo;

  const { error } = await svc()
    .from("sdr_leads")
    .upsert(updateData, { onConflict: "phone,partner_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mudança de status (manual, via dropdown) também sincroniza com o Kanban de Prospecção
  if (body.status !== undefined) {
    const { data: lead } = await svc()
      .from("sdr_leads")
      .select("nome, responsavel_id")
      .eq("phone", body.phone)
      .eq("partner_id", SDR_INTERNO_PARTNER_ID)
      .single();

    let responsavelNome: string | null = null;
    if (lead?.responsavel_id) {
      const { data: resp } = await svc().from("profiles").select("full_name").eq("id", lead.responsavel_id).single();
      responsavelNome = resp?.full_name ?? null;
    }

    await syncSdrLeadToProspeccao({
      phone: body.phone,
      status: body.status,
      nome: lead?.nome ?? null,
      responsavel_id: lead?.responsavel_id ?? null,
      responsavel_nome: responsavelNome,
      nota: `Status alterado manualmente para "${body.status}" no CRM do WhatsApp por ${auth.profile?.full_name ?? "operador"}`,
    }).catch(e => console.error("[SDR] Erro ao sincronizar com Prospecção:", e));
  }

  return NextResponse.json({ ok: true });
}
