import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { auditText, auditHtml } from "@/lib/brand-guardian-gate";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

async function getCaller(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role, full_name").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string, fullName: profile.full_name as string | null };
}

async function notifyMentioned(params: {
  mentionedIds: string[];
  authorName: string;
  content: string;
  subjectLabel: string;
  actionUrl: string;
}) {
  const db = svc();
  const { data: mentionedProfiles } = await db
    .from("profiles")
    .select("id, email, full_name")
    .in("id", params.mentionedIds);

  if (!mentionedProfiles || mentionedProfiles.length === 0) return;

  const title = `${params.authorName} mencionou você em ${params.subjectLabel}`;

  // Notificacao in-app — obrigatoria, nunca pulada
  await db.from("notifications").insert(
    mentionedProfiles.map((p) => ({
      user_id: p.id,
      title,
      message: params.content.slice(0, 200),
      type: "mention",
      action_url: params.actionUrl,
      read: false,
    }))
  );

  // Email — best-effort, nao bloqueia a criacao da nota se falhar
  if (!process.env.RESEND_API_KEY) return;
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const noteSubjectGate = auditText(title);
    const noteHtmlGate = auditHtml(`<p><strong>${params.authorName}</strong> mencionou você numa nota de <strong>${params.subjectLabel}</strong>:</p>
                   <p style="background:#12112A;color:#F5F1E8;padding:12px;border-radius:6px">${params.content}</p>
                   <p>Acesse a Mesa de Capitais para responder: https://app.v3partners.com.br/bolsa/mesa</p>`);
    if (noteHtmlGate.blocking.length > 0) console.error("[deal-notes] Brand Guardian bloqueou:", noteHtmlGate.blocking);
    await Promise.all(
      mentionedProfiles
        .filter((p) => p.email)
        .map((p) =>
          resend.emails.send({
            from: "V3 Partners Bolsa de Ativos <noreply@v3partners.com.br>",
            to: p.email as string,
            subject: noteSubjectGate.corrected,
            html: noteHtmlGate.corrected,
          })
        )
    );
  } catch (err) {
    console.error("[CM Deal Notes] falha ao notificar por email:", err);
  }
}

/** GET /api/cm/deal-notes?listing_id=X OU ?demand_id=X — lista notas do ativo ou timeline do comprador
 *  (generalizada em 19/08/2026, ver BRIEF 3b: mesma tabela, mesmo padrao ja usado em
 *  cm_qualification_batches para listing_id/demand_id). */
export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const listingId = searchParams.get("listing_id");
  const demandId = searchParams.get("demand_id");
  if (!listingId && !demandId) return NextResponse.json({ error: "listing_id ou demand_id obrigatório" }, { status: 422 });

  let query = svc()
    .from("cm_deal_notes")
    .select("*, profiles!cm_deal_notes_author_id_fkey(full_name)")
    .order("created_at", { ascending: false });
  query = listingId ? query.eq("listing_id", listingId) : query.eq("demand_id", demandId!);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notes: data ?? [] });
}

/** POST /api/cm/deal-notes — cria nota (ativo ou comprador) e dispara notificacao (in-app + email)
 *  para usuarios mencionados. Exatamente um de listing_id/demand_id, nunca os dois nem nenhum
 *  (mesmo CHECK do banco, validado aqui antes pra dar erro claro). */
export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { listing_id, demand_id, content, mentioned_user_ids } = await req.json();
  if ((!listing_id && !demand_id) || (listing_id && demand_id) || !content || !content.trim()) {
    return NextResponse.json({ error: "Exatamente um de listing_id/demand_id, e content, são obrigatórios" }, { status: 422 });
  }

  let subjectLabel: string;
  let actionUrl: string;

  if (listing_id) {
    const { data: listing } = await svc().from("cm_asset_listings").select("anonymous_id").eq("id", listing_id).single();
    if (!listing) return NextResponse.json({ error: "Ativo não encontrado" }, { status: 404 });
    subjectLabel = `ativo ${listing.anonymous_id}`;
    actionUrl = `/bolsa/mesa?listing=${listing_id}`;
  } else {
    const { data: demand } = await svc().from("investor_demands").select("nome_contato").eq("id", demand_id).single();
    if (!demand) return NextResponse.json({ error: "Comprador não encontrado" }, { status: 404 });
    subjectLabel = `comprador ${demand.nome_contato}`;
    actionUrl = `/bolsa/mesa?tab=buydemands`;
  }

  const mentionedIds: string[] = Array.isArray(mentioned_user_ids) ? mentioned_user_ids.filter(Boolean) : [];

  const { data: note, error } = await svc()
    .from("cm_deal_notes")
    .insert({
      listing_id: listing_id ?? null,
      demand_id: demand_id ?? null,
      author_id: caller.userId,
      content: content.trim(),
      mentioned_user_ids: mentionedIds,
    })
    .select("*, profiles!cm_deal_notes_author_id_fkey(full_name)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (mentionedIds.length > 0) {
    await notifyMentioned({
      mentionedIds,
      authorName: caller.fullName ?? "Alguém da Mesa",
      content: content.trim(),
      subjectLabel,
      actionUrl,
    });
  }

  return NextResponse.json({ note }, { status: 201 });
}
