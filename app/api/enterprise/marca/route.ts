import { NextRequest, NextResponse } from "next/server";
import { exigirEnterprise } from "@/lib/enterprise-server";

// Marca do white label (nome + logo) do Enterprise. Só o master altera; usuários herdam.
// GET  — marca atual
// POST multipart { nome?, logo? (png/jpg/webp/svg, até 2MB), remover_logo? }

const TIPOS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };
const MAX_BYTES = 2 * 1024 * 1024;

export async function GET() {
  const auth = await exigirEnterprise();
  if (!auth.ok) return auth.res;
  return NextResponse.json({ marca: auth.ctx.marca, ehMaster: auth.ctx.ehMaster });
}

export async function POST(req: NextRequest) {
  const auth = await exigirEnterprise({ somenteMaster: true });
  if (!auth.ok) return auth.res;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  const nome = form.get("nome");
  if (typeof nome === "string") update.white_label_nome = nome.trim().slice(0, 80) || null;

  if (form.get("remover_logo") === "1") update.white_label_logo_url = null;

  const logo = form.get("logo");
  if (logo instanceof File && logo.size > 0) {
    const ext = TIPOS[logo.type];
    if (!ext) return NextResponse.json({ error: "Logo deve ser PNG, JPG, WEBP ou SVG." }, { status: 415 });
    if (logo.size > MAX_BYTES) return NextResponse.json({ error: "Logo maior que 2MB." }, { status: 413 });
    const caminho = `${auth.userId}/logo-${Date.now()}.${ext}`;
    const { error: upErr } = await auth.db.storage
      .from("white-label")
      .upload(caminho, Buffer.from(await logo.arrayBuffer()), { contentType: logo.type, upsert: false });
    if (upErr) return NextResponse.json({ error: `Falha ao salvar o logo: ${upErr.message}` }, { status: 500 });
    update.white_label_logo_url = auth.db.storage.from("white-label").getPublicUrl(caminho).data.publicUrl;
  }

  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nada para alterar." }, { status: 400 });
  const { data, error } = await auth.db
    .from("profiles")
    .update(update)
    .eq("id", auth.userId)
    .select("full_name, white_label_nome, white_label_logo_url")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    ok: true,
    marca: data.white_label_nome || data.white_label_logo_url
      ? { nome: data.white_label_nome ?? data.full_name ?? "Enterprise", logoUrl: data.white_label_logo_url }
      : null,
  });
}
