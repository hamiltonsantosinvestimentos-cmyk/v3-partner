import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import type { DocRequestItem } from "@/lib/ma/document-request-mapper";
import { DOC_TIPO_LABEL } from "@/lib/ma/document-request-mapper";
import { auditText, auditHtml } from "@/lib/brand-guardian-gate";
import { getOrCreateDealUploadToken, buildUploadUrl } from "@/lib/ma/upload-link";

export const maxDuration = 300;

const WRITE_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function computeRequestStatus(items: DocRequestItem[]): "pending" | "sent" | "partial" | "complete" {
  if (items.every(i => i.status === "processed" || i.status === "rejected")) return "complete";
  if (items.some(i => i.status === "received" || i.status === "processed")) return "partial";
  return "sent";
}

// ─── PATCH — Atualiza um pedido ou item específico ───────────────────────────
//
// Ações suportadas:
//   "send_to_partner"  — envia email ao partner (muda status para "sent")
//   "mark_received"    — marca item como recebido (+ doc_id opcional)
//   "mark_rejected"    — marca item como rejeitado
//   "mark_processed"   — marca item como processado (após forja-pdf rodar)
//   "add_item"         — adiciona novo item ao pedido
//   "cancel"           — cancela o pedido inteiro

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = serviceClient();
  const { data: profile } = await svc.from("profiles").select("role, full_name, email").eq("id", user.id).single();
  if (!WRITE_ROLES.includes(profile?.role as typeof WRITE_ROLES[number])) {
    return NextResponse.json({ error: "Apenas a Mesa pode atualizar pedidos" }, { status: 403 });
  }
  const body = await req.json() as {
    action: "send_to_partner" | "mark_received" | "mark_rejected" | "mark_processed" | "add_item" | "cancel";
    item_id?: string;
    doc_id?: string;
    rejection_reason?: string;
    new_item?: DocRequestItem;
    notes?: string;
    deadline?: string;
  };

  const { action, item_id, doc_id, rejection_reason, new_item, notes, deadline } = body;

  // Carrega pedido atual
  const { data: request, error: fetchError } = await svc
    .from("ma_document_requests")
    .select("*, ma_deals(target_company, sector, asset_data, created_by, assigned_to)")
    .eq("id", id)
    .single();

  if (fetchError || !request) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  if (request.status === "cancelled") return NextResponse.json({ error: "Pedido cancelado — não pode ser alterado" }, { status: 422 });

  let items: DocRequestItem[] = Array.isArray(request.documents) ? request.documents : [];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  // ─── Ações ─────────────────────────────────────────────────────────────────

  if (action === "cancel") {
    updates.status = "cancelled";

  } else if (action === "add_item") {
    if (!new_item) return NextResponse.json({ error: "new_item obrigatório" }, { status: 400 });
    items = [...items, { ...new_item, id: new_item.id ?? crypto.randomUUID(), status: "pending", received_at: null, doc_id: null }];
    updates.documents = items;
    updates.status = computeRequestStatus(items);

  } else if (action === "mark_received") {
    if (!item_id) return NextResponse.json({ error: "item_id obrigatório" }, { status: 400 });
    items = items.map(i =>
      i.id === item_id
        ? { ...i, status: "received" as const, received_at: new Date().toISOString(), doc_id: doc_id ?? i.doc_id }
        : i
    );
    updates.documents = items;
    updates.status = computeRequestStatus(items);

  } else if (action === "mark_rejected") {
    if (!item_id) return NextResponse.json({ error: "item_id obrigatório" }, { status: 400 });
    items = items.map(i =>
      i.id === item_id
        ? { ...i, status: "rejected" as const, received_at: new Date().toISOString() }
        : i
    );
    // Injeta reason no item (campo extra tolerado pelo JSON livre)
    if (rejection_reason) {
      items = items.map(i =>
        i.id === item_id ? { ...i, rejection_reason } as DocRequestItem & { rejection_reason: string } : i
      );
    }
    updates.documents = items;
    updates.status = computeRequestStatus(items);

  } else if (action === "mark_processed") {
    if (!item_id) return NextResponse.json({ error: "item_id obrigatório" }, { status: 400 });
    items = items.map(i =>
      i.id === item_id ? { ...i, status: "processed" as const } : i
    );
    updates.documents = items;
    updates.status = computeRequestStatus(items);

  } else if (action === "send_to_partner") {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: "RESEND_API_KEY não configurada" }, { status: 500 });
    }

    // 06/09/2026 (BRIEF Link de Captacao pos-NCNDA, ajuste "go" de João):
    // trava de governança, o email desta aba passa a embutir o link real de
    // captação de documentos — por isso não pode ser enviado antes do NCNDA
    // estar assinado, mesma trava já aplicada ao bloco equivalente no card
    // do NCNDA em contrato-panel.tsx.
    const { data: ncndaContract } = await svc
      .from("operation_contracts")
      .select("status_signature")
      .eq("deal_id", request.deal_id)
      .eq("vertical", "ma")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!ncndaContract || ncndaContract.status_signature !== "assinado") {
      return NextResponse.json({
        error: "O NCNDA deste deal ainda não foi assinado pela contraparte. O link de captação de documentos só pode ser enviado depois da confidencialidade formalizada.",
      }, { status: 422 });
    }

    const uploadTokenResult = await getOrCreateDealUploadToken(svc, request.deal_id, user.id, { label: "Aba Docs" });
    if ("error" in uploadTokenResult) {
      return NextResponse.json({ error: uploadTokenResult.error }, { status: 500 });
    }
    const uploadUrl = buildUploadUrl(uploadTokenResult.token);

    // Resolve email do partner
    const deal = request.ma_deals as Record<string, unknown>;
    const partnerUserId = deal?.created_by ?? deal?.assigned_to;
    let partnerEmail = request.partner_email as string | null;
    let partnerName = "Partner";

    if (partnerUserId && !partnerEmail) {
      const { data: pp } = await svc.from("profiles").select("full_name, email").eq("id", partnerUserId).single();
      partnerEmail = pp?.email ?? null;
      partnerName  = pp?.full_name ?? "Partner";
    }

    if (!partnerEmail) return NextResponse.json({ error: "Email do partner não encontrado" }, { status: 422 });

    const assetData = (deal?.asset_data ?? {}) as Record<string, unknown>;
    const dealCode  = (assetData.v3_code as string) ?? (id.slice(0, 8).toUpperCase());

    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Constrói email com os itens ainda pendentes/rejeitados
    const pendingItems = items.filter(i => i.status === "pending" || i.status === "rejected");

    if (pendingItems.length === 0) {
      return NextResponse.json({ error: "Nenhum item pendente para enviar" }, { status: 422 });
    }

    const emailHtml = buildResendEmail({
      partnerName,
      dealCode,
      dealSector: (deal?.sector as string) ?? "M&A",
      items: pendingItems,
      deadline: request.deadline ?? deadline ?? undefined,
      notes: notes ?? request.notes ?? undefined,
      mesaName: profile?.full_name ?? "Mesa V3",
      uploadUrl,
    });

    const docReqIdHtmlGate = auditHtml(emailHtml);
    if (docReqIdHtmlGate.blocking.length > 0) console.error("[document-requests/id] Brand Guardian bloqueou:", docReqIdHtmlGate.blocking);
    await resend.emails.send({
      from:    "V3 Partners Mesa M&A <noreply@v3partners.com.br>",
      to:      partnerEmail,
      subject: auditText(`[${dealCode}] Documentos necessários para análise`).corrected,
      html:    docReqIdHtmlGate.corrected,
    });

    updates.status        = "sent";
    updates.email_sent    = true;
    updates.email_sent_at = new Date().toISOString();
    updates.partner_email = partnerEmail;
    if (deadline) updates.deadline = deadline;
    if (notes)    updates.notes    = notes;

  } else {
    return NextResponse.json({ error: "action inválida" }, { status: 400 });
  }

  const { data: updated, error: updateError } = await svc
    .from("ma_document_requests")
    .update(updates)
    .eq("id", id)
    .select("id, status, documents, email_sent, email_sent_at")
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const updatedItems: DocRequestItem[] = Array.isArray(updated.documents) ? updated.documents : [];
  return NextResponse.json({
    ok:     true,
    id:     updated.id,
    status: updated.status,
    stats: {
      total:     updatedItems.length,
      pending:   updatedItems.filter(i => i.status === "pending").length,
      received:  updatedItems.filter(i => i.status === "received").length,
      processed: updatedItems.filter(i => i.status === "processed").length,
      rejected:  updatedItems.filter(i => i.status === "rejected").length,
    },
    email_sent:    updated.email_sent,
    email_sent_at: updated.email_sent_at,
  });
}

