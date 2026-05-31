import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const IS_DEMO = false;

interface ClickSignWebhookPayload {
  event: {
    name: "sign" | "close" | "auto_close" | "cancel" | string;
    data?: Record<string, unknown>;
  };
  document: {
    key: string;
    status: "running" | "closed" | "canceled" | string;
    filename?: string;
  };
}

export async function POST(request: NextRequest) {
  // Valida o webhook secret para evitar chamadas não autorizadas
  const webhookSecret = process.env.CLICKSIGN_WEBHOOK_SECRET;
  if (webhookSecret) {
    const receivedSecret =
      request.headers.get("x-clicksign-hmac-sha256") ??
      request.headers.get("x-webhook-secret");
    if (receivedSecret !== webhookSecret) {
      console.warn("[clicksign-webhook] Webhook secret inválido — rejeitado");
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  let payload: ClickSignWebhookPayload;
  try {
    payload = await request.json();
  } catch {
    // Retorna 200 sempre para evitar retry do ClickSign
    return NextResponse.json({ ok: true });
  }

  const { event, document } = payload;

  // Só processa eventos de assinatura completa ou fechamento
  if (event.name !== "sign" && event.name !== "close" && event.name !== "auto_close") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Em demo: apenas loga
  if (IS_DEMO) {
    console.log("[clicksign-webhook] Demo — evento recebido:", {
      event: event.name,
      documentKey: document.key,
      status: document.status,
    });
    return NextResponse.json({ ok: true, demo: true });
  }

  // ─── PRODUÇÃO — Atualiza Supabase ─────────────────────────────────────────
  try {
    const db = svc();

    // Busca deal pelo clicksign_key (ma_deals) ou proposal pelo clicksign_key (commercial_proposals)
    const [{ data: dealRows }, { data: proposalRows }] = await Promise.all([
      db.from("ma_deals").select("id, stage").eq("clicksign_envelope_id", document.key).limit(1),
      db.from("commercial_proposals").select("id").eq("clicksign_key", document.key).limit(1),
    ]);

    // Atualiza proposta comercial se encontrada
    if (proposalRows && proposalRows.length > 0) {
      const proposal = proposalRows[0] as { id: string };
      const isSigned = event.name === "close" || event.name === "auto_close";
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
          content:     `Proposta assinada digitalmente via ClickSign — envelope ${document.key}.`,
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
        description: `Contrato assinado via ClickSign — envelope ${document.key}`,
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
