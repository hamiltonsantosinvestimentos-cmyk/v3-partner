import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import {
  buildSolicitacaoDocumentos,
  buildLinkQualificacao,
  buildAvisoMinutaNcnda,
  buildConvocacaoAlinhamento,
  type InstitutionalTemplateKey,
  type InstitutionalBuildResult,
} from "@/lib/email";

// POST /api/cm/institutional-email/trigger — Forja Jurídico, Etapa 7
// (21/08/2026). Sessão da Mesa constrói e gateia o e-mail (auditText/
// auditHtml, dentro de lib/email.ts, ponto único de verdade do template),
// depois repassa pro workflow n8n W-CM-Email só pra disparar de fato (Resend
// + log em cm_communications_log), no mesmo padrão de orquestração já usado
// por W15/W-Cessao-Anchor: "acionar via n8n", nunca Resend chamado
// diretamente por esta rota. Se o Brand Guardian bloquear, o n8n nunca é
// chamado, o e-mail nunca sai.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

const SENDERS: Record<string, { email: string; label: string }> = {
  juridico: { email: "juridico@v3partners.com.br", label: "Jurídico V3" },
  athaydes: { email: "luis.athaydes@v3partners.com.br", label: "Dr. Luís Athaydes | V3 Partners" },
};

async function getCaller(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role, full_name").eq("id", user.id).single();
  if (!profile || !ALLOWED.includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string, fullName: profile.full_name as string };
}

export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ error: "Apenas ADMIN/GESTAO/MESA_OPERACIONAL" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const {
    listing_id, template_key, sender_key,
    recipient_email, recipient_name, custom_message,
    documents_list, qualification_url, meeting_date_time, meeting_url,
  } = body as Record<string, unknown>;

  if (!listing_id || !template_key || !sender_key || !recipient_email || !recipient_name || !custom_message) {
    return NextResponse.json({
      error: "Campos obrigatórios: listing_id, template_key, sender_key, recipient_email, recipient_name, custom_message",
    }, { status: 422 });
  }

  const sender = SENDERS[sender_key as string];
  if (!sender) return NextResponse.json({ error: `sender_key inválido. Use: ${Object.keys(SENDERS).join(", ")}` }, { status: 422 });

  const db = svc();
  const { data: listing } = await db
    .from("cm_asset_listings")
    .select("id, anonymous_id, apelido")
    .eq("id", listing_id)
    .single();
  if (!listing) return NextResponse.json({ error: "Ativo não encontrado" }, { status: 404 });

  const assetLabel = listing.apelido ? `${listing.anonymous_id} · ${listing.apelido}` : listing.anonymous_id;

  let result: InstitutionalBuildResult;
  switch (template_key as InstitutionalTemplateKey) {
    case "solicitacao_documentos":
      result = buildSolicitacaoDocumentos({
        recipientName: recipient_name as string,
        assetLabel,
        customMessage: custom_message as string,
        documentsList: Array.isArray(documents_list) ? (documents_list as string[]) : [],
      });
      break;
    case "link_qualificacao":
      if (!qualification_url) {
        return NextResponse.json({ error: "Campo obrigatório para este template: qualification_url" }, { status: 422 });
      }
      result = buildLinkQualificacao({
        recipientName: recipient_name as string,
        assetLabel,
        customMessage: custom_message as string,
        qualificationUrl: qualification_url as string,
      });
      break;
    case "aviso_minuta_ncnda":
      result = buildAvisoMinutaNcnda({
        recipientName: recipient_name as string,
        assetLabel,
        customMessage: custom_message as string,
      });
      break;
    case "convocacao_alinhamento":
      result = buildConvocacaoAlinhamento({
        recipientName: recipient_name as string,
        assetLabel,
        customMessage: custom_message as string,
        meetingDateTime: meeting_date_time as string | undefined,
        meetingUrl: meeting_url as string | undefined,
      });
      break;
    default:
      return NextResponse.json({
        error: `template_key inválido. Use: solicitacao_documentos, link_qualificacao, aviso_minuta_ncnda, convocacao_alinhamento`,
      }, { status: 422 });
  }

  if (result.blocking.length > 0) {
    return NextResponse.json({
      error: "Brand Guardian bloqueou este e-mail. Corrija o texto e tente novamente.",
      violations: result.blocking,
    }, { status: 422 });
  }

  const n8nUrl = process.env.N8N_BASE_URL
    ? `${process.env.N8N_BASE_URL}/webhook/v3-cm-institutional-email`
    : "https://n8n-514n.onrender.com/webhook/v3-cm-institutional-email";

  try {
    const n8nRes = await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listing_id,
        template_key,
        sender_key,
        from: `${sender.label} <${sender.email}>`,
        to: recipient_email,
        subject: result.subject,
        html: result.html,
        brand_gate_violations: result.violations,
        sent_by: caller.userId,
      }),
      signal: AbortSignal.timeout(20000),
    });
    const n8nJson = await n8nRes.json().catch(() => ({}));
    if (!n8nRes.ok || n8nJson?.ok === false) {
      return NextResponse.json({ error: n8nJson?.error ?? "Falha ao disparar e-mail via n8n" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, subject: result.subject, resend_message_id: n8nJson?.resend_message_id ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: `Falha ao conectar com o workflow de disparo: ${message}` }, { status: 502 });
  }
}
