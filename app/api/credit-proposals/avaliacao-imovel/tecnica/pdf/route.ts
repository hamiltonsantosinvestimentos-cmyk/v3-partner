import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { launchBrowser } from "@/lib/credit-report-generate";
import { atualizarMetadata } from "@/lib/credit-proposal-meta";
import { codigoLaudo, htmlLaudoAvaliacao } from "@/lib/avaliacao-tecnica/pdf";
import type { AvaliacaoTecnica, PdfAvaliacaoMeta } from "@/lib/avaliacao-tecnica/tipos";

// Laudo em PDF da Avaliação Técnica V3 (18/10/2026).
//   POST { proposal_id, imovel_idx } → gera o PDF da avaliação gravada, salva no storage da
//        proposta (metadata.imoveis[i].avaliacao_tecnica_pdf) e devolve o arquivo.
//   GET  ?proposal_id&imovel_idx     → link assinado do último PDF salvo.

export const maxDuration = 120;

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
const BUCKET = "credit-documents";
const SIGNED_URL_EXPIRES = 60 * 60;

type Imovel = Record<string, unknown>;

const db = () => sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function autorizar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes(profile?.role ?? "")) return { erro: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) };
  return { user, nome: (profile?.full_name as string | null) ?? null };
}

function imovelDe(meta: Record<string, unknown>, idx: number): Imovel {
  return Array.isArray(meta.imoveis) ? (((meta.imoveis as Imovel[])[idx] ?? {}) as Imovel) : {};
}

export async function GET(req: NextRequest) {
  const a = await autorizar();
  if (a.erro) return a.erro;
  const id = req.nextUrl.searchParams.get("proposal_id");
  const idx = Number(req.nextUrl.searchParams.get("imovel_idx") ?? 0);
  if (!id || !Number.isInteger(idx) || idx < 0) return NextResponse.json({ error: "proposal_id e imovel_idx obrigatórios" }, { status: 400 });
  const { data } = await db().from("credit_desk_proposals").select("metadata").eq("id", id).single();
  const pdf = imovelDe((data?.metadata ?? {}) as Record<string, unknown>, idx).avaliacao_tecnica_pdf as PdfAvaliacaoMeta | undefined;
  if (!pdf?.storage_path) return NextResponse.json({ error: "Nenhum PDF salvo para este imóvel." }, { status: 404 });
  const { data: s } = await db().storage.from(pdf.bucket || BUCKET).createSignedUrl(pdf.storage_path, SIGNED_URL_EXPIRES, { download: pdf.file_name });
  if (!s?.signedUrl) return NextResponse.json({ error: "Não foi possível abrir o PDF salvo." }, { status: 500 });
  return NextResponse.json({ url: s.signedUrl, pdf });
}

export async function POST(req: NextRequest) {
  const a = await autorizar();
  if (a.erro) return a.erro;
  const body = (await req.json().catch(() => ({}))) as { proposal_id?: string; imovel_idx?: number };
  const idx = Number(body.imovel_idx ?? 0);
  if (!body.proposal_id || !Number.isInteger(idx) || idx < 0) return NextResponse.json({ error: "proposal_id e imovel_idx obrigatórios" }, { status: 400 });

  const { data: proposta } = await db()
    .from("credit_desk_proposals")
    .select("id, code, client_name, requested_value, partner_id, metadata")
    .eq("id", body.proposal_id)
    .single();
  if (!proposta) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
  const av = imovelDe((proposta.metadata ?? {}) as Record<string, unknown>, idx).avaliacao_tecnica as AvaliacaoTecnica | undefined;
  if (!av) return NextResponse.json({ error: "Gere a avaliação técnica antes do PDF." }, { status: 422 });

  const emitido = new Date();
  const codigo = codigoLaudo(proposta.code, idx);
  const html = htmlLaudoAvaliacao({
    av, codigo, propostaCode: proposta.code, clienteNome: proposta.client_name,
    valorSolicitado: Number(proposta.requested_value) || null, emitidoEm: emitido, emitidoPor: a.nome,
  });

  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  let pdf: Uint8Array;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 60000 });
    await page.evaluate(() => Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 3000))])).catch(() => {});
    pdf = await page.pdf({
      format: "A4", printBackground: true, displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="width:100%;font-size:7px;color:#7A8FA8;font-family:Arial;padding:0 44px;display:flex;justify-content:space-between"><span>${codigo}</span><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>`,
    });
  } catch (e) {
    return NextResponse.json({ error: `Falha ao gerar PDF: ${(e as Error).message}` }, { status: 500 });
  } finally {
    await browser?.close().catch(() => {});
  }

  const cliente = (proposta.client_name ?? "cliente").split(/\s+/).slice(0, 3).join("-");
  const fileName = `Avaliacao-Tecnica-${codigo}-${cliente}.pdf`.normalize("NFD").replace(/[^a-zA-Z0-9.-]+/g, "-").replace(/-+/g, "-");
  const storagePath = `${proposta.partner_id ?? a.user.id}/${proposta.id}/avaliacao_tecnica_pdf_${idx}_${Date.now()}.pdf`;

  // Salva no storage e registra no imóvel; se falhar, ainda entrega o arquivo (com aviso no header).
  let salvo = false;
  const up = await db().storage.from(BUCKET).upload(storagePath, pdf, { contentType: "application/pdf", upsert: true });
  if (!up.error) {
    const meta: PdfAvaliacaoMeta = { storage_path: storagePath, bucket: BUCKET, file_name: fileName, gerado_em: emitido.toISOString(), gerado_por: a.nome, avaliacao_gerada_em: av.gerado_em };
    let anterior: PdfAvaliacaoMeta | undefined;
    const r = await atualizarMetadata(db(), proposta.id, (m) => {
      const imoveis = Array.isArray(m.imoveis) ? [...(m.imoveis as Imovel[])] : [];
      if (!imoveis[idx]) return m;
      anterior = imoveis[idx].avaliacao_tecnica_pdf as PdfAvaliacaoMeta | undefined;
      imoveis[idx] = { ...imoveis[idx], avaliacao_tecnica_pdf: meta };
      return { ...m, imoveis };
    });
    salvo = r.ok;
    // Mantém só o último PDF de cada imóvel no storage.
    if (r.ok && anterior?.storage_path && anterior.storage_path !== storagePath) {
      await db().storage.from(anterior.bucket || BUCKET).remove([anterior.storage_path]).catch(() => {});
    }
  } else {
    console.error("[avaliacao-tecnica/pdf] upload", up.error.message);
  }

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "X-Pdf-Salvo": salvo ? "1" : "0",
    },
  });
}
