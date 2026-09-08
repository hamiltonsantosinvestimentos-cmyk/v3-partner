import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { parseCertOneWebhookEvent } from "@/lib/esignature/certone-provider";

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

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const rawBody = await req.text();

  // Nenhum evento real da CertOne foi recebido ainda (webhook não
  // cadastrado no painel deles). Loga o payload bruto no primeiro evento
  // real para permitir ajustar parseCertOneWebhookEvent() a partir do dado
  // de verdade, em vez de mais uma rodada de suposição — mesmo padrão já
  // usado para o webhook v3 da ClickSign em 28/07/2026.
  console.log("[webhooks/certone] payload bruto:", rawBody.slice(0, 2000));

  const parsed = parseCertOneWebhookEvent(rawBody);
  if (!parsed) {
    return NextResponse.json({ ok: true, skipped: true, reason: "payload não é JSON válido" });
  }

  // TODO (Fase 3, quando o roteamento por provedor estiver ligado): usar
  // parsed.envelopeId/parsed.status para atualizar operation_contracts,
  // mesmo formato que app/api/cron/clicksign-sync já grava hoje. Não
  // implementado ainda porque nenhum contrato real é enviado via CertOne
  // até a Fase 3 (switch no painel) existir.
  console.log("[webhooks/certone] evento normalizado:", JSON.stringify(parsed).slice(0, 500));

  return NextResponse.json({ ok: true });
}
