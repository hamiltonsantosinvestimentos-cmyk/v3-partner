// GET /api/integracao-api/comprovante — PDF do aceite do termo vigente (cláusula 14.4).
import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { chamador, svcDb } from "@/lib/integracao-api";
import { termoVigente } from "@/lib/api-v1/auth";

export const dynamic = "force-dynamic";

function dataHoraBrasilia(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " (horário de Brasília)";
}

/** As fontes padrão do PDF só têm WinAnsi: troca o que não cabe. */
function seguro(s: string): string {
  return s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

export async function GET(req: NextRequest) {
  const c = await chamador(req);
  if (!c) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const db = svcDb();
  const termo = await termoVigente(db);
  if (!termo) return NextResponse.json({ error: "Nenhum termo publicado." }, { status: 404 });
  const { data: aceite } = await db.from("partner_api_termo_aceites")
    .select("versao, texto_hash, ip, user_agent, dispositivo, sessao_id, aceito_em")
    .eq("partner_id", c.id).eq("versao", termo.versao).order("aceito_em", { ascending: false }).limit(1).maybeSingle();
  if (!aceite) return NextResponse.json({ error: "Você ainda não aceitou esta versão do termo." }, { status: 404 });
  const a = aceite as { versao: string; texto_hash: string; ip: string | null; user_agent: string | null; dispositivo: string | null; sessao_id: string | null; aceito_em: string };

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = 790;
  const linha = (rotulo: string, valor: string) => {
    page.drawText(seguro(rotulo), { x: 50, y, size: 9, font: bold, color: rgb(0.47, 0.56, 0.66) });
    const partes = seguro(valor).match(/.{1,80}/g) ?? [""];
    for (const p of partes) { page.drawText(p, { x: 200, y, size: 10, font, color: rgb(0.07, 0.12, 0.21) }); y -= 15; }
    y -= 4;
  };
  page.drawText("V3 PARTNERS SOLUCOES LTDA. - CNPJ 14.219.287/0001-50", { x: 50, y, size: 9, font: bold, color: rgb(0.79, 0.66, 0.3) }); y -= 26;
  page.drawText(seguro("Comprovante de aceite eletrônico"), { x: 50, y, size: 18, font: bold, color: rgb(0.07, 0.12, 0.21) }); y -= 20;
  page.drawText(seguro("Termo de Uso da API de Propostas de Crédito da V3 Partners"), { x: 50, y, size: 11, font, color: rgb(0.07, 0.12, 0.21) }); y -= 34;
  linha("Partner", c.nome ?? "-");
  linha("E-mail da conta", c.email ?? "-");
  linha("Versão do termo", a.versao);
  linha("Hash SHA-256 do texto", a.texto_hash);
  linha("Data e hora do aceite", dataHoraBrasilia(a.aceito_em));
  linha("IP", a.ip ?? "-");
  linha("Navegador", a.user_agent ?? "-");
  linha("Dispositivo", a.dispositivo ?? "-");
  linha("Sessão", a.sessao_id ?? "-");
  linha("Confirmações", "Aceite integral do termo; aceite das cláusulas em destaque (4.8, 4.9, 11.4, 12.4, 12.5, 12.7 e 12.8); declaração de poderes para representar o partner.");
  y -= 10;
  page.drawText(seguro("Aceite registrado nos termos do art. 10, § 2º, da MP nº 2.200-2/2001 e da Lei nº 14.063/2020."), { x: 50, y, size: 9, font, color: rgb(0.47, 0.56, 0.66) });

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="aceite-termo-api-v${a.versao}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
