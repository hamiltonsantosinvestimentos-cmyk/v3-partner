import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { mapMissingToDocRequests, DOC_TIPO_LABEL } from "@/lib/ma/document-request-mapper";
import type { DocRequestItem } from "@/lib/ma/document-request-mapper";
import { auditText, auditHtml } from "@/lib/brand-guardian-gate";

export const maxDuration = 300;

const WRITE_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// ─── Email Builder ────────────────────────────────────────────────────────────

function buildPartnerRequestEmail(params: {
  partnerName: string;
  dealCode: string;
  dealSector: string;
  items: DocRequestItem[];
  deadline?: string;
  notes?: string;
  mesaName: string;
}) {
  const { partnerName, dealCode, dealSector, items, deadline, notes, mesaName } = params;
  const alta  = items.filter(i => i.priority === "ALTA");
  const media = items.filter(i => i.priority === "MEDIA");

  const itemRow = (item: DocRequestItem) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #243A66;vertical-align:top;">
        <div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#C9A84C;">${item.tipo}</div>
        <div style="font-size:11px;color:#F0ECE4;margin-top:2px;">${item.descricao}</div>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #243A66;text-align:right;white-space:nowrap;">
        <span style="display:inline-block;padding:2px 8px;border-radius:3px;font-size:8px;font-weight:700;letter-spacing:1px;text-transform:uppercase;background:${item.priority === "ALTA" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)"};color:${item.priority === "ALTA" ? "#EF4444" : "#F59E0B"};border:1px solid ${item.priority === "ALTA" ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)"};">${item.priority}</span>
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

      <!-- Header -->
      <tr><td style="background:#162744;padding:24px 28px;border-bottom:1px solid #243A66;">
        <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;">V3 Partners · Mesa M&A</p>
        <h1 style="margin:0;font-size:18px;font-weight:700;color:#F0ECE4;">Documentos Necessários — ${dealCode}</h1>
        <p style="margin:4px 0 0;font-size:11px;color:#7A8FA8;">${dealSector}</p>
      </td></tr>

      <!-- Body -->
      <tr><td style="padding:24px 28px;">

        <p style="margin:0 0 20px;font-size:13px;color:#7A8FA8;line-height:1.7;">
          Olá, <strong style="color:#F0ECE4;">${partnerName}</strong>.<br/>
          Para avançar na análise do seu deal <strong style="color:#C9A84C;">${dealCode}</strong>,
          nossa mesa precisa dos seguintes documentos. Por favor, faça o upload diretamente na plataforma.
        </p>

        ${alta.length > 0 ? `
        <div style="margin-bottom:16px;">
          <p style="margin:0 0 8px;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#EF4444;">Urgente — Obrigatórios para prosseguir (${alta.length})</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#162744;border:1px solid rgba(239,68,68,0.25);border-radius:8px;overflow:hidden;">
            ${alta.map(itemRow).join("")}
          </table>
        </div>` : ""}

        ${media.length > 0 ? `
        <div style="margin-bottom:20px;">
          <p style="margin:0 0 8px;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#F59E0B;">Importantes — Enviar em breve (${media.length})</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#162744;border:1px solid rgba(245,158,11,0.2);border-radius:8px;overflow:hidden;">
            ${media.map(itemRow).join("")}
          </table>
        </div>` : ""}

        ${deadline ? `
        <div style="background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.2);border-radius:6px;padding:12px 16px;margin-bottom:20px;">
          <span style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#C9A84C;">Prazo:</span>
          <span style="font-size:11px;color:#F0ECE4;margin-left:8px;">${new Date(deadline).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</span>
        </div>` : ""}

        ${notes ? `
        <div style="background:#162744;border:1px solid #243A66;border-radius:6px;padding:12px 16px;margin-bottom:20px;">
          <p style="margin:0 0 4px;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#7A8FA8;">Observação da Mesa</p>
          <p style="margin:0;font-size:11px;color:#F0ECE4;line-height:1.6;">${notes}</p>
        </div>` : ""}

        <a href="https://app.v3partners.com.br/ma" style="display:inline-block;background:#C9A84C;color:#09081A;font-weight:700;font-size:12px;padding:12px 28px;border-radius:6px;text-decoration:none;margin-bottom:24px;">
          Enviar Documentos na Plataforma
        </a>

        <hr style="border:none;border-top:1px solid #243A66;margin:0 0 14px;"/>
        <p style="margin:0;font-size:10px;color:#7A8FA8;line-height:1.6;">
          Enviado por <strong style="color:#F0ECE4;">${mesaName}</strong> · V3 Partners Soluções Ltda<br/>
          <a href="https://v3partners.com.br" style="color:#C9A84C;text-decoration:none;">v3partners.com.br</a>
        </p>

      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ─── POST — Criar pedido de documentos ───────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = serviceClient();
  const { data: profile } = await svc.from("profiles").select("role, full_name, email").eq("id", user.id).single();
  if (!WRITE_ROLES.includes(profile?.role as typeof WRITE_ROLES[number])) {
    return NextResponse.json({ error: "Apenas a Mesa pode criar pedidos de documentos" }, { status: 403 });
  }

  const body = await req.json() as {
    deal_id: string;
    missing?: { field: string; impact: string; priority: "ALTA" | "MEDIA" | "BAIXA" }[];
    custom_items?: DocRequestItem[];
    notes?: string;
    deadline?: string;
    send_email?: boolean;
    forja_snapshot_at?: string;
  };

  const { deal_id, missing, custom_items, notes, deadline, send_email, forja_snapshot_at } = body;
  if (!deal_id) return NextResponse.json({ error: "deal_id obrigatório" }, { status: 400 });

  // Verifica se já existe pedido pending para este deal (evita duplicata automática)
  const { data: existing } = await svc
    .from("ma_document_requests")
    .select("id, status")
    .eq("deal_id", deal_id)
    .in("status", ["pending", "sent", "partial"])
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      error: "Já existe um pedido ativo para este deal",
      existing_id: existing.id,
      existing_status: existing.status,
    }, { status: 409 });
  }

  // Busca dados do deal para o email
  const { data: deal } = await svc
    .from("ma_deals")
    .select("created_by, assigned_to, target_company, sector, documents, asset_data")
    .eq("id", deal_id)
    .single();

  if (!deal) return NextResponse.json({ error: "Deal não encontrado" }, { status: 404 });

  // Busca email do partner
  const partnerUserId = deal.created_by ?? deal.assigned_to;
  let partnerProfile: { full_name: string; email: string } | null = null;
  if (partnerUserId) {
    const { data } = await svc.from("profiles").select("full_name, email").eq("id", partnerUserId).single();
    partnerProfile = data;
  }

  // Constrói lista de itens: do mapper de campos ausentes + itens customizados
  const mappedItems   = missing?.length ? mapMissingToDocRequests(missing) : [];
  const allItems: DocRequestItem[] = [
    ...mappedItems,
    ...(custom_items ?? []),
  ];

  if (allItems.length === 0) {
    return NextResponse.json({ error: "Nenhum item de documento para solicitar" }, { status: 422 });
  }

  const { data: inserted, error: insertError } = await svc
    .from("ma_document_requests")
    .insert({
      deal_id,
      forja_snapshot_at: forja_snapshot_at ?? null,
      requested_by:      user.id,
      documents:         allItems,
      status:            "pending",
      notes:             notes ?? null,
      deadline:          deadline ?? null,
      partner_email:     partnerProfile?.email ?? null,
    })
    .select("id")
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Envia email imediatamente se requested
  let emailSent = false;
  if (send_email && partnerProfile?.email && process.env.RESEND_API_KEY) {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    const assetData = (deal.asset_data ?? {}) as Record<string, unknown>;
    const dealCode = (assetData.v3_code as string) ?? deal_id.slice(0, 8).toUpperCase();

    try {
      const docReqHtmlGate = auditHtml(buildPartnerRequestEmail({
        partnerName: partnerProfile.full_name ?? "Partner",
        dealCode,
        dealSector:  deal.sector ?? "M&A",
        items:       allItems,
        deadline,
        notes,
        mesaName:    profile?.full_name ?? "Mesa V3",
      }));
      if (docReqHtmlGate.blocking.length > 0) console.error("[document-requests] Brand Guardian bloqueou:", docReqHtmlGate.blocking);
      await resend.emails.send({
        from:    "V3 Partners Mesa M&A <noreply@v3partners.com.br>",
        to:      partnerProfile.email,
        subject: auditText(`[${dealCode}] Documentos necessários para análise`).corrected,
        html:    docReqHtmlGate.corrected,
      });

      await svc
        .from("ma_document_requests")
        .update({ status: "sent", email_sent: true, email_sent_at: new Date().toISOString() })
        .eq("id", inserted.id);

      emailSent = true;
    } catch (e) {
      console.error("[document-requests] email error:", e);
    }
  }

  return NextResponse.json({
    ok:           true,
    request_id:   inserted.id,
    items_count:  allItems.length,
    email_sent:   emailSent,
    items:        allItems.map(i => ({ tipo: i.tipo, label: DOC_TIPO_LABEL[i.tipo], priority: i.priority })),
  });
}

// ─── GET — Listar pedidos do deal ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const deal_id = searchParams.get("deal_id");
  if (!deal_id) return NextResponse.json({ error: "deal_id obrigatório" }, { status: 400 });

  const svc = serviceClient();
  const { data, error } = await svc
    .from("ma_document_requests")
    .select("*")
    .eq("deal_id", deal_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Agrega stats para o frontend
  const stats = (data ?? []).map(req => {
    const items: DocRequestItem[] = Array.isArray(req.documents) ? req.documents : [];
    return {
      ...req,
      _stats: {
        total:     items.length,
        pending:   items.filter(i => i.status === "pending").length,
        received:  items.filter(i => i.status === "received").length,
        processed: items.filter(i => i.status === "processed").length,
        rejected:  items.filter(i => i.status === "rejected").length,
      },
    };
  });

  return NextResponse.json({ ok: true, requests: stats });
}
