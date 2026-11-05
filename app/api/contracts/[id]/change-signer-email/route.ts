import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { getProvider } from "@/lib/esignature";
import { getClickSignDocumentStatus, listClickSignSignEvents } from "@/lib/esignature/clicksign-provider";
import { cancelEnvelopeInDb, formatBrDateTime } from "@/lib/contract-envelope-cancel";
import { checkSendGates, sendContractToSignature } from "@/lib/contract-send";
import {
  CHANGE_CONTRACT_COLUMNS, OPEN_BATCH_ERROR, countEmailMentions, editableParties, executeSignerEmailChange,
  qualificationBatchState, resolveMode, type ChangeContract, type ChangeDeps,
} from "@/lib/signer-email-change";

// "Alterar e-mail e reenviar" (BRIEF docs/briefs/2026-11-05_alterar-email-reenviar-contrato.md).
// Só ADMIN (decisão do Hamilton, 05/11/2026). Service role no servidor, depois de
// conferir a sessão e o papel, no mesmo padrão de cancel-envelope e send.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function requireAdmin(): Promise<{ status: 401 | 403 } | { userId: string; name: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: 401 };
  const { data: profile } = await svc().from("profiles").select("full_name, role").eq("id", user.id).single();
  if (!profile || profile.role !== "ADMIN") return { status: 403 };
  return { userId: user.id, name: (profile.full_name as string | null) ?? "Usuário" };
}

// GET: o que o modal mostra antes de confirmar. Somente leitura.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireAdmin();
  if ("status" in caller)
    return NextResponse.json({ error: caller.status === 401 ? "Não autorizado" : "Só o ADMIN pode alterar o e-mail do signatário." }, { status: caller.status });

  const { id } = await params;
  const db = svc();
  const { data: row } = await db.from("operation_contracts").select(CHANGE_CONTRACT_COLUMNS).eq("id", id).maybeSingle();
  if (!row) return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 });
  const contract = row as unknown as ChangeContract;

  const m = resolveMode(contract);
  if ("error" in m) return NextResponse.json({ error: m.error }, { status: m.status });

  let blocked: string | null = null;
  try {
    if ((await qualificationBatchState(db, id)).open) blocked = OPEN_BATCH_ERROR;
  } catch (e) {
    blocked = `Não foi possível conferir a qualificação de partes: ${(e as Error).message}`;
  }

  let signed: Array<{ name: string; email: string; signed_at: string | null; signed_at_br: string }> = [];
  if (m.mode === "envio") {
    const sig = await listClickSignSignEvents(contract.external_envelope_id as string);
    if (!sig.ok) return NextResponse.json({ error: `Falha ao consultar as assinaturas na ClickSign: ${sig.error}` }, { status: 502 });
    signed = sig.events.map((e) => ({ name: e.name, email: e.email, signed_at: e.signedAt, signed_at_br: formatBrDateTime(e.signedAt) }));
  }

  const parties = (contract.parties ?? []).map((p) => ({ name: p.name ?? null, email: p.email ?? null }));
  return NextResponse.json({
    ok: true,
    mode: m.mode,
    contract_code: contract.contract_code,
    contract_title: contract.contract_title,
    status: contract.status_signature,
    blocked,
    editable: editableParties(contract.parties).map((p) => ({
      ...p,
      mentions_in_text: countEmailMentions(contract.rendered_html, p.email),
    })),
    all_parties: parties,
    signed,
  });
}

// POST: executa a troca (e o reenvio, se o contrato estava enviado).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireAdmin();
  if ("status" in caller)
    return NextResponse.json({ error: caller.status === 401 ? "Não autorizado" : "Só o ADMIN pode alterar o e-mail do signatário." }, { status: caller.status });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const deps: ChangeDeps = {
    db: svc(),
    listSignEvents: listClickSignSignEvents,
    getDocumentStatus: getClickSignDocumentStatus,
    cancelAtProvider: async (c, envelopeId, documentId) =>
      (await getProvider({ contractId: c.id, provider: c.esignature_provider ?? undefined })).cancel(envelopeId, documentId),
    cancelInDb: cancelEnvelopeInDb,
    checkGates: (db, c) => checkSendGates(db, c),
    send: sendContractToSignature,
    batchState: qualificationBatchState,
    formatDateTime: formatBrDateTime,
    now: () => new Date(),
    uuid: () => randomUUID(),
  };

  const r = await executeSignerEmailChange(deps, caller, id, body ?? {});
  return NextResponse.json(r.body, { status: r.status });
}
