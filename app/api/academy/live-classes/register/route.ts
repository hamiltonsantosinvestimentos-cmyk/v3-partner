import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { notifyAulaAoVivoInscricao } from "@/lib/email";
import { createNotification } from "@/lib/notify";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// POST — partner se inscreve numa aula ao vivo: registra, envia e-mail e mensagem no chat interno
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { live_class_id } = await req.json() as { live_class_id: string };
  if (!live_class_id) return NextResponse.json({ error: "live_class_id obrigatório" }, { status: 400 });

  const db = svc();

  const [{ data: liveClass }, { data: partner }] = await Promise.all([
    db.from("academy_live_classes").select("*").eq("id", live_class_id).single(),
    db.from("profiles").select("id, full_name, email").eq("id", user.id).single(),
  ]);

  if (!liveClass) return NextResponse.json({ error: "Aula não encontrada" }, { status: 404 });
  if (!partner) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  const { error } = await db.from("academy_live_registrations").insert({
    live_class_id,
    partner_id: user.id,
  });

  // Já inscrito — não é erro, apenas confirma
  if (error && error.code !== "23505") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const dataHora = new Date(liveClass.date).toLocaleString("pt-BR", {
    day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit",
  });
  const zoomLink = liveClass.zoom_link ?? "";

  // E-mail de confirmação
  if (partner.email && zoomLink) {
    notifyAulaAoVivoInscricao({
      partnerEmail: partner.email,
      partnerName: partner.full_name ?? "Partner",
      titulo: liveClass.title,
      instrutor: liveClass.instructor ?? "V3 Partners",
      dataHora,
      zoomLink,
    }).catch(() => {});
  }

  // Mensagem no chat interno (sala 1:1 admin↔partner), remetente "V3 Academy"
  if (zoomLink) {
    const chatContent = `📺 Inscrição confirmada: *${liveClass.title}*\n${dataHora}\nLink de acesso: ${zoomLink}`;
    db.from("chat_messages").insert({
      room_id: `partner_${user.id}`,
      sender_id: liveClass.created_by ?? user.id,
      sender_name: "V3 Academy",
      sender_role: "SYSTEM",
      content: chatContent,
    }).then(() => {}).then(undefined, () => {});

    createNotification({
      user_id: user.id,
      title: "Inscrição confirmada — Aula ao Vivo",
      message: liveClass.title,
      type: "info",
      action_url: "/academy",
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
