import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

const ALLOWED = ["ADMIN", "GESTAO", "MESA"];

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };
  const { data: profile } = await svc().from("profiles").select("id, full_name, role").eq("id", user.id).single();
  return { user, profile };
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, profile } = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED.includes(profile?.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: proposal } = await svc()
    .from("commercial_proposals").select("*").eq("id", id).single();

  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (proposal.status !== "draft") {
    return NextResponse.json({ error: "Proposta não está em rascunho" }, { status: 422 });
  }

  const clicksignKey = process.env.CLICKSIGN_API_KEY;
  const resendKey    = process.env.RESEND_API_KEY;
  let clicksign_url  = "";
  let clicksign_key  = "";

  // ── 1. Criar documento no ClickSign ──────────────────────────────────────
  if (clicksignKey) {
    try {
      const csRes = await fetch("https://app.clicksign.com/api/v1/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "access-token": clicksignKey,
        },
        body: JSON.stringify({
          document: {
            path: `/${proposal.code}-${Date.now()}.pdf`,
            template: {
              data: {
                title: proposal.title,
                service_type: proposal.service_type,
                recipient_name: proposal.recipient_name,
                recipient_company: proposal.recipient_company ?? "",
                value: proposal.value ? `R$ ${Number(proposal.value).toLocaleString("pt-BR")}` : "A definir",
                description: proposal.description ?? "",
                sender_name: profile?.full_name ?? "V3 Partners",
                date: new Date().toLocaleDateString("pt-BR"),
              },
            },
          },
        }),
      });
      if (csRes.ok) {
        const csData = await csRes.json();
        clicksign_key = csData.document?.key ?? "";
        clicksign_url = csData.document?.download_finalized_link ?? csData.document?.url ?? "";
      }
    } catch (e) {
      void svc().from("execution_errors").insert({ workflow: "api/propostas/send ClickSign", error_message: String(e), severity: "medium" });
    }
  }

  // ── 2. Enviar email via Resend ────────────────────────────────────────────
  if (resendKey) {
    try {
      const toList = [proposal.recipient_email];
      const ccList = proposal.partner_email ? [proposal.partner_email] : [];

      const htmlBody = `
        <div style="background:#09081A;padding:32px;font-family:'DM Sans',Arial,sans-serif;max-width:560px;margin:0 auto;border-radius:8px">
          <img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style="height:36px;margin-bottom:24px" />
          <h1 style="color:#F5F1E8;font-size:20px;font-weight:700;margin:0 0 8px">${proposal.title}</h1>
          <p style="color:#9BAFC5;font-size:13px;margin:0 0 20px">Olá, ${proposal.recipient_name}${proposal.recipient_company ? ` — ${proposal.recipient_company}` : ""},</p>
          <p style="color:#9BAFC5;font-size:13px;line-height:1.7;margin:0 0 20px">
            A <strong style="color:#F5F1E8">V3 Partners</strong> preparou uma proposta comercial para você.
            ${proposal.description ? `<br/><br/>${proposal.description}` : ""}
          </p>
          ${proposal.value ? `<div style="background:#162744;border:1px solid #243A66;border-radius:6px;padding:14px;margin-bottom:20px"><p style="color:#9BAFC5;font-size:10px;text-transform:uppercase;letter-spacing:.1em;margin:0 0 4px">Valor da Proposta</p><p style="color:#C9A84C;font-size:20px;font-weight:700;margin:0">R$ ${Number(proposal.value).toLocaleString("pt-BR")}</p></div>` : ""}
          ${clicksign_url ? `<a href="${clicksign_url}" style="display:inline-block;background:#C9A84C;color:#09081A;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:700;font-size:13px;margin-bottom:20px">Assinar Proposta</a>` : ""}
          <hr style="border:none;border-top:1px solid #243A66;margin:20px 0"/>
          <p style="color:#9BAFC5;font-size:11px;margin:0">V3 Partners Soluções Ltda — CNPJ 14.219.287/0001-50<br/>contato@v3partners.com.br</p>
        </div>`;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "inteligencia@v3partners.com.br",
          to: toList,
          cc: ccList.length ? ccList : undefined,
          subject: `Proposta Comercial V3 Partners — ${proposal.title}`,
          html: htmlBody,
        }),
      });
    } catch (e) {
      void svc().from("execution_errors").insert({ workflow: "api/propostas/send Resend", error_message: String(e), severity: "medium" });
    }
  }

  // ── 3. Atualizar proposta ─────────────────────────────────────────────────
  await svc().from("commercial_proposals").update({
    status: "sent",
    sent_at: new Date().toISOString(),
    ...(clicksign_key && { clicksign_key }),
    ...(clicksign_url && { clicksign_url }),
  }).eq("id", id);

  // ── 4. Gravar evento no log de conversas ──────────────────────────────────
  void svc().from("proposal_messages").insert({
    proposal_id: id,
    sender_id:   user.id,
    sender_name: profile?.full_name ?? "Mesa M&A",
    sender_role: profile?.role ?? "MESA",
    content:     `Proposta enviada para ${proposal.recipient_name}${proposal.recipient_company ? ` (${proposal.recipient_company})` : ""} via email${proposal.partner_name ? ` · CC: ${proposal.partner_name}` : ""}.`,
    type:        "system_event",
  });

  return NextResponse.json({ ok: true, clicksign_url });
}
