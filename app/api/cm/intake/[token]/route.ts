import { NextRequest, NextResponse } from "next/server";
import { getCmFlag, FLAG_MEETING_AUTOTRIGGER } from "@/lib/cm-flags";
import { notifyMeetingLink } from "@/lib/cm-meeting";
import { createClient as sc } from "@supabase/supabase-js";
import { isValidCpfCnpj } from "@/lib/utils";
import { issueV3Code, resolveSectorCode, resolveEsferaCode } from "@/lib/v3-codes";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data: listing, error } = await svc()
    .from("cm_asset_listings")
    .select("id, anonymous_id, asset_type, listing_status, intake_locked, intake_data, seller_name, ente_devedor, uf_ente_devedor, municipio_ente_devedor, esfera, tribunal, natureza, numero_processo, valor_face, valor_atualizado, desagio_pretendido, prazo_estimado_meses, allows_tranching, tranche_valor_minimo")
    .eq("cm_intake_token", token)
    .single();

  if (error || !listing)
    return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });

  if (listing.intake_locked)
    return NextResponse.json({
      error: "Formulário já enviado. Solicite um novo link à equipe V3 Partners.",
      locked: true,
    }, { status: 409 });

  return NextResponse.json({
    listing_id: listing.id,
    anonymous_id: listing.anonymous_id,
    status: listing.listing_status,
    prefill: {
      asset_type: listing.asset_type,
      seller_name: listing.seller_name !== "Pendente" ? listing.seller_name : "",
      ente_devedor: listing.ente_devedor ?? "",
      uf_ente_devedor: listing.uf_ente_devedor ?? "",
      municipio_ente_devedor: listing.municipio_ente_devedor ?? "",
      esfera: listing.esfera ?? "",
      tribunal: listing.tribunal ?? "",
      natureza: listing.natureza ?? "",
      numero_processo: listing.numero_processo ?? "",
      valor_face: listing.valor_face > 0 ? listing.valor_face : "",
      valor_atualizado: listing.valor_atualizado ?? "",
      desagio_pretendido: listing.desagio_pretendido ?? "",
      prazo_estimado_meses: listing.prazo_estimado_meses ?? "",
      allows_tranching: listing.allows_tranching ?? false,
      tranche_valor_minimo: listing.tranche_valor_minimo ?? "",
      ...(listing.intake_data as Record<string, unknown> ?? {}),
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data: listing } = await svc()
    .from("cm_asset_listings")
    .select("id, intake_locked, created_by")
    .eq("cm_intake_token", token)
    .single();

  if (!listing)
    return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });

  if (listing.intake_locked)
    return NextResponse.json({
      error: "Formulário já enviado. Solicite um novo link à equipe V3 Partners.",
      locked: true,
    }, { status: 409 });

  const body = await req.json();
  const {
    asset_type, seller_name, seller_cpf_cnpj,
    ente_devedor, uf_ente_devedor, municipio_ente_devedor, esfera, tribunal, natureza, numero_processo,
    valor_face, valor_atualizado, desagio_pretendido, prazo_estimado_meses,
    allows_tranching, tranche_valor_minimo, nda_accepted,
    contato_nome, contato_email, contato_telefone,
    nacionalidade, profissao, estado_civil, identidade_orgao, endereco,
    intermediarios,
    checklist_contato_direto, checklist_ativo_livre_onus,
    checklist_regularidade_fiscal, checklist_intermediarios_cientes,
  } = body;

  if (!seller_name || !valor_face || !asset_type) {
    return NextResponse.json({
      error: "Campos obrigatórios: nome do cedente, tipo de ativo e valor de face",
    }, { status: 422 });
  }

  // 10/09/2026: nunca confiar so na validacao do client -- o formulario ja tinha "CPF/CNPJ *"
  // como obrigatorio na label, mas a rota aceitava qualquer sequencia de digitos sem checar o
  // digito verificador. Foi assim que um CPF invalido (091.004.234-34) entrou num cedente
  // real, so descoberto quando a Checktudo recusou a consulta na Fase 2 do Cockpit de
  // Compliance.
  if (!seller_cpf_cnpj || !isValidCpfCnpj(seller_cpf_cnpj)) {
    return NextResponse.json({
      error: "CPF/CNPJ do cedente inválido ou ausente (dígito verificador não confere)",
    }, { status: 422 });
  }

  // Fix 17/09/2026: este era o unico ponto do sistema ainda emitindo numero
  // pela funcao LEGADA generate_cm_anonymous_id() -- violacao ativa de
  // v3-numbering-governance.md, nunca migrado quando a Fase 2 (10/08) tocou
  // o resto do sistema. O placeholder gravado em /api/cm/intake/generate
  // (antes de existir classificacao) nunca usa um codigo real de serie --
  // so aqui, com o tipo e a esfera que o proprio cedente/partner escolheu,
  // e que o codigo definitivo e emitido.
  let anonId: string;
  try {
    if (asset_type === "precatorio" || asset_type === "direito_creditorio") {
      const esferaCode = resolveEsferaCode(esfera);
      const series = asset_type === "precatorio" ? "PR" : "DC";
      anonId = await issueV3Code(series, esferaCode);
    } else {
      const sectorCode = await resolveSectorCode(null);
      anonId = await issueV3Code("BA", sectorCode);
    }
  } catch (codeErr) {
    const msg = codeErr instanceof Error ? codeErr.message : String(codeErr);
    return NextResponse.json({ error: `Falha ao emitir código do ativo: ${msg}` }, { status: 500 });
  }

  const { error } = await svc()
    .from("cm_asset_listings")
    .update({
      anonymous_id: anonId,
      asset_type,
      seller_name,
      seller_cpf_cnpj: seller_cpf_cnpj ?? null,
      ente_devedor: ente_devedor ?? null,
      uf_ente_devedor: uf_ente_devedor ?? null,
      municipio_ente_devedor: municipio_ente_devedor ?? null,
      esfera: esfera ?? null,
      tribunal: tribunal ?? null,
      natureza: natureza ?? null,
      numero_processo: numero_processo ?? null,
      valor_face: Number(valor_face),
      valor_atualizado: valor_atualizado ? Number(valor_atualizado) : null,
      desagio_pretendido: desagio_pretendido ? Number(desagio_pretendido) : null,
      prazo_estimado_meses: prazo_estimado_meses ? Number(prazo_estimado_meses) : null,
      allows_tranching: allows_tranching ?? false,
      tranche_valor_minimo: tranche_valor_minimo ? Number(tranche_valor_minimo) : null,
      listing_status: "formulario_preenchido",
      form_submitted_at: new Date().toISOString(),
      intake_locked: true,
      intake_data: {
        contato_nome: contato_nome ?? null,
        contato_email: contato_email ?? null,
        contato_telefone: contato_telefone ?? null,
        nacionalidade: nacionalidade ?? null,
        profissao: profissao ?? null,
        estado_civil: estado_civil ?? null,
        identidade_orgao: identidade_orgao ?? null,
        endereco: endereco ?? null,
        nda_accepted: nda_accepted ?? false,
        nda_accepted_at: nda_accepted ? new Date().toISOString() : null,
        submitted_at: new Date().toISOString(),
        // Sprint 1, Fase 4 (18/09/2026): grid de intermediarios declarados pelo
        // Partner e checklist orientativo. Sem migration -- intake_data ja e
        // jsonb flexivel, mesmo padrao dos demais campos deste bloco. A Mesa
        // usa isso pra gerar o link de qualificacao de cada intermediario
        // (nao a Mesa preenchendo dados por telefone/WhatsApp).
        intermediarios: Array.isArray(intermediarios) ? intermediarios : [],
        checklist: {
          contato_direto: checklist_contato_direto ?? false,
          ativo_livre_onus: checklist_ativo_livre_onus ?? false,
          regularidade_fiscal: checklist_regularidade_fiscal ?? false,
          intermediarios_cientes: checklist_intermediarios_cientes ?? false,
        },
      },
    })
    .eq("id", listing.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fase 5 (19/09/2026, pedido de Joao): Etapa 2 (Reuniao) passa a disparar
  // automaticamente assim que o intake fecha, nao mais so depois da
  // qualificacao terminar (movido de app/api/cm/qualificacao/[token]/route.ts).
  // Best-effort -- nunca desfaz o envio ja confirmado ao cedente/parceiro se
  // a transicao ou a notificacao falharem.
  // 20/09/2026 (pedido de Joao): o gatilho automatico so roda com a chave
  // meeting_autotrigger LIGADA (cm_feature_flags, desligada por padrao). Enquanto a base e
  // os testes sao saneados, o analista agenda pelo botao "Agendar Reuniao" (Mesa) e o ativo
  // espera em "Formulario preenchido". Ligar a chave depois da homologacao restaura o
  // comportamento automatico sem novo deploy.
  if (await getCmFlag(FLAG_MEETING_AUTOTRIGGER)) {
    const { data: meetingTransition } = await svc().rpc("transition_cm_listing_status", {
      p_listing_id: listing.id,
      p_new_status: "reuniao_agendada",
      p_reason: "Intake concluído, agendamento automático da reunião inicial.",
      p_user_id: listing.created_by,
    });
    if (meetingTransition) {
      await notifyMeetingLink({
        userId: listing.created_by,
        title: `Ativo ${anonId}: agende a reunião inicial`,
        intro: "O intake foi concluído.",
        actionUrl: "/bolsa/mesa",
      });
    }
  }

  // Governanca Documental Universal (achado 17/09/2026): listagem submetida via
  // link de intake nunca chamava create_deal_folder -- so a criacao direta pela
  // Mesa (POST /api/cm/listings) tinha pasta MPS. Best-effort, nunca bloqueia a
  // resposta ao cedente/partner. p_user_id usa quem gerou o link (created_by),
  // ja que o formulario publico nao tem sessao autenticada.
  const { error: folderError } = await svc().rpc("create_deal_folder", {
    p_vertical: "BolsaDeAtivos",
    p_deal_code: anonId,
    p_client_name: seller_name,
    p_user_id: listing.created_by,
  });
  if (folderError) console.error("[cm/intake/[token] POST] falha ao criar pasta MPS", folderError.message);

  return NextResponse.json({
    success: true,
    anonymous_id: anonId,
    message: "Formulário enviado com sucesso. A equipe V3 Partners entrará em contato.",
  });
}
