import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { notifyNovaProposta, notifyPropostaAtualizada } from "@/lib/email";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getAuthedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null, supabase };
  const { data: profile } = await supabase.from("profiles").select("id, full_name, role").eq("id", user.id).single();
  return { user, profile, supabase };
}

const ADMIN_ROLES    = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;
const CREDIT_LINES_N1 = ["HOME EQUITY", "AVAL", "CDC", "CREDITO PESSOAL", "CONSIGNADO"];
const CREDIT_LINES_N2 = ["FIDC", "CRI", "CRA", "V3GIRO", "CGI", "RECEIVABLES"];
const CREDIT_LINES_N3 = ["CPR", "FUNDOS", "PROJECT FINANCE", "REAL ESTATE", "INFRASTRUCTURE"];
const ALL_CREDIT_LINES = [...CREDIT_LINES_N1, ...CREDIT_LINES_N2, ...CREDIT_LINES_N3];

const createSchema = z.object({
  code:            z.string().max(50).optional(),
  title:           z.string().min(3, "Título muito curto").max(200),
  client_name:     z.string().min(2, "Nome do cliente obrigatório").max(200),
  client_cpf_cnpj: z.string().max(20).optional().nullable(),
  credit_line:     z.string().min(1, "Linha de crédito obrigatória"),
  requested_value: z.number().positive("Valor deve ser positivo"),
  current_level:   z.enum(["NIVEL_1","NIVEL_2","NIVEL_3"]),
  notes:           z.string().max(2000).optional().nullable(),
});

const patchSchema = z.object({
  id:               z.string().uuid("ID inválido"),
  stage:            z.enum(["RECEBIDO","TRIAGEM","ANALISE","PENDENCIA","APROVACAO","FINALIZADO"]).optional(),
  status:           z.enum(["PENDING","IN_REVIEW","APPROVED","REJECTED","COMPLETED","CANCELLED"]).optional(),
  approved_value:   z.number().positive().optional().nullable(),
  current_level:    z.enum(["NIVEL_1","NIVEL_2","NIVEL_3"]).optional(),
  level1_notes:     z.string().max(2000).optional().nullable(),
  level2_notes:     z.string().max(2000).optional().nullable(),
  level3_notes:     z.string().max(2000).optional().nullable(),
  level1_analyst_id: z.string().uuid().optional().nullable(),
  level2_analyst_id: z.string().uuid().optional().nullable(),
  level3_approver_id: z.string().uuid().optional().nullable(),
  valor_credito_atual:         z.number().positive().optional().nullable(),
  comissao_mandato_perc:       z.number().min(0).optional().nullable(),
  comissao_instituicao_perc:   z.number().min(0).optional().nullable(),
  requested_value:             z.number().positive().optional(),
});

// GET — lista propostas (partner vê as suas, admin/mesa vê todas)
export async function GET(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const level  = searchParams.get("level");
  const isAdmin = ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number]);

  const svc = serviceClient();
  let query = svc
    .from("credit_desk_proposals")
    .select(`
      id, code, title, client_name, client_cpf_cnpj, credit_line,
      requested_value, approved_value, current_level, status,
      level1_notes, level2_notes, level3_notes,
      level1_at, level2_at, level3_at, created_at,
      partner:profiles!credit_desk_proposals_partner_id_fkey(id, full_name)
    `)
    .order("created_at", { ascending: false });

  if (!isAdmin) query = query.eq("partner_id", user.id);
  if (status)   query = query.eq("status", status.toUpperCase());
  if (level)    query = query.eq("current_level", level.toUpperCase());

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ proposals: data ?? [] });
}

// POST — cria nova proposta de crédito
export async function POST(req: NextRequest) {
  const { user, supabase } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const d = parsed.data;

  // Valida valor mínimo N3
  if (d.current_level === "NIVEL_3" && d.requested_value < 5_000_000) {
    return NextResponse.json(
      { error: { requested_value: ["Nível 3 exige valor mínimo de R$ 5.000.000"] } },
      { status: 400 }
    );
  }

  const { count } = await supabase
    .from("credit_desk_proposals").select("*", { count: "exact", head: true });
  const code = d.code ?? `CRED-26-${String((count ?? 0) + 1).padStart(4, "0")}`;

  const { data, error } = await supabase.from("credit_desk_proposals").insert({
    code,
    title:           d.title,
    client_name:     d.client_name,
    client_cpf_cnpj: d.client_cpf_cnpj ?? null,
    credit_line:     d.credit_line,
    requested_value: d.requested_value,
    current_level:   d.current_level,
    status:          "PENDING",
    partner_id:      user.id,
    created_by:      user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notifica admin por e-mail (fire and forget)
  const adminEmail = process.env.EMAIL_ADMIN;
  if (adminEmail) {
    const svcEmail = serviceClient();
    const { data: partnerUser } = await svcEmail.auth.admin.getUserById(user.id);
    notifyNovaProposta({
      adminEmail,
      partnerName:    profile?.full_name ?? "Partner",
      proposalCode:   data.code,
      proposalTitle:  data.title,
      clientName:     data.client_name,
      creditLine:     data.credit_line,
      requestedValue: d.requested_value,
    });
    void partnerUser; // evita lint warning
  }

  return NextResponse.json({ ok: true, proposal: data });
}

// PATCH — atualiza proposta (status, análise por nível) — admin/mesa only
export async function PATCH(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const isAdmin = ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number]);
  if (!isAdmin) {
    return NextResponse.json({ error: "Apenas analistas podem atualizar propostas" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { id, ...fields } = parsed.data;
  const updateData: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() };

  // Registra timestamp do nível se informado
  if (fields.level1_notes && !fields.level1_at) updateData.level1_at = new Date().toISOString();
  if (fields.level2_notes && !fields.level2_at) updateData.level2_at = new Date().toISOString();
  if (fields.level3_notes && !fields.level3_at) updateData.level3_at = new Date().toISOString();

  const { data, error } = await serviceClient()
    .from("credit_desk_proposals")
    .update(updateData)
    .eq("id", id)
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAudit({ userId: user.id!, userName: profile?.full_name, action: "UPDATE", entity: "credit_desk_proposals", entityId: id, newData: fields as Record<string, unknown> });

  // Notifica partner se status mudou (fire and forget)
  if (fields.status) {
    const svcEmail = serviceClient();
    const { data: proposal } = await svcEmail
      .from("credit_desk_proposals")
      .select("partner_id, title, credit_line, code")
      .eq("id", id)
      .single();
    if (proposal?.partner_id) {
      const { data: partnerUser } = await svcEmail.auth.admin.getUserById(proposal.partner_id);
      const partnerEmail = partnerUser?.user?.email;
      const { data: partnerProfile } = await svcEmail
        .from("profiles").select("full_name").eq("id", proposal.partner_id).single();
      if (partnerEmail) {
        notifyPropostaAtualizada({
          partnerEmail,
          partnerName:    partnerProfile?.full_name ?? "Partner",
          proposalCode:   proposal.code,
          proposalTitle:  proposal.title,
          creditLine:     proposal.credit_line,
          novoStatus:     fields.status,
        });
      }
    }
  }

  return NextResponse.json({ ok: true, proposal: data });
}

// DELETE — somente ADMIN
export async function DELETE(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (profile?.role !== "ADMIN") {
    return NextResponse.json({ error: "Apenas administradores podem excluir propostas" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  const { error } = await serviceClient().from("credit_desk_proposals").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAudit({ userId: user.id!, userName: profile?.full_name, action: "DELETE", entity: "credit_desk_proposals", entityId: id });

  return NextResponse.json({ ok: true });
}
