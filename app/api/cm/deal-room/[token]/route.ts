import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { resolveContractVariables, wrapContractInV3Html, type ContractParty } from "@/lib/contract-render";
import { auditText, auditHtml } from "@/lib/brand-guardian-gate";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Mesmo grupo de governanca da Bolsa de Ativos usado em nda-authorize e delete —
// evita criar um novo destinatario interno so para esta notificacao.
const MESA_V3_EMAILS = [
  "joao.lemos@v3partners.com.br",
  "suporte@v3partners.com.br",
  "robinholino16@gmail.com",
];

async function sendNdaCopyByEmail(params: {
  buyerEmail: string;
  anonymousId: string;
  contractTitle: string;
  renderedHtml: string;
}) {
  if (!process.env.RESEND_API_KEY) return;
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const subjectGate = auditText(`${params.contractTitle}: ${params.anonymousId} (assinado)`);
    const htmlGate = auditHtml(`<p>Segue cópia do termo assinado eletronicamente na Deal Room do ativo <strong>${params.anonymousId}</strong>.</p>${params.renderedHtml}`);
    if (htmlGate.blocking.length > 0) console.error("[deal-room nda-copy] Brand Guardian bloqueou:", htmlGate.blocking);
    const subject = subjectGate.corrected;
    const html = htmlGate.corrected;

    await Promise.all([
      resend.emails.send({
        from: "V3 Partners Bolsa de Ativos <noreply@v3partners.com.br>",
        to: params.buyerEmail,
        subject,
        html,
      }),
      resend.emails.send({
        from: "V3 Partners Bolsa de Ativos <noreply@v3partners.com.br>",
        to: MESA_V3_EMAILS,
        subject: auditText(`[Mesa] ${subject}`).corrected,
        html,
      }),
    ]);
  } catch (err) {
    console.error("[CM Deal Room] falha ao enviar copia do NDA por email:", err);
  }
}

