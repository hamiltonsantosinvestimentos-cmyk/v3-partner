import { NextRequest, NextResponse } from "next/server";
import { exigirEnterprise, logAntesDaEscritaAdmin, logFalhaAdmin } from "@/lib/enterprise-server";
import { getClientIp, logAuditStrict } from "@/lib/audit";
import { temaDoMaster } from "@/lib/enterprise";
import { validarTema, verificarContraste, prefixoBucketWhiteLabel, type TemaEnterprise } from "@/lib/enterprise-tema";
import { conferirIcone, conferirLogoClaro } from "@/lib/enterprise-arquivos";
import { cnpjCanonico, normalizarRazaoSocial } from "@/lib/enterprise-identidade";
import { formatCNPJ } from "@/lib/validators/cpf-cnpj";

// Razão social e CNPJ (BRIEF 2026-11-23 identidade fase 1). Leitura tolerante: antes da migration as colunas não existem.
async function identidadeJuridica(db: import("@supabase/supabase-js").SupabaseClient, masterId: string): Promise<{ razao_social: string | null; cnpj: string | null }> {
  try {
    const { data, error } = await db.from("profiles").select("white_label_razao_social, white_label_cnpj").eq("id", masterId).maybeSingle();
    if (error || !data) return { razao_social: null, cnpj: null };
    const d = data as { white_label_razao_social?: string | null; white_label_cnpj?: string | null };
    return { razao_social: d.white_label_razao_social ?? null, cnpj: d.white_label_cnpj ?? null };
  } catch {
    return { razao_social: null, cnpj: null };
  }
}

// Marca do white label do Enterprise. Só o master altera; usuários herdam.
// Modo ADMIN (?master=<id>, BRIEF 2026-11-19_admin-configura-white-label-enterprise.md): o ADMIN
// altera em nome do master, com log obrigatório antes da escrita.
// Tema visual (BRIEF 2026-11-21_tema-visual-enterprise-manual-de-marca.md): cores, logo para fundo
// claro e ícone da aba em profiles.white_label_tema; toda gravação é auditada antes da escrita.
// GET  — marca atual + tema
// POST multipart { nome?, logo?, remover_logo?, cor_principal?, cor_acento?, logo_claro?, icone?,
//                  remover_logo_claro?, remover_icone?, remover_tema? }

const TIPOS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };
const MAX_BYTES = 2 * 1024 * 1024;
const HEX = /^#[0-9a-fA-F]{6}$/;

export async function GET(req: NextRequest) {
  const auth = await exigirEnterprise({ req, permitirAdmin: true });
  if (!auth.ok) return auth.res;
  const juridica = await identidadeJuridica(auth.db, auth.ctx.masterId);
  return NextResponse.json({
    marca: auth.ctx.marca, ehMaster: auth.ctx.ehMaster, tema: auth.ctx.tema ?? null,
    razao_social: juridica.razao_social,
    cnpj: juridica.cnpj ? formatCNPJ(juridica.cnpj) : null,
  });
}

