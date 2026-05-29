import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const STAGE_LABELS: Record<string, string> = {
  PROSPECTING:   "Prospecção",
  QUALIFICATION: "Qualificação",
  IOI:           "Viabilidade",
  PROPOSAL:      "Estruturação",
  NEGOTIATION:   "Negociação",
  DUE_DILIGENCE: "Due Diligence",
  CLOSING:       "Closing",
  CLOSED_WON:    "Fechado (Won)",
  CLOSED_LOST:   "Fechado (Perdido)",
};

export type TimelineEvent = {
  id: string;
  type: "stage_change" | "forja" | "upload" | "comment" | "notification";
  title: string;
  description: string;
  actor?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
};

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await svc()
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const ALLOWED = ["ADMIN", "GESTAO", "MESA"];
  if (!ALLOWED.includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const dealId = searchParams.get("deal_id");
  if (!dealId) return NextResponse.json({ error: "deal_id obrigatório" }, { status: 400 });

  // Modo count_only — retorna apenas contagem de notificações não lidas do deal
  if (searchParams.get("count_only") === "true") {
    const { count } = await svc()
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .like("action_url", `/mesa-ma?deal=${dealId}%`)
      .eq("user_id", user.id)
      .eq("read", false);
    return NextResponse.json({ unread_count: count ?? 0 });
  }

  const events: TimelineEvent[] = [];

  // 1. Stage changes from ma_deal_history
  const { data: history } = await svc()
    .from("ma_deal_history")
    .select("id, from_stage, to_stage, notes, changed_by, created_at, profiles(full_name)")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (history) {
    for (const h of history as Array<{
      id: string; from_stage: string | null; to_stage: string; notes: string | null;
      changed_by: string | null; created_at: string;
      profiles: { full_name?: string } | null;
    }>) {
      const fromLabel = STAGE_LABELS[h.from_stage ?? ""] ?? h.from_stage ?? "—";
      const toLabel   = STAGE_LABELS[h.to_stage] ?? h.to_stage;
      events.push({
        id:          h.id,
        type:        "stage_change",
        title:       `Movido para ${toLabel}`,
        description: h.from_stage
          ? `De "${fromLabel}" para "${toLabel}"`
          : `Entrou em "${toLabel}"`,
        actor:       h.profiles?.full_name ?? undefined,
        metadata:    { from_stage: h.from_stage, to_stage: h.to_stage, notes: h.notes },
        created_at:  h.created_at,
      });
    }
  }

  // 2. Notifications linked to this deal via action_url pattern
  const { data: notifs } = await svc()
    .from("notifications")
    .select("id, title, message, type, created_at")
    .like("action_url", `/mesa-ma?deal=${dealId}%`)
    .order("created_at", { ascending: false })
    .limit(30);

  if (notifs) {
    for (const n of notifs as Array<{
      id: string; title: string; message: string | null;
      type: string; created_at: string;
    }>) {
      const titleLower = n.title.toLowerCase();
      let evType: TimelineEvent["type"] = "notification";
      if (titleLower.includes("forja") || titleLower.includes("validação") || titleLower.includes("score"))
        evType = "forja";
      else if (titleLower.includes("upload") || titleLower.includes("documento") || titleLower.includes("recebido"))
        evType = "upload";

      events.push({
        id:          n.id,
        type:        evType,
        title:       n.title,
        description: n.message ?? "",
        created_at:  n.created_at,
      });
    }
  }

  events.sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return NextResponse.json({ events: events.slice(0, 50) });
}

// PATCH — marca notificações do deal como lidas para o usuário atual
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dealId = searchParams.get("deal_id");
  if (!dealId) return NextResponse.json({ error: "deal_id obrigatório" }, { status: 400 });

  await svc()
    .from("notifications")
    .update({ read: true })
    .like("action_url", `/mesa-ma?deal=${dealId}%`)
    .eq("user_id", user.id)
    .eq("read", false);

  return NextResponse.json({ ok: true });
}
