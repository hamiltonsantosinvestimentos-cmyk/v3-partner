import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { getEnvelopeStatusV3 } from "@/lib/clicksign";

// GET /api/cron/clicksign-sync: sincronização real de status de assinatura
// (19/08/2026, item 2 dos ajustes de governança pedidos por João).
//
// DECISÃO EXPLÍCITA: não usa cron da Vercel (plano Hobby, limite de 1x/dia,
// documentado em session-decisions 2026-08-02). João pediu para acionar via
// n8n a cada 30 minutos batendo nesta rota de fora, mesmo padrão server-
// to-server já usado por /api/cron/clicksign-archive e /api/cron/cm-sla-alert
// (Bearer CRON_SECRET), não fica em PUBLIC_ROUTES.
//
// O que resolve de verdade: os 2 contratos reais de parceria
// (V3C-PAR-2026-0037/0038) ficaram parados em "enviado_assinatura" mesmo
// depois de um deles (0037) já estar "closed" na ClickSign desde
// 14/08/2026, confirmado ao vivo nesta sessão (GET /api/v3/envelopes/{id}
// contra a conta de produção real), porque o webhook
// /api/ma/clicksign-webhook nunca é registrado por envelope em
// sendToClickSignV3 (só existe se a conta ClickSign tiver webhook
// configurado globalmente no painel deles, o que não é verificável por
// código). Esta rota fecha esse gap com polling ativo.
export const maxDuration = 60;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// contract_notes.author_id tem FK real para auth.users(id), confirmado
// contra o schema em 19/08/2026 (achado ao testar o resend-notification:
// "00000000-0000-0000-0000-000000000000" falha a constraint em silêncio se
// o erro não for checado). Mesmo UUID real já usado como autor de sistema
// em app/api/relatorios/ingest/route.ts.
const SYSTEM_USER_ID = "d0af8eaa-9f3c-4e7a-b8c6-613736524317";

interface PendingContract {
  id: string;
  contract_code: string | null;
  contract_title: string;
  external_envelope_id: string;
  parties: Array<{ role: string; name: string }> | null;
  deal_id: string | null;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const db = svc();

  const { data: pending, error: fetchErr } = await db
    .from("operation_contracts")
    .select("id, contract_code, contract_title, external_envelope_id, parties, deal_id")
    .eq("status_signature", "enviado_assinatura")
    .not("external_envelope_id", "is", null);

  if (fetchErr) {
    return NextResponse.json({ ok: false, error: fetchErr.message }, { status: 500 });
  }

  const contracts = (pending ?? []) as PendingContract[];
  const updated: string[] = [];
  const errors: Array<{ contract_id: string; error: string }> = [];

  for (const contract of contracts) {
    const statusRes = await getEnvelopeStatusV3(contract.external_envelope_id);

    if (!statusRes.ok) {
      errors.push({ contract_id: contract.id, error: statusRes.error });
      continue;
    }

    if (statusRes.status !== "closed" && statusRes.status !== "auto_closed") {
      continue; // ainda pendente de assinatura, nada a fazer
    }

    const signedAt = new Date().toISOString();
    const parties = contract.parties ?? [];
    const signatario = parties.find((p) => p.role !== "v3_partners" && p.role !== "testemunha");

    await db
      .from("operation_contracts")
      .update({ status_signature: "assinado", signed_at: signedAt })
      .eq("id", contract.id);

    // Timeline real (fecha o item 2 do pedido de João: a tela de contratos
    // não mostrava nenhum evento de assinatura, mesmo quando o envelope já
    // tinha fechado na ClickSign há dias).
    const { error: noteError } = await db.from("contract_notes").insert({
      contract_id: contract.id,
      author_id: SYSTEM_USER_ID,
      author_name: "Sincronização ClickSign",
      note_type: "sistema",
      content: `Envelope ClickSign fechado, todos os signatários assinaram digitalmente${signatario ? `, incluindo ${signatario.name}` : ""}.`,
    });
    if (noteError) {
      console.error(`[clicksign-sync] falha ao gravar contract_notes do contrato ${contract.id} (status já atualizado):`, noteError.message);
    }

    // Arquivamento best-effort do PDF assinado (link presigned S3, TTL
    // curto, precisa ser baixado na hora). Falha aqui nunca desfaz a
    // atualização de status acima: o poller de e-mail
    // (lib/clicksign-archive.ts) continua como segunda chance.
    if (statusRes.signedDocumentUrl) {
      try {
        const pdfRes = await fetch(statusRes.signedDocumentUrl);
        if (pdfRes.ok) {
          const buffer = Buffer.from(await pdfRes.arrayBuffer());
          const storagePath = `contratos-assinados/${contract.id}.pdf`;
          const { error: uploadErr } = await db.storage.from("documents").upload(storagePath, buffer, {
            contentType: "application/pdf",
            upsert: true,
          });
          if (!uploadErr) {
            await db.from("operation_contracts").update({
              signed_document_path: storagePath,
              signed_document_archived_at: new Date().toISOString(),
            }).eq("id", contract.id);
          }
        }
      } catch {
        // silencioso de propósito: arquivamento é best-effort, o poller de
        // e-mail cobre o mesmo caso
      }
    }

    // Client 360 (mesmo padrão já usado em app/api/ma/clicksign-webhook):
    // promove clientes vinculados ao deal de "prospecto" para "a_performar".
    if (contract.deal_id) {
      await db
        .from("ma_deal_clients")
        .update({ status: "a_performar", updated_at: new Date().toISOString() })
        .eq("deal_id", contract.deal_id)
        .eq("status", "prospecto");
    }

    updated.push(contract.id);
  }

  return NextResponse.json({
    ok: true,
    checked: contracts.length,
    updated,
    errors,
  });
}