async function renderNdaDocument(listing: any, parties?: ContractParty[]) {
  const { data: template } = await svc()
    .from("contract_templates")
    .select("*")
    .eq("vertical", "capital_markets")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!template) return null;

  const variables: Record<string, any> = {
    data_geracao: new Date().toLocaleDateString("pt-BR"),
    data_geracao_extenso: new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }),
    nome_cedente: listing.seller_name,
    cpf_cnpj_cedente: listing.seller_cpf_cnpj ?? null,
    tipo_ativo: listing.asset_type,
    anonymous_id: listing.anonymous_id,
    ente_devedor: listing.ente_devedor,
    esfera: listing.esfera,
    tribunal: listing.tribunal,
    natureza: listing.natureza,
    numero_processo: listing.numero_processo,
    valor_face: listing.valor_face,
    valor_atualizado: listing.valor_atualizado ?? listing.valor_face,
    desagio_pretendido: listing.desagio_pretendido,
    prazo_estimado_meses: listing.prazo_estimado_meses,
  };

  const renderedBody = resolveContractVariables(template.body_text_raw, variables);
  const contractTitle = resolveContractVariables(template.template_name, variables);
  // Bug real (12/08/2026, mesmo padrão em 6 rotas de geração de contrato):
  // esta função nunca recebia parties, então o NDA "assinado" (aceite via
  // clique + hash, cópia emailada ao comprador) saía sem o bloco visual de
  // assinatura. Opcional porque a chamada de preview (GET, NDA ainda não
  // aceito) não tem identidade do comprador confirmada ainda.
  const renderedHtml = wrapContractInV3Html(contractTitle, renderedBody, parties);

  return { template, variables, contractTitle, renderedBody, renderedHtml };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data: access } = await svc()
    .from("cm_deal_room_access")
    .select("*, cm_asset_listings(id, anonymous_id, asset_type, ente_devedor, esfera, tribunal, natureza, valor_face, valor_atualizado, desagio_pretendido, prazo_estimado_meses, listing_status, seller_name, seller_cpf_cnpj, numero_processo)")
    .eq("access_token", token)
    .eq("revoked", false)
    .single();

  if (!access)
    return NextResponse.json({ error: "Link inválido ou revogado" }, { status: 404 });

  if (access.expires_at && new Date(access.expires_at) < new Date())
    return NextResponse.json({ error: "Link expirado. Solicite novo acesso à V3 Partners." }, { status: 410 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
  await svc().from("cm_deal_room_access").update({
    last_accessed_at: new Date().toISOString(),
    first_accessed_at: access.first_accessed_at ?? new Date().toISOString(),
    access_count: (access.access_count ?? 0) + 1,
  }).eq("id", access.id);

  if (!access.nda_accepted) {
    const ndaDoc = await renderNdaDocument(access.cm_asset_listings);
    return NextResponse.json({
      nda_required: true,
      listing: {
        anonymous_id: (access.cm_asset_listings as any)?.anonymous_id,
        asset_type: (access.cm_asset_listings as any)?.asset_type,
      },
      nda_document_html: ndaDoc?.renderedBody ?? null,
    });
  }

  const listing = access.cm_asset_listings as any;
  const tier = access.access_tier ?? "nda_only";

  const baseListing = {
    anonymous_id: listing.anonymous_id,
    asset_type: listing.asset_type,
    ente_devedor: listing.ente_devedor,
    esfera: listing.esfera,
    tribunal: listing.tribunal,
    natureza: listing.natureza,
    valor_face: listing.valor_face,
    desagio_pretendido: listing.desagio_pretendido,
    prazo_estimado_meses: listing.prazo_estimado_meses,
  };

  if (tier === "nda_only") {
    return NextResponse.json({
      nda_required: false,
      access_tier: "nda_only",
      qualification_status: access.qualification_status,
      listing: baseListing,
      documents: [],
      access: {
        buyer_name: access.buyer_name,
        nda_accepted_at: access.nda_accepted_at,
      },
      actions: {
        can_qualify: access.qualification_status === "pendente",
        can_accept_mandato: false,
        can_accept_cessao: false,
      },
    });
  }

  const { data: docs } = await svc()
    .from("cm_listing_documents")
    .select("id, document_type, original_filename, file_size, validation_status, created_at")
    .eq("listing_id", listing.id)
    .order("created_at", { ascending: false });

  // Download nao usa mais signed URL estatica — vai por /documents/[doc_id],
  // que registra IP+CPF obrigatoriamente e aplica marca dagua antes de servir o PDF.
  const docsWithUrls = (docs ?? []).map((doc: any) => ({
    ...doc,
    download_url: `/api/cm/deal-room/${token}/documents/${doc.id}`,
  }));

  const enrichedListing = tier === "full_dd"
    ? { ...baseListing, seller_name: listing.seller_name, numero_processo: listing.numero_processo }
    : baseListing;

  return NextResponse.json({
    nda_required: false,
    access_tier: tier,
    qualification_status: access.qualification_status,
    mandato_v3_accepted: access.mandato_v3_accepted,
    listing: enrichedListing,
    documents: docsWithUrls,
    access: {
      buyer_name: access.buyer_name,
      nda_accepted_at: access.nda_accepted_at,
      mandato_v3_accepted_at: access.mandato_v3_accepted_at,
    },
    cessao: {
      hash: access.cessao_hash ?? null,
      accepted_at: access.cessao_accepted_at ?? null,
      ots_proof_path: access.cessao_ots_proof_path ?? null,
    },
    actions: {
      can_qualify: false,
      can_accept_mandato: tier === "qualified" && !access.mandato_v3_accepted,
      can_accept_cessao: tier === "full_dd" && !access.cessao_hash,
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { action, buyer_email } = await req.json();

  if (!["accept_nda", "accept_cessao"].includes(action))
    return NextResponse.json({ error: "Ação inválida" }, { status: 422 });

  // ── NDA acceptance ────────────────────────────────────────────────────
  if (action === "accept_nda") {
    const { data: access } = await svc()
      .from("cm_deal_room_access")
      .select("id, listing_id, buyer_name, buyer_email, nda_accepted, revoked, expires_at, cm_asset_listings(id, anonymous_id, asset_type, ente_devedor, esfera, tribunal, natureza, valor_face, valor_atualizado, desagio_pretendido, prazo_estimado_meses, seller_name, seller_cpf_cnpj, numero_processo)")
      .eq("access_token", token)
      .single();

    if (!access || access.revoked)
      return NextResponse.json({ error: "Link inválido ou revogado" }, { status: 404 });

    if (access.expires_at && new Date(access.expires_at) < new Date())
      return NextResponse.json({ error: "Link expirado" }, { status: 410 });

    if (access.nda_accepted)
      return NextResponse.json({ success: true, message: "NDA já aceito" });

    const effectiveEmail: string | null = access.buyer_email ?? buyer_email ?? null;
    if (!effectiveEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(effectiveEmail.trim()))
      return NextResponse.json({ error: "Email válido é obrigatório para receber a cópia do NDA assinado" }, { status: 422 });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const userAgent = req.headers.get("user-agent") ?? "unknown";
    const timestamp = new Date().toISOString();

    const listingForParties = access.cm_asset_listings as any;
    const ndaParties: ContractParty[] = [
      { role: "cedente", name: listingForParties?.seller_name ?? "Cedente", doc: listingForParties?.seller_cpf_cnpj ?? null },
      { role: "receptora", name: access.buyer_name ?? "Receptora", doc: effectiveEmail },
      { role: "v3_partners", name: "V3 Partners Soluções Ltda", doc: "14.219.287/0001-50" },
    ];
    const ndaDoc = await renderNdaDocument(access.cm_asset_listings, ndaParties);

    // Hash amarrado ao conteudo do documento aceito, nao so a metadados de acesso —
    // se o template mudar depois, o hash deste aceite continua provando exatamente
    // qual texto o comprador viu e aceitou.
    const hashPayload = `${access.id}|${token}|${ip}|${userAgent}|${timestamp}|nda_accepted|${ndaDoc?.renderedHtml ?? "sem_template_ativo"}`;
    const ndaHash = createHash("sha256").update(hashPayload).digest("hex");

    let ndaContractId: string | null = null;
    if (ndaDoc) {
      const listing = access.cm_asset_listings as any;
      const { data: contract } = await svc()
        .from("operation_contracts")
        .insert({
          template_id: ndaDoc.template.id,
          vertical: "capital_markets",
          listing_id: access.listing_id,
          deal_room_access_id: access.id,
          contract_title: ndaDoc.contractTitle,
          rendered_html: ndaDoc.renderedHtml,
          status_signature: "assinado",
          signed_at: timestamp,
          parties: [
            { role: "cedente", name: listing?.seller_name ?? null, doc: listing?.seller_cpf_cnpj ?? null },
            { role: "receptora", name: access.buyer_name ?? null, doc: null, email: effectiveEmail },
            { role: "v3_partners", name: "V3 Partners Soluções Ltda", doc: "14.219.287/0001-50" },
          ],
        })
        .select("id")
        .single();
      ndaContractId = contract?.id ?? null;
    }

    const { error } = await svc()
      .from("cm_deal_room_access")
      .update({
        nda_accepted: true,
        nda_accepted_at: timestamp,
        nda_ip_address: ip,
        nda_hash: ndaHash,
        nda_contract_id: ndaContractId,
        buyer_email: effectiveEmail,
        geo_location: req.headers.get("cf-ipcountry") ?? req.headers.get("x-vercel-ip-country") ?? null,
      })
      .eq("id", access.id);

    if (!error && ndaDoc) {
      await sendNdaCopyByEmail({
        buyerEmail: effectiveEmail,
        anonymousId: (access.cm_asset_listings as any)?.anonymous_id,
        contractTitle: ndaDoc.contractTitle,
        renderedHtml: ndaDoc.renderedHtml,
      });
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, message: "NDA aceito. Documentos liberados.", nda_hash: ndaHash });
  }

  // ── Cessão acceptance (Tier 3 — âncora blockchain via OpenTimestamps) ─
  if (action === "accept_cessao") {
    const { data: access } = await svc()
      .from("cm_deal_room_access")
      .select("id, cessao_hash, revoked, expires_at, access_tier, mandato_v3_accepted, geo_location")
      .eq("access_token", token)
      .single();

    if (!access || access.revoked)
      return NextResponse.json({ error: "Link inválido ou revogado" }, { status: 404 });

    if (access.expires_at && new Date(access.expires_at) < new Date())
      return NextResponse.json({ error: "Link expirado" }, { status: 410 });

    if (access.access_tier !== "full_dd")
      return NextResponse.json({ error: "Acesso insuficiente para aceitar cessão" }, { status: 403 });

    if (!access.mandato_v3_accepted)
      return NextResponse.json({ error: "Mandato V3 deve ser aceito antes da cessão" }, { status: 422 });

    if (access.cessao_hash)
      return NextResponse.json({ success: true, message: "Cessão já aceita", cessao_hash: access.cessao_hash });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const userAgent = req.headers.get("user-agent") ?? "unknown";
    const timestamp = new Date().toISOString();

    const hashPayload = `${access.id}|${token}|${ip}|${userAgent}|${timestamp}|cessao_aceita`;
    const cessaoHash = createHash("sha256").update(hashPayload).digest("hex");

    const { error } = await svc()
      .from("cm_deal_room_access")
      .update({
        cessao_hash: cessaoHash,
        cessao_accepted_at: timestamp,
        cessao_accepted_ip: ip,
        geo_location: access.geo_location ?? req.headers.get("cf-ipcountry") ?? req.headers.get("x-vercel-ip-country") ?? null,
      })
      .eq("id", access.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Dispara n8n W-Cessao-Anchor de forma assíncrona (fire-and-forget)
    // OTS anchoring é não-bloqueante — confirmação Bitcoin ocorre em ~10 min
    const n8nUrl = process.env.N8N_BASE_URL
      ? `${process.env.N8N_BASE_URL}/webhook/v3-cessao-anchor`
      : "https://n8n-514n.onrender.com/webhook/v3-cessao-anchor";

    fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_id: access.id, cessao_hash: cessaoHash }),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: "Cessão aceita. Ancoragem blockchain iniciada.",
      cessao_hash: cessaoHash,
    });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 422 });
}
