import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

webpush.setVapidDetails(
  process.env.VAPID_EMAIL ?? "mailto:admin@v3partners.com.br",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// POST — envia push para um usuário (uso interno/server-side apenas)
// Chamado internamente por outras APIs, não diretamente pelo cliente.
export async function POST(req: NextRequest) {
  // Verificação de segurança: apenas chamadas internas com service role key
  const authHeader = req.headers.get("x-internal-secret");
  if (authHeader !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { user_id, title, body: msgBody, url } = body as {
    user_id: string;
    title: string;
    body: string;
    url?: string;
  };

  if (!user_id || !title) {
    return NextResponse.json(
      { error: "user_id e title são obrigatórios" },
      { status: 400 }
    );
  }

  // Busca todas as subscriptions do usuário
  const { data: subscriptions, error } = await svc()
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", user_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!subscriptions?.length) return NextResponse.json({ ok: true, sent: 0 });

  const payload = JSON.stringify({
    title,
    body: msgBody ?? "",
    url: url ?? "/",
    tag: `v3-${Date.now()}`,
  });

  const expiredEndpoints: string[] = [];
  let sent = 0;

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
        sent++;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 410 || statusCode === 404) {
          // Subscription expirada — marcar para remoção
          expiredEndpoints.push(sub.endpoint);
        }
      }
    })
  );

  // Remove subscriptions expiradas
  if (expiredEndpoints.length > 0) {
    await svc()
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user_id)
      .in("endpoint", expiredEndpoints);
  }

  return NextResponse.json({ ok: true, sent, removed: expiredEndpoints.length });
}
