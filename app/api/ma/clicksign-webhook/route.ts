import { NextRequest, NextResponse } from "next/server";
import { createClient as sc, type SupabaseClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "crypto";
import { auditHtml, auditText } from "@/lib/brand-guardian-gate";
import { notifyDealTimeline } from "@/lib/ma-negociacao-notify";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const IS_DEMO = false;

const MANDATARIO_VENDA_EMAIL = "rafa2704@gmail.com";
const MANDATARIO_VENDA_NOME = "Rafael Campos";
const CARTA_INTENCAO_TEMPLATE_NAME = "Carta de Intencao de Compra (Matching)";

// Etapa 3 da esteira M&A: quando a Carta de Intenção (Etapa 2) é assinada
// pelo comprador ("compra firme"), dispara automaticamente a FPA Venda
// (Etapa 3) para o grupo do lado vendedor (Rafael). Gera um novo invite
// (access_side "seller", já usado pelo Contrato de Venda) com token próprio
// e envia o link real por e-mail.
async function triggerFpaVendaIfCartaIntencao(
  db: SupabaseClient,
  contract: { template_id: string | null; deal_id: string | null; deal_room_invite_id: string | null }
) {
  if (!contract.template_id || !contract.deal_id) return;

  const { data: template } = await db
    .from("contract_templates")
    .select("template_name")
    .eq("id", contract.template_id)
    .single();
  if (template?.template_name !== CARTA_INTENCAO_TEMPLATE_NAME) return;

  const { data: originalInvite } = contract.deal_room_invite_id
    ? await db.from("deal_room_invites").select("deal_room_id").eq("id", contract.deal_room_invite_id).single()
    : { data: null };
  if (!originalInvite) return;

  const { data: deal } = await db.from("ma_deals").select("v3_code, code").eq("id", contract.deal_id).single();
  const dealCode = deal?.v3_code ?? deal?.code ?? contract.deal_id;

  const token = crypto.randomUUID().replace(/-/g, "");
  const { error: inviteErr } = await db.from("deal_room_invites").insert({
    deal_room_id: originalInvite.deal_room_id,
    investor_name: MANDATARIO_VENDA_NOME,
    investor_email: MANDATARIO_VENDA_EMAIL,
    access_side: "seller",
    token,
    token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: "pending",
  });
  if (inviteErr) {
    console.error("[clicksign-webhook] Falha ao criar invite da FPA Venda:", inviteErr.message);
    return;
  }

  await notifyFpaVendaDisponivel(dealCode, token);
}

async function notifyFpaVendaDisponivel(dealCode: string, token: string) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  const link = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br"}/intake/fpa-venda/${token}`;

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>FPA Venda Disponível, V3 Partners</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
</head>
<body style="font-family:'DM Sans',Arial,sans-serif; background:#09081A; color:#F5F1E8; margin:0; padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09081A; padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#13223A; border:1px solid #243A66; border-radius:12px; overflow:hidden;">
        <tr>
          <td style="padding:12px 32px; background:#162744; text-align:center;">
            <img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners" height="32" />
          </td>
        </tr>
        <tr>
          <td style="background:#162744; padding:24px 32px; border-bottom:1px solid #243A66;">
            <p style="margin:0; font-size:11px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#C9A84C;">V3 Partners, Mesa M&amp;A</p>
            <h1 style="margin:8px 0 0; font-size:20px; font-weight:700; color:#F5F1E8;">Compra Firme Confirmada, FPA Venda Disponível</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 20px; font-size:14px; color:#9BAFC5; line-height:1.6;">
              Prezado(a) ${MANDATARIO_VENDA_NOME}, a Carta de Intenção do deal ${dealCode} foi assinada pelo comprador. A partir de agora, o cadastro do grupo de venda (FPA Venda) está disponível no link abaixo.
            </p>
            <a href="${link}" style="display:inline-block; background:#C9A84C; color:#09081A; font-weight:700; font-size:13px; padding:12px 28px; border-radius:8px; text-decoration:none;">
              Preencher FPA Venda
            </a>
            <hr style="border:none; border-top:1px solid #243A66; margin:32px 0 24px;" />
            <p style="margin:0; font-size:11px; color:#9BAFC5; line-height:1.5;">
              V3 Partners Soluções Ltda, CNPJ 14.219.287/0001-50<br />
              <a href="https://v3partners.com.br" style="color:#C9A84C; text-decoration:none;">v3partners.com.br</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();

  const gate = auditHtml(html);
  if (gate.blocking.length > 0) {
    console.error("[clicksign-webhook notifyFpaVendaDisponivel] Brand Guardian bloqueou:", gate.blocking);
    return;
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: "V3 Partners Plataforma <noreply@v3partners.com.br>",
      to: MANDATARIO_VENDA_EMAIL,
      subject: auditText(`Compra firme confirmada, FPA Venda disponível, ${dealCode}`).corrected,
      html: gate.corrected,
    });
  } catch (err) {
    console.error("[clicksign-webhook notifyFpaVendaDisponivel] Erro ao enviar email:", err);
  }
}

