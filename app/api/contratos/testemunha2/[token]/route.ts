import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyContratoFinalizado, notifyAssinaturaRegistrada } from "@/lib/email";
import { gerarCertificadoHTML } from "@/lib/contrato-html";
import { gerarCertificadoPDF } from "@/lib/contrato-pdf";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { token } = await params;

  const { data, error } = await supabase
    .from("contratos_mandato")
    .select("id, status, client_name, client_cpf, client_email, commission_perc, deal_value, credit_line, proposal_code, signed_at, v3_signed_at, v3_signer_name, testemunha_nome, testemunha_signed_at, testemunha2_nome, testemunha2_cpf, testemunha2_signed_at, endereco_cadastrado, bairro_cadastrado, municipio_cadastrado, estado_cadastrado, cep_cadastrado, telefone")
    .eq("testemunha2_token", token)
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
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { token } = await params;
  const { nome_assinatura, cpf, birthdate, address } = await req.json();

  if (!nome_assinatura?.trim()) {
    return NextResponse.json({ error: "Nome para assinatura obrigatório" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("contratos_mandato")
    .select("id, status, client_name, client_email, client_cpf, credit_line, proposal_code, deal_value, commission_perc, signed_at, ip_address, v3_signed_at, v3_signer_name, v3_email, v3_ip_address, testemunha_nome, testemunha_email, testemunha_cpf, testemunha_signed_at, testemunha_ip_address, testemunha2_nome, testemunha2_email, testemunha2_cpf, testemunha2_signed_at")
    .eq("testemunha2_token", token)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 });
  }

  if (data.status === "EXPIRADO" || data.status === "CANCELADO") {
    return NextResponse.json({ error: `Contrato está ${data.status.toLowerCase()}` }, { status: 409 });
  }
  if (data.testemunha2_signed_at) {
    return NextResponse.json({ error: "Você já assinou este contrato." }, { status: 409 });
  }

  const testemunha2SignedAt = new Date().toISOString();

  const ipRaw = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "desconhecido";
  const t2Ip = ipRaw.split(",")[0].trim();

  // Recalcula status com base em quem já assinou
  const clientSigned = !!data.signed_at;
  const v3Signed = !!data.v3_signed_at;
  const t1Signed = !data.testemunha_email || !!data.testemunha_signed_at;
  const novoStatus = (clientSigned && v3Signed && t1Signed) ? "ASSINADO" : "AGUARDANDO_TESTEMUNHA2";

  const { error: updateErr } = await supabase
    .from("contratos_mandato")
    .update({
      status: novoStatus,
      testemunha2_signed_at: testemunha2SignedAt,
      testemunha2_nome: nome_assinatura.trim(),
      testemunha2_cpf: cpf ?? null,
      testemunha2_birthdate: birthdate ?? null,
      testemunha2_address: address ?? null,
      testemunha2_ip_address: t2Ip,
    })
    .eq("testemunha2_token", token);

  if (updateErr) {
    return NextResponse.json({ error: "Erro ao registrar assinatura" }, { status: 500 });
  }

  // Confirmação para Aline
  const alineEmail = (data.testemunha2_email as string) ?? (process.env.WITNESS2_EMAIL ?? "financeiro@v3partners.com.br");
  await notifyAssinaturaRegistrada({
    email: alineEmail,
    nome: nome_assinatura.trim(),
    papel: "2ª Testemunha (Institucional)",
    proposalCode: data.proposal_code ?? "",
    clientName: data.client_name,
    signedAt: testemunha2SignedAt,
  });

  // Gera e faz upload dos certificados (HTML + PDF)
  let contratoUrl: string | null = null;
  try {
    const certData = {
      proposal_code: data.proposal_code,
      client_name: data.client_name,
      client_email: data.client_email,
      client_cpf: data.client_cpf,
      credit_line: data.credit_line,
      deal_value: data.deal_value,
      commission_perc: data.commission_perc ?? 6,
      signed_at: data.signed_at,
      ip_address: data.ip_address,
      v3_signer_name: data.v3_signer_name,
      v3_email: data.v3_email,
      v3_signed_at: data.v3_signed_at,
      v3_ip_address: data.v3_ip_address,
      testemunha_nome: data.testemunha_nome,
      testemunha_email: data.testemunha_email,
      testemunha_cpf: data.testemunha_cpf,
      testemunha_signed_at: data.testemunha_signed_at,
      testemunha_ip_address: data.testemunha_ip_address,
      testemunha2_nome: nome_assinatura.trim(),
      testemunha2_email: data.testemunha2_email,
      testemunha2_cpf: cpf ?? data.testemunha2_cpf,
      testemunha2_signed_at: testemunha2SignedAt,
      testemunha2_ip_address: t2Ip,
    };
    const htmlContent = gerarCertificadoHTML(certData);

    const prefix = `${data.proposal_code ?? data.id}/${token}`;

    // Upload HTML
    const { error: htmlErr } = await supabase.storage
      .from("contratos")
      .upload(`${prefix}.html`, Buffer.from(htmlContent, "utf-8"), {
        contentType: "text/html; charset=utf-8",
        upsert: true,
      });

    let contratoPdfUrl: string | null = null;

    // Upload PDF
    try {
      const pdfBuffer = await gerarCertificadoPDF(certData);
      const { error: pdfErr } = await supabase.storage
        .from("contratos")
        .upload(`${prefix}.pdf`, pdfBuffer, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (!pdfErr) {
        const { data: pdfSigned } = await supabase.storage
          .from("contratos")
          .createSignedUrl(`${prefix}.pdf`, 60 * 60 * 24 * 365);
        contratoPdfUrl = pdfSigned?.signedUrl ?? null;
      }
    } catch (pdfGenErr) {
      console.error("Erro ao gerar PDF:", pdfGenErr);
    }

    if (!htmlErr) {
      const { data: signedData } = await supabase.storage
        .from("contratos")
        .createSignedUrl(`${prefix}.html`, 60 * 60 * 24 * 365);

      if (signedData?.signedUrl) {
        contratoUrl = signedData.signedUrl;
        await supabase
          .from("contratos_mandato")
          .update({
            contrato_url: contratoUrl,
            contrato_pdf_url: contratoPdfUrl,
          })
          .eq("testemunha2_token", token);
      }
    }
  } catch (certErr) {
    console.error("Erro ao gerar/salvar certificado:", certErr);
    // não bloqueia o fluxo
  }

  // Envia e-mail para todos os envolvidos
  await notifyContratoFinalizado({
    proposalCode: data.proposal_code ?? "",
    creditLine: data.credit_line ?? "",
    contratoUrl,
    clientName: data.client_name,
    clientEmail: data.client_email,
    clientData: data.signed_at,
    clientIp: data.ip_address,
    v3Nome: data.v3_signer_name ?? "V3 Partners",
    v3Email: data.v3_email ?? "joao.lemos@v3partners.com.br",
    v3Data: data.v3_signed_at,
    v3Ip: data.v3_ip_address,
    t1Nome: data.testemunha_nome,
    t1Email: data.testemunha_email,
    t1Data: data.testemunha_signed_at,
    t1Ip: data.testemunha_ip_address,
    t2Nome: nome_assinatura.trim(),
    t2Email: data.testemunha2_email,
    t2Data: testemunha2SignedAt,
    t2Ip,
  });

  return NextResponse.json({ ok: true, testemunha2_signed_at: testemunha2SignedAt });
}
