import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { notifyClickSignEnvelope } from "@/lib/clicksign";
import { auditText, auditHtml } from "@/lib/brand-guardian-gate";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

// POST /api/cm/contracts/[id]/resend — reenvia a notificação de assinatura
// pendente de um contrato da Bolsa de Capitais (vertical capital_markets).
// Generaliza o mesmo botão já em produção no M&A (app/api/ma/loi-contracts/
// [id]/resend), mas com um branch a mais: a Bolsa de Capitais usa DOIS
// mecanismos de assinatura sob o mesmo operation_contracts —
//   1) ClickSign (external_envelope_id) — NDA Quadripartite futura, Fase 3
//   2) token interno + página própria /assinar/anexo/[token] (Anexo FPA/NCND,
//      generate-annex) — é o que existe de verdade hoje em produção
// então o reenvio precisa checar qual dos dois o contrato usa.
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
    .select("id, contract_title, status_signature, external_envelope_id, signing_token, parties")
    .eq("id", id)
    .eq("vertical", "capital_markets")
    .single();

  if (!contract) return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 });
  if (contract.status_signature === "assinado") {
    return NextResponse.json({ error: "Este documento já foi assinado, não há o que reenviar." }, { status: 409 });
  }

  const parties = (contract.parties as Array<{ role: string; name: string | null; email?: string | null }> | null) ?? [];
  const signatario = parties.find((p) => p.role === "mandatario") ?? parties[0];

  if (contract.external_envelope_id) {
    const result = await notifyClickSignEnvelope(contract.external_envelope_id, signatario?.name ?? "", contract.contract_title);
    if (!result.ok) {
      return NextResponse.json({ error: `Falha ao reenviar notificação: ${result.error}` }, { status: 502 });
    }
  } else if (contract.signing_token) {
    if (!signatario?.email) {
      return NextResponse.json({ error: "Signatário sem e-mail cadastrado neste contrato." }, { status: 409 });
    }
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: "RESEND_API_KEY não configurado." }, { status: 500 });
    }
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const subjectGate = auditText(`Lembrete: assinatura pendente — ${contract.contract_title}`);
      const htmlGate = auditHtml(`<p>Olá ${signatario.name ?? "Sr(a)"},</p>
             <p>A V3 Partners reforça a solicitação de assinatura do documento <strong>${contract.contract_title}</strong>, ainda pendente.</p>
             <p>Assine em: https://app.v3partners.com.br/assinar/anexo/${contract.signing_token}</p>`);
      if (htmlGate.blocking.length > 0) console.error("[cm-resend] Brand Guardian bloqueou:", htmlGate.blocking);
      await resend.emails.send({
        from: "V3 Partners Bolsa de Ativos <noreply@v3partners.com.br>",
        to: signatario.email,
        subject: subjectGate.corrected,
        html: htmlGate.corrected,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      return NextResponse.json({ error: `Falha ao reenviar e-mail: ${message}` }, { status: 502 });
    }
  } else {
    return NextResponse.json({ error: "Este contrato ainda não foi enviado para assinatura." }, { status: 409 });
  }

  await db.from("operation_contracts").update({ sent_to_signature_at: new Date().toISOString() }).eq("id", id);

  return NextResponse.json({ ok: true, message: `Notificação reenviada para ${signatario?.email ?? signatario?.name ?? "o signatário"}.` });
}
