import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { exigirEnterprise } from "@/lib/enterprise-server";
import { MAX_USUARIOS } from "@/lib/enterprise";

// Usuários abaixo do master de um Enterprise (até MAX_USUARIOS). Só o master gerencia.
// GET   — lista os usuários
// POST  { nome, email, telefone?, percentual } — cria o acesso (role ENTERPRISE, enterprise_id =
//        master), senha temporária com troca obrigatória no 1º acesso, convite por e-mail
// PATCH { id, percentual?, ativo?, nome?, telefone? }

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.v3partners.com.br";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function percentualValido(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) / 100 : null;
}

export async function GET() {
  const auth = await exigirEnterprise({ somenteMaster: true });
  if (!auth.ok) return auth.res;
  const { data, error } = await auth.db
    .from("profiles")
    .select("id, full_name, email, phone, is_active, enterprise_repasse_percent, created_at")
    .eq("enterprise_id", auth.userId)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ usuarios: data ?? [], limite: MAX_USUARIOS });
}

export async function POST(req: NextRequest) {
  const auth = await exigirEnterprise({ somenteMaster: true });
  if (!auth.ok) return auth.res;
  const body = (await req.json().catch(() => ({}))) as { nome?: string; email?: string; telefone?: string; percentual?: number };
  const nome = body.nome?.trim().replace(/\s+/g, " ");
  const email = body.email?.trim().toLowerCase();
  const percentual = percentualValido(body.percentual ?? 0);
  if (!nome || nome.split(" ").length < 2) return NextResponse.json({ error: "Informe o nome completo." }, { status: 400 });
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  if (percentual == null) return NextResponse.json({ error: "Percentual deve ficar entre 0 e 100." }, { status: 400 });
  if (auth.ctx.usuariosIds.length >= MAX_USUARIOS) {
    return NextResponse.json({ error: `Limite de ${MAX_USUARIOS} usuários atingido.` }, { status: 422 });
  }

  const senha = `V3-${randomBytes(6).toString("base64url")}`;
  const { data: criado, error: errAuth } = await auth.db.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { full_name: nome },
    // Troca de senha no 1º acesso (layout da plataforma) e sem o aviso de contrato de parceria
    // da V3: o vínculo do usuário é com o Enterprise.
    app_metadata: { must_change_password: true, contract_signed: true },
  });
  if (errAuth || !criado?.user) {
    const msg = /already|registered|exists/i.test(errAuth?.message ?? "") ? "Já existe um acesso com este e-mail." : errAuth?.message ?? "Falha ao criar acesso";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { error: errPerfil } = await auth.db
    .from("profiles")
    .update({
      role: "ENTERPRISE",
      full_name: nome,
      phone: body.telefone?.trim() || null,
      enterprise_id: auth.userId,
      enterprise_repasse_percent: percentual,
      is_active: true,
    })
    .eq("id", criado.user.id);
  if (errPerfil) {
    await auth.db.auth.admin.deleteUser(criado.user.id).catch(() => {});
    return NextResponse.json({ error: `Falha ao vincular usuário: ${errPerfil.message}` }, { status: 500 });
  }

  // Convite com a marca do Enterprise (o envio troca o logo pela marca do destinatário).
  const marca = auth.ctx.marca?.nome ?? "V3 Partners";
  const quem = auth.nome ?? marca;
  const { enviarEmailHtml } = await import("@/lib/email");
  await enviarEmailHtml(
    email,
    `Seu acesso à plataforma ${marca}`,
    [
      `<!DOCTYPE html><html lang="pt-BR"><body style="margin:0;background:#09081A;font-family:'DM Sans',Arial,sans-serif;">`,
      `<div style="max-width:560px;margin:40px auto;background:#162744;border-radius:12px;border:1px solid #243A66;overflow:hidden;">`,
      `<div style="padding:24px 32px;background:#09081A;border-bottom:1px solid #243A66;">`,
      `<img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style="height:32px;display:block;"></div>`,
      `<div style="padding:32px;color:#9BAFC5;font-size:14px;line-height:1.7;">`,
      `<h2 style="margin:0 0 16px;color:#F0ECE4;font-size:19px;">Olá, ${esc(nome)}!</h2>`,
      `<p>${esc(quem)} criou seu acesso na plataforma <strong style="color:#E8C97A;">${esc(marca)}</strong>.</p>`,
      `<p style="margin:18px 0 6px;">E-mail: <strong style="color:#F0ECE4;">${esc(email)}</strong><br>Senha temporária: <strong style="color:#F0ECE4;">${senha}</strong></p>`,
      `<p>No primeiro acesso você vai criar a sua própria senha.</p>`,
      `<p style="margin-top:24px;"><a href="${APP_URL}/login" style="display:inline-block;background:#C9A84C;color:#09081A;text-decoration:none;padding:12px 26px;border-radius:8px;font-weight:700;">Acessar a plataforma →</a></p>`,
      `</div></div></body></html>`,
    ].join(""),
  );

  return NextResponse.json({ ok: true, id: criado.user.id, senha_temporaria: senha });
}

export async function PATCH(req: NextRequest) {
  const auth = await exigirEnterprise({ somenteMaster: true });
  if (!auth.ok) return auth.res;
  const body = (await req.json().catch(() => ({}))) as { id?: string; percentual?: number; ativo?: boolean; nome?: string; telefone?: string };
  if (!body.id || !auth.ctx.usuariosIds.includes(body.id)) {
    return NextResponse.json({ error: "Usuário não pertence a este Enterprise." }, { status: 404 });
  }
  const update: Record<string, unknown> = {};
  if (body.percentual !== undefined) {
    const p = percentualValido(body.percentual);
    if (p == null) return NextResponse.json({ error: "Percentual deve ficar entre 0 e 100." }, { status: 400 });
    update.enterprise_repasse_percent = p;
  }
  if (body.nome?.trim()) update.full_name = body.nome.trim();
  if (body.telefone !== undefined) update.phone = body.telefone?.trim() || null;
  if (body.ativo !== undefined) {
    update.is_active = Boolean(body.ativo);
    // Bloqueia/libera o login de verdade, não só a flag.
    await auth.db.auth.admin.updateUserById(body.id, { ban_duration: body.ativo ? "none" : "876000h" }).catch(() => {});
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nada para alterar." }, { status: 400 });
  const { error } = await auth.db.from("profiles").update(update).eq("id", body.id).eq("enterprise_id", auth.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
