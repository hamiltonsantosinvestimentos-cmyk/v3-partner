import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { notifyComentarioProposta } from "@/lib/email";

export const dynamic = "force-dynamic";

const MESA_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

// GET — retorna comentários de uma proposta (apenas mesa/admin)
export async function GET(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const isMesa = MESA_ROLES.includes(profile?.role as typeof MESA_ROLES[number]);
  if (!isMesa) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const proposal_id = searchParams.get("proposal_id");
  if (!proposal_id) return NextResponse.json({ error: "proposal_id obrigatório" }, { status: 400 });

  const { data } = await serviceClient()
    .from("credit_desk_proposals")
    .select("mesa_comments")
    .eq("id", proposal_id)
    .single();

  const comments = Array.isArray(data?.mesa_comments) ? data.mesa_comments : [];
  return NextResponse.json({ comments });
}

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getAuthedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };
  const { data: profile } = await supabase.from("profiles").select("id, full_name, role").eq("id", user.id).single();
  return { user, profile };
}

// POST — adiciona comentário da mesa e notifica o partner
export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const isMesa = MESA_ROLES.includes(profile?.role as typeof MESA_ROLES[number]);
  if (!isMesa) return NextResponse.json({ error: "Apenas a Mesa pode adicionar comentários" }, { status: 403 });

  const body = await req.json();
  const { proposal_id, text } = body;
  if (!proposal_id || !text?.trim()) {
    return NextResponse.json({ error: "proposal_id e text são obrigatórios" }, { status: 400 });
  }

  const svc = serviceClient();
  const { data: proposal } = await svc
    .from("credit_desk_proposals")
    .select("id, code, title, credit_line, mesa_comments, partner_id")
    .eq("id", proposal_id)
    .single();

  if (!proposal) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });

  const existing = Array.isArray(proposal.mesa_comments) ? proposal.mesa_comments : [];
  const autor = profile?.full_name ?? "Mesa Operacional";
  const newComment = {
    id: `mc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text: text.trim(),
    author: autor,
    created_at: new Date().toISOString(),
  };

  const updated = [...existing, newComment];
  const { error } = await svc
    .from("credit_desk_proposals")
    .update({ mesa_comments: updated })
    .eq("id", proposal_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notifica o partner (fire-and-forget)
  if (proposal.partner_id) {
    const { data: partnerProfile } = await svc
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", proposal.partner_id)
      .single();

    if (partnerProfile) {
      // Notificação interna na plataforma
      svc.from("notifications").insert({
        user_id: partnerProfile.id,
        title: `Novo comentário na proposta ${proposal.code ?? ""}`,
        message: `${autor}: ${text.trim()}`,
        type: "PROPOSTA_COMENTARIO",
        action_url: "/mesa-credito",
        read: false,
      }).then(() => {}, () => {});

      // E-mail — profiles.email pode ser null, busca em auth.users
      const emailFinal: string | null = partnerProfile.email ?? null;
      let resolvedEmail = emailFinal;
      if (!resolvedEmail) {
        const { data: authUser } = await svc.auth.admin.getUserById(partnerProfile.id);
        resolvedEmail = authUser?.user?.email ?? null;
      }

      if (resolvedEmail) {
        notifyComentarioProposta({
          partnerEmail: resolvedEmail,
          partnerName: partnerProfile.full_name ?? "Parceiro",
          proposalCode: proposal.code ?? proposal_id,
          proposalTitle: proposal.title ?? "",
          creditLine: proposal.credit_line ?? "",
          autor,
          comentario: text.trim(),
        });
      }
    }
  }

  return NextResponse.json({ ok: true, comment: newComment });
}
