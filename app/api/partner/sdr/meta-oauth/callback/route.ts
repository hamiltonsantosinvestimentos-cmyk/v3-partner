import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import {
  readOAuthState, exchangeCodeForUserToken, exchangeForLongLivedUserToken,
  fetchManagedPages, subscribePageWebhook, encryptPageToken, siteUrl,
  type ManagedPage,
} from "@/lib/meta-oauth";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Sempre redireciona de volta pra aba de canais do partner (nunca devolve
// JSON puro — quem chega aqui é o navegador do partner vindo do dialog da
// Meta), com um parâmetro de resultado que a UI lê pra mostrar sucesso/erro.
function redirectComResultado(resultado: string) {
  const url = new URL("/meu-atendimento-ia", siteUrl());
  url.searchParams.set("meta_oauth", resultado);
  return NextResponse.redirect(url, { status: 303 });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const erroMeta = searchParams.get("error_description") ?? searchParams.get("error");

  if (erroMeta) {
    console.error("[Meta OAuth] Partner cancelou ou a Meta recusou:", erroMeta);
    return redirectComResultado("cancelado");
  }
  if (!code || !state) return redirectComResultado("erro");

  let partnerId: string;
  try {
    ({ partnerId } = readOAuthState(state));
  } catch (e) {
    console.error("[Meta OAuth] State inválido:", e);
    return redirectComResultado("erro");
  }

  try {
    const shortLived = await exchangeCodeForUserToken(code);
    const longLived = await exchangeForLongLivedUserToken(shortLived);
    const pages = await fetchManagedPages(longLived);

    if (pages.length === 0) {
      return redirectComResultado("sem_paginas");
    }

    if (pages.length === 1) {
      await conectarPagina(partnerId, pages[0]);
      return redirectComResultado("conectado");
    }

    // Mais de uma Página administrada — guarda pendente (token de cada uma já
    // criptografado) e deixa o partner escolher na UI antes de gravar a conexão final.
    const pendentes = pages.map(p => ({
      id: p.id,
      name: p.name,
      access_token_encrypted: encryptPageToken(p.access_token),
      instagram_business_account_id: p.instagram_business_account?.id ?? null,
      instagram_username: p.instagram_business_account?.username ?? null,
    }));

    await svc().from("partner_sdr_connections").upsert({
      partner_id: partnerId,
      meta_pending_pages: pendentes,
      meta_pending_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "partner_id" });

    return redirectComResultado("escolher_pagina");
  } catch (e) {
    console.error("[Meta OAuth] Erro no callback:", e);
    return redirectComResultado("erro");
  }
}

async function conectarPagina(partnerId: string, page: ManagedPage) {
  await svc().from("partner_sdr_connections").upsert({
    partner_id: partnerId,
    meta_page_id: page.id,
    meta_page_name: page.name,
    meta_page_access_token_encrypted: encryptPageToken(page.access_token),
    messenger_status: "conectado",
    instagram_business_account_id: page.instagram_business_account?.id ?? null,
    instagram_username: page.instagram_business_account?.username ?? null,
    instagram_status: page.instagram_business_account?.id ? "conectado" : "desconectado",
    meta_pending_pages: null,
    meta_pending_at: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "partner_id" });

  // Sem essa inscrição a Página nunca manda evento pro webhook do App —
  // falha aqui não deve travar a conexão (o token e os dados já foram
  // salvos), só fica sem receber mensagem até reconectar/tentar de novo.
  try {
    await subscribePageWebhook(page.id, page.access_token);
  } catch (e) {
    console.error(`[Meta OAuth] Página ${page.id} conectada mas falhou ao inscrever no webhook:`, e);
  }
}
