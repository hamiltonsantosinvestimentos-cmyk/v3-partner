// GET /api/v1/linhas — linhas de crédito liberadas ao partner e documentos por PF e PJ.
import type { NextRequest } from "next/server";
import { executar, portfolioAtivo } from "@/lib/api-v1/rota";
import { documentosDaLinha, linhasOrdenadas } from "@/lib/api-v1/visao-partner";
import { linhaPermitidaParaPapel, VALOR_MINIMO_N3 } from "@/lib/credit-proposal-create";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return executar(req, null, "GET /linhas", async (ctx, db) => {
    const portfolio = await portfolioAtivo(db);
    const linhas = linhasOrdenadas()
      .filter((l) => linhaPermitidaParaPapel(ctx.role, l.nome))
      .map((l) => ({
        nome: l.nome,
        nivel: l.nivel,
        valor_minimo: l.nivel === "NIVEL_3" ? VALOR_MINIMO_N3 : null,
        documentos: {
          PF: documentosDaLinha(l.nome, "PF", portfolio),
          PJ: documentosDaLinha(l.nome, "PJ", portfolio),
        },
      }));
    return { corpo: { linhas } };
  });
}
