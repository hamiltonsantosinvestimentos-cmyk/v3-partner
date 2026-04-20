import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyContratoCompleto } from "@/lib/email";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const V3_REP_EMAIL = process.env.EMAIL_MESA_OPERACIONAL ?? process.env.EMAIL_ADMIN ?? "mesa@v3partners.com.br";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data, error } = await supabase
    .from("contratos_mandato")
    .select("id, status, client_name, client_cpf, client_email, commission_perc, deal_value, credit_line, proposal_code, signed_at, v3_signed_at, v3_signer_name, testemunha_nome, testemunha_email, testemunha_signed_at, endereco_cadastrado, bairro_cadastrado, municipio_cadastrado, estado_cadastrado, cep_cadastrado, telefone")
    .eq("testemunha_token", token)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ contrato: data });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { nome_assinatura, cpf, birthdate, address } = await req.json();

  if (!nome_assinatura?.trim()) {
    return NextResponse.json({ error: "Nome para assinatura obrigatório" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("contratos_mandato")
    .select("id, status, client_name, client_email, credit_line, proposal_code, signed_at, v3_signed_at, v3_signer_name")
    .eq("testemunha_token", token)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 });
  }

  if (data.status !== "AGUARDANDO_TESTEMUNHA") {
    return NextResponse.json({ error: `Contrato está ${data.status.toLowerCase()}` }, { status: 409 });
  }

  const testemunhaSignedAt = new Date().toISOString();

  const { error: updateErr } = await supabase
    .from("contratos_mandato")
    .update({
      status: "ASSINADO",
      testemunha_signed_at: testemunhaSignedAt,
      testemunha_nome: nome_assinatura.trim(),
      testemunha_cpf: cpf ?? null,
      testemunha_birthdate: birthdate ?? null,
      testemunha_address: address ?? null,
    })
    .eq("testemunha_token", token);

  if (updateErr) {
    return NextResponse.json({ error: "Erro ao registrar assinatura" }, { status: 500 });
  }

  await notifyContratoCompleto({
    clientEmail: data.client_email,
    clientName: data.client_name,
    repEmail: V3_REP_EMAIL,
    proposalCode: data.proposal_code ?? "",
    creditLine: data.credit_line ?? "",
    clientSignedAt: data.signed_at ?? testemunhaSignedAt,
    v3SignedAt: data.v3_signed_at ?? testemunhaSignedAt,
    v3SignerName: data.v3_signer_name ?? "",
  });

  return NextResponse.json({ ok: true, testemunha_signed_at: testemunhaSignedAt });
}
