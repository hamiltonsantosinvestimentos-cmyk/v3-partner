import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { createHmac } from "crypto";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const IS_DEMO = false;

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

  // Validação HMAC-SHA256: ClickSign assina o body com o secret
  if (webhookSecret) {
    const receivedSig = request.headers.get("x-clicksign-hmac-sha256") ?? "";
    const expectedSig = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
    if (receivedSig !== expectedSig) {
      console.warn("[clicksign-webhook] HMAC inválido — rejeitado");
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
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
      db.from("operation_contracts").select("id, status_signature").eq("external_envelope_id", externalId).limit(1),
    ]);

    const isSigned = eventName === "close" || eventName === "auto_close";

    // Atualiza contrato (ex: Carta de Intenção) se encontrado
    const contract = contractRows?.[0] as { id: string; status_signature: string } | undefined;
    if (contract) {
      if (isSigned && contract.status_signature !== "assinado") {
        await db.from("operation_contracts").update({
          status_signature: "assinado",
          signed_at: new Date().toISOString(),
        }).eq("id", contract.id);
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
