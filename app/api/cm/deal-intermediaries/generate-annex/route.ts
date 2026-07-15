import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { resolveContractVariables, wrapContractInV3Html } from "@/lib/contract-render";
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

function buildDistribuicaoTableHtml(rows: { intermediary_name: string; intermediary_document: string | null; percentage: number }[]): string {
  const linhas = rows
    .map(
      (r) =>
        `<tr><td style="padding:6px 10px;border-bottom:1px solid #243A66">${r.intermediary_name}</td><td style="padding:6px 10px;border-bottom:1px solid #243A66">${r.intermediary_document ?? "N/D"}</td><td style="padding:6px 10px;border-bottom:1px solid #243A66;text-align:right">${r.percentage}%</td></tr>`
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:12px">
    <thead><tr style="color:#E8C97A;text-transform:uppercase;font-size:10px">
      <th style="text-align:left;padding:6px 10px;border-bottom:2px solid #C9A84C">Intermediário</th>
      <th style="text-align:left;padding:6px 10px;border-bottom:2px solid #C9A84C">CPF/CNPJ</th>
      <th style="text-align:right;padding:6px 10px;border-bottom:2px solid #C9A84C">Percentual</th>
    </tr></thead>
    <tbody>${linhas}</tbody>
  </table>`;
}

/** POST /api/cm/deal-intermediaries/generate-annex: gera o Anexo FPA/NCND e envia link de assinatura ao Mandatario */
export async function POST(req: NextRequest) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { listing_id, side } = await req.json();
  if (!listing_id || !["compra", "venda"].includes(side))
    return NextResponse.json({ error: "listing_id e side ('compra'|'venda') são obrigatórios" }, { status: 422 });

  const { data: rows } = await svc()
    .from("cm_deal_intermediaries")
    .select("*, profiles!cm_deal_intermediaries_mandatario_partner_id_fkey(id, full_name, email, document_cpf)")
    .eq("listing_id", listing_id)
    .eq("side", side);

  if (!rows || rows.length === 0)
    return NextResponse.json({ error: "Nenhum intermediário cadastrado para este lado da operação" }, { status: 422 });

  const mandatario = (rows[0] as any).profiles;
  const mandatarioId = rows[0].mandatario_partner_id;
  const mismatched = rows.some((r) => r.mandatario_partner_id !== mandatarioId);
  if (mismatched)
    return NextResponse.json({ error: "Todos os intermediários deste lado precisam ter o mesmo Mandatário" }, { status: 422 });

  // Gate juridico: Mandatario precisa ter o Contrato de Parceria padrao assinado
  // antes de assumir a obrigacao irrevogavel do Anexo FPA/NCND.
  const { data: partnerContract } = await svc()
    .from("partner_contracts")
    .select("id")
    .eq("user_id", mandatarioId)
    .maybeSingle();

  if (!partnerContract)
    return NextResponse.json({ error: `${mandatario?.full_name ?? "O Mandatário"} ainda não assinou o Contrato de Parceria. Assine-o antes de gerar o Anexo FPA/NCND.` }, { status: 409 });

  const { data: listing } = await svc()
    .from("cm_asset_listings")
    .select("id, anonymous_id")
    .eq("id", listing_id)
    .single();

  if (!listing) return NextResponse.json({ error: "Ativo não encontrado" }, { status: 404 });

  const { data: template } = await svc()
    .from("contract_templates")
    .select("*")
    .eq("vertical", "capital_markets")
    .eq("template_name", "Anexo FPA/NCND: Distribuição de Comissionamento")
    .eq("is_active", true)
    .maybeSingle();

  if (!template) return NextResponse.json({ error: "Template do Anexo FPA/NCND não encontrado" }, { status: 404 });

  const variables: Record<string, any> = {
    anonymous_id: listing.anonymous_id,
    lado_operacao: side === "compra" ? "Compra" : "Venda",
    mandatario_nome: mandatario?.full_name ?? "[mandatario_nome]",
    mandatario_documento: mandatario?.document_cpf ?? "[mandatario_documento]",
    tabela_distribuicao: buildDistribuicaoTableHtml(rows as any),
    data_geracao_extenso: new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }),
  };

  const renderedBody = resolveContractVariables(template.body_text_raw, variables);
  const contractTitle = `${resolveContractVariables(template.template_name, variables)}, ${listing.anonymous_id} (${variables.lado_operacao})`;
  const renderedHtml = wrapContractInV3Html(contractTitle, renderedBody);
  const signingToken = randomUUID().replace(/-/g, "");

  const { data: contract, error } = await svc()
    .from("operation_contracts")
    .insert({
      template_id: template.id,
      vertical: "capital_markets",
      listing_id,
      contract_title: contractTitle,
      rendered_html: renderedHtml,
      status_signature: "enviado_assinatura",
      signing_token: signingToken,
      parties: [
        { role: "mandatario", name: mandatario?.full_name ?? null, doc: mandatario?.document_cpf ?? null, email: mandatario?.email ?? null },
        { role: "v3_partners", name: "V3 Partners Soluções Ltda", doc: "14.219.287/0001-50" },
      ],
      created_by: caller.userId,
    })
    .select("id, signing_token")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (mandatario?.email && process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const annexSubjectGate = auditText(`Assinatura pendente: ${contractTitle}`);
      const annexHtmlGate = auditHtml(`<p>Olá ${mandatario.full_name},</p>
               <p>Você foi designado Mandatário da cadeia de intermediação (lado ${variables.lado_operacao}) do ativo <strong>${listing.anonymous_id}</strong>.</p>
               <p>Assine o Anexo FPA/NCND para confirmar o recebimento centralizado e a obrigação de repasse: https://app.v3partners.com.br/assinar/anexo/${signingToken}</p>`);
      if (annexHtmlGate.blocking.length > 0) console.error("[generate-annex] Brand Guardian bloqueou:", annexHtmlGate.blocking);
      await resend.emails.send({
        from: "V3 Partners Bolsa de Ativos <noreply@v3partners.com.br>",
        to: mandatario.email,
        subject: annexSubjectGate.corrected,
        html: annexHtmlGate.corrected,
      });
    } catch (err) {
      console.error("[generate-annex] falha ao enviar email de assinatura:", err);
    }
  }

  return NextResponse.json({ contract, signing_url: `/assinar/anexo/${signingToken}` }, { status: 201 });
}
