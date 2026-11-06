// POST /api/v1/propostas/{id}/documentos — confirma o envio: confere tamanho, tipo real e PDF
// seguro, e registra em credit_desk_proposals.documents (o mesmo lugar do modal; o OCR roda depois).
import type { NextRequest } from "next/server";
import { executar, partnerAccess, portfolioAtivo, propostaDoPartner } from "@/lib/api-v1/rota";
import { ErroApi } from "@/lib/api-v1/http";
import { COLUNAS_VISAO, visaoDoPartner } from "@/lib/api-v1/visao-partner";
import { analisarArquivo, BUCKET, lerUpload, MAX_BYTES, mesmoTipo, nomeSeguro, tipoPelosBytes } from "@/lib/api-v1/arquivos";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return executar(req, "propostas:criar", "POST /propostas/{id}/documentos", async (ctx, db) => {
    await propostaDoPartner(db, ctx, id, "id");

    let body: { upload_id?: unknown };
    try { body = await req.json(); } catch { throw new ErroApi(400, "dados_invalidos", "O corpo precisa ser um JSON válido."); }
    const up = lerUpload(String(body?.upload_id ?? ""));
    if (!up || up.p !== id || up.k !== ctx.keyId || !up.path.startsWith(`${ctx.partnerId}/${id}/`)) {
      throw new ErroApi(400, "dados_invalidos", "upload_id inválido, vencido ou de outra proposta.", { upload_id: "Inválido." });
    }

    const resposta = async () => {
      const p = await propostaDoPartner(db, ctx, id, COLUNAS_VISAO);
      const visao = visaoDoPartner(p, { portfolio: await portfolioAtivo(db), access: await partnerAccess(db, ctx.partnerId) });
      return { corpo: { ok: true, tipo_documento: up.d, documentos_pendentes: visao.documentos_pendentes, documentos_recebidos: visao.documentos_recebidos }, proposalId: id };
    };

    // Confirmação repetida: já registrado, responde igual.
    const { data: atual } = await db.from("credit_desk_proposals").select("documents, checklist").eq("id", id).single();
    const docs = Array.isArray(atual?.documents) ? (atual!.documents as Record<string, unknown>[]) : [];
    if (docs.some((d) => d.storage_path === up.path)) return resposta();

    // O envio precisa estar registrado para esta chave (partner_api_uploads).
    const { data: registro } = await db.from("partner_api_uploads").select("id").eq("storage_path", up.path).eq("key_id", ctx.keyId).maybeSingle();
    if (!registro) throw new ErroApi(400, "dados_invalidos", "upload_id inválido, vencido ou de outra proposta.", { upload_id: "Envio não encontrado." });

    const recusar = async (status: number, codigo: "arquivo_grande" | "tipo_nao_aceito", msg: string): Promise<never> => {
      await db.storage.from(BUCKET).remove([up.path]);
      throw new ErroApi(status, codigo, msg);
    };

    // Tamanho conferido pelos dados do armazenamento ANTES de baixar o arquivo.
    const pasta = up.path.slice(0, up.path.lastIndexOf("/"));
    const nome = up.path.slice(up.path.lastIndexOf("/") + 1);
    const { data: lista } = await db.storage.from(BUCKET).list(pasta, { search: nome, limit: 5 });
    const info = (lista ?? []).find((o) => o.name === nome) as { metadata?: { size?: number } } | undefined;
    if (!info) throw new ErroApi(400, "dados_invalidos", "O arquivo ainda não chegou. Suba o arquivo no link (PUT) antes de confirmar.", { upload_id: "Arquivo não encontrado." });
    if (typeof info.metadata?.size === "number" && info.metadata.size > MAX_BYTES) await recusar(413, "arquivo_grande", "Arquivo acima de 25 MB.");

    const { data: blob, error: dlErr } = await db.storage.from(BUCKET).download(up.path);
    if (dlErr || !blob) throw new ErroApi(400, "dados_invalidos", "O arquivo ainda não chegou. Suba o arquivo no link (PUT) antes de confirmar.", { upload_id: "Arquivo não encontrado." });
    const bytes = new Uint8Array(await blob.arrayBuffer());

    if (bytes.byteLength > MAX_BYTES) await recusar(413, "arquivo_grande", "Arquivo acima de 25 MB.");
    const real = tipoPelosBytes(bytes);
    if (!real || !mesmoTipo(real, up.c)) await recusar(415, "tipo_nao_aceito", "O conteúdo do arquivo não corresponde à extensão informada. Envie PDF, JPG, PNG ou DOCX sem macro.");
    const problema = await analisarArquivo(bytes, real!);
    if (problema) await recusar(415, "tipo_nao_aceito", problema);

    const agora = new Date().toISOString();
    const novo = {
      doc_id: up.d,
      file_name: nomeSeguro(up.n),
      storage_path: up.path,
      uploaded_at: agora,
      uploaded_by: ctx.partnerId,
      source: "api",
    };
    const checklist = (atual?.checklist as Record<string, boolean> | null) ?? {};
    const { error } = await db.from("credit_desk_proposals").update({
      documents: [...docs, novo],
      checklist: { ...checklist, [up.d]: true },
      updated_at: agora,
    }).eq("id", id).eq("partner_id", ctx.partnerId);
    if (error) throw new Error(error.message);
    await db.from("partner_api_uploads").update({ confirmado_em: agora }).eq("storage_path", up.path);

    return resposta();
  });
}
