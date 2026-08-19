import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { notifyClickSignEnvelope } from "@/lib/clicksign";
import { auditText } from "@/lib/brand-guardian-gate";

// POST /api/contracts/[id]/resend-notification: reenvio de lembrete de
// assinatura pendente para contratos da Central de Contratos enviados via
// ClickSign (19/08/2026). Server-to-server, sem sessão de navegador, mesmo
// padrão x-v3-service-token/V3_INGEST_SECRET já usado por
// app/api/relatorios/ingest e app/api/ma/meetings/ingest, e já disponível em
// n8n como a credencial "V3 Portal — Ingest Token" (l723yj7FMhJ3fVIg), sem
// segredo novo. Pedido explícito de João: acionar via n8n (não chamar essa
// rota direto de script/sessão de terminal) e validar o texto pelo mesmo
// gate Brand & Grammar Guardian já usado por qualquer outro envio via
// ClickSign (auditText, o mesmo que corrigiu o P0 real de 11/08 documentado
// em notifyClickSignEnvelope).

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const serviceToken = req.headers.get("x-v3-service-token");
  const validToken = process.env.V3_INGEST_SECRET;
  if (!serviceToken || serviceToken !== validToken) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const customMessage = typeof body.custom_message === "string" ? body.custom_message.trim() : undefined;

  const db = svc();
  const { data: contract } = await db
    .from("operation_contracts")
    .select("id, contract_code, contract_title, status_signature, external_envelope_id, parties")
    .eq("id", id)
    .single();

  if (!contract) return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 });
  if (!contract.external_envelope_id) {
    return NextResponse.json({ error: "Contrato não foi enviado via ClickSign (sem external_envelope_id), nada a reenviar." }, { status: 409 });
  }
  if (contract.status_signature === "assinado") {
    return NextResponse.json({ error: "Contrato já assinado, não há o que reenviar." }, { status: 409 });
  }
  if (contract.status_signature !== "enviado_assinatura") {
    return NextResponse.json({ error: `Contrato em status "${contract.status_signature}", só é possível reenviar lembrete para contratos já "enviado_assinatura".` }, { status: 409 });
  }

  const parties = (contract.parties as Array<{ role: string; name: string }> | null) ?? [];
  const pendingSignatory = parties.find((p) => p.role !== "v3_partners" && p.role !== "testemunha") ?? parties[0];

  const documentLabel = contract.contract_code
    ? `${contract.contract_code} · ${contract.contract_title}`
    : contract.contract_title;

  // Gate Brand & Grammar Guardian: roda ANTES de qualquer chamada à ClickSign.
  // Mesma função já usada em produção (não uma cópia paralela) — se a
  // mensagem customizada trouxer alguma violação bloqueante, o envio inteiro
  // é recusado, nunca corrigido em silêncio para depois virar e-mail real.
  if (customMessage) {
    const gate = auditText(customMessage);
    if (gate.blocking.length > 0) {
      return NextResponse.json({
        error: "Brand Guardian bloqueou a mensagem customizada.",
        violations: gate.blocking,
      }, { status: 422 });
    }
  }

  const result = await notifyClickSignEnvelope(
    contract.external_envelope_id,
    pendingSignatory?.name ?? "",
    documentLabel,
    customMessage
  );

  if (!result.ok) {
    return NextResponse.json({ error: `Falha ao reenviar notificação ClickSign: ${result.error}` }, { status: 502 });
  }

  await db.from("contract_notes").insert({
    contract_id: contract.id,
    author_id: "00000000-0000-0000-0000-000000000000",
    author_name: "Reenvio via n8n",
    note_type: "sistema",
    content: `Lembrete de assinatura pendente reenviado a ${pendingSignatory?.name ?? "signatário(s)"}${customMessage ? " com mensagem customizada" : ""}.`,
  });

  return NextResponse.json({ ok: true, contract_code: contract.contract_code, notified: pendingSignatory?.name ?? null });
}
