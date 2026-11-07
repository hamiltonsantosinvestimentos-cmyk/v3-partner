// CertOne: leitura do evento do webhook, das assinaturas do documento e nota na linha do tempo.
// Payloads no formato real observado em 07/11/2026 (V3C-NDA-2026-0061), com CPF de teste.
import { test } from "node:test";
import assert from "node:assert/strict";
import { getCertOneSignatures, parseCertOneWebhookEvent } from "../../lib/esignature/certone-provider";
import { recordSignatureNote } from "../../lib/contract-signature-timeline";

const DOC_ID = "90591e2b-1707-409e-989a-12457ae7b461";

test("webhook: DocumentSigned vira 'signed' com o id do documento", () => {
  const raw = JSON.stringify({
    type: "DocumentSigned",
    data: {
      signature: { flowActionId: "57f2f265", date: "2026-11-07T02:22:42.8194136+00:00", name: "ZZTEST MANDATARIO TESTE", identifier: "11144477735", emailAddress: "mandatario@exemplo.test" },
      id: DOC_ID,
      name: "doc.pdf",
    },
  });
  const r = parseCertOneWebhookEvent(raw);
  assert.equal(r?.status, "signed");
  assert.equal(r?.envelopeId, DOC_ID);
  assert.equal(parseCertOneWebhookEvent("não é json"), null);
});

test("documento: lê só quem assinou, sem CPF, e detecta conclusão", async () => {
  const original = globalThis.fetch;
  process.env.CERTONE_API_KEY = "chave-de-teste";
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        status: "Concluded",
        isConcluded: true,
        flowActions: [
          { type: "Signer", status: "Completed", updateDate: "2026-11-07T01:43:52+00:00", user: { name: "Head Teste", email: "head@exemplo.test", identifier: "11144477735" } },
          { type: "Signer", status: "Completed", updateDate: "2026-11-07T02:25:00+00:00", user: { name: "Parte Teste", email: "parte@exemplo.test", identifier: "52998224725" } },
          { type: "Signer", status: "Pending", updateDate: "2026-11-07T01:39:00+00:00", user: { name: "Pendente", email: "pendente@exemplo.test" } },
        ],
      }),
      { status: 200 },
    )) as typeof fetch;
  try {
    const r = await getCertOneSignatures(DOC_ID);
    assert.ok(r.ok);
    if (r.ok) {
      assert.equal(r.isConcluded, true);
      assert.equal(r.signatures.length, 2);
      assert.equal(r.lastSignedAt, "2026-11-07T02:25:00+00:00");
      assert.ok(!JSON.stringify(r).includes("11144477735"), "CPF não pode sair do leitor");
    }
  } finally {
    globalThis.fetch = original;
  }
});

function fakeDb(sentAt: string | null) {
  const notes: Array<Record<string, unknown>> = [];
  const from = (table: string) => {
    const eqs: Array<[string, unknown]> = [];
    const f: Record<string, unknown> = {};
    f.select = () => f;
    f.eq = (c: string, v: unknown) => (eqs.push([c, v]), f);
    f.gte = () => f;
    f.maybeSingle = async () => ({ data: { sent_to_signature_at: sentAt }, error: null });
    f.then = (res: (v: unknown) => unknown) => res({ data: notes.filter((n) => eqs.every(([c, v]) => n[c] === v)), error: null });
    f.insert = async (row: Record<string, unknown>) => {
      if (table === "contract_notes") notes.push(row);
      return { error: null };
    };
    return f;
  };
  return { db: { from } as never, notes };
}

test("linha do tempo: nota 'no CertOne (n de N)', autor CertOne e idempotente", async () => {
  const { db, notes } = fakeDb("2026-11-07T01:39:44+00:00");
  const contract = {
    id: "c1",
    parties: [{ email: "a@x.test" }, { email: "b@x.test" }, { email: "c@x.test" }, { email: "d@x.test" }],
  };
  const ev = { name: "Parte Teste", email: "b@x.test", signedAt: "2026-11-07T02:10:33+00:00" };
  assert.equal(await recordSignatureNote(db, contract, ev, "CertOne"), "criada");
  assert.equal(notes[0].content, "Parte Teste assinou digitalmente no CertOne (1 de 4).");
  assert.equal(notes[0].author_name, "CertOne");
  assert.equal(await recordSignatureNote(db, contract, ev, "CertOne"), "ja_registrada");
  assert.equal(notes.length, 1);
});

test("sync: contrato em rascunho ou cancelado com documento concluído não muda nem ganha notas", async () => {
  const { syncCertOneContract } = await import("../../lib/certone-signature-sync");
  const original = globalThis.fetch;
  let chamouApi = false;
  globalThis.fetch = (async () => {
    chamouApi = true;
    return new Response(JSON.stringify({ status: "Concluded", isConcluded: true, flowActions: [] }), { status: 200 });
  }) as typeof fetch;
  process.env.CERTONE_API_KEY = "chave-de-teste";
  try {
    for (const status of ["rascunho", "cancelado", "assinado"]) {
      const { db, notes } = fakeDb(null);
      const r = await syncCertOneContract(db, { id: "c1", status_signature: status, parties: [] }, DOC_ID);
      assert.equal(r.ok, false);
      assert.equal(notes.length, 0);
    }
    assert.equal(chamouApi, false, "nem deve consultar a CertOne");
  } finally {
    globalThis.fetch = original;
  }
});
