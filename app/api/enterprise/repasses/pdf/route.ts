import { NextRequest, NextResponse } from "next/server";
import { exigirEnterprise, logLeituraAdmin } from "@/lib/enterprise-server";
import { htmlRepasses, listarRepasses } from "@/lib/enterprise-repasses";
import { periodoDoMes } from "@/lib/relatorio-mensal-partners";
import { aplicarMarca } from "@/lib/enterprise";
import { launchBrowser } from "@/lib/credit-report-generate";

export const maxDuration = 120;

// GET ?mes=YYYY-MM|todos — PDF de repasses com a marca do Enterprise (master: todos os
// usuários; usuário: os próprios).
export async function GET(req: NextRequest) {
  const auth = await exigirEnterprise({ req, permitirAdmin: true });
  if (!auth.ok) return auth.res;
  // O PDF de repasses mostra o valor do master e o %: fica só para o master e o ADMIN.
  // O usuário da equipe vê a comissão dele em Comissões (BRIEF 2026-11-23 menu enxuto e comissões).
  if (!auth.ctx.ehMaster && !auth.admin) return NextResponse.json({ error: "Sua comissão está em Comissões." }, { status: 403 });
  const mes = new URL(req.url).searchParams.get("mes");
  const periodo = !mes || mes === "todos" ? null : periodoDoMes(mes);
  // Modo ADMIN: registra a exportação (não bloqueia).
  await logLeituraAdmin(auth, req, { action: "EXPORT", newData: { mes: mes ?? "todos", documento: "repasses_pdf" } });

  const dados = await listarRepasses(auth.db, auth.ctx.ehMaster
    ? { enterpriseId: auth.userId, periodo }
    : { usuarioId: auth.userId, periodo });
  const { data: master } = await auth.db.from("profiles").select("full_name").eq("id", auth.ctx.masterId).maybeSingle();
  const marcaNome = auth.ctx.marca?.nome ?? (master?.full_name as string) ?? "Enterprise";
  const html = aplicarMarca(
    htmlRepasses({ marcaNome, masterNome: (master?.full_name as string) ?? marcaNome, periodoLabel: periodo?.label ?? "todo o período", dados }),
    auth.ctx.marca,
  );

  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 60000 });
    const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } });
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Repasses-${periodo?.chave ?? "todos"}.pdf"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: `Falha ao gerar PDF: ${(e as Error).message}` }, { status: 500 });
  } finally {
    await browser?.close().catch(() => {});
  }
}
