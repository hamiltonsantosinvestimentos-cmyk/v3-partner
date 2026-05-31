import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { buildPropostaHTML } from "@/components/propostas/proposta-template";

const ALLOWED = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };
  const { data: profile } = await svc()
    .from("profiles").select("id, full_name, role").eq("id", user.id).single();
  return { user, profile };
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, profile } = await getUser();
  if (!user)  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED.includes(profile?.role ?? ""))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: proposal } = await svc()
    .from("commercial_proposals").select("*").eq("id", id).single();

  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (proposal.status !== "draft")
    return NextResponse.json({ error: "Proposta não está em rascunho" }, { status: 422 });

  // Env vars — padrão igual ao /api/ma/clicksign-send
  const accessToken = process.env.CLICKSIGN_ACCESS_TOKEN;
  const baseUrl     = process.env.CLICKSIGN_BASE_URL ?? "https://sandbox.clicksign.com";
  const resendKey   = process.env.RESEND_API_KEY;

  let clicksign_key = "";
  let clicksign_url = "";

  // Gerar HTML V3-branded da proposta
  const proposalHTML = buildPropostaHTML({
    code:              proposal.code,
    title:             proposal.title,
    service_type:      proposal.service_type,
    recipient_name:    proposal.recipient_name,
    recipient_email:   proposal.recipient_email,
    recipient_company: proposal.recipient_company ?? undefined,
    value:             proposal.value ? Number(proposal.value) : undefined,
    description:       proposal.description ?? undefined,
    sender_name:       profile?.full_name ?? "Mesa M&A",
    date:              new Date().toISOString(),
  });

  // ── 1. ClickSign — criar documento + adicionar signatário + ativar ────────
  if (accessToken) {
    try {
      // 1a. Criar documento com HTML base64
      const createRes = await fetch(
        `${baseUrl}/api/v1/documents?access_token=${accessToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            document: {
              path:          `/${proposal.code}-${Date.now()}.html`,
              content_base64: Buffer.from(proposalHTML).toString("base64"),
              auto_close:    true,
              locale:        "pt-BR",
              remind_interval: 3,
            },
          }),
        }
      );

      if (createRes.ok) {
        const createData = await createRes.json();
        clicksign_key = createData.document?.key ?? "";
        clicksign_url = `${baseUrl}/sign/${clicksign_key}`;

        // 1b. Adicionar signatário (destinatário da proposta)
        if (clicksign_key) {
          await fetch(
            `${baseUrl}/api/v1/lists?access_token=${accessToken}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                list: {
                  document_key: clicksign_key,
                  signer: {
                    email:             proposal.recipient_email,
                    name:              proposal.recipient_name,
                    auth_type:         "email",
                    phone_number:      null,
                    has_documentation: false,
                  },
                  sign_as: "sign",
                  message: `V3 Partners solicita sua assinatura na proposta: ${proposal.title}`,
                },
              }),
            }
          );

          // 1c. Ativar documento (dispara email ClickSign para o signatário)
          await fetch(
            `${baseUrl}/api/v1/documents/${clicksign_key}/finish?access_token=${accessToken}`,
            { method: "PATCH" }
          );
        }
      } else {
        const err = await createRes.text();
        void svc().from("execution_errors").insert({
          workflow: "api/propostas/send ClickSign",
          error_message: `ClickSign createDoc: ${err}`, severity: "medium",
        });
      }
    } catch (e) {
      void svc().from("execution_errors").insert({
        workflow: "api/propostas/send ClickSign",
        error_message: String(e), severity: "medium",
      });
    }
  }

  // ── 2. Resend — email de aviso com link de assinatura ─────────────────────
  if (resendKey) {
    try {
      const valueStr = proposal.value
        ? `R$ ${Number(proposal.value).toLocaleString("pt-BR")}`
        : null;

      const emailHtml = `
<div style="background:#09081A;padding:40px 32px;font-family:'DM Sans',Arial,sans-serif;max-width:560px;margin:0 auto">
  <img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style="height:36px;margin-bottom:28px"/>
  <p style="font-size:9px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#E8C97A;margin:0 0 8px">Proposta Comercial · ${proposal.code}</p>
  <h1 style="font-size:22px;font-weight:700;color:#F5F1E8;margin:0 0 16px;line-height:1.3">${proposal.title}</h1>
  <p style="font-size:13px;color:#9BAFC5;line-height:1.7;margin:0 0 24px">
    Olá, <strong style="color:#F5F1E8">${proposal.recipient_name}</strong>${proposal.recipient_company ? ` — ${proposal.recipient_company}` : ""},<br/>
    a V3 Partners preparou uma proposta de serviços para você. Clique no botão abaixo para visualizar e assinar.
  </p>
  ${valueStr ? `
  <div style="background:#162744;border:1px solid #243A66;border-radius:6px;padding:14px 18px;margin-bottom:24px;display:inline-block">
    <p style="font-size:9px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#E8C97A;margin:0 0 4px">Valor</p>
    <p style="font-size:22px;font-weight:800;color:#C9A84C;margin:0">${valueStr}</p>
  </div>` : ""}
  ${clicksign_url ? `
  <div style="margin-bottom:28px">
    <a href="${clicksign_url}" style="display:inline-block;background:#C9A84C;color:#09081A;text-decoration:none;padding:13px 28px;border-radius:6px;font-weight:700;font-size:14px">
      Visualizar e Assinar Proposta
    </a>
  </div>` : ""}
  <hr style="border:none;border-top:1px solid #162744;margin:24px 0"/>
  <p style="font-size:11px;color:#9BAFC5;margin:0;line-height:1.6">
    V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50<br/>
    Rua Visconde de Pirajá, 414, Sala 718 — Ipanema, Rio de Janeiro<br/>
    <a href="mailto:contato@v3partners.com.br" style="color:#9BAFC5">contato@v3partners.com.br</a>
  </p>
</div>`;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from:    "inteligencia@v3partners.com.br",
          to:      [proposal.recipient_email],
          cc:      proposal.partner_email ? [proposal.partner_email] : undefined,
          subject: `Proposta Comercial V3 Partners — ${proposal.title}`,
          html:    emailHtml,
        }),
      });
    } catch (e) {
      void svc().from("execution_errors").insert({
        workflow: "api/propostas/send Resend",
        error_message: String(e), severity: "medium",
      });
    }
  }

  // ── 3. Atualizar proposta no banco ────────────────────────────────────────
  await svc().from("commercial_proposals").update({
    status:   "sent",
    sent_at:  new Date().toISOString(),
    ...(clicksign_key && { clicksign_key }),
    ...(clicksign_url && { clicksign_url }),
  }).eq("id", id);

  // ── 4. Evento no log de conversas ────────────────────────────────────────
  void svc().from("proposal_messages").insert({
    proposal_id: id,
    sender_id:   user.id,
    sender_name: profile?.full_name ?? "Mesa M&A",
    sender_role: profile?.role ?? "MESA_OPERACIONAL",
    content: `Proposta enviada para ${proposal.recipient_name}${proposal.recipient_company ? ` (${proposal.recipient_company})` : ""} via Resend${clicksign_key ? " + ClickSign" : ""}${proposal.partner_name ? ` · CC: ${proposal.partner_name}` : ""}.`,
    type: "system_event",
  });

  return NextResponse.json({ ok: true, clicksign_url });
}
