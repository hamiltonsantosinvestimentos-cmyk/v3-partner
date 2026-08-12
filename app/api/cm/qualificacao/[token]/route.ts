import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { isValidCPF, isValidCNPJ } from "@/lib/validators/cpf-cnpj";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  nda_quadripartite: "NDA Quadripartite",
  fpa_venda: "FPA Venda",
  fpa_compra: "FPA Compra",
  mandato: "Mandato",
  contrato_final: "Contrato Final",
  contrato_parceria: "Contrato de Parceria",
};

// Papéis que recebem repasse de comissão precisam de dados bancários/PIX e
// RG completos (mesmo padrão desde 28/07, Bolsa de Ativos). Testemunha e
// parte principal de um contrato fora da Bolsa de Ativos só precisam de
// CPF/CNPJ (suficiente para o texto do contrato e autenticação ClickSign) —
// exigir dados bancários de uma testemunha não faz sentido (achado
// 11/08/2026, ao generalizar este fluxo para a Central de Contratos).
const ROLES_QUE_RECEBEM_REPASSE = ["mandatario", "intermediario_finder_venda", "intermediario_finder_compra"];

// GET /api/cm/qualificacao/[token] — contexto público para o envolvido preencher.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const { data: qualification } = await svc()
    .from("cm_party_qualifications")
    .select("id, full_name, email, role_in_document, status, batch_id, cm_qualification_batches(document_type, cm_asset_listings(anonymous_id))")
    .eq("qualification_token", token)
    .single();

  if (!qualification) return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });

  const batch = qualification.cm_qualification_batches as any;
  const docLabel = DOCUMENT_TYPE_LABELS[batch?.document_type] ?? batch?.document_type;

  if (qualification.status === "preenchido") {
    return NextResponse.json({ locked: true, message: `Qualificação já enviada. Aguarde a geração do ${docLabel}.` }, { status: 409 });
  }

  return NextResponse.json({
    full_name: qualification.full_name,
    email: qualification.email,
    role_in_document: qualification.role_in_document,
    document_type_label: docLabel,
    anonymous_id: batch?.cm_asset_listings?.anonymous_id ?? null,
  });
}

