import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyContratoCliente, notifyV3ParaAssinar, notifyTestemunhaParaAssinar, notifyTestemunha2ParaAssinar } from "@/lib/email";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://v3-partner.vercel.app";
const V3_REP_EMAIL = process.env.EMAIL_MESA_OPERACIONAL ?? process.env.EMAIL_ADMIN ?? "mesa@v3partners.com.br";

export async function POST(req: NextRequest) {
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

    // Busca nome, e-mail e CPF do partner (testemunha 1)
    let testemunhaNome: string | null = null;
    let testemunhaEmail: string | null = null;
    let testemunhaCpf: string | null = null;
    if (proposal.partner_id) {
      const { data: partner } = await supabase
        .from("profiles")
        .select("full_name, email, cpf")
        .eq("id", proposal.partner_id)
        .single();
      if (partner) {
        testemunhaNome  = (partner.full_name as string) ?? null;
        testemunhaEmail = (partner.email as string) ?? null;
        testemunhaCpf   = (partner.cpf as string) ?? null;
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
          testemunha_nome:  testemunhaNome,
          testemunha_email: testemunhaEmail,
          testemunha_cpf:   testemunhaCpf,
          // Testemunha 2 — Aline (financeiro)
          testemunha2_nome:  process.env.WITNESS2_NAME  ?? "Aline Rodrigues dos Santos",
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

    // Busca todos os tokens para os 4 assinantes
    const { data: tokens } = await supabase
      .from("contratos_mandato")
      .select("token, v3_token, testemunha_token, testemunha2_token, testemunha_email, testemunha_nome, testemunha2_email, testemunha2_nome")
      .eq("token", token)
      .single();

    const signingUrl     = `${APP_URL}/assinar/${token}`;
    const v3SigningUrl   = tokens?.v3_token       ? `${APP_URL}/assinar/v3/${tokens.v3_token}` : null;
    const t1SigningUrl   = tokens?.testemunha_token  ? `${APP_URL}/assinar/testemunha/${tokens.testemunha_token}` : null;
    const t2SigningUrl   = tokens?.testemunha2_token ? `${APP_URL}/assinar/testemunha2/${tokens.testemunha2_token}` : null;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const joaoEmail    = process.env.EMAIL_V3_SIGNER    ?? "joao.lemos@v3partners.com.br";
    const alineEmail   = process.env.WITNESS2_EMAIL      ?? "financeiro@v3partners.com.br";
    const alineNome    = process.env.WITNESS2_NAME       ?? "Aline Rodrigues dos Santos";

    await Promise.allSettled([
      // 1. Cliente
      notifyContratoCliente({
        clientEmail,
        clientName: proposal.client_name,
        proposalCode: proposal.code,
        creditLine: proposal.credit_line,
        requestedValue: proposal.requested_value,
        signingUrl,
        expiresAt,
      }),
      // 2. João (V3 — representante)
      v3SigningUrl ? notifyV3ParaAssinar({
        repEmail: joaoEmail,
        clientName: proposal.client_name,
        clientEmail,
        proposalCode: proposal.code,
        creditLine: proposal.credit_line,
        signedAt: new Date().toISOString(),
        v3SigningUrl,
      }) : Promise.resolve(),
      // 3. Partner / Partner PRO (1ª testemunha)
      t1SigningUrl && tokens?.testemunha_email ? notifyTestemunhaParaAssinar({
        testemunhaEmail: tokens.testemunha_email as string,
        testemunhaNome:  (tokens.testemunha_nome as string) ?? "Parceiro",
        clientName: proposal.client_name,
        proposalCode: proposal.code,
        creditLine: proposal.credit_line,
        testemunhaUrl: t1SigningUrl,
      }) : Promise.resolve(),
      // 4. Aline (2ª testemunha — financeiro)
      t2SigningUrl ? notifyTestemunha2ParaAssinar({
        testemunhaEmail: alineEmail,
        testemunhaNome:  alineNome,
        clientName: proposal.client_name,
        proposalCode: proposal.code,
        creditLine: proposal.credit_line,
        testemunhaUrl: t2SigningUrl,
      }) : Promise.resolve(),
    ]);

    return NextResponse.json({ ok: true, token, signingUrl });
  } catch (err) {
    console.error("Erro ao enviar contrato:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
