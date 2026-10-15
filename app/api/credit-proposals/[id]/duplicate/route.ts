import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { notifyByRoles } from "@/lib/notify";
import { issueCreditCode } from "@/lib/v3-codes";
import { resolveClient } from "@/lib/v3-clients";

// Duplicar proposta para outra linha (14/10/2026, pedido do Hamilton): a Mesa
// Operacional abre uma proposta nova, na linha escolhida, aproveitando o
// cadastro do cliente e os documentos já enviados. Os arquivos são COPIADOS no
// storage (caminho próprio da nova proposta) — excluir um documento numa das
// propostas nunca apaga o da outra. O OCR já validado vem junto (chaves
// remapeadas pro novo caminho). Etapa, mandato, NDA, checklist confirmado,
// comissões e histórico NÃO vêm: a nova proposta nasce em RECEBIDO.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;
const DEFAULT_BUCKET = "credit-documents";
const GOVERNED_BUCKET = "v3-docs-publico";

function resolveBucket(doc: { storage_path?: string; bucket?: string }): string {
  if (doc.bucket) return doc.bucket;
  if (doc.storage_path?.startsWith("Credito/") || doc.storage_path?.startsWith("MA/") || doc.storage_path?.startsWith("Administracao/")) return GOVERNED_BUCKET;
  return DEFAULT_BUCKET;
}

// Chaves do metadata que pertencem ao andamento da proposta original, não ao cliente.
const META_NAO_COPIAR = [
  "stage_history", "stage_changed_at", "crm_pending_review", "sla_override",
  "docs_checklist_confirmed_at", "docs_checklist_confirmed_by", "docs_checklist_confirmed_by_name",
  "mandato_envios", "recursos_liberados", "commissions_generated", "analise_gate_override", "ai_analysis",
  "lembretes_enviados", "pendencias_ocr", "duplicada_de",
];

const bodySchema = z.object({
  credit_line:     z.string().min(1, "Escolha a linha").max(100),
  current_level:   z.enum(["NIVEL_1", "NIVEL_2", "NIVEL_3"]),
  requested_value: z.number().gt(0).optional(),
  copiar_documentos: z.boolean().optional(),
});

