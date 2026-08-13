import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { isValidEmail } from "@/lib/utils";
import { auditText, auditHtml } from "@/lib/brand-guardian-gate";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
const ROLES_IN_DOCUMENT = [
  "parte_principal", "intermediario_finder_venda", "intermediario_finder_compra", "mandatario", "testemunha",
  // Papeis granulares da indicacao rapida (13/08/2026) -- ver 20260813_qualificacoes_pf_pj_fpa.sql
  "finder_originacao_venda", "finder_originacao_compra", "intermediario_venda", "intermediario_compra",
];
const DOCUMENT_TYPES = ["nda_quadripartite", "fpa_venda", "fpa_compra", "mandato", "contrato_final", "contrato_parceria"];

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  nda_quadripartite: "NDA Quadripartite",
  fpa_venda: "FPA Venda",
  fpa_compra: "FPA Compra",
  mandato: "Mandato",
  contrato_final: "Contrato Final",
  contrato_parceria: "Contrato de Parceria",
};

async function getCaller() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

// GET /api/cm/qualifications?listing_id=X ou ?operation_contract_id=Y —
// lotes de qualificação do ativo (Bolsa de Ativos) ou do contrato (Central
// de Contratos genérica, 11/08/2026), com o progresso de cada envolvido.
export async function GET(req: NextRequest) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const listingId = searchParams.get("listing_id");
  const operationContractId = searchParams.get("operation_contract_id");
  const demandId = searchParams.get("demand_id");
  if (!listingId && !operationContractId && !demandId) {
    return NextResponse.json({ error: "listing_id, operation_contract_id ou demand_id é obrigatório" }, { status: 422 });
  }

  // qualification_token incluso propositalmente: permite "Copiar link"/"WhatsApp"
  // a qualquer momento depois da criação do lote, não só no instante do POST
  // (achado 11/08/2026, ao trazer este fluxo para a Central de Contratos).
  let query = svc()
    .from("cm_qualification_batches")
    .select("*, cm_party_qualifications(id, full_name, email, role_in_document, status, filled_at, qualification_token)")
    .order("created_at", { ascending: false });
  query = listingId
    ? query.eq("listing_id", listingId)
    : operationContractId
    ? query.eq("operation_contract_id", operationContractId)
    : query.eq("demand_id", demandId!);

  const { data: batches, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ batches: batches ?? [] });
}

