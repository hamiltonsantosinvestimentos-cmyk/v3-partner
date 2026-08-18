import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { auditText, auditHtml } from "@/lib/brand-guardian-gate";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data: demand } = await svc()
    .from("investor_demands")
    .select("id, nome_contato, email, intake_locked, intake_data, nda_accepted")
    .eq("intake_token", token)
    .single();

  if (!demand)
    return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });

  if (demand.intake_locked)
    return NextResponse.json({
      error: "Formulário já enviado. Solicite um novo link à equipe V3 Partners.",
      locked: true,
    }, { status: 409 });

  return NextResponse.json({
    demand_id: demand.id,
    prefill: {
      nome_contato: demand.nome_contato !== "Pendente" ? demand.nome_contato : "",
      email: demand.email !== "pendente@pendente.com" ? demand.email : "",
      ...(demand.intake_data as Record<string, unknown> ?? {}),
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data: demand } = await svc()
    .from("investor_demands")
    .select("id, intake_locked, origin_partner_id")
    .eq("intake_token", token)
    .single();

  if (!demand)
    return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });

  if (demand.intake_locked)
    return NextResponse.json({
      error: "Formulário já enviado. Solicite um novo link à equipe V3 Partners.",
      locked: true,
    }, { status: 409 });

  const body = await req.json();
  const {
    nome_contato, email, telefone, empresa, cnpj, cpf,
    nacionalidade, profissao, estado_civil, identidade_orgao, endereco,
    setores, jurisdicao_alvo, natureza_preferida, asset_types_preferidos,
    ticket_min, ticket_max, desagio_min, criterios, nda_accepted,
    purchase_frequency_type, recurrence_months, origin_partner_id,
  } = body;

  if (!nome_contato || !email)
    return NextResponse.json({ error: "Nome e email são obrigatórios" }, { status: 422 });

  // Origin partner e sempre resolvido no servidor contra profiles.id real -- um valor
  // invalido/malformado em ?partner= nunca bloqueia o cadastro do comprador, so fica sem
  // atribuicao (mesmo principio ja usado para documento opcional: nada trava o registro).
  // Preserva o que a Mesa ja tiver atribuido no momento de gerar o link (18/08/2026): o
  // formulario publico nunca manda origin_partner_id, entao sem este fallback o submit
  // apagava silenciosamente a atribuicao feita na criacao do link.
  let resolvedOriginPartnerId: string | null = demand.origin_partner_id ?? null;
  if (origin_partner_id && typeof origin_partner_id === "string") {
    const { data: partnerProfile } = await svc()
      .from("profiles")
      .select("id")
      .eq("id", origin_partner_id)
      .maybeSingle();
    if (partnerProfile) resolvedOriginPartnerId = partnerProfile.id;
  }

  const freqType = ["SINGLE_PURCHASE", "RECURRENT_MONTHLY"].includes(purchase_frequency_type)
    ? purchase_frequency_type
    : null;
  const recMonths = freqType === "RECURRENT_MONTHLY" && recurrence_months
    ? Math.min(60, Math.max(1, Number(recurrence_months)))
    : null;

  const { error } = await svc()
    .from("investor_demands")
    .update({
      nome_contato,
      email,
      telefone: telefone ?? null,
      empresa: empresa ?? null,
      cnpj: cnpj ?? null,
      cpf: cpf ?? null,
      nacionalidade: nacionalidade ?? null,
      profissao: profissao ?? null,
      estado_civil: estado_civil ?? null,
      identidade_orgao: identidade_orgao ?? null,
      endereco: endereco ?? null,
      setores: setores?.length ? setores : ["precatorio"],
      ufs: jurisdicao_alvo?.length ? jurisdicao_alvo : ["RJ"],
      jurisdicao_alvo: jurisdicao_alvo ?? null,
      natureza_preferida: natureza_preferida ?? null,
      asset_types_preferidos: asset_types_preferidos ?? null,
      ticket_min: ticket_min ? Number(ticket_min) : 0,
      ticket_max: ticket_max ? Number(ticket_max) : 99999999,
      desagio_min: desagio_min ? Number(desagio_min) : null,
      tipos_operacao: ["compra"],
      criterios: criterios ?? null,
      origem: "intake_buy",
      status: "ativo",
      alerta_ativo: true,
      nda_accepted: nda_accepted ?? false,
      nda_accepted_at: nda_accepted ? new Date().toISOString() : null,
      purchase_frequency_type: freqType,
      recurrence_months: recMonths,
      origin_partner_id: resolvedOriginPartnerId,
      intake_locked: true,
      intake_data: {
        submitted_at: new Date().toISOString(),
        nda_accepted: nda_accepted ?? false,
      },
    })
    .eq("id", demand.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // E-mail de confirmacao ao comprador -- ate 12/08/2026 esse envio simplesmente nao
  // existia, o unico sinal de "recebido" era a tela de confirmacao no navegador, que
  // desaparece se ele fechar a aba. Best-effort: nunca bloqueia a resposta de sucesso.
  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const ASSET_LABEL: Record<string, string> = {
        precatorio: "Precatório", direito_creditorio: "Direito Creditório",
        icms: "ICMS", ipi: "IPI", outros: "Outros",
      };
      const tiposLabel = (asset_types_preferidos ?? []).map((t: string) => ASSET_LABEL[t] ?? t).join(", ") || "não especificado";
      const subjectGate = auditText("Cadastro recebido — V3 Partners, Bolsa de Ativos");
      const htmlGate = auditHtml(`
        <p>Olá, <strong>${nome_contato}</strong>.</p>
        <p>Seu cadastro de interesse na Bolsa de Ativos V3 Partners foi recebido com sucesso.</p>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">
          <tr><td><strong>Tipo de ativo</strong></td><td>${tiposLabel}</td></tr>
          <tr><td><strong>Ticket</strong></td><td>R$ ${Number(ticket_min || 0).toLocaleString("pt-BR")} a R$ ${Number(ticket_max || 0).toLocaleString("pt-BR")}</td></tr>
        </table>
        <p>A equipe V3 Partners entrará em contato quando ativos compatíveis com seu perfil estiverem disponíveis na vitrine.</p>
        <p style="margin-top:24px;color:#888;font-size:12px">V3 Partners Soluções Ltda — CNPJ 14.219.287/0001-50</p>
      `);
      if (htmlGate.blocking.length > 0) {
        console.error("[cm/intake/buy] Brand Guardian bloqueou e-mail de confirmacao:", htmlGate.blocking);
      } else {
        await resend.emails.send({
          from: "V3 Partners Bolsa de Ativos <deal@v3partners.com.br>",
          to: [email],
          subject: subjectGate.corrected,
          html: htmlGate.corrected,
        });
      }
    } catch (emailErr) {
      console.error("[cm/intake/buy] falha ao enviar e-mail de confirmacao:", emailErr);
    }
  }

  return NextResponse.json({
    success: true,
    message: "Cadastro de interesse recebido. A equipe V3 Partners entrará em contato quando ativos compatíveis estiverem disponíveis.",
  });
}
