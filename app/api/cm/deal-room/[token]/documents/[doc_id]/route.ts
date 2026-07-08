import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";

export const dynamic = "force-dynamic";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function maskCpf(cpf: string | null): string {
  if (!cpf) return "NAO-INFORMADO";
  const d = cpf.replace(/\D/g, "");
  if (d.length < 11) return cpf;
  return `${d.slice(0, 3)}.***.${d.slice(6, 9)}-${d.slice(9)}`;
}

/**
 * GET /api/cm/deal-room/[token]/documents/[doc_id]
 * Download gated por token do Deal Room. Registra IP+CPF obrigatoriamente
 * (cm_deal_room_document_views) e aplica marca dagua com o numero do Deal Room
 * e o CPF do visualizador em documentos PDF antes de servir o arquivo.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; doc_id: string }> }
) {
  const { token, doc_id } = await params;
  const db = svc();

  const { data: access } = await db
    .from("cm_deal_room_access")
    .select("id, listing_id, access_tier, nda_accepted, revoked, expires_at, buyer_cpf, buyer_email, cm_asset_listings(anonymous_id)")
    .eq("access_token", token)
    .single();

  if (!access || access.revoked)
    return NextResponse.json({ error: "Link inválido ou revogado" }, { status: 404 });

  if (access.expires_at && new Date(access.expires_at) < new Date())
    return NextResponse.json({ error: "Link expirado" }, { status: 410 });

  if (!access.nda_accepted || !["qualified", "full_dd"].includes(access.access_tier ?? ""))
    return NextResponse.json({ error: "Acesso insuficiente para este documento" }, { status: 403 });

  if (!access.buyer_cpf || !access.buyer_email)
    return NextResponse.json({ error: "CPF e email não registrados para este acesso — qualificação incompleta" }, { status: 403 });

  const { data: doc } = await db
    .from("cm_listing_documents")
    .select("id, listing_id, storage_path, original_filename")
    .eq("id", doc_id)
    .single();

  if (!doc || doc.listing_id !== access.listing_id)
    return NextResponse.json({ error: "Documento não encontrado nesta Deal Room" }, { status: 404 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
  const userAgent = req.headers.get("user-agent") ?? "unknown";

  // Log obrigatorio ANTES de servir o arquivo — trilha de auditoria, nunca pulado
  await db.from("cm_deal_room_document_views").insert({
    access_id: access.id,
    document_id: doc.id,
    ip_address: ip,
    buyer_cpf: access.buyer_cpf,
    buyer_email: access.buyer_email,
    user_agent: userAgent,
  });

  const { data: fileData, error: downloadError } = await db.storage
    .from("documents")
    .download(doc.storage_path);

  if (downloadError || !fileData)
    return NextResponse.json({ error: "Erro ao carregar documento" }, { status: 500 });

  const originalBytes = Buffer.from(await fileData.arrayBuffer());
  const anonymousId = (access.cm_asset_listings as any)?.anonymous_id ?? "V3";
  const isPdf = doc.storage_path.toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    return new NextResponse(originalBytes, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${doc.original_filename ?? "documento"}"`,
      },
    });
  }

  try {
    const pdfDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const watermarkText = `V3 Partners — Deal Room ${anonymousId} — CPF ${maskCpf(access.buyer_cpf)} — ${access.buyer_email} — ${new Date().toLocaleString("pt-BR")}`;

    for (const page of pdfDoc.getPages()) {
      const { width, height } = page.getSize();
      page.drawText(watermarkText, {
        x: width / 2 - (watermarkText.length * 3.2),
        y: height / 2,
        size: 11,
        font,
        color: rgb(0.79, 0.66, 0.3),
        opacity: 0.35,
        rotate: degrees(35),
      });
      page.drawText(watermarkText, {
        x: 20,
        y: 15,
        size: 6,
        font,
        color: rgb(0.5, 0.5, 0.5),
        opacity: 0.8,
      });
    }

    const watermarkedBytes = await pdfDoc.save();
    return new NextResponse(Buffer.from(watermarkedBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${doc.original_filename ?? "documento.pdf"}"`,
      },
    });
  } catch {
    // PDF corrompido/nao suportado pelo pdf-lib — serve original, mas a view ja ficou registrada
    return new NextResponse(originalBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${doc.original_filename ?? "documento.pdf"}"`,
      },
    });
  }
}
