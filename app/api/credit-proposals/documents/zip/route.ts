import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { ZipArchive } from "archiver";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_BUCKET = "credit-documents";
const GOVERNED_BUCKET = "v3-docs-publico";

function resolveBucket(doc: { storage_path?: string; bucket?: string }): string {
  if (doc.bucket) return doc.bucket;
  if (doc.storage_path?.startsWith("Credito/") || doc.storage_path?.startsWith("MA/") || doc.storage_path?.startsWith("Administracao/")) return GOVERNED_BUCKET;
  return DEFAULT_BUCKET;
}

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getAuthedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };
  const { data: profile } = await supabase.from("profiles").select("id, full_name, role").eq("id", user.id).single();
  return { user, profile };
}

const READ_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO"] as const;

type DocEntry = { doc_id: string; file_name: string; storage_path: string; uploaded_at: string; uploaded_by: string };
type MetadataDoc = { label?: string; name?: string; url?: string };

// Evita colisão de nomes dentro do zip (dois arquivos com o mesmo file_name,
// ex: dois uploads de "RG.pdf" pro mesmo doc_id) sem mexer no nome quando
// não precisa.
function uniqueZipName(desired: string, used: Set<string>): string {
  const safe = desired.replace(/[\\/]/g, "_").trim() || "documento";
  if (!used.has(safe)) { used.add(safe); return safe; }
  const dot = safe.lastIndexOf(".");
  const base = dot > 0 ? safe.slice(0, dot) : safe;
  const ext = dot > 0 ? safe.slice(dot) : "";
  let i = 2;
  let candidate = `${base} (${i})${ext}`;
  while (used.has(candidate)) { i++; candidate = `${base} (${i})${ext}`; }
  used.add(candidate);
  return candidate;
}

// GET — baixa todos os documentos de uma proposta compactados num único .zip
// (upload livre + checklist, que compartilham a coluna documents; mais os
// anexados pelo cliente via link público de captação, em metadata.documentos).
// Gera tudo em memória (o volume de uma proposta de crédito é sempre
// pequeno — poucos PDFs/imagens — não precisa de streaming).
export async function GET(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const proposalId = searchParams.get("proposal_id");
  if (!proposalId) return NextResponse.json({ error: "proposal_id obrigatório" }, { status: 400 });

  const svc = serviceClient();
  const { data: proposal } = await svc
    .from("credit_desk_proposals")
    .select("id, code, partner_id, documents, metadata")
    .eq("id", proposalId)
    .single();

  if (!proposal) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });

  const isReader = READ_ROLES.includes(profile?.role as typeof READ_ROLES[number]);
  if (!isReader && proposal.partner_id !== user.id) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const docs: DocEntry[] = Array.isArray(proposal.documents) ? proposal.documents : [];
  const metadataDocs: MetadataDoc[] = Array.isArray((proposal.metadata as { documentos?: MetadataDoc[] } | null)?.documentos)
    ? (proposal.metadata as { documentos: MetadataDoc[] }).documentos
    : [];

  if (docs.length === 0 && metadataDocs.length === 0) {
    return NextResponse.json({ error: "Nenhum documento enviado ainda." }, { status: 404 });
  }

  const archive = new ZipArchive({ zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  archive.on("data", (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<void>((resolve, reject) => {
    archive.on("end", () => resolve());
    archive.on("error", (err: Error) => reject(err));
  });

  const usedNames = new Set<string>();
  let anyAdded = false;

  for (const doc of docs) {
    const bucket = resolveBucket(doc);
    const { data, error } = await svc.storage.from(bucket).download(doc.storage_path);
    if (error || !data) continue; // arquivo pode ter sido removido do storage manualmente -- não derruba o zip inteiro
    const buffer = Buffer.from(await data.arrayBuffer());
    archive.append(buffer, { name: uniqueZipName(doc.file_name, usedNames) });
    anyAdded = true;
  }

  for (const doc of metadataDocs) {
    if (!doc.url) continue;
    try {
      const res = await fetch(doc.url);
      if (!res.ok) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      archive.append(buffer, { name: uniqueZipName(doc.name || doc.label || "documento", usedNames) });
      anyAdded = true;
    } catch {
      // link externo fora do ar ou expirado -- pula, não derruba o zip inteiro
    }
  }

  if (!anyAdded) {
    return NextResponse.json({ error: "Não foi possível baixar nenhum documento (arquivos indisponíveis)." }, { status: 502 });
  }

  archive.finalize();
  await finished;
  const zipBuffer = Buffer.concat(chunks);

  const safeCode = String(proposal.code ?? proposalId).replace(/[^a-zA-Z0-9._-]/g, "_");
  return new NextResponse(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeCode}-documentos.zip"`,
      "Content-Length": String(zipBuffer.length),
    },
  });
}
