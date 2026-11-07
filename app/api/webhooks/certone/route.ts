import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createClient as sc } from "@supabase/supabase-js";
import { parseCertOneWebhookEvent } from "@/lib/esignature/certone-provider";
import { isSafeProviderId } from "@/lib/contract-signature-timeline";
import { syncCertOneContract } from "@/lib/certone-signature-sync";

// POST /api/webhooks/certone (Fase 2 do BRIEF "ClickSign vs CertOne",
// 08/09/2026). A CertOne não oferece HMAC nativo (confirmado por Gustavo/
// Gabriel em 08/09: "acredito que não é possível [configurar via API],
// apenas na web mesmo"), e o Swagger não documenta nenhum esquema de
// assinatura de webhook. Achado de segurança (08/09/2026, revisão de
// arquitetura): subir a rota sem NENHUMA validação de origem, só logando
// o payload, deixaria um endpoint público aceitando POST cego — mesmo
// erro que o webhook v1/v3 da ClickSign já cometeu uma vez (ver comentário
// em app/api/ma/clicksign-webhook/route.ts: "Sem secret configurado a rota
// aceitaria qualquer payload"), não repetir aqui.
//
// Mitigação: token estático, gerado por nós (não pela CertOne), verificado
// em toda requisição ANTES de qualquer log ou parsing. Aceito via header
// x-certone-webhook-token OU query string ?token=, porque não temos
// garantia de qual dos dois o painel da CertOne permite configurar (a URL
// de callback é cadastrada manualmente por lá, sem controle fino de
// headers custom documentado). Comparação em tempo constante, mesmo
// padrão já usado no HMAC da ClickSign. FAIL-CLOSED: sem
// CERTONE_WEBHOOK_TOKEN configurado no ambiente, a rota rejeita tudo
// (nunca aceita por omissão, diferente do bug histórico do webhook
// ClickSign).
//
// Token gerado e guardado em wiki/sources/cofre-credenciais-v3.md, seção
// 15 (08/09/2026). Falta: (1) adicionar CERTONE_WEBHOOK_TOKEN na Vercel,
// (2) cadastrar a URL completa (com ?token=...) no painel da CertOne
// quando a organização de homologação estiver disponível.
function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CERTONE_WEBHOOK_TOKEN;
  if (!expected) {
    console.error("[webhooks/certone] CERTONE_WEBHOOK_TOKEN ausente: rejeitando por padrão seguro (fail-closed)");
    return false;
  }

  const { searchParams } = new URL(req.url);
  const provided = req.headers.get("x-certone-webhook-token") ?? searchParams.get("token") ?? "";

  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Eventos reais observados em 07/11/2026 (V3C-NDA-2026-0061): a CertOne manda um DocumentSigned por
// assinatura (data.id = id do documento = external_document_id do contrato) e NÃO manda evento de
// conclusão. Por isso cada evento dispara uma leitura do documento na API: ela grava as notas que
// faltam e fecha o contrato quando o documento conclui. Nunca loga o payload bruto: ele traz o CPF
// do signatário (LGPD).
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const rawBody = await req.text();
  const parsed = parseCertOneWebhookEvent(rawBody);
  if (!parsed) {
    return NextResponse.json({ ok: true, skipped: true, reason: "payload não é JSON válido" });
  }

  const documentId = parsed.envelopeId;
  console.log(`[webhooks/certone] evento ${parsed.status} documento ${documentId ? documentId.slice(0, 8) : "sem id"}`);

  if (!documentId || !isSafeProviderId(documentId) || !["signed", "closed"].includes(parsed.status)) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const db = svc();
    const { data: contract } = await db
      .from("operation_contracts")
      .select("id, status_signature, parties")
      .eq("external_document_id", documentId)
      .eq("esignature_provider", "certone")
      .maybeSingle();
    if (!contract) return NextResponse.json({ ok: true, skipped: true, reason: "contrato não encontrado" });
    if (contract.status_signature !== "enviado_assinatura") {
      return NextResponse.json({ ok: true, skipped: true, reason: `contrato em ${contract.status_signature}` });
    }

    const result = await syncCertOneContract(
      db,
      { id: contract.id, status_signature: contract.status_signature, parties: contract.parties as Array<{ email?: string | null; name?: string | null }> | null },
      documentId,
    );
    if (!result.ok) console.error(`[webhooks/certone] falha ao sincronizar o contrato ${contract.id}: ${result.error}`);
  } catch (err) {
    console.error("[webhooks/certone] erro:", err instanceof Error ? err.message : err);
  }

  // 200 sempre: o sync é idempotente e o botão "Atualizar status das assinaturas" recupera o que falhar.
  return NextResponse.json({ ok: true });
}
