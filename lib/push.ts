/**
 * Helper interno para disparar push notifications diretamente via webpush.
 * Deve ser chamado APENAS do lado server (API routes).
 * Usa webpush diretamente para evitar cancelamento em ambiente serverless.
 */

import webpush from "web-push";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function initVapid() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL ?? "mailto:admin@v3partners.com.br";
  if (pub && priv) {
    webpush.setVapidDetails(email, pub, priv);
  }
}

export interface PushPayload {
  user_id: string;
  title: string;
  body?: string;
  url?: string;
}

/**
 * Envia push para um único usuário de forma fire-and-forget.
 * Não lança exceção.
 */
export async function sendPushNotification(payload: PushPayload): Promise<void> {
  try {
    initVapid();

    const { data: subscriptions } = await svc()
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", payload.user_id);

    if (!subscriptions?.length) return;

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body ?? "",
      url: payload.url ?? "/",
      tag: `v3-${Date.now()}`,
    });

    const expiredEndpoints: string[] = [];

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            pushPayload
          );
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 410 || status === 404) {
            expiredEndpoints.push(sub.endpoint);
          }
        }
      })
    );

    if (expiredEndpoints.length > 0) {
      await svc()
        .from("push_subscriptions")
        .delete()
        .eq("user_id", payload.user_id)
        .in("endpoint", expiredEndpoints);
    }
  } catch {
    // fire-and-forget — falhas são silenciosas
  }
}

/**
 * Envia push para múltiplos usuários de forma fire-and-forget.
 */
export async function sendPushToMany(
  userIds: string[],
  opts: Omit<PushPayload, "user_id">
): Promise<void> {
  await Promise.allSettled(
    userIds.map((user_id) => sendPushNotification({ user_id, ...opts }))
  );
}
