// GET /api/v1/propostas/{id} — visão do partner (só o que ele vê na Mesa de Crédito).
import type { NextRequest } from "next/server";
import { executar, partnerAccess, portfolioAtivo, propostaDoPartner } from "@/lib/api-v1/rota";
import { COLUNAS_VISAO, visaoDoPartner } from "@/lib/api-v1/visao-partner";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return executar(req, "propostas:ler", "GET /propostas/{id}", async (ctx, db) => {
    const p = await propostaDoPartner(db, ctx, id, COLUNAS_VISAO);
    const visao = visaoDoPartner(p, { portfolio: await portfolioAtivo(db), access: await partnerAccess(db, ctx.partnerId) });
    return { corpo: visao, proposalId: id };
  });
}
