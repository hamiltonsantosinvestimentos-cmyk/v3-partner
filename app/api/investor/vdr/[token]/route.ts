import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

// Rota pública — sem Supabase Auth. Acesso via token único.
function svc() {
  return sc(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params;

  // Captura headers injetados pelo middleware (rastreamento de grupo)
  const sourceGroup = req.headers.get("x-vdr-group") ?? "direct";
  const accessSide  = req.headers.get("x-vdr-side")  ?? "buyer";
  const ipAddress   = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
                   ?? req.headers.get("x-real-ip")
                   ?? "unknown";
  const userAgent   = req.headers.get("user-agent") ?? "";

  const db = svc();

  // 1. Buscar convite pelo token
  const { data: invite, error } = await db
    .from("deal_room_invites")
    .select(`
      id, status, token_expires_at,
      investor_name, investor_email, investor_company,
      source_group, access_side, access_count,
      deal_rooms (
        id, name, status, nda_required, nda_text, expires_at,
        deal_id,
        deal_room_documents ( id, label, doc_type, requires_nda, sort_order, file_size_bytes )
      )
    `)
    .eq("token", token)
    .single();

  if (error || !invite) {
    return NextResponse.json({ error: "Link inválido ou não encontrado." }, { status: 404 });
  }

  // 2. Validações de acesso
  if (invite.status === "revoked") {
    return NextResponse.json({ error: "Este link foi revogado." }, { status: 410 });
  }

  if (new Date(invite.token_expires_at) < new Date()) {
    await db.from("deal_room_invites").update({ status: "expired" }).eq("id", invite.id);
    return NextResponse.json({ error: "Este link expirou." }, { status: 410 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const room = (invite.deal_rooms as any);
  if (!room || room.status === "closed") {
    return NextResponse.json({ error: "Esta sala de investimento foi encerrada." }, { status: 410 });
  }

  if (room.expires_at && new Date(room.expires_at) < new Date()) {
    return NextResponse.json({ error: "A sala expirou." }, { status: 410 });
  }

  // 3. Registrar primeiro acesso e enriquecer rastreamento
  const isFirstAccess = !invite.source_group && sourceGroup !== "direct";

  await db.from("deal_room_invites").update({
    first_accessed_at: invite.access_count === 0 ? new Date().toISOString() : undefined,
    access_count:      (invite.access_count ?? 0) + 1,
    source_group:      invite.source_group ?? (sourceGroup !== "direct" ? sourceGroup : null),
    access_side:       invite.access_side  ?? accessSide,
  }).eq("id", invite.id);

  // 4. Log de acesso (pre-NDA)
  await db.from("document_views").insert({
    invite_id:    invite.id,
    document_id:  null,
    ip_address:   ipAddress,
    device_type:  detectDevice(userAgent),
    status:       "pre_nda",
  });

  // 5. Verificar se NDA já foi assinado
  const { data: ndaSig } = await db
    .from("nda_signatures")
    .select("id, signed_at")
    .eq("invite_id", invite.id)
    .single();

  const nda_signed = !!ndaSig;

  // 6. Buscar v3_code do deal para construir URL canônica
  const { data: deal } = await db
    .from("ma_deals")
    .select("v3_code, code, target_company, sector")
    .eq("id", room.deal_id)
    .single();

  // 7. Ordenar documentos
  const documents = (room.deal_room_documents ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .sort((a: any, b: any) => a.sort_order - b.sort_order)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((doc: any) => ({
      id:           doc.id,
      label:        doc.label,
      doc_type:     doc.doc_type,
      requires_nda: doc.requires_nda,
      file_size_bytes: doc.file_size_bytes,
      locked:       doc.requires_nda && !nda_signed,
    }));

  return NextResponse.json({
    room: {
      id:           room.id,
      name:         room.name,
      nda_required: room.nda_required,
      nda_text:     room.nda_required ? (room.nda_text ?? DEFAULT_NDA_TEXT) : null,
    },
    deal: {
      v3_code:        deal?.v3_code ?? null,
      legacy_code:    deal?.code ?? null,
      target_company: deal?.target_company ?? null,
      sector:         deal?.sector ?? null,
    },
    investor: {
      name:    invite.investor_name,
      company: invite.investor_company,
    },
    nda_signed,
    nda_signed_at:   ndaSig?.signed_at ?? null,
    documents,
    access_count:    (invite.access_count ?? 0) + 1,
    is_first_access: isFirstAccess,
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function detectDevice(ua: string): "mobile" | "desktop" | "tablet" {
  if (/tablet|ipad/i.test(ua)) return "tablet";
  if (/mobile|android|iphone/i.test(ua)) return "mobile";
  return "desktop";
}

const DEFAULT_NDA_TEXT = `ACORDO DE CONFIDENCIALIDADE (NDA) — V3 Partners

Este Acordo de Confidencialidade ("Acordo") é celebrado entre a V3 Partners Soluções Ltda
(CNPJ 14.219.287/0001-50) e o Receptor das Informações identificado no convite.

1. CONFIDENCIALIDADE: Todas as informações, documentos e materiais disponibilizados
nesta sala de investimento são estritamente confidenciais e destinados exclusivamente ao
Receptor identificado. É expressamente proibida a reprodução, divulgação ou repasse
a terceiros sem autorização prévia e por escrito da V3 Partners.

2. FINALIDADE: O acesso é concedido exclusivamente para fins de análise de investimento
no âmbito do processo de M&A conduzido pela V3 Partners.

3. DURAÇÃO: As obrigações de confidencialidade permanecem por 3 (três) anos a contar
da data de aceite, mesmo após o encerramento do processo de M&A.

4. REGISTRO ELETRÔNICO: O aceite deste Acordo será registrado com endereço IP,
data e hora, e snapshot do texto, constituindo evidência de aceite eletrônico com
validade jurídica nos termos do Art. 10 da MP 2.200-2/2001 e do Art. 104 do CC/2002.

V3 Partners Soluções Ltda — privacidade@v3partners.com.br`;
