// lib/contract-send.ts
//
// Envio de contrato da Central de Contratos para assinatura (ClickSign/CertOne).
// Extraído de app/api/contracts/[id]/send/route.ts em 05/11/2026 (BRIEF
// docs/briefs/2026-11-05_alterar-email-reenviar-contrato.md) para que a rota
// "Alterar e-mail e reenviar" use exatamente os mesmos bloqueios e o mesmo envio.
// O código foi MOVIDO, não reescrito: mensagens e status HTTP são os mesmos.
// O gate de status ("rascunho"/"aprovado") e o escopo de vertical da
// MESA_OPERACIONAL continuam na rota `send`.
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { checkHeadInContract } from "@/lib/contract-head-gate";
import { revokedContactsError } from "@/lib/contract-revoked-contacts";
import { getProvider, type SendEnvelopeInput } from "@/lib/esignature";
import { renderContractDocx } from "@/lib/contract-docx-render";
import type { ContractParty } from "@/lib/contract-render";
import { buildEnvelopeLabel } from "@/lib/contract-envelope-label";
import { getCmFlag, FLAG_CERTONE_CPF_REPRESENTANTE } from "@/lib/cm-flags";
import { normalizeCpf, resolveCertOneSigners, type QualificationRow } from "@/lib/esignature/certone-signer";
import { SYSTEM_USER_ID } from "@/lib/contract-signature-timeline";

export const SEND_CONTRACT_COLUMNS =
  "id, template_id, vertical, contract_title, contract_code, status_signature, parties, signing_token, signature_message, signature_subject, is_master_agreement, stamped_document_path, loi_matching_status, loi_override_justification, rendered_html, qualification_batch_id, created_at";

export type SendParty = { role: string; name: string | null; email?: string | null; doc?: string | null };

export interface SendContract {
  id: string;
  template_id?: string | null;
  vertical: string;
  contract_title: string;
  contract_code: string | null;
  status_signature: string;
  parties: SendParty[] | null;
  signing_token: string | null;
  signature_message?: string | null;
  signature_subject?: string | null;
  is_master_agreement?: boolean | null;
  stamped_document_path?: string | null;
  loi_matching_status?: string | null;
  loi_override_justification?: string | null;
  rendered_html?: string | null;
  qualification_batch_id?: string | null;
  /** Usada só pela Q-01 (a regra vale para contratos criados depois da data de corte). */
  created_at?: string | null;
}

export type GateError = { status: number; error: string };

export interface SendGateDeps {
  checkHead: typeof checkHeadInContract;
}

const defaultGateDeps: SendGateDeps = { checkHead: checkHeadInContract };

// Mapeia o vertical do contrato para um documentType aceito por
// sendToClickSign — apenas os tipos que já rodam pela API v3 (funcional).
// "vertical" não distingue NDA Quadripartite de FPA/Mandato/Contrato Final
// dentro de capital_markets: usa-se contract_title para decidir, já que
// document_type do lote de qualificação não é persistido em operation_contracts
// (só qualification_batch_id, que aponta pro lote).
export function resolveDocumentType(contractTitle: string, vertical: string): SendEnvelopeInput["documentType"] {
  const title = contractTitle.toLowerCase();
  // 03/09/2026: faltava branch pra "Carta de Intenção" (documentType "loi",
  // já suportado pela API v3 do ClickSign, ver lib/clicksign.ts). Sem isso,
  // toda LOI (a de matching já existente e a nova unilateral pra terceiros)
  // caía no fallback "contrato_final" por engano.
  if (title.includes("carta de intenção") || title.includes("carta de intencao")) return "loi";
  if (title.includes("nda")) return "nda_quadripartite";
  if (title.includes("fpa venda") || title.includes("fpa_venda")) return "fpa_venda";
  if (title.includes("fpa compra") || title.includes("fpa_compra")) return "fpa_compra";
  if (title.includes("mandato")) return "mandato";
  if (title.includes("contrato final")) return "contrato_final";
  if (vertical === "ma") return "contrato_venda";
  return "contrato_final";
}

/**
 * Bloqueios do envio para assinatura, na mesma ordem da rota `send`. Não confere
 * o status do contrato nem o escopo de vertical (ficam na rota). Devolve o erro
 * (status + mensagem) ou null quando o contrato pode ser enviado.
 * Usado também como pré-voo da troca de e-mail, com as partes já trocadas em
 * memória, antes de qualquer chamada à ClickSign.
 */
