import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Anexos da instituição (Mesa Operacional › Instituições): apresentação da
// instituição e SCR / autorização de consulta, com vários arquivos por campo. Ficam num bucket PRIVADO do
// Storage, em `<instituicao_id>/<tipo>/<timestamp>__<arquivo>`, sem coluna nova
// no banco: o tipo vem da pasta e o nome original vem do próprio arquivo.
// SCR/autorização contém dado de cliente, então só URL assinada de curta duração
// e só para os papéis internos abaixo. O upload vai direto do browser ao Storage
// (URL assinada) para não esbarrar no limite de ~4,5 MB de body da Vercel.
const INSTITUICAO_ANEXOS_BUCKET = "instituicoes-anexos";
const TIPOS = ["apresentacao", "scr_autorizacao"] as const;
type Tipo = (typeof TIPOS)[number];
interface AnexoItem {
  name: string; path: string; size: number | null; uploaded_at: string | null;
  url: string | null; download_url: string | null;
}

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_EXT = new Set(["pdf", "png", "jpg", "jpeg", "doc", "docx", "ppt", "pptx"]);
const SIGNED_URL_SECONDS = 60 * 10;
const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getRole(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await svc().from("profiles").select("role").eq("id", user.id).single();
    return (data?.role as string) ?? null;
  } catch {
    return null;
  }
}

function sanitizeAscii(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-120);
}

function isTipo(v: unknown): v is Tipo {
  return typeof v === "string" && (TIPOS as readonly string[]).includes(v);
}

async function ensureBucket() {
  const db = svc();
  const { data: buckets } = await db.storage.listBuckets();
  const existing = buckets?.find((b) => b.name === INSTITUICAO_ANEXOS_BUCKET);
  if (!existing) {
    const { error } = await db.storage.createBucket(INSTITUICAO_ANEXOS_BUCKET, { public: false, fileSizeLimit: MAX_BYTES });
    if (error) throw new Error(`Erro ao preparar armazenamento: ${error.message}`);
  } else if (existing.public) {
    await db.storage.updateBucket(INSTITUICAO_ANEXOS_BUCKET, { public: false, fileSizeLimit: MAX_BYTES });
  }
}

async function instituicaoExiste(id: string): Promise<boolean> {
  const { data } = await svc().from("instituicoes").select("id").eq("id", id).maybeSingle();
  return !!data;
}

async function listarArquivos(id: string, tipo: Tipo) {
  const { data } = await svc().storage
    .from(INSTITUICAO_ANEXOS_BUCKET)
    .list(`${id}/${tipo}`, { limit: 100, sortBy: { column: "name", order: "desc" } });
  return (data ?? []).filter((f) => f.name && f.id);
}

// GET — devolve todos os arquivos de cada tipo (mais recente primeiro), com URL
// assinada para abrir e outra para baixar com o nome original.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = await getRole();
  if (!ALLOWED_ROLES.includes(role ?? "")) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const { id } = await params;

  const storage = svc().storage.from(INSTITUICAO_ANEXOS_BUCKET);
  const result: Record<Tipo, AnexoItem[]> = { apresentacao: [], scr_autorizacao: [] };

  for (const tipo of TIPOS) {
    const arquivos = await listarArquivos(id, tipo); // nome começa com timestamp, ordenado desc
    result[tipo] = await Promise.all(arquivos.map(async (f) => {
      const path = `${id}/${tipo}/${f.name}`;
      const name = f.name.includes("__") ? f.name.split("__").slice(1).join("__") : f.name;
      const [view, download] = await Promise.all([
        storage.createSignedUrl(path, SIGNED_URL_SECONDS),
        storage.createSignedUrl(path, SIGNED_URL_SECONDS, { download: name }),
      ]);
      return {
        name,
        path,
        size: (f.metadata as { size?: number } | null)?.size ?? null,
        uploaded_at: f.created_at ?? null,
        url: view.data?.signedUrl ?? null,
        download_url: download.data?.signedUrl ?? null,
      };
    }));
  }

  return NextResponse.json({ anexos: result });
}

// POST { tipo, file_name } — gera a URL assinada de upload direto ao Storage.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = await getRole();
  if (!ALLOWED_ROLES.includes(role ?? "")) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  if (!isTipo(body.tipo)) return NextResponse.json({ error: "Tipo de anexo inválido" }, { status: 400 });
  const fileName = String(body.file_name ?? "");
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!fileName || !ALLOWED_EXT.has(ext)) {
    return NextResponse.json({ error: "Formato não permitido. Use PDF, imagem, Word ou PowerPoint." }, { status: 415 });
  }
  if (!(await instituicaoExiste(id))) return NextResponse.json({ error: "Instituição não encontrada" }, { status: 404 });

  try {
    await ensureBucket();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  const storagePath = `${id}/${body.tipo}/${Date.now()}__${sanitizeAscii(fileName)}`;
  const { data, error } = await svc().storage.from(INSTITUICAO_ANEXOS_BUCKET).createSignedUploadUrl(storagePath);
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Erro ao gerar URL de upload" }, { status: 500 });

  return NextResponse.json({ token: data.token, storagePath, bucket: INSTITUICAO_ANEXOS_BUCKET });
}

// DELETE ?tipo=&path= — remove um arquivo específico do anexo.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const role = await getRole();
  if (!ALLOWED_ROLES.includes(role ?? "")) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  const { id } = await params;

  const url = new URL(req.url);
  const tipo = url.searchParams.get("tipo");
  const path = url.searchParams.get("path") ?? "";
  if (!isTipo(tipo) || !path.startsWith(`${id}/${tipo}/`) || path.includes("..")) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }

  const { error } = await svc().storage.from(INSTITUICAO_ANEXOS_BUCKET).remove([path]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