/** Caminho no bucket a partir da URL pública (null se não for do nosso bucket). */
function caminhoNoBucket(url: string | null | undefined): string | null {
  const prefixo = prefixoBucketWhiteLabel(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!url || !prefixo || !url.startsWith(prefixo)) return null;
  return decodeURIComponent(url.slice(prefixo.length));
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

  // ── Nome e logo (fundo escuro) ────────────────────────────────────────────
  const update: Record<string, unknown> = {};
  const nome = form.get("nome");
  if (typeof nome === "string") update.white_label_nome = nome.trim().slice(0, 80) || null;

  // ── Razão social e CNPJ: validados aqui, no servidor; gravados no formato canônico ──
  const razao = form.get("razao_social");
  if (typeof razao === "string") update.white_label_razao_social = normalizarRazaoSocial(razao);
  const cnpjForm = form.get("cnpj");
  if (typeof cnpjForm === "string") {
    if (!cnpjForm.trim()) update.white_label_cnpj = null;
    else {
      const c = cnpjCanonico(cnpjForm);
      if (!c) return NextResponse.json({ error: "CNPJ inválido." }, { status: 400 });
      update.white_label_cnpj = c;
    }
  }

  const removerLogo = form.get("remover_logo") === "1";
  if (removerLogo) update.white_label_logo_url = null;

  const logo = form.get("logo");
  const temLogo = logo instanceof File && logo.size > 0;
  if (temLogo) {
    if (!TIPOS[logo.type]) return NextResponse.json({ error: "Logo deve ser PNG, JPG, WEBP ou SVG." }, { status: 415 });
    if (logo.size > MAX_BYTES) return NextResponse.json({ error: "Logo maior que 2MB." }, { status: 413 });
  }

  // ── Tema ──────────────────────────────────────────────────────────────────
  const temaAtual = await temaDoMaster(auth.db, auth.userId);
  const corP = form.get("cor_principal");
  const corA = form.get("cor_acento");
  const removerTema = form.get("remover_tema") === "1";
  const removerLogoClaro = form.get("remover_logo_claro") === "1";
  const removerIcone = form.get("remover_icone") === "1";
  const logoClaro = form.get("logo_claro");
  const icone = form.get("icone");
  const temLogoClaro = logoClaro instanceof File && logoClaro.size > 0;
  const temIcone = icone instanceof File && icone.size > 0;
  const mexeNoTema = removerTema || removerLogoClaro || removerIcone || temLogoClaro || temIcone || typeof corP === "string" || typeof corA === "string";

  let bytesLogoClaro: { buf: Buffer; ext: string; mime: string } | null = null;
  let bytesIcone: { buf: Buffer; ext: string; mime: string } | null = null;
  let novoTema: TemaEnterprise | null = temaAtual;

  if (mexeNoTema && !removerTema) {
    const principal = typeof corP === "string" && corP ? corP.trim() : temaAtual?.cor_principal;
    const acento = typeof corA === "string" && corA ? corA.trim() : temaAtual?.cor_acento;
    if (!principal || !acento || !HEX.test(principal) || !HEX.test(acento)) {
      return NextResponse.json({ error: "Informe a cor principal e a cor de acento no formato #RRGGBB." }, { status: 422 });
    }
    const falhas = verificarContraste({ cor_principal: principal, cor_acento: acento });
    if (falhas.length) {
      return NextResponse.json({
        error: "Essas cores não têm contraste suficiente para leitura. Escolha um tom mais escuro para a cor principal ou mais claro para o acento.",
        falhas,
      }, { status: 422 });
    }
    if (temLogoClaro) {
      const buf = Buffer.from(await (logoClaro as File).arrayBuffer());
      const r = conferirLogoClaro(buf);
      if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 415 });
      bytesLogoClaro = { buf, ext: r.ext, mime: r.mime };
    }
    if (temIcone) {
      const buf = Buffer.from(await (icone as File).arrayBuffer());
      const r = conferirIcone(buf);
      if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 415 });
      bytesIcone = { buf, ext: r.ext, mime: r.mime };
    }
    novoTema = {
      cor_principal: principal.toUpperCase(),
      cor_acento: acento.toUpperCase(),
      logo_claro_url: removerLogoClaro ? null : (temaAtual?.logo_claro_url ?? null),
      icone_url: removerIcone ? null : (temaAtual?.icone_url ?? null),
    };
  }
  if (removerTema) novoTema = null;

  if (Object.keys(update).length === 0 && !temLogo && !mexeNoTema) {
    return NextResponse.json({ error: "Nada para alterar." }, { status: 400 });
  }

  // ── Auditoria antes de qualquer escrita (inclusive upload) ────────────────
  const { data: antes } = await auth.db.from("profiles").select("white_label_nome, white_label_logo_url").eq("id", auth.userId).single();
  const juridicaAntes = await identidadeJuridica(auth.db, auth.userId);
  const dadosLog = {
    action: "UPDATE" as const,
    oldData: {
      white_label_nome: antes?.white_label_nome ?? null,
      white_label_logo_url: antes?.white_label_logo_url ?? null,
      white_label_tema: temaAtual,
      white_label_razao_social: juridicaAntes.razao_social,
      white_label_cnpj: juridicaAntes.cnpj,
    },
    newData: {
      ...("white_label_nome" in update ? { white_label_nome: update.white_label_nome } : {}),
      ...("white_label_razao_social" in update ? { white_label_razao_social: update.white_label_razao_social } : {}),
      ...("white_label_cnpj" in update ? { white_label_cnpj: update.white_label_cnpj } : {}),
      ...(removerLogo ? { white_label_logo_url: null } : {}),
      ...(temLogo ? { logo_novo: (logo as File).name } : {}),
      ...(mexeNoTema ? { white_label_tema: novoTema, logo_claro_novo: temLogoClaro ? (logoClaro as File).name : undefined, icone_novo: temIcone ? (icone as File).name : undefined } : {}),
    },
  };
  if (auth.admin) {
    const bloqueio = await logAntesDaEscritaAdmin(auth, req, dadosLog);
    if (bloqueio) return bloqueio;
  } else {
    try {
      await logAuditStrict({
        userId: auth.userId,
        userName: auth.nome,
        action: "UPDATE",
        entity: "profiles",
        entityId: auth.userId,
        oldData: dadosLog.oldData,
        newData: dadosLog.newData,
        ipAddress: getClientIp(req),
      });
    } catch {
      return NextResponse.json({ error: "Não foi possível registrar a alteração. Nada foi salvo; tente de novo." }, { status: 500 });
    }
  }

  // ── Uploads ───────────────────────────────────────────────────────────────
  const subir = async (buf: Buffer, nomeBase: string, ext: string, mime: string): Promise<string | NextResponse> => {
    const caminho = `${auth.userId}/${nomeBase}-${Date.now()}.${ext}`;
    const { error } = await auth.db.storage.from("white-label").upload(caminho, buf, { contentType: mime, upsert: false });
    if (error) {
      await logFalhaAdmin(auth, req, dadosLog, error.message);
      return NextResponse.json({ error: `Falha ao salvar o arquivo: ${error.message}` }, { status: 500 });
    }
    return auth.db.storage.from("white-label").getPublicUrl(caminho).data.publicUrl;
  };

  if (temLogo) {
    const f = logo as File;
    const r = await subir(Buffer.from(await f.arrayBuffer()), "logo", TIPOS[f.type], f.type);
    if (r instanceof NextResponse) return r;
    update.white_label_logo_url = r;
  }
  if (novoTema && bytesLogoClaro) {
    const r = await subir(bytesLogoClaro.buf, "logo-claro", bytesLogoClaro.ext, bytesLogoClaro.mime);
    if (r instanceof NextResponse) return r;
    novoTema.logo_claro_url = r;
  }
  if (novoTema && bytesIcone) {
    const r = await subir(bytesIcone.buf, "icone", bytesIcone.ext, bytesIcone.mime);
    if (r instanceof NextResponse) return r;
    novoTema.icone_url = r;
  }
  if (mexeNoTema) {
    // Revalida o que vai para o banco (mesmo validador da leitura).
    update.white_label_tema = novoTema ? validarTema(novoTema, prefixoBucketWhiteLabel(process.env.NEXT_PUBLIC_SUPABASE_URL)) : null;
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

  // Arquivos que saíram do tema são apagados do bucket público (senão a URL continuaria aberta).
  const apagar = [
    temaAtual?.logo_claro_url !== (novoTema?.logo_claro_url ?? null) ? caminhoNoBucket(temaAtual?.logo_claro_url) : null,
    temaAtual?.icone_url !== (novoTema?.icone_url ?? null) ? caminhoNoBucket(temaAtual?.icone_url) : null,
  ].filter((c): c is string => !!c);
  if (apagar.length) {
    try { await auth.db.storage.from("white-label").remove(apagar); } catch { /* arquivo órfão não bloqueia a gravação */ }
  }

  return NextResponse.json({
    ok: true,
    marca: data.white_label_nome || data.white_label_logo_url
      ? { nome: data.white_label_nome ?? data.full_name ?? "Enterprise", logoUrl: data.white_label_logo_url }
      : null,
    tema: mexeNoTema ? (update.white_label_tema ?? null) : temaAtual,
  });
}
