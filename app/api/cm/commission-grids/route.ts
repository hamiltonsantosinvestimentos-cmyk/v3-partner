import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { isValidEmail } from "@/lib/utils";
import { normalizePhone } from "@/lib/phone";
import {
  ASSESSORIA_FIXED_PERCENT_EACH, ASSESSORIA_V3_FIXED, COMMISSION_DEFAULT_SOURCE, COMMISSION_GROUPS,
  COMMISSION_GROUP_LABELS, COMMISSION_GROUP_PERCENT, COMMISSION_TOKEN_DAYS, commissionLink,
  loadParticipantsFromContract, type CommissionGroup, type GridParticipant,
} from "@/lib/commission-grid";
import { newGridToken, sendGridInvite } from "@/lib/commission-grid-server";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO"];

async function requireStaff() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as string)) return null;
  return { userId: user.id, name: (profile.full_name as string) ?? "Usuário" };
}

// GET: os 3 grupos, sempre em ordem fixa (venda, compra, assessoria), com a grade mais recente de cada um.
export async function GET() {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const db = svc();
  const { data } = await db
    .from("cm_commission_grids")
    .select("id, token, group_code, group_percent, participants, allocations, fixed_allocations, status, representative_name, representative_email, representative_phone, submitted_by_name, submitted_at, token_expires_at, reopened_count, reopen_log, created_at")
    .order("created_at", { ascending: true });
  const rows = data ?? [];
  const groups = await Promise.all(COMMISSION_GROUPS.map(async (g) => {
    const active = rows.filter((r) => r.group_code === g && r.status !== "substituido").pop() ?? null;
    // Sem grade ativa, a tela precisa dos participantes do contrato de origem para escolher o representante (só id e nome, ordem canônica).
    let participants_preview: { qualification_id: string; name: string }[] = [];
    if (!active) {
      const loaded = await loadParticipantsFromContract(db, COMMISSION_DEFAULT_SOURCE[g]);
      if (loaded.ok) participants_preview = loaded.participants.map((p) => ({ qualification_id: p.qualification_id, name: p.name }));
    }
    return {
      group_code: g,
      label: COMMISSION_GROUP_LABELS[g],
      group_percent: COMMISSION_GROUP_PERCENT[g],
      default_source: COMMISSION_DEFAULT_SOURCE[g],
      participants_preview,
      grid: active,
    };
  }));
  return NextResponse.json({ groups });
}

// POST: cria o link de um grupo. Travas no servidor: perfil, contrato de origem com lote, representante com e-mail válido.
export async function POST(req: NextRequest) {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { group_code, source_contract_code, representative_qualification_id, representative_name, representative_email, representative_phone, replace } = body as {
    group_code?: string; source_contract_code?: string; representative_qualification_id?: string;
    representative_name?: string; representative_email?: string; representative_phone?: string; replace?: boolean;
  };

  if (!group_code || !(COMMISSION_GROUPS as readonly string[]).includes(group_code)) {
    return NextResponse.json({ error: "Grupo inválido." }, { status: 422 });
  }
  const group = group_code as CommissionGroup;
  const sourceCode = (source_contract_code ?? COMMISSION_DEFAULT_SOURCE[group]).trim();
  const db = svc();

  const loaded = await loadParticipantsFromContract(db, sourceCode);
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status });

  // Participantes e linhas fixas (assessoria: 20% e 20% travados pelo Mandato, mais V3 60%).
  let participants: GridParticipant[] = loaded.participants;
  let fixed: { label: string; percent: number }[] = [];
  if (group === "assessoria") {
    participants = participants.map((p) => ({ ...p, fixed_percent: ASSESSORIA_FIXED_PERCENT_EACH }));
    fixed = [ASSESSORIA_V3_FIXED];
  }

  // Representante: contato vindo da qualificação do participante escolhido, com campos opcionais para sobrescrever.
  let repName = (representative_name ?? "").trim();
  let repEmail = (representative_email ?? "").trim();
  let repPhone = (representative_phone ?? "").trim();
  if (representative_qualification_id) {
    if (!participants.some((p) => p.qualification_id === representative_qualification_id)) {
      return NextResponse.json({ error: "O representante precisa ser um dos participantes do grupo." }, { status: 422 });
    }
    const { data: q } = await db.from("cm_party_qualifications").select("full_name, email, phone").eq("id", representative_qualification_id).maybeSingle();
    if (!q) return NextResponse.json({ error: "Qualificação do representante não encontrada." }, { status: 404 });
    repName = repName || String(q.full_name);
    repEmail = repEmail || String(q.email ?? "");
    repPhone = repPhone || String(q.phone ?? "");
  }
  if (repName.split(/\s+/).filter(Boolean).length < 2) return NextResponse.json({ error: "Informe o nome completo do representante." }, { status: 422 });
  if (!isValidEmail(repEmail)) return NextResponse.json({ error: "Informe um e-mail válido do representante." }, { status: 422 });
  let phoneE164: string | null = null;
  if (repPhone) {
    const ph = normalizePhone(repPhone);
    if (!ph.ok) return NextResponse.json({ error: `WhatsApp do representante inválido: ${ph.error}` }, { status: 422 });
    phoneE164 = ph.e164 ?? null;
  }

  // Grade ativa existente: só substitui com confirmação explícita (o link anterior deixa de valer).
  const { data: active } = await db.from("cm_commission_grids").select("id, status").eq("group_code", group).in("status", ["pendente", "enviado"]).maybeSingle();
  if (active) {
    if (!replace) return NextResponse.json({ error: "Este grupo já tem uma grade ativa.", has_active: true }, { status: 409 });
    if (active.status === "enviado") return NextResponse.json({ error: "A grade deste grupo já foi enviada. Use Reabrir, que exige motivo." }, { status: 409 });
    const { error: supErr } = await db.from("cm_commission_grids").update({ status: "substituido" }).eq("id", active.id).eq("status", "pendente");
    if (supErr) return NextResponse.json({ error: supErr.message }, { status: 500 });
  }

  const token = newGridToken();
  const { data: created, error } = await db
    .from("cm_commission_grids")
    .insert({
      token,
      group_code: group,
      group_percent: COMMISSION_GROUP_PERCENT[group],
      source_contract_id: loaded.contractId,
      participants,
      fixed_allocations: fixed,
      representative_name: repName,
      representative_email: repEmail,
      representative_phone: phoneE164,
      token_expires_at: new Date(Date.now() + COMMISSION_TOKEN_DAYS * 24 * 3600 * 1000).toISOString(),
      created_by: staff.userId,
    })
    .select("id, token, token_expires_at")
    .single();
  if (error || !created) return NextResponse.json({ error: error?.message ?? "Erro ao criar a grade." }, { status: 500 });

  const emailSent = await sendGridInvite({ to: repEmail, name: repName, group, token });
  return NextResponse.json({ id: created.id, link: commissionLink(created.token as string), email_sent: emailSent, expires_at: created.token_expires_at }, { status: 201 });
}
