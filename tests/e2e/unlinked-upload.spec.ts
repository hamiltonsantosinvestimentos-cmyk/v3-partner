import { test, expect } from "@playwright/test";
import { NONEXISTENT_DEAL_ID, uniqueFileContent } from "./fixtures";

// MPS Documentos V3 Fase 3 - teste 2/3: upload apontando para um deal_id que nao existe
// deve ser bloqueado (nunca criar documento orfao sem deal real por tras).
test("upload para deal inexistente e rejeitado, nenhum documento e criado", async ({ request }) => {
  const content = uniqueFileContent("unlinked");

  const res = await request.post("/api/ma/documents", {
    multipart: {
      file: { name: "teste-fase3-sem-deal.pdf", mimeType: "application/pdf", buffer: Buffer.from(content) },
      deal_id: NONEXISTENT_DEAL_ID,
      doc_id: `qa_unlinked_${Date.now()}`,
      category: "Due_Diligence",
    },
  });

  expect(res.status()).toBe(404);
  const body = await res.json();
  expect(body.error).toMatch(/não encontrada/i);
});

test("register tambem rejeita deal_id inexistente", async ({ request }) => {
  const res = await request.post("/api/ma/documents/register", {
    data: {
      deal_id: NONEXISTENT_DEAL_ID,
      doc_id: `qa_unlinked_register_${Date.now()}`,
      file_name: "nao-deveria-existir.pdf",
      storage_path: `${NONEXISTENT_DEAL_ID}/fake.pdf`,
      file_size_bytes: 10,
    },
  });

  expect(res.status()).toBe(404);
});