interface ClickSignWebhookPayload {
  event?: {
    name: "sign" | "close" | "auto_close" | "cancel" | string;
    data?: Record<string, unknown>;
  };
  document?: {
    key: string;
    status: "running" | "closed" | "canceled" | string;
    filename?: string;
  };
  // Formato v3 (envelopes) — não confirmado por assinatura real ainda, só
  // por leitura da doc (data.type "envelopes", relationships.envelope). O
  // log abaixo captura o payload bruto no primeiro evento real pra permitir
  // ajustar este parsing sem adivinhar de novo.
  data?: {
    id?: string;
    type?: string;
    attributes?: { status?: string; [key: string]: unknown };
    relationships?: { envelope?: { data?: { id?: string } } };
  };
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.CLICKSIGN_WEBHOOK_SECRET;
  const rawBody = await request.text();

  // Validação HMAC-SHA256 do webhook da ClickSign.
  //
  // CORRIGIDO 04/08/2026. A ClickSign desativou o canal após 10 dias de falhas.
  // O histórico de entregas mostrava 100% de HTTP 401, de 28/07 a 03/08, em 5
  // documentos, incluindo um Event::AutoClose (documento totalmente assinado)
  // que o portal nunca registrou.
  //
  // A causa NÃO era o secret: o valor no painel da ClickSign e o da Vercel
  // conferem. Era o NOME DO HEADER. A documentação oficial deles especifica
  // `Content-Hmac`, com o valor prefixado por `sha256=`, calculado sobre o corpo
  // bruto. Esta rota lia `x-clicksign-hmac-sha256` e comparava hex puro, então
  // nenhuma entrega jamais passou.
  //
  // Aceita as duas grafias por tolerância, e o valor com ou sem prefixo.
  if (webhookSecret) {
    const raw =
      request.headers.get("content-hmac") ??
      request.headers.get("x-clicksign-hmac-sha256") ??
      "";

    // "sha256=abc..." e "abc..." são tratados igual
    const receivedSig = raw.trim().replace(/^sha256=/i, "").toLowerCase();
    const expectedSig = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");

    // Comparação em tempo constante. Antes era `!==`, que vaza informação por
    // tempo de resposta e permite descobrir a assinatura byte a byte.
    const a = Buffer.from(receivedSig, "utf8");
    const b = Buffer.from(expectedSig, "utf8");
    const assinaturaConfere = a.length === b.length && timingSafeEqual(a, b);

    if (!assinaturaConfere) {
      console.warn(
        `[clicksign-webhook] HMAC invalido, rejeitado. Header presente: ${
          raw ? "sim" : "NAO (nenhum dos nomes conhecidos veio na requisicao)"
        }`
      );
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  } else {
    // Sem secret configurado a rota aceitaria qualquer payload. Registrar alto e
    // claro, porque é falha aberta de segurança, não apenas configuração ausente.
    console.error("[clicksign-webhook] CLICKSIGN_WEBHOOK_SECRET ausente: payload aceito SEM validacao");
  }

  let payload: ClickSignWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true });
  }

  // Log do payload bruto: nenhum envelope v3 foi assinado de verdade ainda
  // (exige clique real num e-mail), então o formato do webhook v3 não está
  // 100% confirmado. Este log é o que permite ajustar o parsing abaixo a
  // partir do primeiro evento real, em vez de mais uma rodada de pesquisa.
  console.log("[clicksign-webhook] payload bruto:", rawBody.slice(0, 2000));

  const { event, document, data } = payload;

  // Formato v1 (document.key + event.name) — usado por ma_deals e
  // commercial_proposals, que continuam na v1 por enquanto.
  if (event && document) {
    if (event.name !== "sign" && event.name !== "close" && event.name !== "auto_close") {
      return NextResponse.json({ ok: true, skipped: true });
    }
    if (IS_DEMO) {
      console.log("[clicksign-webhook] Demo — evento recebido:", {
        event: event.name,
        documentKey: document.key,
        status: document.status,
      });
      return NextResponse.json({ ok: true, demo: true });
    }
    return handleV1Event(event.name, document.key);
  }

  // Formato v3 (envelopes) — usado pela Carta de Intenção. Extração do
  // envelope_id best-effort a partir dos caminhos mais prováveis do JSON:API
  // até o primeiro evento real confirmar a estrutura de verdade.
  if (data) {
    const envelopeId = data.relationships?.envelope?.data?.id ?? (data.type === "envelopes" ? data.id : undefined);
    const status = data.attributes?.status;
    if (envelopeId && (status === "closed" || status === "auto_closed")) {
      return handleV1Event("close", envelopeId);
    }
    return NextResponse.json({ ok: true, skipped: true, reason: "v3 payload sem envelope_id/status reconhecido" });
  }

  return NextResponse.json({ ok: true, skipped: true, reason: "payload não reconhecido" });
}

