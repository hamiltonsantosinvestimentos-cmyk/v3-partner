import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyContratoCliente, notifyContratoV3Rep } from "@/lib/email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://v3-partner.vercel.app";
const V3_REP_EMAIL = process.env.EMAIL_MESA_OPERACIONAL ?? process.env.EMAIL_ADMIN ?? "mesa@v3partners.com.br";

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  try {
    const { proposal_id } = await req.json();
    if (!proposal_id) {
      return NextResponse.json({ error: "proposal_id obrigatório" }, { status: 400 });
    }

    // Busca a proposta + partner_id
    const { data: proposal, error: propErr } = await supabase
      .from("credit_desk_proposals")
      .select("id, code, title, client_name, client_cpf_cnpj, credit_line, requested_value, comissao_mandato_perc, metadata, partner_id")
      .eq("id", proposal_id)
      .single();

    if (propErr || !proposal) {
      return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
    }

    const meta = (proposal.metadata as Record<string, unknown>) ?? {};
    const clientEmail = typeof meta.email === "string" && meta.email.trim() ? meta.email.trim() : null;

    if (!clientEmail) {
      return NextResponse.json({ error: "E-mail do cliente não cadastrado na proposta" }, { status: 422 });
    }

    // Busca e-mail e nome do partner (testemunha)
    let testemunhaNome: string | null = null;
    let testemunhaEmail: string | null = null;
    if (proposal.partner_id) {
      const { data: partner } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", proposal.partner_id)
        .single();
      if (partner) {
        testemunhaNome = (partner.full_name as string) ?? null;
        testemunhaEmail = (partner.email as string) ?? null;
      }
    }

    // Verifica contrato pendente já existente
    const { data: existing } = await supabase
      .from("contratos_mandato")
      .select("id, token, status")
      .eq("proposal_id", proposal_id)
      .eq("status", "PENDENTE")
      .maybeSingle();

    let token: string;

    if (existing) {
      token = existing.token;
      await supabase
        .from("contratos_mandato")
        .update({ expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })
        .eq("id", existing.id);
    } else {
      const commissionPerc = (proposal.comissao_mandato_perc as number) ?? 6.0;
      const telefone = (meta.telefone as string) ?? null;
      const enderecoRua   = (meta.endereco_rua   ?? "") as string;
      const bairroMeta    = (meta.bairro          ?? "") as string;
      const municipioMeta = (meta.endereco_cidade ?? "") as string;
      const estadoMeta    = (meta.endereco_uf     ?? "") as string;
      const cepMeta       = (meta.endereco_cep    ?? "") as string;

      const { data: contrato, error: insertErr } = await supabase
        .from("contratos_mandato")
        .insert({
          proposal_id,
          client_name: proposal.client_name,
          client_cpf: proposal.client_cpf_cnpj ?? null,
          client_email: clientEmail,
          commission_perc: commissionPerc,
          deal_value: proposal.requested_value,
          credit_line: proposal.credit_line,
          proposal_code: proposal.code,
          telefone,
          endereco_cadastrado: enderecoRua || null,
          bairro_cadastrado: bairroMeta || null,
          municipio_cadastrado: municipioMeta || null,
          estado_cadastrado: estadoMeta || null,
          cep_cadastrado: cepMeta || null,
          testemunha_nome: testemunhaNome,
          testemunha_email: testemunhaEmail,
          // Testemunha 2 — configurada via variável de ambiente
          testemunha2_nome:  process.env.WITNESS2_NAME  ?? "Representante V3 Partners",
          testemunha2_email: process.env.WITNESS2_EMAIL ?? "financeiro@v3partners.com.br",
          testemunha2_cpf:   process.env.WITNESS2_CPF   ?? null,
          v3_email:          process.env.EMAIL_V3_SIGNER ?? "joao.lemos@v3partners.com.br",
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select("token")
        .single();

      if (insertErr || !contrato) {
        console.error("Erro ao criar contrato:", insertErr);
        return NextResponse.json({ error: "Erro ao criar contrato" }, { status: 500 });
      }
      token = contrato.token;
    }

    const signingUrl = `${APP_URL}/assinar/${token}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await Promise.allSettled([
      notifyContratoCliente({
        clientEmail,
        clientName: proposal.client_name,
        proposalCode: proposal.code,
        creditLine: proposal.credit_line,
        requestedValue: proposal.requested_value,
        signingUrl,
        expiresAt,
      }),
      notifyContratoV3Rep({
        repEmail: V3_REP_EMAIL,
        clientName: proposal.client_name,
        clientEmail,
        proposalCode: proposal.code,
        creditLine: proposal.credit_line,
        requestedValue: proposal.requested_value,
        commissionPerc: (proposal.comissao_mandato_perc as number) ?? 6.0,
        signingUrl,
      }),
    ]);

    return NextResponse.json({ ok: true, token, signingUrl });
  } catch (err) {
    console.error("Erro ao enviar contrato:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
