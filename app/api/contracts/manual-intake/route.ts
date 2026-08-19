import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { createHash, randomUUID } from "crypto";
import mammoth from "mammoth";
import { resolveContractVariables, wrapContractInV3Html } from "@/lib/contract-render";
import { htmlToPdfBase64 } from "@/lib/clicksign";
import { mergeAndStampManualContract } from "@/lib/contract-watermark";
import type { V3Series } from "@/lib/v3-codes";

// POST /api/contracts/manual-intake: Regularização de Contratos Manuais
// (19/08/2026, item 4 dos ajustes de governança pedidos por João, série
// V3C-REG). Fecha o gap real: contratos assinados fisicamente/por fora
// antes de a Central de Contratos existir, sem numeração V3, viram um
// registro operation_contracts real, com PDF final (capa "Termo de
// Ratificação e Vinculação Comercial" + original) estampado e com hash
// SHA-256 de ambos os arquivos para não-repúdio.
//
// O texto jurídico do Termo NÃO é escrito aqui: é uma minuta normal em
// contract_templates (série V3C-REG), que precisa estar approval_status =
// 'aprovado' (mesmo quórum jurídico+compliance de qualquer outro template,
// NUNCA grandfathered como os 8 templates de 11/08, este é novo). Sem
// minuta aprovada, esta rota recusa com 422 explícito, nunca inventa texto.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Regularizar um contrato manual é ato com efeito jurídico retroativo
// (estende validade a negócios futuros via operation_contract_links),
// mesmo gate restrito de ADMIN/GESTAO já usado em edit-body e nos links.
async function requireRole(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!profile || !["ADMIN", "GESTAO"].includes(profile.role as string)) return null;
  return { userId: user.id };
}

const MAX_SIZE = 10 * 1024 * 1024; // 10MB, maior que o limite de minuta (5MB) porque aqui é scan real de contrato assinado, não texto de template
const ALLOWED_EXT = [".pdf", ".docx", ".txt"];

interface AvulsoParty {
  name: string;
  email: string;
  doc?: string;
  role?: string;
}

