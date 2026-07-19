import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { auditText, auditHtml } from "@/lib/brand-guardian-gate";

// Padrão de governança de exclusão (soft delete + lixeira 30 dias + email aos
// 3 diretores) — extraído do que já roda em produção em cm_asset_listings
// (app/api/cm/listings/[id]/delete/route.ts) para ser reaproveitado por
// qualquer tabela/vertical, em vez de duplicar a mesma lógica por Mesa.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export const GOVERNANCE_EMAILS = [
  "joao.lemos@v3partners.com.br",
  "suporte@v3partners.com.br",
  "robinholino16@gmail.com",
];

export const TRASH_RETENTION_DAYS = 30;

async function getCaller(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role, full_name").eq("id", user.id).single();
  if (!profile) return null;
  return { userId: user.id, role: profile.role as string, fullName: profile.full_name as string | null };
}

async function notifyDeletionGovernance(params: {
  vertical: string;
  itemLabel: string;
  requesterName: string;
  reason: string;
  reviewUrl: string;
  itemId: string;
}) {
  if (!process.env.RESEND_API_KEY) return;
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const subjectGate = auditText(`Solicitação de exclusão — ${params.vertical}: ${params.itemLabel}`);
    const htmlGate = auditHtml(`<p><strong>${params.requesterName}</strong> solicitou a exclusão de <strong>${params.itemLabel}</strong> (${params.vertical}).</p>
             <p><strong>Motivo:</strong> ${params.reason}</p>
             <p>Acesse para aprovar ou rejeitar: ${params.reviewUrl}</p>
             <p style="color:#888;font-size:12px">id: ${params.itemId}</p>`);
    if (htmlGate.blocking.length > 0) console.error(`[governance-delete][${params.vertical}] Brand Guardian bloqueou:`, htmlGate.blocking);
    await resend.emails.send({
      from: "V3 Partners Governança <noreply@v3partners.com.br>",
      to: GOVERNANCE_EMAILS,
      subject: subjectGate.corrected,
      html: htmlGate.corrected,
    });
  } catch (err) {
    console.error(`[governance-delete][${params.vertical}] falha ao notificar governança:`, err);
  }
}

export type DeleteRouteConfig = {
  table: string;
  vertical: string;
  labelColumn: string;
  reviewUrl: string;
  requestRoles: string[];
};

// POST: ADMIN exclui direto (soft delete + email de aviso). Demais roles em
// requestRoles apenas solicitam (pending_governance + email de aprovação).
// PATCH: ADMIN aprova ou rejeita uma solicitação pendente.
export function buildDeleteHandlers(config: DeleteRouteConfig) {
  async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const caller = await getCaller(req);
    if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    if (!config.requestRoles.includes(caller.role)) {
      return NextResponse.json({ error: "Sem permissão para excluir ou solicitar exclusão" }, { status: 403 });
    }

    const { id } = await params;
    const { reason } = await req.json();
    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      return NextResponse.json({ error: "Motivo da exclusão é obrigatório (mínimo 5 caracteres)" }, { status: 422 });
    }

    const db = svc();
    const labelSelect: string = `id, ${config.labelColumn}`;
    const { data: item } = await db.from(config.table).select(labelSelect).eq("id", id).single();
    if (!item) return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
    const label = String((item as unknown as Record<string, unknown>)[config.labelColumn] ?? id);

    if (caller.role === "ADMIN") {
      const { data, error } = await db.from(config.table).update({
        deleted_at: new Date().toISOString(),
        deleted_by: caller.userId,
        deletion_reason: reason.trim(),
        deletion_status: "approved",
      }).eq("id", id).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await notifyDeletionGovernance({
        vertical: config.vertical,
        itemLabel: label,
        requesterName: caller.fullName ?? "Usuário",
        reason: reason.trim(),
        reviewUrl: config.reviewUrl,
        itemId: id,
      });

      return NextResponse.json({ item: data, mode: "deleted" });
    }

    const { data, error } = await db.from(config.table).update({
      deletion_status: "pending_governance",
      deletion_requested_by: caller.userId,
      deletion_requested_at: new Date().toISOString(),
      deletion_reason: reason.trim(),
    }).eq("id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await notifyDeletionGovernance({
      vertical: config.vertical,
      itemLabel: label,
      requesterName: caller.fullName ?? "Usuário",
      reason: reason.trim(),
      reviewUrl: config.reviewUrl,
      itemId: id,
    });

    return NextResponse.json({ item: data, mode: "pending_governance" });
  }

  async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const caller = await getCaller(req);
    if (!caller || caller.role !== "ADMIN") {
      return NextResponse.json({ error: "Apenas ADMIN pode aprovar ou rejeitar exclusões" }, { status: 403 });
    }

    const { id } = await params;
    const { action } = await req.json();
    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "action deve ser approve ou reject" }, { status: 422 });
    }

    const update = action === "approve"
      ? { deleted_at: new Date().toISOString(), deleted_by: caller.userId, deletion_status: "approved" }
      : { deletion_status: "rejected", deletion_requested_by: null, deletion_requested_at: null };

    const { data, error } = await svc().from(config.table).update(update).eq("id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data });
  }

  return { POST, PATCH };
}

// Função (não template literal inline) para o TS não tentar inferir o
// select como string literal e quebrar o parser de tipos do supabase-js.
function lixeiraSelect(selectColumns: string): string {
  return `${selectColumns}, deleted_at, deletion_reason, deleted_by, profiles!deleted_by(full_name)`;
}

export type LixeiraTableConfig = {
  table: string;
  itemType: string;
  selectColumns: string;
};

export function buildLixeiraHandlers(tables: LixeiraTableConfig[]) {
  async function GET(req: NextRequest) {
    const caller = await getCaller(req);
    if (!caller || caller.role !== "ADMIN") {
      return NextResponse.json({ error: "Apenas ADMIN acessa a lixeira" }, { status: 403 });
    }

    const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const db = svc();

    const results = await Promise.all(tables.map(async (t) => {
      const { data, error } = await db
        .from(t.table)
        .select(lixeiraSelect(t.selectColumns))
        .not("deleted_at", "is", null)
        .gte("deleted_at", cutoff)
        .order("deleted_at", { ascending: false });

      if (error) return [];
      return (data ?? []).map((item) => {
        const record = item as unknown as Record<string, unknown>;
        const deletedAt = new Date(record.deleted_at as string);
        const daysElapsed = Math.floor((Date.now() - deletedAt.getTime()) / (24 * 60 * 60 * 1000));
        return { ...record, item_type: t.itemType, days_remaining: Math.max(0, TRASH_RETENTION_DAYS - daysElapsed) };
      });
    }));

    return NextResponse.json({ items: results.flat() });
  }

  async function POST(req: NextRequest) {
    const caller = await getCaller(req);
    if (!caller || caller.role !== "ADMIN") {
      return NextResponse.json({ error: "Apenas ADMIN restaura registros" }, { status: 403 });
    }

    const { item_type, item_id } = await req.json();
    const cfg = tables.find((t) => t.itemType === item_type);
    if (!cfg || !item_id) return NextResponse.json({ error: "item_type/item_id inválido" }, { status: 422 });

    const { data, error } = await svc().from(cfg.table).update({
      deleted_at: null,
      deleted_by: null,
      deletion_reason: null,
      deletion_status: "none",
      deletion_requested_by: null,
      deletion_requested_at: null,
    }).eq("id", item_id).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data });
  }

  return { GET, POST };
}