type DocEntry = { doc_id: string; file_name: string; storage_path: string; bucket?: string; [k: string]: unknown };
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: sourceId } = await ctx.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number])) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  const d = parsed.data;
  const copiarDocs = d.copiar_documentos !== false;

  const { data: src, error: srcErr } = await db
    .from("credit_desk_proposals")
    .select("id, code, client_name, client_cpf_cnpj, v3_client_id, requested_value, partner_id, metadata, documents, checklist")
    .eq("id", sourceId)
    .is("deleted_at", null)
    .single();
  if (srcErr || !src) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });

  const requestedValue = d.requested_value ?? Number(src.requested_value);
  if (d.current_level === "NIVEL_3" && requestedValue < 5_000_000) {
    return NextResponse.json({ error: "Nível 3 exige valor mínimo de R$ 5.000.000" }, { status: 400 });
  }

  const { data: linhaMatch } = await db.from("regras_linhas_credito").select("id").eq("nome", d.credit_line).maybeSingle();

  let code: string;
  try {
    code = (await issueCreditCode(linhaMatch?.id ?? null, undefined, db)).code;
  } catch (e) {
    return NextResponse.json({ error: `Falha ao emitir código da proposta: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
  }

  const srcMeta = ((src.metadata ?? {}) as Record<string, unknown>);
  const meta: Record<string, unknown> = { ...srcMeta };
  for (const k of META_NAO_COPIAR) delete meta[k];
  delete meta.ocr_resultados; // remapeado depois da cópia dos arquivos
  // Mesmo cliente: se a original já tinha a Análise de Crédito paga (ou liberada
  // por ADMIN), a nova herda a liberação do gate de avanço.
  const { data: paidOrder } = await db
    .from("partner_service_orders")
    .select("id")
    .eq("credit_desk_proposal_id", src.id)
    .eq("status", "PAID")
    .limit(1)
    .maybeSingle();
  if (paidOrder || srcMeta.analise_gate_override) {
    meta.analise_gate_override = {
      by: user.id,
      by_name: profile?.full_name ?? "Mesa Operacional",
      at: new Date().toISOString(),
      herdado_de: src.code,
    };
  }
  meta.duplicada_de = { id: src.id, code: src.code, em: new Date().toISOString(), por: profile?.full_name ?? null };

  const v3ClientId = src.v3_client_id
    ?? await resolveClient(src.client_cpf_cnpj, { legalName: src.client_name, vertical: "credito" }).catch(() => null);

  const { data: novo, error: insErr } = await db
    .from("credit_desk_proposals")
    .insert({
      code,
      title:           `${d.credit_line} — ${src.client_name}`,
      client_name:     src.client_name,
      client_cpf_cnpj: src.client_cpf_cnpj ?? null,
      v3_client_id:    v3ClientId,
      credit_line:     d.credit_line,
      credit_line_id:  linhaMatch?.id ?? null,
      requested_value: requestedValue,
      current_level:   d.current_level,
      status:          "PENDING",
      stage:           "RECEBIDO",
      partner_id:      src.partner_id ?? user.id,
      created_by:      user.id,
      metadata:        meta,
    })
    .select("id, code, title, client_name, credit_line, requested_value, current_level, status, stage, partner_id, metadata, created_at")
    .single();
  if (insErr || !novo) return NextResponse.json({ error: insErr?.message ?? "Erro ao criar proposta" }, { status: 500 });

  // Copia os arquivos para o caminho da nova proposta (best-effort por arquivo).
  const docs: DocEntry[] = copiarDocs && Array.isArray(src.documents) ? (src.documents as DocEntry[]) : [];
  const novosDocs: DocEntry[] = [];
  const caminhoNovo = new Map<string, string>();
  const falhas: string[] = [];
  const ownerId = src.partner_id ?? user.id;
  for (const doc of docs) {
    if (!doc?.storage_path) continue;
    const bucket = resolveBucket(doc);
    const base = doc.storage_path.split("/").pop() ?? `${doc.doc_id}_${Date.now()}`;
    const destino = bucket === DEFAULT_BUCKET
      ? `${ownerId}/${novo.id}/${base}`
      : `${doc.storage_path.split("/").slice(0, -1).join("/")}/dup_${novo.id}_${base}`;
    const { error: cpErr } = await db.storage.from(bucket).copy(doc.storage_path, destino);
    if (cpErr) { falhas.push(doc.file_name); continue; }
    caminhoNovo.set(doc.storage_path, destino);
    novosDocs.push({ ...doc, storage_path: destino, ...(doc.bucket ? { bucket: doc.bucket } : {}) });
  }

  // OCR: chaves "docId::fileKey" apontam pro storage_path — troca pelo caminho novo.
  const ocrSrc = (srcMeta.ocr_resultados ?? {}) as Record<string, unknown>;
  const ocrNovo: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ocrSrc)) {
    const sep = k.indexOf("::");
    if (sep < 0) continue;
    const novoPath = caminhoNovo.get(k.slice(sep + 2));
    if (novoPath) ocrNovo[`${k.slice(0, sep)}::${novoPath}`] = v;
  }

  const finalMeta = Object.keys(ocrNovo).length > 0 ? { ...meta, ocr_resultados: ocrNovo } : meta;
  const { error: upErr } = await db
    .from("credit_desk_proposals")
    .update({
      documents: novosDocs,
      checklist: copiarDocs ? (src.checklist ?? null) : null,
      metadata: finalMeta,
      updated_at: new Date().toISOString(),
    })
    .eq("id", novo.id);
  if (upErr) console.error("[credit-proposals duplicate] falha ao gravar documentos", upErr.message);

  const { error: folderError } = await db.rpc("create_deal_folder", {
    p_vertical: "Credito", p_deal_code: code, p_client_name: src.client_name, p_user_id: user.id,
  });
  if (folderError) console.error("[credit-proposals duplicate] falha ao criar pasta MPS", folderError.message);

  logAudit({
    userId: user.id, userName: profile?.full_name,
    action: "CREATE", entity: "credit_desk_proposals",
    entityId: novo.id,
    newData: { duplicada_de: src.code, code, credit_line: d.credit_line, documentos: novosDocs.length },
  });

  await Promise.allSettled([
    notifyByRoles(["ADMIN", "GESTAO", "MESA_OPERACIONAL"], {
      type: "proposal",
      title: `Nova Proposta — ${code}`,
      message: `Duplicada de ${src.code}: ${src.client_name} · ${d.credit_line} · ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(requestedValue)}`,
      action_url: "/mesa-operacional",
    }),
  ]);

  return NextResponse.json({
    ok: true,
    proposal: { ...novo, metadata: finalMeta },
    documentos_copiados: novosDocs.length,
    documentos_com_falha: falhas,
  });
}
