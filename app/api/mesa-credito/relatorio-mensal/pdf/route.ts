import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { launchBrowser } from "@/lib/credit-report-generate";
import {
  htmlRelatorioPartner, htmlRelatorioSocios, montarRelatorioMensal, periodoDoMes, PARTNER_ROLES,
} from "@/lib/relatorio-mensal-partners";
import { aplicarMarca, idsDaEquipe, marcaDoPerfil } from "@/lib/enterprise";

export const maxDuration = 120;

const EQUIPE = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

// GET /api/mesa-credito/relatorio-mensal/pdf?mes=YYYY-MM[&partner_id=]
// PDF do relatório mensal, mesmo conteúdo do e-mail (lib/relatorio-mensal-partners.ts):
// equipe sem partner_id → consolidado da rede; equipe com partner_id → aquele partner;
// partner → sempre o próprio (partner_id ignorado).
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role ?? "";
  const equipe = EQUIPE.includes(role);
  if (!equipe && !(PARTNER_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const periodo = periodoDoMes(searchParams.get("mes"));
  const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  // Master de Enterprise: a equipe dele (ou um usuário dela via partner_id); partner comum: o próprio.
  const equipeEnterprise = equipe ? null : await idsDaEquipe(db, user.id);
  const pedido = searchParams.get("partner_id");
  let alvo: string | null;
  if (equipe) alvo = pedido;
  else if (equipeEnterprise && equipeEnterprise.length > 1) alvo = pedido && equipeEnterprise.includes(pedido) ? pedido : null;
  else alvo = user.id;
  const rel = await montarRelatorioMensal(db, periodo, alvo ?? (equipe ? undefined : equipeEnterprise ?? undefined));
  const marca = equipe ? null : await marcaDoPerfil(db, user.id);

  let html: string;
  let nome: string;
  if (alvo) {
    const r = rel.partners[0];
    if (!r) return NextResponse.json({ error: "Partner não encontrado" }, { status: 404 });
    html = aplicarMarca(htmlRelatorioPartner(rel, r, true), marca);
    nome = r.partner.nome;
  } else {
    html = aplicarMarca(htmlRelatorioSocios(rel, true), marca);
    nome = equipe ? "Rede" : "Equipe";
  }

  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 60000 });
    const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } });
    const arquivo = `Relatorio-Mensal-${nome}-${periodo.chave}`
      .normalize("NFD").replace(/[^a-zA-Z0-9-]+/g, "-").replace(/-+/g, "-");
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${arquivo}.pdf"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: `Falha ao gerar PDF: ${(e as Error).message}` }, { status: 500 });
  } finally {
    await browser?.close().catch(() => {});
  }
}
