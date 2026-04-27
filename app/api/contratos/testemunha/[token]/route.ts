import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyContratoCompleto, notifyAssinaturaRegistrada } from "@/lib/email";

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
    .select("id, status, client_name, client_cpf, client_email, commission_perc, deal_value, credit_line, proposal_code, signed_at, v3_signed_at, v3_signer_name, testemunha_nome, testemunha_email, testemunha_signed_at, testemunha2_signed_at, endereco_cadastrado, bairro_cadastrado, municipio_cadastrado, estado_cadastrado, cep_cadastrado, telefone")
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
    .select("id, status, client_name, client_email, credit_line, proposal_code, signed_at, v3_signed_at, v3_signer_name, testemunha_signed_at, testemunha2_email, testemunha2_signed_at, testemunha2_nome, testemunha2_token")
    .eq("testemunha_token", token)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 });
  }

  if (data.status === "EXPIRADO" || data.status === "CANCELADO") {
    return NextResponse.json({ error: `Contrato está ${data.status.toLowerCase()}` }, { status: 409 });
  }
  if (data.testemunha_signed_at) {
    return NextResponse.json({ error: "Você já assinou este contrato." }, { status: 409 });
  }

  const testemunhaSignedAt = new Date().toISOString();
  const ipRaw = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "desconhecido";
  const t1Ip = ipRaw.split(",")[0].trim();

  const { error: updateErr } = await supabase
    .from("contratos_mandato")
    .update({
      testemunha_signed_at: testemunhaSignedAt,
      testemunha_nome: nome_assinatura.trim(),
      testemunha_cpf: cpf ?? null,
      testemunha_birthdate: birthdate ?? null,
      testemunha_address: address ?? null,
      testemunha_ip_address: t1Ip,
    })
    .eq("testemunha_token", token);

  if (updateErr) {
    return NextResponse.json({ error: "Erro ao registrar assinatura" }, { status: 500 });
  }

  // Status independente de ordem
  const clientSigned = !!data.signed_at;
  const v3Signed = !!data.v3_signed_at;
  const t2Done = !data.testemunha2_email || !!data.testemunha2_signed_at;
  const allSigned = clientSigned && v3Signed && t2Done;
  const novoStatus = allSigned ? "ASSINADO" : "AGUARDANDO_TESTEMUNHA";

  await supabase.from("contratos_mandato").update({ status: novoStatus }).eq("testemunha_token", token);

  // Busca email da testemunha para confirmação
  const { data: t1Data } = await supabase
    .from("contratos_mandato")
    .select("testemunha_email, testemunha_nome")
    .eq("testemunha_token", token)
    .single();

  if (t1Data?.testemunha_email) {
    await notifyAssinaturaRegistrada({
      email: t1Data.testemunha_email as string,
      nome: nome_assinatura.trim(),
      papel: "1ª Testemunha (Parceiro Originador)",
      proposalCode: data.proposal_code ?? "",
      clientName: data.client_name,
      signedAt: testemunhaSignedAt,
    });
  }

  if (novoStatus === "ASSINADO") {
    await notifyContratoCompleto({
      clientEmail: data.client_email, clientName: data.client_name,
      repEmail: V3_REP_EMAIL, proposalCode: data.proposal_code ?? "",
      creditLine: data.credit_line ?? "", clientSignedAt: data.signed_at ?? testemunhaSignedAt,
      v3SignedAt: data.v3_signed_at ?? testemunhaSignedAt, v3SignerName: data.v3_signer_name ?? "",
    });
  }

  return NextResponse.json({ ok: true, testemunha_signed_at: testemunhaSignedAt });
}
