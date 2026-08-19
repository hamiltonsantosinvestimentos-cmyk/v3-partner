import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notify";
import { auditText, auditHtml } from "@/lib/brand-guardian-gate";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

// Checklist fixo de KYC (BRIEF 3b, 19/08/2026, decisao explicita de Joao: checklist fixo,
// nao so "pelo menos 1 documento"). contrato_social so entra na exigencia quando o comprador
// e PJ (cnpj preenchido) -- nao ha campo person_type em investor_demands, a mesma inferencia
// por presenca de cnpj ja usada no resto do modulo (ex: legal-text de qualificacao).
function missingKycItems(docTypes: Set<string>, isPJ: boolean): string[] {
  const missing: string[] = [];
  if (!docTypes.has("kyc_identidade")) missing.push("Identidade (RG/CNH)");
  if (!docTypes.has("kyc_comprovante_residencia")) missing.push("Comprovante de Residência");
  if (isPJ && !docTypes.has("kyc_contrato_social")) missing.push("Contrato Social");
  return missing;
}

/** POST /api/cm/investor-demands/[id]/approve-kyc — Mesa aprova o checklist de KYC do comprador.
 *  Gate real: bloqueia (422) se faltar documento do checklist fixo, nunca aprova "no escuro".
 *  Ao aprovar: grava kyc_approved_at/by, timeline (cm_deal_notes, is_system), e-mail Resend pro
 *  comprador com link de retorno (upload de documento ja funciona pos-trava, 12/08/2026), e
 *  notificacao in-app pro Partner de origem. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as string)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { id } = await params;

  const { data: demand } = await db
    .from("investor_demands")
    .select("id, nome_contato, email, cnpj, intake_token, origin_partner_id, kyc_approved_at")
    .eq("id", id)
    .maybeSingle();

  if (!demand) return NextResponse.json({ error: "Comprador não encontrado" }, { status: 404 });
  if (demand.kyc_approved_at) {
    return NextResponse.json({ error: "KYC já aprovado para este comprador." }, { status: 422 });
  }

  const { data: docs } = await db
    .from("investor_demand_documents")
    .select("document_type")
    .eq("demand_id", id);

  const docTypes = new Set((docs ?? []).map((d) => d.document_type));
  const isPJ = !!demand.cnpj;
  const missing = missingKycItems(docTypes, isPJ);

  if (missing.length > 0) {
    return NextResponse.json({
      error: `Checklist de KYC incompleto. Faltando: ${missing.join(", ")}.`,
      missing,
    }, { status: 422 });
  }

  const { error: updateError } = await db
    .from("investor_demands")
    .update({ kyc_approved_at: new Date().toISOString(), kyc_approved_by: user.id })
    .eq("id", id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Timeline -- nota de sistema, sem author_id humano.
  void db.from("cm_deal_notes").insert({
    demand_id: id,
    content: "KYC aprovado pela Mesa. Full DD liberado para este comprador.",
    is_system: true,
  });

  // Notifica o Partner de origem, mesmo padrao ja usado no upload de documento.
  if (demand.origin_partner_id) {
    void createNotification({
      user_id: demand.origin_partner_id,
      title: `KYC aprovado: ${demand.nome_contato}`,
      message: "O comprador que você indicou teve o KYC aprovado pela Mesa. Full DD liberado.",
      type: "marketplace",
      action_url: "/meus-compradores",
    });
  }

  // E-mail pro comprador -- best-effort, nunca bloqueia a aprovacao se falhar. Link de volta
  // ao proprio /intake/buy/[token]: upload de documento ja funciona mesmo com intake_locked=true
  // (12/08/2026), entao "ate coletar tudo" nao precisa de rota nova nenhuma.
  if (process.env.RESEND_API_KEY && demand.email) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const link = `https://app.v3partners.com.br/intake/buy/${demand.intake_token}`;
      const subjectGate = auditText("KYC aprovado — V3 Partners, Bolsa de Ativos");
      const htmlGate = auditHtml(`
        <p>Olá, <strong>${demand.nome_contato}</strong>.</p>
        <p>Seu KYC foi aprovado pela equipe V3 Partners. Você já está liberado para a Due Diligence completa dos ativos compatíveis com seu perfil.</p>
        <p>Se precisar enviar ou completar algum documento adicional, use o link abaixo a qualquer momento:</p>
        <p><a href="${link}">${link}</a></p>
        <p style="margin-top:24px;color:#888;font-size:12px">V3 Partners Soluções Ltda — CNPJ 14.219.287/0001-50</p>
      `);
      if (htmlGate.blocking.length > 0) {
        console.error("[approve-kyc] Brand Guardian bloqueou e-mail:", htmlGate.blocking);
      } else {
        await resend.emails.send({
          from: "V3 Partners Bolsa de Ativos <deal@v3partners.com.br>",
          to: [demand.email],
          subject: subjectGate.corrected,
          html: htmlGate.corrected,
        });
      }
    } catch (emailErr) {
      console.error("[approve-kyc] falha ao enviar e-mail:", emailErr);
    }
  }

  return NextResponse.json({ success: true });
}
