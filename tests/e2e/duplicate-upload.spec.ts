import { test, expect } from "@playwright/test";
import { QA_DEAL_ID, uniqueFileContent } from "./fixtures";

// MPS Documentos V3 Fase 3 - teste 1/3: mesmo arquivo duas vezes deve ser bloqueado como duplicata.
test("upload duplicado do mesmo arquivo e bloqueado, nao cria copia", async ({ request }) => {
  const content = uniqueFileContent("dup");
  const fileName = "teste-fase3-duplicata.pdf";
  let docIdToClean = "";

  try {
    const first = await request.post("/api/ma/documents", {
      multipart: {
        file: { name: fileName, mimeType: "application/pdf", buffer: Buffer.from(content) },
        deal_id: QA_DEAL_ID,
        doc_id: `qa_dup_${Date.now()}_a`,
        category: "Due_Diligence",
      },
    });
    expect(first.ok()).toBeTruthy();
    const firstBody = await first.json();
    expect(firstBody.ok).toBe(true);
    expect(firstBody.duplicate).toBeFalsy();
    docIdToClean = firstBody.document.doc_id;

    const second = await request.post("/api/ma/documents", {
      multipart: {
        file: { name: fileName, mimeType: "application/pdf", buffer: Buffer.from(content) },
        deal_id: QA_DEAL_ID,
        doc_id: `qa_dup_${Date.now()}_b`,
        category: "Due_Diligence",
      },
    });
    expect(second.ok()).toBeTruthy();
    const secondBody = await second.json();
    expect(secondBody.ok).toBe(true);
    expect(secondBody.duplicate).toBe(true);
    expect(secondBody.document.file_name).toBe(fileName);
  } finally {
    if (docIdToClean) {
      await request.delete(`/api/ma/documents?deal_id=${QA_DEAL_ID}&doc_id=${docIdToClean}`);
    }
  }
});