export async function checkSendGates(
  db: SupabaseClient,
  contract: SendContract,
  deps: SendGateDeps = defaultGateDeps,
): Promise<GateError | null> {
  // Trava de LOI Casada (BRIEF 2, 30/08/2026): barreira final antes do
  // envio real. Uma LOI de venda sem par de compra casado só pode ser
  // enviada com aprovação UNÂNIME dos 3 sócios (contract_approvals),
  // reaproveitando o mecanismo de aprovação já existente em vez de criar
  // um trilho novo — aqui o "3/3" é o próprio override, não uma opção.
  if (contract.loi_matching_status === "nao_casada") {
    const { data: approvals } = await db
      .from("contract_approvals")
      .select("decision")
      .eq("contract_id", contract.id);
    const aprovados = ((approvals as Array<{ decision: string }> | null) ?? []).filter((a) => a.decision === "aprovado").length;
    if (aprovados < 3) {
      return {
        status: 422,
        error: `Este contrato é uma Carta de Intenção de venda sem par de compra casado (justificativa registrada: "${contract.loi_override_justification}"). Envio para assinatura exige aprovação unânime dos 3 sócios (hoje: ${aprovados}/3).`,
      };
    }
  }

  const parties = contract.parties ?? [];

  // Gate de integridade (11/08/2026, P0 real): antes deste gate, um bug na
  // esteira de qualificação sobrescrevia `parties` e derrubava a contraparte
  // principal sem ninguém perceber, dois contratos reais chegaram a ser
  // enviados pra assinatura só com testemunhas, sem a V3 e sem a contraparte.
  // Bloqueia ANTES de qualquer chamada à ClickSign se: (a) alguma parte tem
  // nome mas não tem e-mail (dado corrompido/parcial), ou (b) não existe
  // nenhum signatário fora do papel de testemunha (contrato sem parte
  // principal cadastrada não pode ser "enviado", mesmo que tenha testemunha).
  // v3_partners agora ENTRA como signatário de verdade (pedido de João
  // 11/08/2026: ele assina digitalmente pela V3, não é só metadado).
  const incomplete = parties.filter((p) => p.name?.trim() && !p.email?.trim());
  if (incomplete.length > 0) {
    return {
      status: 422,
      error: `Contrato não pode ser enviado: ${incomplete.length} parte(s) sem e-mail cadastrado (${incomplete.map((p) => p.name).join(", ")}). Corrija antes de enviar.`,
    };
  }

  // Gate do Head da Mesa (30/09/2026): M&A e Bolsa de Ativos só saem para
  // assinatura com o Head atual presente (assinante, nome, CPF impresso).
  const headError = await deps.checkHead({
    vertical: contract.vertical,
    parties,
    rendered_html: contract.rendered_html ?? null,
  });
  if (headError) return { status: 422, error: headError };

  // Contato desligado da V3 nunca vai para assinatura (lib/contract-revoked-contacts.ts).
  const revokedError = revokedContactsError(contract.rendered_html, "contrato");
  if (revokedError) return { status: 422, error: revokedError };

  // Gate de signatário duplicado (21/09/2026, BRIEF NCNDA, problema 4): o
  // NCNDA V3C-NDA-2026-0036 saiu do gerador com o Head da Mesa duas vezes, mesmo
  // e-mail. Dois signatários com o mesmo e-mail viram requisitos repetidos no
  // envelope e assinatura em dobro no bloco do documento. Bloqueia antes de
  // qualquer chamada externa; a correção é regerar/ajustar as partes.
  const emailCount = new Map<string, string[]>();
  for (const p of parties) {
    const key = p.email?.trim().toLowerCase();
    if (!key) continue;
    emailCount.set(key, [...(emailCount.get(key) ?? []), p.name ?? ""]);
  }
  const duplicated = Array.from(emailCount.entries()).filter(([, names]) => names.length > 1);
  if (duplicated.length > 0) {
    return {
      status: 422,
      error: `Contrato não pode ser enviado: signatário duplicado (mesmo e-mail em mais de uma parte): ${duplicated.map(([email, names]) => `${email} (${names.join(" / ")})`).join("; ")}. Corrija as partes antes de enviar.`,
    };
  }

  const nonWitnessSignatories = parties.filter((p) => p.role !== "testemunha" && p.email?.trim());
  if (nonWitnessSignatories.length === 0) {
    return {
      status: 422,
      error: "Contrato não pode ser enviado: só há testemunha(s) cadastrada(s), falta a(s) parte(s) principal(is) (contraparte e/ou V3 Partners). Verifique o array de partes antes de reenviar.",
    };
  }

  if (parties.filter((p) => p.email?.trim()).length === 0) {
    return { status: 422, error: "Contrato sem signatários com e-mail cadastrado (parties vazio ou sem e-mail)." };
  }

  return null;
}

