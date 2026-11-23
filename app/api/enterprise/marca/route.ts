import { NextRequest, NextResponse } from "next/server";
import { exigirEnterprise, logAntesDaEscritaAdmin, logFalhaAdmin } from "@/lib/enterprise-server";

// Marca do white label (nome + logo) do Enterprise. Só o master altera; usuários herdam.
// Modo ADMIN (?master=<id>, BRIEF 2026-11-19_admin-configura-white-label-enterprise.md): o ADMIN
// altera em nome do master, com log obrigatório antes da escrita.
// GET  — marca atual
// POST multipart { nome?, logo? (png/jpg/webp/svg, até 2MB), remover_logo? }

const TIPOS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };
const MAX_BYTES = 2 * 1024 * 1024;

export async function GET(req: NextRequest) {
  const auth = await exigirEnterprise({ req, permitirAdmin: true });
  if (!auth.ok) return auth.res;
  return NextResponse.json({ marca: auth.ctx.marca, ehMaster: auth.ctx.ehMaster });
}

export async function POST(req: NextRequest) {
  const auth = await exigirEnterprise({ somenteMaster: true, req, permitirAdmin: true });
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

  const removerLogo = form.get("remover_logo") === "1";
  if (removerLogo) update.white_label_logo_url = null;

  const logo = form.get("logo");
  const temLogo = logo instanceof File && logo.size > 0;
  if (temLogo) {
    if (!TIPOS[logo.type]) return NextResponse.json({ error: "Logo deve ser PNG, JPG, WEBP ou SVG." }, { status: 415 });
    if (logo.size > MAX_BYTES) return NextResponse.json({ error: "Logo maior que 2MB." }, { status: 413 });
  }
  if (Object.keys(update).length === 0 && !temLogo) return NextResponse.json({ error: "Nada para alterar." }, { status: 400 });

  // Modo ADMIN: log obrigatório antes de qualquer escrita (inclusive o upload).
  const { data: antes } = await auth.db.from("profiles").select("white_label_nome, white_label_logo_url").eq("id", auth.userId).single();
  const dadosLog = {
    action: "UPDATE" as const,
    oldData: { white_label_nome: antes?.white_label_nome ?? null, white_label_logo_url: antes?.white_label_logo_url ?? null },
    newData: {
      ...("white_label_nome" in update ? { white_label_nome: update.white_label_nome } : {}),
      ...(removerLogo ? { white_label_logo_url: null } : {}),
      ...(temLogo ? { logo_novo: (logo as File).name } : {}),
    },
  };
  const bloqueio = await logAntesDaEscritaAdmin(auth, req, dadosLog);
  if (bloqueio) return bloqueio;

  if (temLogo) {
    const f = logo as File;
    const caminho = `${auth.userId}/logo-${Date.now()}.${TIPOS[f.type]}`;
    const { error: upErr } = await auth.db.storage
      .from("white-label")
      .upload(caminho, Buffer.from(await f.arrayBuffer()), { contentType: f.type, upsert: false });
    if (upErr) {
      await logFalhaAdmin(auth, req, dadosLog, upErr.message);
      return NextResponse.json({ error: `Falha ao salvar o logo: ${upErr.message}` }, { status: 500 });
    }
    update.white_label_logo_url = auth.db.storage.from("white-label").getPublicUrl(caminho).data.publicUrl;
  }

  const { data, error } = await auth.db
    .from("profiles")
    .update(update)
    .eq("id", auth.userId)
    .select("full_name, white_label_nome, white_label_logo_url")
    .single();
  if (error) {
    await logFalhaAdmin(auth, req, dadosLog, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    marca: data.white_label_nome || data.white_label_logo_url
      ? { nome: data.white_label_nome ?? data.full_name ?? "Enterprise", logoUrl: data.white_label_logo_url }
      : null,
  });
}
