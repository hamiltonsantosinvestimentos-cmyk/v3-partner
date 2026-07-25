import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const TIMELINE_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

// Grava uma notificação in-app por usuário elegível, com o mesmo padrão de
// action_url ("/mesa-ma?deal={id}") que a aba Timeline nativa do deal já lê
// (ver app/api/ma/timeline/route.ts). Best-effort: nunca lança, só loga erro,
// para não derrubar o fluxo principal (envio de convite ou intake público)
// por causa de uma notificação que falhou.
export async function notifyDealTimeline(params: {
  dealId: string;
  title: string;
  message: string;
  type: "negociacao_convite" | "negociacao_assinado" | "negociacao_falha";
}) {
  const { dealId, title, message, type } = params;
  try {
    const db = svc();
    const { data: users } = await db
      .from("profiles")
      .select("id")
      .in("role", TIMELINE_ROLES)
      .eq("is_active", true);

    if (!users || users.length === 0) return;

    await db.from("notifications").insert(
      users.map(u => ({
        user_id: u.id,
        title,
        message,
        type,
        action_url: `/mesa-ma?deal=${dealId}`,
        read: false,
      }))
    );
  } catch (e) {
    console.error("[ma-negociacao-notify]", e);
  }
}