// POST /api/cm/qualificacao/[token] — envolvido envia CPF/CNPJ, RG, endereço
// e dados bancários/PIX. Ao completar 100% do lote, marca o batch como
// "completo" e notifica a Mesa — a geração do instrumento jurídico
// (NDA Quadripartite/FPA/Mandato/Contrato Final) continua manual a partir
// daqui: os textos desses 4 documentos ainda não existem em contract_templates
// (só "NDA (Comprador Bolsa de Ativos)" e "Anexo FPA/NCND" existem hoje) e
// autoria de texto jurídico novo não é decisão que este código deve tomar.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const { data: qualification } = await svc()
    .from("cm_party_qualifications")
    .select("id, batch_id, status, role_in_document")
    .eq("qualification_token", token)
    .single();

  if (!qualification) return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });
  if (qualification.status === "preenchido") {
    return NextResponse.json({ error: "Este link já foi preenchido." }, { status: 409 });
  }

  const recebeRepasse = ROLES_QUE_RECEBEM_REPASSE.includes(qualification.role_in_document);

  const body = await req.json().catch(() => ({}));
  const { cpf_cnpj, rg, endereco_completo, dados_bancarios, pix_key } = body as {
    cpf_cnpj?: string;
    rg?: string;
    endereco_completo?: string;
    dados_bancarios?: { banco?: string; agencia?: string; conta?: string; tipo_conta?: string };
    pix_key?: string;
  };

  // Testemunha/parte principal fora da Bolsa de Ativos: só CPF/CNPJ é
  // obrigatório. Quem recebe repasse continua exigindo RG + endereço
  // (mesma regra de sempre).
  const required = recebeRepasse ? { cpf_cnpj, rg, endereco_completo } : { cpf_cnpj };
  const missing = Object.entries(required).filter(([, v]) => !v || String(v).trim() === "").map(([k]) => k);
  if (missing.length > 0) {
    return NextResponse.json({ error: `Campos obrigatórios ausentes: ${missing.join(", ")}` }, { status: 422 });
  }

  const docDigits = String(cpf_cnpj).replace(/\D/g, "");
  const validDoc = docDigits.length > 11 ? isValidCNPJ(cpf_cnpj!) : isValidCPF(cpf_cnpj!);
  if (!validDoc) {
    return NextResponse.json({ error: "CPF/CNPJ inválido, confira o número informado." }, { status: 422 });
  }
  if (recebeRepasse && !pix_key && !dados_bancarios?.banco) {
    return NextResponse.json({ error: "Informe ao menos dados bancários ou chave PIX para eventual repasse." }, { status: 422 });
  }

  const db = svc();

  const { error: updateError } = await db
    .from("cm_party_qualifications")
    .update({
      cpf_cnpj,
      rg,
      endereco_completo,
      dados_bancarios: dados_bancarios ?? null,
      pix_key: pix_key ?? null,
      status: "preenchido",
      filled_at: new Date().toISOString(),
    })
    .eq("id", qualification.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const { data: siblings } = await db
    .from("cm_party_qualifications")
    .select("status")
    .eq("batch_id", qualification.batch_id);

  const allFilled = (siblings ?? []).every((s) => s.status === "preenchido");

  if (allFilled) {
    const { data: batch } = await db
      .from("cm_qualification_batches")
      .update({ status: "completo", completed_at: new Date().toISOString() })
      .eq("id", qualification.batch_id)
      .select("created_by, document_type, listing_id, operation_contract_id")
      .single();

    if (batch?.created_by) {
      await db.from("notifications").insert({
        user_id: batch.created_by,
        title: "Qualificação de partes completa",
        message: `Todos os envolvidos preencheram os dados de qualificação para ${DOCUMENT_TYPE_LABELS[batch.document_type] ?? batch.document_type}. Pronto para gerar o documento.`,
        type: "qualificacao_completa",
        action_url: batch.listing_id ? `/bolsa/mesa` : "/juridico/contratos",
        read: false,
      });
    }

    // Central de Contratos (11/08/2026): quando o lote pertence a um
    // operation_contract_id (não Bolsa de Ativos), os dados reais coletados
    // (nome, e-mail, CPF/CNPJ) viram parties do contrato automaticamente —
    // sem isso o botão "Enviar para Assinatura" nunca teria e-mail de quem
    // acabou de se qualificar (testemunha, parte principal, etc).
    if (batch?.operation_contract_id) {
      const { data: allQualifications } = await db
        .from("cm_party_qualifications")
        .select("full_name, email, role_in_document, cpf_cnpj")
        .eq("batch_id", qualification.batch_id);

      const { data: contract } = await db
        .from("operation_contracts")
        .select("parties")
        .eq("id", batch.operation_contract_id)
        .single();

      // P0 real achado 11/08/2026, corrigido no mesmo bloco: esta rota
      // sobrescrevia o array `parties` INTEIRO só com o que veio deste
      // lote + v3_partners, apagando silenciosamente qualquer outra parte
      // já existente no contrato (ex: a contraparte principal, cadastrada
      // na criação do contrato, nunca parte de nenhum lote de
      // qualificação). Isso derrubou a contraparte de 2 contratos reais
      // (Iris no Closer, Daniel+Diogo no Home Cash) do array de
      // signatários sem ninguém perceber, porque o "Enviar para
      // Assinatura" nunca avisa quem ficou de fora. Corrigido para
      // MESCLAR: preserva toda parte existente cujo e-mail não é de
      // ninguém deste lote, e só então acrescenta/atualiza as deste lote.
      const existingParties = (contract?.parties as Array<{ role: string; name: string; doc?: string | null; email?: string }> | null) ?? [];
      const batchEmails = new Set((allQualifications ?? []).map((q) => q.email.toLowerCase()));
      const preservedParties = existingParties.filter((p) => !p.email || !batchEmails.has(p.email.toLowerCase()));
      const novasPartes = (allQualifications ?? []).map((q) => ({
        role: q.role_in_document,
        name: q.full_name,
        doc: q.cpf_cnpj ?? null,
        email: q.email,
      }));

      await db.from("operation_contracts").update({
        parties: [...preservedParties, ...novasPartes],
      }).eq("id", batch.operation_contract_id);
    }
  }

  return NextResponse.json({ success: true, batch_complete: allFilled });
}