export async function POST(req: NextRequest) {
  const caller = await requireRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const justification = (formData.get("justification") as string | null)?.trim();
  const partiesRaw = formData.get("parties") as string | null;
  const regularizationExpiresAtRaw = formData.get("regularization_expires_at") as string | null;
  const commissionPercentRaw = formData.get("commission_percent") as string | null;
  const signatureMessageOverride = (formData.get("signature_message") as string | null)?.trim() || null;

  if (!file) return NextResponse.json({ error: "Arquivo do contrato manual obrigatório" }, { status: 422 });
  if (!justification) return NextResponse.json({ error: "Justificativa operacional obrigatória: explique por que este contrato está sendo regularizado agora" }, { status: 422 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Arquivo excede 10MB" }, { status: 422 });

  const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    return NextResponse.json({ error: `Formato ${ext} não suportado. Use: ${ALLOWED_EXT.join(", ")}` }, { status: 422 });
  }

  let parties: AvulsoParty[] = [];
  try {
    parties = JSON.parse(partiesRaw ?? "[]");
  } catch {
    return NextResponse.json({ error: "Campo parties inválido (esperado JSON)" }, { status: 422 });
  }
  const invalidParty = parties.some((p) => !p?.name?.trim() || !p?.email?.trim());
  if (parties.length === 0 || invalidParty) {
    return NextResponse.json({ error: "Informe ao menos uma contraparte com nome e e-mail preenchidos" }, { status: 422 });
  }

  const db = svc();

  // Minuta do Termo de Ratificação e Vinculação Comercial: precisa já
  // existir, aprovada, antes de qualquer regularização. Não é inventada
  // aqui: o texto real é fornecido por João e passa pela revisão do Dr.
  // Athaydes via a mesma tela de Minutas (contract_template_reviews).
  const { data: template } = await db
    .from("contract_templates")
    .select("*")
    .eq("contract_series", "V3C-REG")
    .eq("approval_status", "aprovado")
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!template) {
    return NextResponse.json({
      error: "Nenhuma minuta \"Termo de Ratificação e Vinculação Comercial\" (série V3C-REG) aprovada ainda. Cadastre o texto em Central de Contratos > Minutas e envie para revisão jurídica antes de regularizar qualquer contrato manual.",
    }, { status: 422 });
  }

  const originalBuffer = Buffer.from(await file.arrayBuffer());
  const originalFileHash = createHash("sha256").update(originalBuffer).digest("hex");

  const { data: contractCode, error: codeError } = await db.rpc("next_v3_code", {
    p_series: "V3C-REG" as V3Series,
    p_class: null,
  });
  if (codeError || !contractCode) {
    return NextResponse.json({ error: `Falha ao emitir número do contrato: ${codeError?.message ?? "resposta vazia"}` }, { status: 500 });
  }

  const todayFormatted = new Date().toLocaleDateString("pt-BR");
  const todayExtenso = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

  const partesBlock = parties
    .map((p) => `${p.name}${p.doc ? `, inscrito(a) no CPF/CNPJ sob o nº ${p.doc}` : ""}, e-mail ${p.email}`)
    .join("; ");

  const variables: Record<string, any> = {
    data_geracao: todayFormatted,
    data_geracao_extenso: todayExtenso,
    codigo_regularizacao: contractCode,
    data_revalidacao: todayFormatted,
    justificativa_operacional: justification,
    partes_regularizadas_block: partesBlock,
    nome_arquivo_original: file.name,
  };

  const resolvedParties = [
    ...parties.map((p) => ({ role: p.role?.trim() || "contraparte", name: p.name.trim(), doc: p.doc?.trim() || null, email: p.email.trim() })),
    { role: "v3_partners", name: "João Lemos Netto", doc: "14.219.287/0001-50", email: "joao.lemos@v3partners.com.br" },
  ];

  const renderedBody = resolveContractVariables(template.body_text_raw, variables);
  const contractTitle = resolveContractVariables(template.template_name, variables);
  const termoHtml = wrapContractInV3Html(contractTitle, renderedBody, resolvedParties);

  // Capa (Termo) sempre renderizada de HTML → PDF, mesmo pipeline já
  // homologado (lib/clicksign.ts, htmlToPdfBase64).
  const coverPdfDataUri = await htmlToPdfBase64(termoHtml);
  const coverPdfBytes = Buffer.from(coverPdfDataUri.replace(/^data:application\/pdf;base64,/, ""), "base64");

  // Conteúdo original a mesclar: PDF entra direto (bytes reais, fac-símile
  // preservado). DOCX/TXT viram HTML no padrão visual V3 e passam pelo
  // mesmo conversor, não é fac-símile do original (mammoth não preserva
  // layout visual, só estrutura semântica), é transcrição fiel do texto,
  // rotulada como tal no próprio corpo para nunca ser confundida com scan.
  let originalPdfBytesForMerge: Buffer;
  if (ext === ".pdf") {
    originalPdfBytesForMerge = originalBuffer;
  } else if (ext === ".docx") {
    const { value: html } = await mammoth.convertToHtml({ buffer: originalBuffer });
    const transcriptionHtml = wrapContractInV3Html(
      `Transcrição do Documento Original, ${file.name}`,
      `<p style="font-size:11px;color:#9BAFC5;font-style:italic">Transcrição textual gerada a partir do arquivo .docx enviado, não é fac-símile do documento original. O arquivo original, íntegro, fica preservado no Storage e seu hash SHA-256 consta no registro deste contrato.</p>${html}`
    );
    const dataUri = await htmlToPdfBase64(transcriptionHtml);
    originalPdfBytesForMerge = Buffer.from(dataUri.replace(/^data:application\/pdf;base64,/, ""), "base64");
  } else {
    const text = originalBuffer.toString("utf-8");
    const transcriptionHtml = wrapContractInV3Html(
      `Transcrição do Documento Original, ${file.name}`,
      `<p style="font-size:11px;color:#9BAFC5;font-style:italic">Transcrição textual do arquivo .txt enviado, o arquivo original, íntegro, fica preservado no Storage e seu hash SHA-256 consta no registro deste contrato.</p><pre style="white-space:pre-wrap;font-family:inherit">${text.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!))}</pre>`
    );
    const dataUri = await htmlToPdfBase64(transcriptionHtml);
    originalPdfBytesForMerge = Buffer.from(dataUri.replace(/^data:application\/pdf;base64,/, ""), "base64");
  }

  const { pdfBytes: stampedBytes } = await mergeAndStampManualContract(coverPdfBytes, originalPdfBytesForMerge, {
    code: contractCode,
    date: todayFormatted,
    justification,
  });
  const stampedBuffer = Buffer.from(stampedBytes);
  const stampedFileHash = createHash("sha256").update(stampedBuffer).digest("hex");

  const contractId = randomUUID();
  const originalStoragePath = `contratos-manuais/${contractId}-original${ext}`;
  const stampedStoragePath = `contratos-manuais/${contractId}-estampado.pdf`;

  const [uploadOriginal, uploadStamped] = await Promise.all([
    db.storage.from("documents").upload(originalStoragePath, originalBuffer, {
      contentType: ext === ".pdf" ? "application/pdf" : ext === ".docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "text/plain",
      upsert: true,
    }),
    db.storage.from("documents").upload(stampedStoragePath, stampedBuffer, { contentType: "application/pdf", upsert: true }),
  ]);

  if (uploadOriginal.error || uploadStamped.error) {
    return NextResponse.json({
      error: `Falha ao subir arquivo(s) para o Storage: ${uploadOriginal.error?.message ?? ""} ${uploadStamped.error?.message ?? ""}`.trim(),
    }, { status: 500 });
  }

  const defaultSignatureMessage =
    `Este documento consolida a revalidação e a integração do contrato original ao sistema V3 Partners, sob o código de registro ${contractCode}. Sua assinatura digital abaixo ratifica os termos já vigentes entre as partes e formaliza o registro deste instrumento na Central de Contratos.`;

  const { data: contract, error } = await db
    .from("operation_contracts")
    .insert({
      id: contractId,
      template_id: template.id,
      contract_code: contractCode,
      vertical: template.vertical,
      contract_title: contractTitle,
      rendered_html: termoHtml,
      status_signature: "rascunho",
      commission_percent: commissionPercentRaw ? Number(commissionPercentRaw) : null,
      parties: resolvedParties,
      is_master_agreement: true,
      manual_original_path: originalStoragePath,
      stamped_document_path: stampedStoragePath,
      regularization_justification: justification,
      regularization_expires_at: regularizationExpiresAtRaw || null,
      original_file_hash: originalFileHash,
      stamped_file_hash: stampedFileHash,
      signature_message: signatureMessageOverride ?? defaultSignatureMessage,
      created_by: caller.userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    contract,
    original_file_hash: originalFileHash,
    stamped_file_hash: stampedFileHash,
  }, { status: 201 });
}
