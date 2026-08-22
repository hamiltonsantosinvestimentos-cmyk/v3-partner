import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { sendText } from "@/lib/whatsapp/openwa-client";
import { sendInstagramText } from "@/lib/instagram-dm";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Assinatura do Calendly: header "Calendly-Webhook-Signature" no formato
// "t=<timestamp>,v1=<hmac-sha256 hex de `${t}.${rawBody}` com a signing key>".
// Sem isso qualquer um poderia forjar um "agendamento confirmado" e enganar
// um lead. Ver signing_key retornado na criação da subscription (POST
// /webhook_subscriptions) -- salvo em CALENDLY_WEBHOOK_SIGNING_KEY.
function assinaturaValida(rawBody: string, header: string | null): boolean {
  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
  if (!signingKey || !header) return false;

  const partes = Object.fromEntries(
    header.split(",").map((p) => p.split("=") as [string, string])
  );
  const t = partes.t;
  const v1 = partes.v1;
  if (!t || !v1) return false;

  const esperado = createHmac("sha256", signingKey).update(`${t}.${rawBody}`).digest("hex");
  const bufA = Buffer.from(esperado, "hex");
  const bufB = Buffer.from(v1, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

type CalendlyInviteeCreatedPayload = {
  event?: string;
  payload?: {
    email?: string;
    name?: string;
    uri?: string;
    tracking?: { utm_content?: string | null };
    scheduled_event?: {
      uri?: string;
      start_time?: string;
      location?: { join_url?: string; location?: string };
    };
  };
};

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const assinatura = req.headers.get("Calendly-Webhook-Signature");

  if (!assinaturaValida(rawBody, assinatura)) {
    console.warn("[Calendly Webhook] Assinatura inválida ou ausente — descartando.");
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  let body: CalendlyInviteeCreatedPayload;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (body.event !== "invitee.created") return NextResponse.json({ ok: true });

  const trackingId = body.payload?.tracking?.utm_content;
  if (!trackingId) {
    console.log("[Calendly Webhook] invitee.created sem tracking utm_content — provavelmente agendado fora do fluxo do SDR, ignorando.");
    return NextResponse.json({ ok: true });
  }

  const { data: agendamento, error: fetchErr } = await supabase
    .from("sdr_agendamentos")
    .select("*")
    .eq("id", trackingId)
    .maybeSingle();

  if (fetchErr || !agendamento) {
    console.log(`[Calendly Webhook] Nenhum agendamento SDR encontrado para tracking ${trackingId}`);
    return NextResponse.json({ ok: true });
  }

  if (agendamento.status === "confirmado") {
    console.log(`[Calendly Webhook] Agendamento ${trackingId} já estava confirmado — reentrega, ignorando.`);
    return NextResponse.json({ ok: true });
  }

  const startTime = body.payload?.scheduled_event?.start_time ?? agendamento.slot_start_time;
  const dataHoraBR = new Date(startTime).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  await supabase.from("sdr_agendamentos").update({
    status: "confirmado",
    calendly_event_uri: body.payload?.scheduled_event?.uri ?? null,
    calendly_invitee_email: body.payload?.email ?? null,
    calendly_invitee_name: body.payload?.name ?? null,
    confirmado_em: new Date().toISOString(),
  }).eq("id", trackingId);

  const mensagemConfirmacao = `Prontinho, confirmado! Nossa reunião fica marcada para ${dataHoraBR}.\n\nVocê vai receber um e-mail do Calendly com o link da chamada. Até lá!`;

  try {
    if (agendamento.canal === "instagram") {
      await sendInstagramText(agendamento.phone, mensagemConfirmacao);
    } else {
      await sendText(agendamento.phone, mensagemConfirmacao);
    }
    await supabase.from("sdr_conversas").insert({
      phone: agendamento.phone,
      canal: agendamento.canal,
      role: "assistant",
      content: mensagemConfirmacao,
      instance: agendamento.canal,
    });
  } catch (e) {
    console.error("[Calendly Webhook] Erro ao enviar confirmação pro lead:", e);
  }

  console.log(`[Calendly Webhook] Agendamento confirmado para ${agendamento.phone} (${agendamento.canal}) — ${dataHoraBR}`);
  return NextResponse.json({ ok: true });
}