// ─── Email reutilizável ───────────────────────────────────────────────────────

function buildResendEmail(params: {
  partnerName: string;
  dealCode: string;
  dealSector: string;
  items: DocRequestItem[];
  deadline?: string;
  notes?: string;
  mesaName: string;
  uploadUrl: string;
}) {
  const { partnerName, dealCode, dealSector, items, deadline, notes, mesaName, uploadUrl } = params;
  const alta  = items.filter(i => i.priority === "ALTA");
  const media = items.filter(i => i.priority === "MEDIA");

  const row = (item: DocRequestItem) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #243A66;vertical-align:top;">
        <div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#C9A84C;">${item.tipo}</div>
        <div style="font-size:11px;color:#F0ECE4;margin-top:2px;">${item.descricao}</div>
        ${item.status === "rejected" ? `<div style="font-size:9px;color:#EF4444;margin-top:3px;">Documento anterior rejeitado — reenviar versão correta</div>` : ""}
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #243A66;text-align:right;">
        <span style="display:inline-block;padding:2px 8px;border-radius:3px;font-size:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase;background:${item.priority === "ALTA" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)"};color:${item.priority === "ALTA" ? "#EF4444" : "#F59E0B"};">${item.priority}</span>
      </td>
    </tr>`;

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet"/>
</head>
<body style="font-family:'DM Sans',Arial,sans-serif;background:#09081A;color:#F0ECE4;margin:0;padding:0;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#09081A;padding:32px 0;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" style="background:#111F35;border:1px solid #243A66;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#162744;padding:24px 28px;border-bottom:1px solid #243A66;">
        <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;">V3 Partners · Mesa M&A</p>
        <h1 style="margin:0;font-size:18px;font-weight:700;color:#F0ECE4;">Documentos Necessários — ${dealCode}</h1>
        <p style="margin:4px 0 0;font-size:11px;color:#7A8FA8;">${dealSector}</p>
      </td></tr>
      <tr><td style="padding:24px 28px;">
        <p style="margin:0 0 20px;font-size:13px;color:#7A8FA8;line-height:1.7;">
          Olá, <strong style="color:#F0ECE4;">${partnerName}</strong>.<br/>
          Para continuar a análise do deal <strong style="color:#C9A84C;">${dealCode}</strong>, precisamos dos documentos abaixo.
        </p>
        ${alta.length > 0 ? `
        <p style="margin:0 0 6px;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#EF4444;">Urgente — Obrigatórios (${alta.length})</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#162744;border:1px solid rgba(239,68,68,0.25);border-radius:8px;overflow:hidden;margin-bottom:16px;">
          ${alta.map(row).join("")}
        </table>` : ""}
        ${media.length > 0 ? `
        <p style="margin:0 0 6px;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#F59E0B;">Importantes (${media.length})</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#162744;border:1px solid rgba(245,158,11,0.2);border-radius:8px;overflow:hidden;margin-bottom:16px;">
          ${media.map(row).join("")}
        </table>` : ""}
        ${deadline ? `<div style="background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.2);border-radius:6px;padding:10px 14px;margin-bottom:16px;font-size:11px;color:#F0ECE4;">Prazo: <strong>${new Date(deadline).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</strong></div>` : ""}
        ${notes ? `<div style="background:#162744;border:1px solid #243A66;border-radius:6px;padding:10px 14px;margin-bottom:16px;"><p style="margin:0 0 4px;font-size:9px;color:#7A8FA8;text-transform:uppercase;letter-spacing:1px;">Observação</p><p style="margin:0;font-size:11px;color:#F0ECE4;">${notes}</p></div>` : ""}
        <a href="${uploadUrl}" style="display:inline-block;background:#C9A84C;color:#09081A;font-weight:700;font-size:12px;padding:12px 28px;border-radius:6px;text-decoration:none;margin-bottom:8px;">Enviar Documentos</a>
        <p style="margin:0 0 20px;font-size:10px;color:#7A8FA8;">Link direto, sem necessidade de login.</p>
        <hr style="border:none;border-top:1px solid #243A66;margin:0 0 14px;"/>
        <p style="margin:0;font-size:10px;color:#7A8FA8;">Enviado por <strong style="color:#F0ECE4;">${mesaName}</strong> · <a href="https://v3partners.com.br" style="color:#C9A84C;text-decoration:none;">v3partners.com.br</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// Exporta para reutilização no route POST (compartilhado via import)
export { DOC_TIPO_LABEL };