export type SendResult =
  | { ok: true; envelopeId: string; signatarios: number }
  | { ok: false; status: number; error: string };

/**
 * Envia o contrato para assinatura e grava o envelope. Pressupõe que
 * checkSendGates já passou para este mesmo `contract`.
 */
export type PrepareResult =
  | { ok: true; signatories: Array<{ name: string; email: string; document: string | null }>; cpfRepresentante: Array<{ role: string; email: string }> }
  | { ok: false; status: number; error: string };

/**
 * CertOne (BRIEF 09/11/2026): parte PJ só tem o CNPJ em `doc`; o signatário passa a ser o
 * representante pessoa física da qualificação (nome e CPF). Só com a chave de compliance
 * ligada. ClickSign nunca consulta a qualificação nem recebe CPF (devolve a lista intacta).
 */
export async function prepareSignatoriesForProvider(
  db: SupabaseClient,
  providerName: string,
  contract: SendContract,
  parties: SendParty[],
  signatories: Array<{ name: string; email: string; document: string | null }>,
  flag: (key: string) => Promise<boolean> = (key) => getCmFlag(key),
): Promise<PrepareResult> {
  const cpfRepresentante: Array<{ role: string; email: string }> = [];
  if (providerName !== "certone") return { ok: true, signatories, cpfRepresentante };
  const semCpf = signatories.filter((s) => !normalizeCpf(s.document));
  if (semCpf.length === 0) return { ok: true, signatories, cpfRepresentante };

  const papelDe = (email: string) => parties.find((p) => p.email === email)?.role ?? "parte";
  if (!(await flag(FLAG_CERTONE_CPF_REPRESENTANTE))) {
    return {
      ok: false,
      status: 422,
      error: `Envio pela CertOne bloqueado: o uso do CPF do representante das partes PJ aguarda validação de compliance (${semCpf.map((s) => `${papelDe(s.email)} (${s.email})`).join(", ")}).`,
    };
  }
  if (!contract.qualification_batch_id) {
    return { ok: false, status: 422, error: "Contrato sem lote de qualificação: não há representante cadastrado para as partes PJ. Complete a qualificação antes de enviar pela CertOne." };
  }
  const { data: quals, error: qualErr } = await db
    .from("cm_party_qualifications")
    .select("role_in_document, email, person_type, representation")
    .eq("batch_id", contract.qualification_batch_id)
    .is("deleted_at", null);
  if (qualErr) return { ok: false, status: 500, error: "Falha ao ler a qualificação das partes para o envio pela CertOne." };
  const resolved = resolveCertOneSigners(
    signatories.map((s) => ({ role: papelDe(s.email), name: s.name, email: s.email, document: s.document })),
    (quals ?? []) as QualificationRow[],
  );
  if (!resolved.ok) return { ok: false, status: 422, error: resolved.error };
  for (const r of resolved.signers) if (r.fromRepresentative) cpfRepresentante.push({ role: r.role, email: r.email });
  return {
    ok: true,
    signatories: resolved.signers.map((r) => ({ name: r.name, email: r.email, document: r.document })),
    cpfRepresentante,
  };
}

export interface SendActor {
  userId: string;
  label: string;
}

