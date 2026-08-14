import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { sendToClickSign, type SendToClickSignInput } from "@/lib/clicksign";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function requireRole(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["ADMIN", "GESTAO"].includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

// Mapeia o vertical do contrato para um documentType aceito por
// sendToClickSign — apenas os tipos que já rodam pela API v3 (funcional).
// "vertical" não distingue NDA Quadripartite de FPA/Mandato/Contrato Final
// dentro de capital_markets: usa-se contract_title para decidir, já que
// document_type do lote de qualificação não é persistido em operation_contracts
// (só qualification_batch_id, que aponta pro lote).
function resolveDocumentType(contractTitle: string, vertical: string): SendToClickSignInput["documentType"] {
  const title = contractTitle.toLowerCase();
  if (title.includes("quadripartite")) return "nda_quadripartite";
  if (title.includes("fpa venda") || title.includes("fpa_venda")) return "fpa_venda";
  if (title.includes("fpa compra") || title.includes("fpa_compra")) return "fpa_compra";
  if (title.includes("mandato")) return "mandato";
  if (title.includes("contrato final")) return "contrato_final";
  if (vertical === "ma") return "contrato_venda";
  return "contrato_final";
}

// POST /api/contracts/[id]/send — dispara o contrato gerado pela Central de
// Contratos (status "rascunho"/"aprovado") para assinatura digital real via
// ClickSign, usando o array `parties` já gravado (inclui os N signatários
// vindos da esteira de qualificação, quando qualification_batch_id existe).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireRole(_req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const db = svc();

  const { data: contract } = await db
    .from("operation_contracts")
    .select("id, vertical, contract_title, contract_code, status_signature, parties, signing_token")
    .eq("id", id)
    .single();

  if (!contract) return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 });
  if (!["rascunho", "aprovado"].includes(contract.status_signature)) {
    return NextResponse.json({ error: `Contrato em status "${contract.status_signature}" não pode ser (re)enviado por esta rota.` }, { status: 409 });
  }

  const parties = (contract.parties as Array<{ role: string; name: string | null; email?: string | null }> | null) ?? [];

  // Gate de integridade (11/08/2026, P0 real): antes deste gate, um bug na
  // esteira de qualificação sobrescrevia `parties` e derrubava a contraparte
  // principal sem ninguém perceber, dois contratos reais chegaram a ser
  // enviados pra assinatura só com testemunhas, sem a V3 e sem a contraparte.
  // Bloqueia ANTES de qualquer chamada à ClickSign se: (a) alguma parte tem
  // nome mas não tem e-mail (dado corrompido/parcial), ou (b) não existe
  // nenhum signatário fora do papel de testemunha (contrato sem parte
  // principal cadastrada não pode ser "enviado", mesmo que tenha testemunha).
  // v3_partners agora ENTRA como signatário de verdade (pedido de João
  // 11/08/2026: ele assina digitalmente pela V3, não é só metadado).
  const incomplete = parties.filter((p) => p.name?.trim() && !p.email?.trim());
  if (incomplete.length > 0) {
    return NextResponse.json({
      error: `Contrato não pode ser enviado: ${incomplete.length} parte(s) sem e-mail cadastrado (${incomplete.map((p) => p.name).join(", ")}). Corrija antes de enviar.`,
    }, { status: 422 });
  }

  const signatories = parties
    .filter((p) => p.email?.trim())
    .map((p) => ({ name: p.name ?? "", email: p.email! }));

  const nonWitnessSignatories = parties.filter((p) => p.role !== "testemunha" && p.email?.trim());
  if (nonWitnessSignatories.length === 0) {
    return NextResponse.json({
      error: "Contrato não pode ser enviado: só há testemunha(s) cadastrada(s), falta a(s) parte(s) principal(is) (contraparte e/ou V3 Partners). Verifique o array de partes antes de reenviar.",
    }, { status: 422 });
  }

  if (signatories.length === 0) {
    return NextResponse.json({ error: "Contrato sem signatários com e-mail cadastrado (parties vazio ou sem e-mail)." }, { status: 422 });
  }

  const signingToken = contract.signing_token ?? randomUUID().replace(/-/g, "");
  if (!contract.signing_token) {
    await db.from("operation_contracts").update({ signing_token: signingToken }).eq("id", id);
  }

  const documentUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br"}/api/contracts/html/${id}/${signingToken}`;

  // Label prefixado com contract_code (11/08/2026, ciclo ClickSign Fase 2):
  // vira o nome do envelope E o nome do arquivo (filename: `${documentLabel}.pdf`),
  // dá uma chave de correlação confiável pra identificar o contrato quando
  // o PDF assinado retornar por e-mail via Observador de Assinatura, sem
  // depender do formato de e-mail da própria ClickSign, que não controlamos.
  const documentLabel = contract.contract_code
    ? `${contract.contract_code} · ${contract.contract_title}`
    : contract.contract_title;

  const result = await sendToClickSign({
    dealId: id,
    documentType: resolveDocumentType(contract.contract_title, contract.vertical),
    documentUrl,
    documentLabel,
    signatories,
    // 14/08/2026: apontado para deal@v3partners.com.br (era
    // joao.lemos@v3partners.com.br). Mudança deliberada: lib/clicksign-archive.ts
    // (Fase 2, arquivamento automático) só tem credencial IMAP testada para
    // esta caixa — é a única que o poller consegue ler. Padroniza a caixa
    // observadora em todos os pontos de envio para o poller cobrir 100% dos
    // contratos, não só os das 4 rotas públicas de intake.
    watcherEmail: "deal@v3partners.com.br",
  });

  if (!result.ok) {
    return NextResponse.json({ error: `Falha ao enviar para o ClickSign: ${result.error}` }, { status: 502 });
  }

  await db.from("operation_contracts").update({
    status_signature: "enviado_assinatura",
    external_envelope_id: result.envelopeId,
    external_document_id: result.documentId,
    sent_to_signature_at: new Date().toISOString(),
  }).eq("id", id);

  return NextResponse.json({ ok: true, envelope_id: result.envelopeId, signatarios: signatories.length });
}
