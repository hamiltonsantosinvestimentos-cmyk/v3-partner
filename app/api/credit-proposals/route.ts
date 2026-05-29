import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { notifyNovaProposta, notifyPropostaAtualizada } from "@/lib/email";
import { createNotification, notifyByRoles } from "@/lib/notify";

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
  requested_value: z.number().gt(0, "Valor deve ser positivo"),
  current_level:   z.enum(["NIVEL_1","NIVEL_2","NIVEL_3"]),
  notes:           z.string().max(2000).optional().nullable(),
  metadata:        z.record(z.string(), z.unknown()).optional().nullable(),
  partner_id:      z.string().uuid().optional().nullable(),
});

const patchSchema = z.object({
  id:               z.string().uuid("ID inválido"),
  stage:            z.enum(["RECEBIDO","TRIAGEM","ANALISE","PENDENCIA","APROVACAO","FINALIZADO"]).optional(),
  status:           z.enum(["PENDING","IN_REVIEW","APPROVED","REJECTED","COMPLETED","CANCELLED"]).optional(),
  approved_value:   z.number().gt(0).optional().nullable(),
  current_level:    z.enum(["NIVEL_1","NIVEL_2","NIVEL_3"]).optional(),
  level1_notes:     z.string().max(2000).optional().nullable(),
  level2_notes:     z.string().max(2000).optional().nullable(),
  level3_notes:     z.string().max(2000).optional().nullable(),
  level1_analyst_id: z.string().uuid().optional().nullable(),
  level2_analyst_id: z.string().uuid().optional().nullable(),
  level3_approver_id: z.string().uuid().optional().nullable(),
  level1_at: z.string().optional().nullable(),
  level2_at: z.string().optional().nullable(),
  level3_at: z.string().optional().nullable(),
  valor_credito_atual:         z.number().gt(0).optional().nullable(),
  comissao_mandato_perc:       z.number().min(0).optional().nullable(),
  comissao_instituicao_perc:   z.number().min(0).optional().nullable(),
  requested_value:             z.number().gt(0).optional(),
  // Campos editáveis por partner/partner_pro
  title:           z.string().min(1).max(200).optional(),
  client_name:     z.string().min(1).max(200).optional(),
  client_cpf_cnpj: z.string().max(20).optional().nullable(),
  metadata:        z.record(z.string(), z.unknown()).optional().nullable(),
  // Campo exclusivo mesa/admin (armazena JSON array de instituições)
  instituicao_encaminhada: z.string().max(1000).optional().nullable(),
  // Transferência de nível e linha (apenas mesa/admin)
  credit_line: z.string().min(1).max(100).optional(),
  partner_id:  z.string().uuid().optional().nullable(),
  // Campos de pendência
  pending_reason:        z.string().max(2000).optional().nullable(),
  pending_responsible:   z.string().max(200).optional().nullable(),
  pending_resolved_at:   z.string().optional().nullable(),
  pending_resolved_by:   z.string().max(200).optional().nullable(),
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
      requested_value, approved_value, current_level, status, stage,
      level1_notes, level2_notes, level3_notes,
      level1_at, level2_at, level3_at, created_at,
      valor_credito_atual, comissao_mandato_perc, comissao_instituicao_perc,
      instituicao_encaminhada, instituicao_feedback,
      pending_reason, pending_responsible, pending_at,
      pending_resolved_at, pending_resolved_by,
      metadata,
      partner:profiles!partner_id(id, full_name)
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
  try {
    const { user, supabase, profile } = await getAuthedUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const msg = Object.entries(fieldErrors)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
        .join(" | ");
      return NextResponse.json({ error: msg || "Dados inválidos" }, { status: 400 });
    }
    const d = parsed.data;

    // Valida valor mínimo N3
    if (d.current_level === "NIVEL_3" && d.requested_value < 5_000_000) {
      return NextResponse.json(
        { error: { requested_value: ["Nível 3 exige valor mínimo de R$ 5.000.000"] } },
        { status: 400 }
      );
    }

    const { count } = await serviceClient()
      .from("credit_desk_proposals").select("id", { count: "exact", head: true });
    const code = d.code ?? `CRED-26-${String((count ?? 0) + 1).padStart(4, "0")}`;

    // Se admin/gestao enviou um partner_id específico no payload (ex: convertendo lead de um partner), usa ele
    // Caso contrário usa o usuário autenticado
    const isAdmin = ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number]);
    const effectivePartnerId = (isAdmin && d.partner_id) ? d.partner_id : user.id;

    const { data, error } = await serviceClient().from("credit_desk_proposals").insert({
      code,
      title:           d.title,
      client_name:     d.client_name,
      client_cpf_cnpj: d.client_cpf_cnpj ?? null,
      credit_line:     d.credit_line,
      requested_value: d.requested_value,
      current_level:   d.current_level,
      status:          "PENDING",
      stage:           "RECEBIDO",
      partner_id:      effectivePartnerId,
      created_by:      user.id,
      metadata:        d.metadata ?? {},
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Notifica admin por e-mail — isolado para não crashar o handler
    try {
      const adminEmail = process.env.EMAIL_ADMIN;
      if (adminEmail) {
        notifyNovaProposta({
          adminEmail,
          partnerName:    profile?.full_name ?? "Partner",
          proposalCode:   data.code,
          proposalTitle:  data.title,
          clientName:     data.client_name,
          creditLine:     data.credit_line,
          requestedValue: d.requested_value,
        });
      }
    } catch { /* notificação é opcional, nunca bloqueia a resposta */ }

    // Notificações in-app (fire-and-forget)
    const partnerName = profile?.full_name ?? "Partner";
    // Confirmação para o próprio partner
    createNotification({
      user_id: user.id,
      type: "proposal",
      title: "Proposta de crédito enviada",
      message: `${code} — ${d.client_name} · ${d.credit_line}`,
      action_url: "/mesa-credito",
    });
    // Alerta para a mesa
    notifyByRoles(["ADMIN", "GESTAO", "MESA_OPERACIONAL"], {
      type: "proposal",
      title: `Nova Proposta — ${code}`,
      message: `${partnerName}: ${d.client_name} · ${d.credit_line} · ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(d.requested_value)}`,
      action_url: `/mesa-credito/${d.current_level.toLowerCase().replace("_", "-")}`,
    });

    return NextResponse.json({ ok: true, proposal: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[credit-proposals POST]", msg, err);
    return NextResponse.json({ error: `Erro ao criar proposta: ${msg}` }, { status: 500 });
  }
}

const PARTNER_ROLES = ["PARTNER", "PARTNER_PRO"] as const;
// Campos que um partner pode editar nas próprias propostas
const PARTNER_ALLOWED_FIELDS = new Set(["title", "client_name", "client_cpf_cnpj", "requested_value", "metadata"]);

// PATCH — atualiza proposta (admin/mesa: tudo; partner/partner_pro: campos de cadastro das próprias propostas)
export async function PATCH(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const isAdmin = ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number]);
  const isPartner = PARTNER_ROLES.includes(profile?.role as typeof PARTNER_ROLES[number]);

  if (!isAdmin && !isPartner) {
    return NextResponse.json({ error: "Sem permissão para atualizar propostas" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const msg = Object.entries(fieldErrors)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
      .join(" | ");
    return NextResponse.json({ error: msg || "Dados inválidos" }, { status: 400 });
  }

  const { id, ...fields } = parsed.data;

  // Partners só podem editar campos permitidos nas próprias propostas
  if (isPartner && !isAdmin) {
    const forbiddenFields = Object.keys(fields).filter(k => !PARTNER_ALLOWED_FIELDS.has(k));
    if (forbiddenFields.length > 0) {
      return NextResponse.json({ error: "Partner não pode alterar: " + forbiddenFields.join(", ") }, { status: 403 });
    }
    // Verifica que a proposta pertence ao partner
    const { data: own } = await serviceClient()
      .from("credit_desk_proposals").select("partner_id").eq("id", id).single();
    if (own?.partner_id !== user.id) {
      return NextResponse.json({ error: "Sem permissão para editar esta proposta" }, { status: 403 });
    }
  }

  const updateData: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() };

  // Registra timestamp do nível se informado
  if (fields.level1_notes && !fields.level1_at) updateData.level1_at = new Date().toISOString();
  if (fields.level2_notes && !fields.level2_at) updateData.level2_at = new Date().toISOString();
  if (fields.level3_notes && !fields.level3_at) updateData.level3_at = new Date().toISOString();

  // Registra pending_at quando vai para PENDENCIA
  if (fields.stage === "PENDENCIA") {
    updateData.pending_at = new Date().toISOString();
  }

  // Quando o stage muda OU metadata é enviado, garante merge correto (nunca sobrescreve dados existentes)
  if (fields.stage || fields.metadata !== undefined) {
    const { data: current } = await serviceClient()
      .from("credit_desk_proposals")
      .select("stage, metadata")
      .eq("id", id)
      .single();

    if (current) {
      const existingMeta = (current.metadata as Record<string, unknown>) ?? {};
      if (fields.stage && current.stage !== fields.stage) {
        // Stage mudou — registra histórico e faz merge completo
        updateData.metadata = {
          ...existingMeta,
          ...(fields.metadata as Record<string, unknown> ?? {}),
          stage_changed_at: new Date().toISOString(),
          stage_history: [
            ...((existingMeta.stage_history as Array<unknown>) ?? []),
            { stage: current.stage, exited_at: new Date().toISOString() },
          ],
        };
      } else if (fields.metadata !== undefined) {
        // Apenas metadata atualizado — merge preservando todos os dados existentes
        updateData.metadata = {
          ...existingMeta,
          ...(fields.metadata as Record<string, unknown> ?? {}),
        };
      }
    }
  }

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
      // Notificação in-app para o partner
      const statusLabels: Record<string, string> = {
        APPROVED: "aprovada ✓", REJECTED: "reprovada ✗",
        IN_REVIEW: "em análise", COMPLETED: "concluída ✓", CANCELLED: "cancelada",
      };
      const label = statusLabels[fields.status] ?? fields.status;
      createNotification({
        user_id: proposal.partner_id,
        type: "proposal",
        title: `Proposta ${label}`,
        message: `${proposal.code} — ${proposal.title}`,
        action_url: "/mesa-credito",
      });
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
