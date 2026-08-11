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
const ROLES_IN_DOCUMENT = ["parte_principal", "intermediario_finder_venda", "intermediario_finder_compra", "mandatario", "testemunha"];
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
  if (!listingId && !operationContractId) {
    return NextResponse.json({ error: "listing_id ou operation_contract_id é obrigatório" }, { status: 422 });
  }

  let query = svc()
    .from("cm_qualification_batches")
    .select("*, cm_party_qualifications(id, full_name, email, role_in_document, status, filled_at)")
    .order("created_at", { ascending: false });
  query = listingId ? query.eq("listing_id", listingId) : query.eq("operation_contract_id", operationContractId!);

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
  const { listing_id, operation_contract_id, match_deal_id, document_type, parties } = body as {
    listing_id?: string;
    operation_contract_id?: string;
    match_deal_id?: string;
    document_type?: string;
    parties?: { full_name: string; email: string; role_in_document: string }[];
  };

  if (!document_type || !DOCUMENT_TYPES.includes(document_type)) {
    return NextResponse.json({ error: `document_type inválido. Use um de: ${DOCUMENT_TYPES.join(", ")}` }, { status: 422 });
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

  const { data: batch, error: batchError } = await db
    .from("cm_qualification_batches")
    .insert({
      listing_id: listing_id ?? null,
      operation_contract_id: operation_contract_id ?? null,
      match_deal_id: match_deal_id ?? null,
      document_type,
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

  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const docLabel = DOCUMENT_TYPE_LABELS[document_type] ?? document_type;
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
