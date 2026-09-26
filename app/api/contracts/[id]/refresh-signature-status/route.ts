import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { listClickSignSignEvents } from "@/lib/esignature/clicksign-provider";
import { applyEnvelopeClosed, recordSignatureNote } from "@/lib/contract-signature-timeline";
import { MESA_OPERACIONAL_VERTICALS } from "@/lib/contract-verticals";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function requireRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

// POST /api/contracts/[id]/refresh-signature-status (21/09/2026)
//
// Consulta o ClickSign pelo servidor (a credencial só existe no Vercel) e leva para a
// linha do tempo deste contrato as assinaturas que o webhook não registrou, mais o
// fechamento do envelope. É por contrato, nunca em lote: a rota global
// /api/cron/clicksign-sync atinge todos os contratos pendentes. Somente leitura no
// ClickSign; só escreve em contract_notes e, quando o envelope já fechou, marca o
// contrato como assinado.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireRole();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const db = svc();

  const { data: contract } = await db
    .from("operation_contracts")
    .select("id, vertical, status_signature, external_envelope_id, esignature_provider, parties")
    .eq("id", id)
    .single();
  if (!contract) return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 });
  if (caller.role === "MESA_OPERACIONAL" && !MESA_OPERACIONAL_VERTICALS.includes(contract.vertical as string)) {
    return NextResponse.json({ error: "Este contrato não pertence às verticais da Mesa Operacional." }, { status: 403 });
  }
  if (!contract.external_envelope_id) {
    return NextResponse.json({ error: "Este contrato não tem envelope de assinatura." }, { status: 409 });
  }
  if (contract.esignature_provider === "certone") {
    return NextResponse.json({ error: "Consulta de assinaturas ainda não implementada para o CertOne." }, { status: 501 });
  }

  const result = await listClickSignSignEvents(contract.external_envelope_id);
  if (!result.ok) return NextResponse.json({ error: `Falha ao consultar o ClickSign: ${result.error}` }, { status: 502 });

  const parties = (contract.parties as Array<{ email?: string | null; name?: string | null }> | null) ?? [];
  let novas = 0;
  for (const ev of result.events) {
    const r = await recordSignatureNote(db, { id: contract.id, parties }, ev);
    if (r === "criada") novas++;
  }

  let fechado = false;
  if (result.envelopeStatus === "closed" || result.envelopeStatus === "auto_closed") {
    fechado = await applyEnvelopeClosed(db, { id: contract.id, status_signature: contract.status_signature }, result.finishedAt ?? new Date().toISOString());
  }

  const signatarios = parties.filter((p) => p.email?.trim());
  const assinaram = new Set(result.events.map((e) => e.email.trim().toLowerCase()));
  const pendentes = signatarios.filter((p) => !assinaram.has(String(p.email).trim().toLowerCase())).map((p) => p.name ?? p.email);

  return NextResponse.json({
    ok: true,
    envelope_status: result.envelopeStatus,
    total: signatarios.length,
    assinaram: assinaram.size,
    pendentes,
    novas_notas: novas,
    contrato_marcado_como_assinado: fechado,
  });
}
