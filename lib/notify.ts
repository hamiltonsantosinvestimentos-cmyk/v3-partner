import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface NotificationPayload {
  user_id: string;
  title: string;
  message?: string;
  type: "deal" | "proposal" | "ticket" | "commission" | "split" | "info";
  action_url?: string;
}

/** Cria uma notificação para um usuário específico */
export async function createNotification(n: NotificationPayload) {
  try {
    await svc().from("notifications").insert({
      user_id:    n.user_id,
      title:      n.title,
      message:    n.message ?? null,
      type:       n.type,
      action_url: n.action_url ?? null,
    });
  } catch { /* notificações são fire-and-forget */ }
}

/** Cria notificação para todos os usuários com determinadas roles */
export async function notifyByRoles(
  roles: string[],
  n: Omit<NotificationPayload, "user_id">
) {
  try {
    const { data: users } = await svc()
      .from("profiles")
      .select("id")
      .in("role", roles)
      .eq("is_active", true);

    if (!users?.length) return;

    await svc().from("notifications").insert(
      users.map((u) => ({
        user_id:    u.id,
        title:      n.title,
        message:    n.message ?? null,
        type:       n.type,
        action_url: n.action_url ?? null,
      }))
    );
  } catch { /* fire-and-forget */ }
}
