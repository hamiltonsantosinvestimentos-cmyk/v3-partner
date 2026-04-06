import { NextRequest, NextResponse } from "next/server";

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

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
      // Retorna 200 mesmo em caso de falha de autenticação para evitar retry
      // mas não processa o payload
      console.warn("[clicksign-webhook] Webhook secret inválido — ignorado");
      return NextResponse.json({ ok: true, ignored: true });
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
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // Busca o deal pelo envelopeId (documentKey do ClickSign)
    const { data: deal, error: findError } = await supabase
      .from("ma_deals")
      .select("id, stage")
      .eq("clicksign_envelope_id", document.key)
      .single();

    if (findError || !deal) {
      console.warn(
        "[clicksign-webhook] Deal não encontrado para envelope:",
        document.key
      );
      // Retorna 200 para evitar retry
      return NextResponse.json({ ok: true, not_found: true });
    }

    // Atualiza o status do contrato e avança o stage se necessário
    const updates: Record<string, unknown> = {
      contract_status: "SIGNED",
      contract_signed_at: new Date().toISOString(),
    };

    // Avança o deal para QUALIFICATION se ainda estava na etapa anterior
    if (deal.stage === "PROSPECTING" || deal.stage === "APPROACH") {
      updates.stage = "QUALIFICATION";
    }

    const { error: updateError } = await supabase
      .from("ma_deals")
      .update(updates)
      .eq("id", deal.id);

    if (updateError) {
      console.error("[clicksign-webhook] Erro ao atualizar deal:", updateError);
    } else {
      console.log("[clicksign-webhook] Deal atualizado:", deal.id, updates);
    }

    // Registra histórico
    await supabase.from("ma_deal_history").insert({
      deal_id: deal.id,
      event_type: "CONTRACT_SIGNED",
      description: `Contrato assinado via ClickSign — envelope ${document.key}`,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[clicksign-webhook] Erro:", err);
    // Retorna 200 mesmo com erro para evitar retry
  }

  // Retorna 200 OK sempre para evitar retry do ClickSign
  return NextResponse.json({ ok: true });
}
