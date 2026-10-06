import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { isValidEmail } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/qualification-roles";
import { normalizePhone } from "@/lib/phone";
import { auditText, auditHtml } from "@/lib/brand-guardian-gate";
import { validateAdhesionParent } from "@/lib/contract-adhesion";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
const ROLES_IN_DOCUMENT = Object.keys(ROLE_LABELS);

async function requireMesa() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

// POST /api/cm/qualifications/[id]/add-party — "[id]" aqui é o BATCH_ID
// (04/09/2026, P0 real achado ao vivo por João: abrir "Gerar Link de
// Qualificação Antecipada" de novo pra uma minuta que já tinha lote em
// andamento criava um SEGUNDO lote separado. Como /api/contracts/generate
// só olha o lote mais recente por created_at, o mais antigo (com partes
// reais já qualificadas) ficava órfão e era silenciosamente ignorado na
// geração do contrato -- corrigido manualmente uma vez via banco, esta
// rota fecha a causa raiz pra sempre).
//
// Adiciona UMA nova parte a um lote JÁ EXISTENTE (nunca cria lote novo).
// Se o lote já estava "completo", volta pra "coletando" -- a parte nova
// ainda não preencheu, o lote deixou de estar 100% pronto.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireMesa();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id: batchId } = await params;
  const { full_name, email, phone, role_in_document } = await req.json().catch(() => ({}));

  if (!full_name?.trim() || !isValidEmail(email ?? "") || !ROLES_IN_DOCUMENT.includes(role_in_document)) {
    return NextResponse.json({ error: "Nome, e-mail válido e posição no documento são obrigatórios" }, { status: 422 });
  }

  const ph = normalizePhone(phone);
  if (!ph.ok) return NextResponse.json({ error: ph.error }, { status: 422 });

  const db = svc();
  const { data: batch } = await db
    .from("cm_qualification_batches")
    .select("id, status, consumido_por_contract_id, parent_contract_id")
    .eq("id", batchId)
    .single();

  if (!batch) return NextResponse.json({ error: "Lote de qualificação não encontrado" }, { status: 404 });
  if (batch.consumido_por_contract_id) {
    return NextResponse.json({
      error: "Este lote já foi consumido por um contrato gerado. Não é possível adicionar partes a ele — gere um novo lote para o próximo contrato.",
    }, { status: 409 });
  }

  // Lote de Termo de Adesão: mesmas travas do servidor da criação (perfil ADMIN/GESTAO, contrato de
  // origem assinado e com cláusula de adesões futuras). O contrato de origem nunca é alterado.
  if (batch.parent_contract_id) {
    const check = await validateAdhesionParent(db, batch.parent_contract_id as string, caller.role);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const { data: inserted, error } = await db
    .from("cm_party_qualifications")
    .insert({
      batch_id: batchId,
      full_name: full_name.trim(),
      email: email.trim(),
      phone: ph.e164,
      role_in_document,
      qualification_token: randomUUID().replace(/-/g, ""),
    })
    .select("id, full_name, email, phone, role_in_document, status, qualification_token")
    .single();

  if (error || !inserted) return NextResponse.json({ error: error?.message ?? "Erro ao adicionar envolvido" }, { status: 500 });

  if (batch.status === "completo") {
    await db.from("cm_qualification_batches").update({ status: "coletando", completed_at: null }).eq("id", batchId);
  }

  // Convite por e-mail só no lote de adesão (os demais fluxos seguem como antes: link e WhatsApp pela tela).
  if (batch.parent_contract_id && process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const subjectGate = auditText("Qualificação pendente: Termo de Adesão ao NCNDA, V3 Partners");
      const htmlGate = auditHtml(`<p>Olá ${inserted.full_name},</p>
         <p>Você foi cadastrado(a) como envolvido(a) na operação abaixo, referente ao documento <strong>Termo de Adesão ao NCNDA</strong>.</p>
         <p>Complete seus dados de qualificação para prosseguirmos: https://app.v3partners.com.br/intake/qualificacao/${inserted.qualification_token}</p>`);
      if (htmlGate.blocking.length > 0) console.error("[add-party] Brand Guardian bloqueou:", htmlGate.blocking);
      await resend.emails.send({
        from: "V3 Partners <noreply@v3partners.com.br>",
        to: inserted.email,
        subject: subjectGate.corrected,
        html: htmlGate.corrected,
      });
    } catch (err) {
      console.error(`[add-party] falha ao enviar e-mail para ${inserted.email}:`, err);
    }
  }

  return NextResponse.json({ party: inserted }, { status: 201 });
}
