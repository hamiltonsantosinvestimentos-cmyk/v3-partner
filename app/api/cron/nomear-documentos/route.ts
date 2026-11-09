import { NextRequest, NextResponse } from "next/server";
import { limparOrfaos, nomearDocumentosPendentes, NOMEAR_A_PARTIR_DE } from "@/lib/documentos/nomear-proposta";

// GET /api/cron/nomear-documentos: nome automático dos anexos NOVOS das propostas que não foram lidos no upload
// (API de parceiros, chat, link público, novas tentativas de erro). BRIEF 09/11/2026, nomear documentos.
// /api/cron/ é público no proxy.ts: o Bearer CRON_SECRET é validado aqui dentro, sempre.
// Só arquivos com uploaded_at >= NOMEAR_A_PARTIR_DE; os anexos antigos nunca são lidos.
// `?limite=N` (só com o Bearer) para o teste controlado antes de ligar o agendamento.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const pedido = Number(req.nextUrl.searchParams.get("limite"));
  const limite = Number.isFinite(pedido) && pedido > 0 ? Math.min(Math.floor(pedido), 150) : 150;

  const orfaos = await limparOrfaos();
  const resumo = await nomearDocumentosPendentes({ limite, prazoMs: 250_000 });
  return NextResponse.json({ ok: true, corte: NOMEAR_A_PARTIR_DE, orfaos_apagados: orfaos, ...resumo });
}
