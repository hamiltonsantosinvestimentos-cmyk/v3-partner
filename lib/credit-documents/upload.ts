// Serverless Functions da Vercel têm limite fixo de ~4.5MB de request body.
// Arquivos maiores precisam ir direto pro Supabase Storage via URL assinada.
const SMALL_FILE_THRESHOLD = 4 * 1024 * 1024;

export type CreditDocUploadResult =
  | { ok: true; url: string | null; fileKey: string }
  | { ok: false; error: string };

export async function uploadCreditDocument(
  proposalId: string,
  docId: string,
  file: File
): Promise<CreditDocUploadResult> {
  try {
    return file.size > SMALL_FILE_THRESHOLD
      ? await uploadDirect(proposalId, docId, file)
      : await uploadViaApi(proposalId, docId, file);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao enviar arquivo" };
  }
}

async function uploadViaApi(proposalId: string, docId: string, file: File): Promise<CreditDocUploadResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("proposal_id", proposalId);
  form.append("doc_id", docId);
  const res = await fetch("/api/credit-proposals/documents", { method: "POST", body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: json.error ?? "Erro ao enviar arquivo" };
  return { ok: true, url: json.document?.url ?? null, fileKey: json.document?.file_key ?? file.name };
}

async function uploadDirect(proposalId: string, docId: string, file: File): Promise<CreditDocUploadResult> {
  const urlRes = await fetch(
    `/api/credit-proposals/documents/upload-url?proposal_id=${proposalId}&doc_id=${encodeURIComponent(docId)}&file_name=${encodeURIComponent(file.name)}`
  );
  const urlJson = await urlRes.json().catch(() => ({}));
  if (!urlRes.ok) return { ok: false, error: urlJson.error ?? "Erro ao gerar URL de upload" };
  const { token, storagePath, contentType } = urlJson as { token: string; storagePath: string; contentType: string };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `${supabaseUrl}/storage/v1/object/upload/sign/credit-documents/${storagePath}?token=${token}`);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Storage: ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("Falha na conexão com o storage"));
    xhr.send(file);
  });

  const regRes = await fetch("/api/credit-proposals/documents/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ proposal_id: proposalId, doc_id: docId, file_name: file.name, storage_path: storagePath }),
  });
  const regJson = await regRes.json().catch(() => ({}));
  if (!regRes.ok || !regJson.ok) return { ok: false, error: regJson.error ?? "Erro ao registrar arquivo" };
  return { ok: true, url: regJson.document?.url ?? null, fileKey: regJson.document?.file_key ?? storagePath };
}
