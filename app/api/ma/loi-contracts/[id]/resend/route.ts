import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { notifyClickSignEnvelope } from "@/lib/clicksign";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

// POST — reenvia a notificação de assinatura ao comprador (lembrete),
// substituindo o comando manual via ClickSign/terminal por um botão no
// painel de acompanhamento em /propostas.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = svc();

  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED.includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const { data: contract } = await db
    .from("operation_contracts")
    .select("id, status_signature, external_envelope_id, parties")
    .eq("id", id)
    .eq("vertical", "ma")
    .single();

  if (!contract) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  if (contract.status_signature === "assinado") {
    return NextResponse.json({ error: "Este documento já foi assinado, não há o que reenviar." }, { status: 409 });
  }
  if (!contract.external_envelope_id) {
    return NextResponse.json({ error: "Este documento ainda não tem envelope ClickSign associado." }, { status: 409 });
  }

  // Signatário externo: "comprador" (Carta de Intenção), "vendedor"
  // (Contrato de Venda), "participante" (FPA Venda) ou "comissionado_compra" (FPA Compra).
  const parties = (contract.parties as Array<{ role: string; name: string; email: string }> | null) ?? [];
  const signatario = parties.find(p => ["comprador", "vendedor", "participante", "comissionado_compra"].includes(p.role));

  const result = await notifyClickSignEnvelope(contract.external_envelope_id, signatario?.name ?? "", "Carta de Intenção de Compra");
  if (!result.ok) {
    return NextResponse.json({ error: `Falha ao reenviar notificação: ${result.error}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true, message: `Notificação reenviada para ${signatario?.email ?? "o(s) signatário(s)"}.` });
}
