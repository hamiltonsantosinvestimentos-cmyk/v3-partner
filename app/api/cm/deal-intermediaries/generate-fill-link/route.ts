import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { auditText, auditHtml } from "@/lib/brand-guardian-gate";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

async function getCaller() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

/** POST /api/cm/deal-intermediaries/generate-fill-link
 * Gera link publico para o Mandatario preencher sozinho a cadeia de intermediarios
 * do seu lado (nome + CPF/CNPJ + percentual), sem depender da Mesa digitar manualmente.
 */
export async function POST(req: NextRequest) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { listing_id, side, mandatario_partner_id } = await req.json();
  if (!listing_id || !["compra", "venda"].includes(side) || !mandatario_partner_id) {
    return NextResponse.json({ error: "listing_id, side ('compra'|'venda') e mandatario_partner_id são obrigatórios" }, { status: 422 });
  }

  const { data: listing } = await svc()
    .from("cm_asset_listings")
    .select("id, anonymous_id")
    .eq("id", listing_id)
    .single();
  if (!listing) return NextResponse.json({ error: "Ativo não encontrado" }, { status: 404 });

  const { data: mandatario } = await svc()
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", mandatario_partner_id)
    .single();
  if (!mandatario) return NextResponse.json({ error: "Mandatário não encontrado" }, { status: 404 });

  const token = randomUUID().replace(/-/g, "");

  const { data: fillToken, error } = await svc()
    .from("cm_intermediary_fill_tokens")
    .insert({
      listing_id,
      side,
      mandatario_partner_id,
      token,
      created_by: caller.userId,
    })
    .select("id, token")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const url = `https://app.v3partners.com.br/preencher-intermediarios/${token}`;

  if (mandatario.email && process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const subjectGate = auditText(`Preencha a cadeia de intermediários, ${listing.anonymous_id}`);
      const htmlGate = auditHtml(`<p>Olá ${mandatario.full_name},</p>
               <p>Você foi designado Mandatário do lado ${side === "compra" ? "Compra" : "Venda"} do ativo <strong>${listing.anonymous_id}</strong>.</p>
               <p>Preencha a distribuição de percentuais entre os intermediários da sua cadeia de originação: ${url}</p>`);
      if (htmlGate.blocking.length > 0) console.error("[generate-fill-link] Brand Guardian bloqueou:", htmlGate.blocking);
      await resend.emails.send({
        from: "V3 Partners Bolsa de Ativos <noreply@v3partners.com.br>",
        to: mandatario.email,
        subject: subjectGate.corrected,
        html: htmlGate.corrected,
      });
    } catch (err) {
      console.error("[generate-fill-link] falha ao enviar email:", err);
    }
  }

  return NextResponse.json({ fill_token: fillToken, url }, { status: 201 });
}