async function handleV1Event(eventName: string, externalId: string) {

  // ─── PRODUÇÃO — Atualiza Supabase ─────────────────────────────────────────
  try {
    const db = svc();

    // Busca deal pelo clicksign_key (ma_deals), proposal pelo clicksign_key
    // (commercial_proposals), ou contrato pelo external_envelope_id
    // (operation_contracts, ex: Carta de Intenção assinada via intake público)
    const [{ data: dealRows }, { data: proposalRows }, { data: contractRows }] = await Promise.all([
      db.from("ma_deals").select("id, stage").eq("clicksign_envelope_id", externalId).limit(1),
      db.from("commercial_proposals").select("id").eq("clicksign_key", externalId).limit(1),
      db.from("operation_contracts").select("id, status_signature, template_id, deal_id, deal_room_invite_id").eq("external_envelope_id", externalId).limit(1),
    ]);

    const isSigned = eventName === "close" || eventName === "auto_close";

    // Atualiza contrato (ex: Carta de Intenção) se encontrado
    const contract = contractRows?.[0] as { id: string; status_signature: string; template_id: string | null; deal_id: string | null; deal_room_invite_id: string | null } | undefined;
    if (contract) {
      const wasAlreadySigned = contract.status_signature === "assinado";
      if (isSigned && !wasAlreadySigned) {
        await db.from("operation_contracts").update({
          status_signature: "assinado",
          signed_at: new Date().toISOString(),
        }).eq("id", contract.id);

        // Etapa 3 da esteira: assinatura da Carta de Intenção ("compra firme")
        // dispara automaticamente a FPA Venda para o grupo do Rafael.
        await triggerFpaVendaIfCartaIntencao(db, contract);

        // Timeline do deal (aba nativa Mesa M&A): registra a assinatura real,
        // não só o disparo do convite.
        if (contract.deal_id) {
          const [{ data: tpl }, { data: fullContract }] = await Promise.all([
            contract.template_id
              ? db.from("contract_templates").select("template_name").eq("id", contract.template_id).single()
              : Promise.resolve({ data: null }),
            db.from("operation_contracts").select("contract_title, parties").eq("id", contract.id).single(),
          ]);
          const parties = (fullContract?.parties as Array<{ role: string; name: string }> | null) ?? [];
          const signatario = parties.find(p => p.role !== "v3_partners");
          await notifyDealTimeline({
            dealId: contract.deal_id,
            title: `${tpl?.template_name ?? fullContract?.contract_title ?? "Documento"} assinado`,
            message: `${signatario?.name ?? "Signatário"} assinou digitalmente via ClickSign, envelope ${externalId}.`,
            type: "negociacao_assinado",
          });

          // Client 360, Fase B (10-11/08/2026): contrato assinado promove os
          // clientes vinculados a este deal de "prospecto" para "a_performar".
          // Nunca rebaixa quem já está "performado" (deal já fechado antes de
          // uma assinatura tardia de outro documento do mesmo deal).
          await db
            .from("ma_deal_clients")
            .update({ status: "a_performar", updated_at: new Date().toISOString() })
            .eq("deal_id", contract.deal_id)
            .eq("status", "prospecto");
        }
      }
    }

    // Atualiza proposta comercial se encontrada
    if (proposalRows && proposalRows.length > 0) {
      const proposal = proposalRows[0] as { id: string };
      await db.from("commercial_proposals").update({
        status:    isSigned ? "signed" : "viewed",
        ...(isSigned && { signed_at: new Date().toISOString() }),
        ...(!isSigned && { viewed_at: new Date().toISOString() }),
      }).eq("id", proposal.id);

      if (isSigned) {
        void db.from("proposal_messages").insert({
          proposal_id: proposal.id,
          sender_id:   "00000000-0000-0000-0000-000000000000",
          sender_name: "ClickSign",
          sender_role: "SYSTEM",
          content:     `Proposta assinada digitalmente via ClickSign, envelope ${externalId}.`,
          type:        "system_event",
        });
      }
    }

    // Atualiza deal M&A se encontrado
    const deal = dealRows?.[0] as { id: string; stage: string } | undefined;
    if (deal) {
      const updates: Record<string, string> = {
        contract_status:    "SIGNED",
        contract_signed_at: new Date().toISOString(),
      };
      if (deal.stage === "PROSPECTING" || deal.stage === "APPROACH") {
        updates.stage = "QUALIFICATION";
      }
      await db.from("ma_deals").update(updates).eq("id", deal.id);
      void db.from("ma_deal_history").insert({
        deal_id:     deal.id,
        event_type:  "CONTRACT_SIGNED",
        description: `Contrato assinado via ClickSign, envelope ${externalId}`,
        created_at:  new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error("[clicksign-webhook] Erro:", err);
    // Retorna 200 mesmo com erro para evitar retry
  }

  // Retorna 200 OK sempre para evitar retry do ClickSign
  return NextResponse.json({ ok: true });
}
