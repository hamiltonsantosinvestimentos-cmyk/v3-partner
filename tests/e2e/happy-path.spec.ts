import { test, expect } from "@playwright/test";
import { QA_DEAL_ID, uniqueFileContent } from "./fixtures";

// MPS Documentos V3 Fase 3 - teste 3/3: caminho feliz do upload grande (signed URL),
// confirma que o arquivo cai no path governado da categoria correta (03_CIM).
test("upload com categoria CIM cai no path governado correto", async ({ request }) => {
  const content = uniqueFileContent("happy-cim");
  const docId = `qa_happy_${Date.now()}`;
  const fileName = "teste-fase3-happy-path.pdf";

  const urlRes = await request.get(
    `/api/ma/documents/upload-url?deal_id=${QA_DEAL_ID}&doc_id=${docId}&file_name=${encodeURIComponent(fileName)}&category=CIM`
  );
  expect(urlRes.ok()).toBeTruthy();
  const { signedUrl, token, storagePath, bucket, category } = await urlRes.json();

  expect(category).toBe("CIM");
  expect(bucket).toBe("v3-docs-publico");
  expect(storagePath).toContain("/03_CIM/");
  expect(storagePath).toContain("V3-2026-07-IND-002");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  expect(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL precisa estar carregado (ver .env.local)").toBeTruthy();

  const putRes = await request.put(
    `${supabaseUrl}/storage/v1/object/upload/sign/${bucket}/${storagePath}?token=${token}`,
    { data: Buffer.from(content), headers: { "Content-Type": "application/pdf" } }
  );
  expect(putRes.ok()).toBeTruthy();

  let regBody: { ok: boolean; document?: { url: string | null; file_name: string } } | undefined;
  try {
    const regRes = await request.post("/api/ma/documents/register", {
      data: {
        deal_id: QA_DEAL_ID,
        doc_id: docId,
        file_name: fileName,
        storage_path: storagePath,
        bucket,
        category,
        file_size_bytes: content.length,
      },
    });
    expect(regRes.ok()).toBeTruthy();
    regBody = await regRes.json();
    expect(regBody!.ok).toBe(true);
    expect(regBody!.document!.file_name).toBe(fileName);
    expect(regBody!.document!.url).toBeTruthy();

    const listRes = await request.get(`/api/ma/documents?deal_id=${QA_DEAL_ID}`);
    const listBody = await listRes.json();
    const found = listBody.documents.find((d: { doc_id: string }) => d.doc_id === docId);
    expect(found, "documento deveria aparecer na listagem do deal").toBeTruthy();
  } finally {
    await request.delete(`/api/ma/documents?deal_id=${QA_DEAL_ID}&doc_id=${docId}`);
  }
});