export async function sendContractToSignature(db: SupabaseClient, contract: SendContract, actor?: SendActor): Promise<SendResult> {
  const id = contract.id;
  const parties = contract.parties ?? [];

  // document: repassa o CPF/CNPJ já cadastrado em `parties` (mesmo campo
  // `doc`) -- a ClickSign ignora este campo, a CertOne exige CPF válido
  // aqui (ver lib/esignature/certone-provider.ts, achado real de 11/09/2026).
  const signatories = parties
    .filter((p) => p.email?.trim())
    .map((p) => ({ name: p.name ?? "", email: p.email!, document: p.doc ?? null }));
  const provider = await getProvider({ contractId: id, vertical: contract.vertical });

  // CertOne (BRIEF 09/11/2026): parte PJ só tem o CNPJ em `doc`; o signatário passa a ser o
  // representante pessoa física da qualificação (nome e CPF). Só com a chave de compliance
  // ligada; ClickSign nunca consulta a qualificação nem recebe CPF.
  const prep = await prepareSignatoriesForProvider(db, provider.name, contract, parties, signatories);
  if (!prep.ok) return { ok: false, status: prep.status, error: prep.error };
  const envioSignatories = prep.signatories;
  const cpfRepresentante = prep.cpfRepresentante;

  // Trilha da transmissão do CPF a terceiro (sem o número). Se não gravar, nada sai.
  const notaTransmissao = async (texto: (r: { role: string; email: string }) => string) => {
    for (const r of cpfRepresentante) {
      const { error } = await db.from("contract_notes").insert({
        contract_id: id,
        author_id: actor?.userId ?? SYSTEM_USER_ID,
        author_name: actor?.label ?? "Sistema",
        note_type: "sistema",
        content: texto(r),
      });
      if (error) return false;
    }
    return true;
  };
  if (cpfRepresentante.length > 0) {
    const quando = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const ok = await notaTransmissao((r) => `CPF do representante da parte ${r.role} (${r.email}) enviado ao CertOne por ${actor?.label ?? "sistema"} em ${quando}.`);
    if (!ok) return { ok: false, status: 500, error: "Não foi possível registrar a trilha de envio do CPF do representante. Nada foi enviado à CertOne." };
  }

  const signingToken = contract.signing_token ?? randomUUID().replace(/-/g, "");
  if (!contract.signing_token) {
    await db.from("operation_contracts").update({ signing_token: signingToken }).eq("id", id);
  }

  const documentUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br"}/api/contracts/html/${id}/${signingToken}`;

  // Label prefixado com contract_code (11/08/2026, ciclo ClickSign Fase 2):
  // vira o nome do envelope E o nome do arquivo (filename: `${documentLabel}.pdf`),
  // dá uma chave de correlação confiável pra identificar o contrato quando
  // o PDF assinado retornar por e-mail via Observador de Assinatura, sem
  // depender do formato de e-mail da própria ClickSign, que não controlamos.
  // 21/09/2026 (decisão de João): o envelope leva número do contrato, tipo, setor e partner
  // ("V3C-NDA-2026-0036 · NCNDA · Bolsa de Ativos · Partner Fulano"), nunca o nome interno da
  // minuta. O código continua PRIMEIRO: é a chave de correlação do arquivamento acima.
  const documentLabel = buildEnvelopeLabel({
    contract_code: contract.contract_code,
    contract_title: contract.contract_title,
    vertical: contract.vertical,
    parties,
  });

  // Regularização de contrato manual (19/08/2026): o PDF já está pronto no
  // Storage (capa Termo + original mesclados e estampados, ver
  // lib/contract-watermark.ts e app/api/contracts/manual-intake) — envia
  // esse arquivo direto, nunca gera PDF a partir de rendered_html (que aqui
  // é só a capa, não conteria o documento manual original).
  let documentContentBase64: string | undefined;
  if (contract.is_master_agreement && contract.stamped_document_path) {
    const { data: fileData, error: downloadErr } = await db.storage.from("documents").download(contract.stamped_document_path);
    if (downloadErr || !fileData) {
      return { ok: false, status: 500, error: `Falha ao recuperar o PDF estampado do Storage: ${downloadErr?.message ?? "arquivo não encontrado"}` };
    }
    const buffer = Buffer.from(await fileData.arrayBuffer());
    documentContentBase64 = `data:application/pdf;base64,${buffer.toString("base64")}`;
  }

  // Assinatura Posicionada (BRIEF 11/09/2026): RELIGADA em 11/09/2026, mesmo
  // dia. Causa raiz do bug (rev.123) isolada e corrigida em
  // lib/contract-docx-render.ts: o TextRun da tag tinha `color`/`size`
  // customizados (tentativa de deixá-la invisível), o que quebrava o
  // reconhecimento da ClickSign. Confirmado isolando 4 variantes contra a
  // API real, checando `metadata.position_sign_fields` do documento (o
  // sinal real -- 201 na chamada não garante reconhecimento nenhum, foi
  // exatamente esse o gap que deixou o bug original passar): TextRun com
  // rPr customizado sempre dava campo vazio, TextRun puro sempre reconhecia.
  // Fix aplicado, tag agora sem formatação. Religar só depois de confirmar
  // de novo `position_sign_fields` não-vazio antes de qualquer ativação real.
  let documentDocxBase64: string | undefined;
  let positionedParties: Array<{ name: string; email: string }> | undefined;
  if (!contract.is_master_agreement && contract.rendered_html) {
    try {
      const docxBuffer = await renderContractDocx(contract.rendered_html, parties as ContractParty[], contract.contract_code);
      documentDocxBase64 = docxBuffer.toString("base64");
      positionedParties = signatories;
    } catch (docxErr) {
      console.error(`[contracts/send] falha ao gerar .docx posicionado pro contrato ${id}, caindo no caminho PDF normal:`, docxErr);
    }
  }

  const headParty = (parties as Array<{ role?: string; name?: string; doc?: string | null }>).find((p) => p.role === "head_mesa");
  const result = await provider.send({
    dealId: id,
    documentType: resolveDocumentType(contract.contract_title, contract.vertical),
    documentUrl,
    documentContentBase64,
    documentDocxBase64,
    positionedParties,
    documentLabel,
    signatories: envioSignatories,
    // 14/08/2026: apontado para deal@v3partners.com.br (era
    // joao.lemos@v3partners.com.br). Mudança deliberada: lib/clicksign-archive.ts
    // (Fase 2, arquivamento automático) só tem credencial IMAP testada para
    // esta caixa — é a única que o poller consegue ler. Padroniza a caixa
    // observadora em todos os pontos de envio para o poller cobrir 100% dos
    // contratos, não só os das 4 rotas públicas de intake.
    watcherEmail: "deal@v3partners.com.br",
    // CertOne exige nome e CPF do observador (06/11/2026): usa o Head da Mesa do próprio contrato.
    watcherName: headParty?.name,
    watcherDocument: headParty?.doc ?? null,
    // Item 4 dos ajustes de governança (19/08/2026): mensagem customizada
    // para a série V3C-REG (regularização de contrato manual), explicando
    // ao signatário que se trata de revalidação/integração ao sistema V3.
    // signature_message é gravado no upload manual (app/api/contracts/
    // manual-intake) e fica disponível para qualquer contrato, não só
    // V3C-REG — column nullable, sem efeito quando ausente.
    signatureMessage: contract.signature_message ?? undefined,
    signatureSubject: contract.signature_subject ?? undefined,
  });

  if (!result.ok) {
    if (cpfRepresentante.length > 0) {
      await notaTransmissao((r) => `Falha no envio ao CertOne do contrato com o representante da parte ${r.role} (${r.email}); a CertOne recusou o envio.`);
    }
    return { ok: false, status: 502, error: `Falha ao enviar para o ClickSign: ${result.error}` };
  }

  await db.from("operation_contracts").update({
    status_signature: "enviado_assinatura",
    external_envelope_id: result.envelopeId,
    external_document_id: result.documentId,
    sent_to_signature_at: new Date().toISOString(),
    // Fase 3 (10/09/2026): congela o provedor usado neste envio na mesma
    // UPDATE atômica que grava o envelope -- se a chamada externa acima
    // falhar, nada é gravado (return antes disso); ações futuras neste
    // contrato usam sempre este valor, nunca a config atual da vertical.
    esignature_provider: provider.name,
  }).eq("id", id);

  // Vínculo permanente "já houve envio" (BRIEF Trava de Liberação, decisão 17):
  // grava na primeira vez, em todas as qualificações dos lotes consumidos por
  // este contrato. A coluna é append-only no banco (trigger), então cancelar o
  // envelope depois não apaga este registro. O envelope já foi criado acima,
  // por isso uma falha aqui não desfaz o envio, mas fica no log para correção.
  try {
    const { data: lotes } = await db
      .from("cm_qualification_batches")
      .select("id")
      .eq("consumido_por_contract_id", id);
    const loteIds = (lotes ?? []).map((l: { id: string }) => l.id);
    if (loteIds.length > 0) {
      const { error: vinculoErr } = await db
        .from("cm_party_qualifications")
        .update({ contrato_enviado_id: id, primeiro_envio_em: new Date().toISOString() })
        .in("batch_id", loteIds)
        .is("contrato_enviado_id", null);
      if (vinculoErr) console.error("[contract-send] vínculo de envio não gravado:", vinculoErr.message);
    }
  } catch (e) {
    console.error("[contract-send] vínculo de envio não gravado:", e instanceof Error ? e.message : e);
  }

  return { ok: true, envelopeId: result.envelopeId as string, signatarios: signatories.length };
}
