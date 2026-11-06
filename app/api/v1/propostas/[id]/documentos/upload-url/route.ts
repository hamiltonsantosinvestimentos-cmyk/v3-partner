// POST /api/v1/propostas/{id}/documentos/upload-url — link assinado para subir um arquivo.
import type { NextRequest } from "next/server";
import { z } from "zod";
import { executar, portfolioAtivo, propostaDoPartner } from "@/lib/api-v1/rota";
import { ErroApi, isoBrasilia } from "@/lib/api-v1/http";
import { camposDoZod } from "@/lib/api-v1/proposta";
import { documentosDaLinha } from "@/lib/api-v1/visao-partner";
import { assinarUpload, BUCKET, MAX_BYTES, MAX_PENDENTES, nomeSeguro, tipoPelaExtensao, VALIDADE_UPLOAD_MS } from "@/lib/api-v1/arquivos";

export const dynamic = "force-dynamic";

const corpoSchema = z.object({
  tipo_documento: z.string().trim().min(1).max(60),
  nome_arquivo: z.string().trim().min(1).max(200),
  tamanho_bytes: z.number().int().positive(),
}).strict();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return executar(req, "propostas:criar", "POST /propostas/{id}/documentos/upload-url", async (ctx, db) => {
    const p = await propostaDoPartner<{ id: string; credit_line: string; metadata: Record<string, unknown> | null }>(db, ctx, id, "id, credit_line, metadata");

    let body: unknown;
    try { body = await req.json(); } catch { throw new ErroApi(400, "dados_invalidos", "O corpo precisa ser um JSON válido."); }
    const parsed = corpoSchema.safeParse(body);
    if (!parsed.success) throw new ErroApi(400, "dados_invalidos", "Confira os campos indicados.", camposDoZod(parsed.error));
    const { tipo_documento, nome_arquivo, tamanho_bytes } = parsed.data;

    if (tamanho_bytes > MAX_BYTES) throw new ErroApi(413, "arquivo_grande", "Arquivo acima de 25 MB. Reduza ou divida.");
    const contentType = tipoPelaExtensao(nome_arquivo);
    if (!contentType) throw new ErroApi(415, "tipo_nao_aceito", "Envie PDF, JPG, PNG ou DOCX sem macro. Arquivo .doc não é aceito.");

    const meta = p.metadata ?? {};
    const tipo: "PF" | "PJ" = meta.client_type === "PJ" ? "PJ" : "PF";
    const exigidos = documentosDaLinha(p.credit_line, tipo, await portfolioAtivo(db), meta);
    if (!exigidos.some((d) => d.id === tipo_documento)) {
      throw new ErroApi(400, "dados_invalidos", "tipo_documento não pertence ao checklist desta proposta. Use os ids de GET /linhas.", { tipo_documento: "Documento não encontrado no checklist." });
    }

    // No máximo 50 envios pendentes (pedidos e não confirmados nas últimas 24 horas) por chave.
    const agora = Date.now();
    const { count: pendentes } = await db.from("partner_api_uploads")
      .select("id", { count: "exact", head: true })
      .eq("key_id", ctx.keyId).is("confirmado_em", null)
      .gte("criado_em", new Date(agora - 24 * 3600_000).toISOString());
    if ((pendentes ?? 0) >= MAX_PENDENTES) {
      throw new ErroApi(429, "limite_de_envios", `Há ${MAX_PENDENTES} envios pedidos e não confirmados. Confirme os envios em andamento antes de pedir novos links.`, undefined, { "Retry-After": "60" });
    }

    const storagePath = `${ctx.partnerId}/${id}/${tipo_documento}_${agora}_${nomeSeguro(nome_arquivo)}`;
    const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(storagePath);
    if (error || !data) throw new Error(error?.message ?? "Falha ao gerar link de envio");

    const expira = agora + VALIDADE_UPLOAD_MS;
    const { error: regErr } = await db.from("partner_api_uploads").insert({
      key_id: ctx.keyId, partner_id: ctx.partnerId, proposal_id: id, storage_path: storagePath,
      tipo_documento, expira_em: new Date(expira).toISOString(),
    });
    if (regErr) throw new Error(`registro do envio: ${regErr.message}`);
    const uploadId = assinarUpload({ p: id, k: ctx.keyId, d: tipo_documento, n: nome_arquivo, c: contentType, path: storagePath, t: tamanho_bytes, exp: expira });
    return {
      corpo: { upload_id: uploadId, url: data.signedUrl, content_type: contentType, expira_em: isoBrasilia(new Date(expira).toISOString()) },
      proposalId: id,
    };
  });
}
