import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { decryptPageToken, subscribePageWebhook } from "@/lib/meta-oauth";

const PARTNER_ROLES = ["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

type PendingPage = {
  id: string; name: string; access_token_encrypted: string;
  instagram_business_account_id: string | null; instagram_username: string | null;
};

async function authGuard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!PARTNER_ROLES.includes(profile?.role as typeof PARTNER_ROLES[number])) return null;
  return { user };
}

// GET — lista as Páginas pendentes de escolha (quando o OAuth achou mais de
// uma), sem nunca expor o token — só o suficiente pra UI mostrar a lista
// (nome da Página + @ do Instagram vinculado, se houver).
export async function GET() {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data } = await svc()
    .from("partner_sdr_connections")
    .select("meta_pending_pages")
    .eq("partner_id", auth.user.id)
    .maybeSingle();

  const pendentes = (data?.meta_pending_pages ?? []) as PendingPage[];
  return NextResponse.json({
    pages: pendentes.map(p => ({
      id: p.id, name: p.name,
      instagram_username: p.instagram_username,
      has_instagram: Boolean(p.instagram_business_account_id),
    })),
  });
}

// POST { page_id } — confirma qual Página conectar dentre as pendentes.
export async function POST(req: NextRequest) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { page_id } = await req.json() as { page_id?: string };
  if (!page_id) return NextResponse.json({ error: "page_id obrigatório" }, { status: 400 });

  const db = svc();
  const { data } = await db
    .from("partner_sdr_connections")
    .select("meta_pending_pages")
    .eq("partner_id", auth.user.id)
    .maybeSingle();

  const pendentes = (data?.meta_pending_pages ?? []) as PendingPage[];
  const escolhida = pendentes.find(p => p.id === page_id);
  if (!escolhida) return NextResponse.json({ error: "Página não encontrada entre as pendentes — conecte de novo" }, { status: 404 });

  const pageAccessToken = decryptPageToken(escolhida.access_token_encrypted);

  await db.from("partner_sdr_connections").update({
    meta_page_id: escolhida.id,
    meta_page_name: escolhida.name,
    meta_page_access_token_encrypted: escolhida.access_token_encrypted,
    messenger_status: "conectado",
    instagram_business_account_id: escolhida.instagram_business_account_id,
    instagram_username: escolhida.instagram_username,
    instagram_status: escolhida.instagram_business_account_id ? "conectado" : "desconectado",
    meta_pending_pages: null,
    meta_pending_at: null,
    updated_at: new Date().toISOString(),
  }).eq("partner_id", auth.user.id);

  try {
    await subscribePageWebhook(escolhida.id, pageAccessToken);
  } catch (e) {
    console.error(`[Meta OAuth] Página ${escolhida.id} conectada mas falhou ao inscrever no webhook:`, e);
  }

  return NextResponse.json({ ok: true });
}
