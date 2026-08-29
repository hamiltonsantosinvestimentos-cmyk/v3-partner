import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { getMe, setTelegramWebhook, deleteTelegramWebhook } from "@/lib/telegram-dm";
import { encryptSecret, decryptSecret } from "@/lib/crypto/secret";

const PARTNER_ROLES = ["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.v3partners.com.br";
}

async function authGuard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!PARTNER_ROLES.includes(profile?.role as typeof PARTNER_ROLES[number])) return null;
  return { user };
}

// GET — status da conexão do bot Telegram do partner.
export async function GET() {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: conexao } = await svc()
    .from("partner_sdr_connections")
    .select("addon_ativo, telegram_status, telegram_bot_username")
    .eq("partner_id", auth.user.id)
    .maybeSingle();

  if (!conexao?.addon_ativo) return NextResponse.json({ error: "Add-on não contratado" }, { status: 403 });

  return NextResponse.json({
    status: conexao.telegram_status ?? "desconectado",
    bot_username: conexao.telegram_bot_username ?? null,
  });
}

// POST { bot_token } — conecta o bot do partner: valida o token (getMe),
// gera um segredo de webhook próprio e registra o webhook na Telegram
// apontando pra rota por partner (/api/partner/sdr/telegram-webhook/:id).
export async function POST(req: NextRequest) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: conexao } = await svc()
    .from("partner_sdr_connections")
    .select("addon_ativo")
    .eq("partner_id", auth.user.id)
    .maybeSingle();
  if (!conexao?.addon_ativo) return NextResponse.json({ error: "Add-on não contratado" }, { status: 403 });

  const { bot_token } = await req.json() as { bot_token?: string };
  const token = bot_token?.trim();
  if (!token) return NextResponse.json({ error: "bot_token obrigatório" }, { status: 400 });

  try {
    const bot = await getMe(token); // valida o token — lança se for inválido
    const webhookSecret = randomBytes(24).toString("hex");
    const webhookUrl = `${siteUrl()}/api/partner/sdr/telegram-webhook/${auth.user.id}`;
    await setTelegramWebhook(webhookUrl, webhookSecret, token);

    await svc().from("partner_sdr_connections").upsert({
      partner_id: auth.user.id,
      telegram_bot_token_encrypted: encryptSecret(token),
      telegram_bot_username: bot.username,
      telegram_webhook_secret: webhookSecret,
      telegram_status: "conectado",
      updated_at: new Date().toISOString(),
    }, { onConflict: "partner_id" });

    return NextResponse.json({ ok: true, bot_username: bot.username });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao conectar bot do Telegram" }, { status: 500 });
  }
}

// DELETE — desconecta o bot (remove o webhook na Telegram e limpa os campos).
export async function DELETE() {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: conexao } = await db
    .from("partner_sdr_connections")
    .select("telegram_bot_token_encrypted")
    .eq("partner_id", auth.user.id)
    .maybeSingle();

  if (conexao?.telegram_bot_token_encrypted) {
    try {
      await deleteTelegramWebhook(decryptSecret(conexao.telegram_bot_token_encrypted));
    } catch (e) {
      console.error("[Partner Telegram] Falha ao remover webhook na Telegram (seguindo com a desconexão local):", e);
    }
  }

  await db.from("partner_sdr_connections").update({
    telegram_bot_token_encrypted: null,
    telegram_bot_username: null,
    telegram_webhook_secret: null,
    telegram_status: "desconectado",
    updated_at: new Date().toISOString(),
  }).eq("partner_id", auth.user.id);

  return NextResponse.json({ ok: true });
}