// POST /api/cm/qualifications — Mesa cadastra os envolvidos de um instrumento
// (NDA Quadripartite, FPA Venda/Compra, Mandato, Contrato Final, ou qualquer
// contrato da Central de Contratos via operation_contract_id, 11/08/2026) e
// dispara um link individual de qualificação (/intake/qualificacao/[token])
// para cada um, incluindo testemunhas.
export async function POST(req: NextRequest) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { listing_id, operation_contract_id, demand_id, match_deal_id, document_type, parties } = body as {
    listing_id?: string;
    operation_contract_id?: string;
    demand_id?: string;
    match_deal_id?: string;
    document_type?: string;
    parties?: { full_name: string; email: string; role_in_document: string }[];
  };

  // document_type so e obrigatorio quando o lote ja nasce sabendo o instrumento (fluxo antigo,
  // Bolsa de Ativos/Central de Contratos). A indicacao rapida (13/08/2026, botao no card de
  // Ativo/Comprador) cria o lote ANTES da Governanca decidir o instrumento -- nesse caso o lote
  // nasce em status "aguardando_triagem_governanca", sem document_type, sem disparar email ainda
  // (o email/link formal e responsabilidade do dispatch da Governanca, nao desta rota).
  const isQuickIndication = !document_type && !!demand_id;
  if (document_type && !DOCUMENT_TYPES.includes(document_type)) {
    return NextResponse.json({ error: `document_type inválido. Use um de: ${DOCUMENT_TYPES.join(", ")}` }, { status: 422 });
  }
  if (!document_type && !demand_id) {
    return NextResponse.json({ error: "document_type é obrigatório fora do fluxo de indicação rápida (demand_id)" }, { status: 422 });
  }
  if (!listing_id && !operation_contract_id && !demand_id) {
    return NextResponse.json({ error: "Informe listing_id, operation_contract_id ou demand_id" }, { status: 422 });
  }
  if (!Array.isArray(parties) || parties.length === 0) {
    return NextResponse.json({ error: "Informe ao menos um envolvido" }, { status: 422 });
  }
  for (const p of parties) {
    if (!p.full_name?.trim() || !isValidEmail(p.email ?? "") || !ROLES_IN_DOCUMENT.includes(p.role_in_document)) {
      return NextResponse.json({ error: "Cada envolvido precisa de nome, e-mail válido e posição no documento" }, { status: 422 });
    }
  }

  const db = svc();

  // Lado travado no servidor pelo tipo de ancora que originou a chamada -- nunca aceito do
  // client. Card de Ativo (listing_id) so pode gerar SELL_SIDE, card de Comprador (demand_id)
  // so pode gerar BUY_SIDE. Sem isso um intermediario nao tem como migrar de lado por engano.
  const side = listing_id ? "SELL_SIDE" : demand_id ? "BUY_SIDE" : null;

  const { data: batch, error: batchError } = await db
    .from("cm_qualification_batches")
    .insert({
      listing_id: listing_id ?? null,
      operation_contract_id: operation_contract_id ?? null,
      demand_id: demand_id ?? null,
      match_deal_id: match_deal_id ?? null,
      document_type: document_type ?? null,
      status: isQuickIndication ? "aguardando_triagem_governanca" : undefined,
      side,
      created_by: caller.userId,
    })
    .select("id")
    .single();

  if (batchError || !batch) return NextResponse.json({ error: batchError?.message ?? "Erro ao criar lote de qualificação" }, { status: 500 });

  const rows = parties.map((p) => ({
    batch_id: batch.id,
    full_name: p.full_name.trim(),
    email: p.email.trim(),
    role_in_document: p.role_in_document,
    qualification_token: randomUUID().replace(/-/g, ""),
  }));

  const { data: inserted, error: insertError } = await db
    .from("cm_party_qualifications")
    .insert(rows)
    .select("id, full_name, email, qualification_token");

  if (insertError || !inserted) {
    await db.from("cm_qualification_batches").delete().eq("id", batch.id);
    return NextResponse.json({ error: insertError?.message ?? "Erro ao criar qualificações" }, { status: 500 });
  }

  // Indicacao rapida nao dispara email: o instrumento ainda nao foi decidido pela Governanca,
  // entao nao ha o que o indicado preencher ainda de forma util. O envio formal do link
  // acontece no dispatch (Fase 3 do BRIEF de 13/08/2026), quando document_type e definido.
  if (process.env.RESEND_API_KEY && !isQuickIndication) {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const docLabel = DOCUMENT_TYPE_LABELS[document_type!] ?? document_type;
    await Promise.all(
      inserted.map(async (row) => {
        try {
          const subjectGate = auditText(`Qualificação pendente: ${docLabel}, V3 Partners`);
          const htmlGate = auditHtml(`<p>Olá ${row.full_name},</p>
             <p>Você foi cadastrado(a) como envolvido(a) na operação abaixo, referente ao documento <strong>${docLabel}</strong>.</p>
             <p>Complete seus dados de qualificação para prosseguirmos: https://app.v3partners.com.br/intake/qualificacao/${row.qualification_token}</p>`);
          if (htmlGate.blocking.length > 0) console.error("[qualifications] Brand Guardian bloqueou:", htmlGate.blocking);
          await resend.emails.send({
            from: listing_id ? "V3 Partners Bolsa de Ativos <noreply@v3partners.com.br>" : "V3 Partners <noreply@v3partners.com.br>",
            to: row.email,
            subject: subjectGate.corrected,
            html: htmlGate.corrected,
          });
        } catch (err) {
          console.error(`[qualifications] falha ao enviar e-mail para ${row.email}:`, err);
        }
      })
    );
  }

  return NextResponse.json({ batch_id: batch.id, qualifications: inserted }, { status: 201 });
}
