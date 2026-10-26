import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNotification, notifyByRoles } from "@/lib/notify";
import { notifyChatMensagemPartner } from "@/lib/email";
import { ehDaEquipe } from "@/lib/enterprise";
import {
  ANEXOS_BUCKET, type Anexo, ehMesa, inserirMensagem, lerConversas, marcarLido, salaDoPartner, salvarConversa, svc,
} from "@/lib/chat-partners";

export const dynamic = "force-dynamic";

const LIMITE = 150;
const CODIGO_RE = /\b([A-Z]{2,4}-\d{2}-\d{3,6}(?:-[A-Z]{1,4})?)\b/;

async function perfil(userId: string) {
  const { data } = await svc().from("profiles").select("id, full_name, role").eq("id", userId).single();
  return data as { id: string; full_name: string | null; role: string } | null;
}

type Proposta = { id: string; code: string; client_name: string | null; credit_line: string | null; requested_value: number | null; stage: string | null; status: string | null; pending_reason: string | null; partner_id: string | null };

async function propostasVisiveis(ids: string[], userId: string, mesa: boolean): Promise<Record<string, Proposta>> {
  if (!ids.length) return {};
  const { data } = await svc().from("credit_desk_proposals")
    .select("id, code, client_name, credit_line, requested_value, stage, status, pending_reason, partner_id").in("id", ids);
  const saida: Record<string, Proposta> = {};
  for (const p of (data ?? []) as Proposta[]) {
    if (mesa || p.partner_id === userId || (p.partner_id && await ehDaEquipe(userId, p.partner_id))) saida[p.id] = p;
  }
  return saida;
}

// GET ?room_id=…[&antes=ISO]  → mensagens da sala (+ anexos assinados, cartões de proposta, leitura)
// GET ?proposta_id=…           → mensagens ligadas a uma proposta (só Mesa; aba Comentários do modal)
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const me = await perfil(user.id);
  const mesa = ehMesa(me?.role);
  const sp = req.nextUrl.searchParams;
  const db = svc();

  const propostaId = sp.get("proposta_id");
  if (propostaId) {
    if (!mesa) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    const { data, error } = await db.from("chat_messages").select("*").eq("proposta_id", propostaId).order("created_at", { ascending: true }).limit(200);
    if (error) return NextResponse.json({ messages: [], semMigration: true });
    return NextResponse.json({ messages: data ?? [] });
  }

  const room_id = sp.get("room_id");
  if (!room_id) return NextResponse.json({ error: "room_id obrigatório" }, { status: 400 });
  if (!mesa && room_id !== salaDoPartner(user.id)) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  let q = db.from("chat_messages").select("*").eq("room_id", room_id).order("created_at", { ascending: false }).limit(LIMITE);
  const antes = sp.get("antes");
  if (antes) q = q.lt("created_at", antes);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const messages = (data ?? []).reverse() as (Record<string, unknown> & { anexos?: Anexo[] | null; proposta_id?: string | null })[];

  // Anexos: URL assinada de 1 h
  const paths = messages.flatMap((m) => (m.anexos ?? []).map((a) => a.path));
  const urls: Record<string, string> = {};
  if (paths.length) {
    const { data: assinadas } = await db.storage.from(ANEXOS_BUCKET).createSignedUrls(paths, 3600);
    for (const a of assinadas ?? []) if (a.path && a.signedUrl) urls[a.path] = a.signedUrl;
  }

  const propostas = await propostasVisiveis([...new Set(messages.map((m) => m.proposta_id).filter((x): x is string => !!x))], user.id, mesa);
  const conversa = (await lerConversas(db, [room_id])).get(room_id) ?? null;

  return NextResponse.json({
    messages, urls, propostas,
    leitura: { mesa_lido_ate: conversa?.mesa_lido_ate ?? null, partner_lido_ate: conversa?.partner_lido_ate ?? null },
    responsavel: conversa ? { id: conversa.responsavel_id, nome: conversa.responsavel_nome } : null,
    mais: (data ?? []).length === LIMITE,
  });
}

// POST { room_id, content, anexos?, proposta_id? }
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { room_id, content, anexos, proposta_id } = body as { room_id?: string; content?: string; anexos?: Anexo[]; proposta_id?: string };
  const lista = Array.isArray(anexos) ? anexos.filter((a) => a?.path && a.path.startsWith(`${room_id}/`)).slice(0, 10) : [];
  let texto = (content ?? "").trim();
  if (!room_id || (!texto && !lista.length)) return NextResponse.json({ error: "Escreva uma mensagem ou anexe um arquivo." }, { status: 400 });
  if (!texto) texto = lista.map((a) => `📎 ${a.nome}`).join("\n");

  const me = await perfil(user.id);
  if (!me) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });
  const mesa = ehMesa(me.role);
  if (!mesa && room_id !== salaDoPartner(user.id)) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const db = svc();
  const partnerId = room_id.startsWith("partner_") ? room_id.slice(8) : null;

  // Proposta: a escolhida no seletor ou o código digitado no texto (ex.: PRO-26-0034)
  let propostaId: string | null = null;
  if (proposta_id) propostaId = proposta_id;
  else {
    const cod = texto.match(CODIGO_RE)?.[1];
    if (cod) {
      const { data: p } = await db.from("credit_desk_proposals").select("id").eq("code", cod).maybeSingle();
      if (p) propostaId = p.id as string;
    }
  }
  if (propostaId) {
    const { data: p } = await db.from("credit_desk_proposals").select("partner_id").eq("id", propostaId).maybeSingle();
    const dono = p?.partner_id as string | undefined;
    const permitido = !!p && (mesa ? !partnerId || dono === partnerId || (!!dono && await ehDaEquipe(partnerId, dono)) : dono === user.id || (!!dono && await ehDaEquipe(user.id, dono)));
    if (!permitido) propostaId = null;
  }

  const { data: msg, error } = await inserirMensagem(db, {
    room_id, sender_id: user.id, sender_name: me.full_name ?? "Usuário", sender_role: me.role,
    content: texto, proposta_id: propostaId, anexos: lista,
  });
  if (error) {
    return NextResponse.json({ error: lista.length ? "Anexos ficam disponíveis depois da atualização do banco (migration do chat)." : error.message }, { status: 500 });
  }

  // Quem escreve leu tudo até aqui; resposta da Mesa encerra a espera (zera o alerta de SLA)
  await marcarLido(db, room_id, mesa ? "mesa" : "partner");
  if (mesa) await salvarConversa(db, room_id, { sla_alertado_em: null });

  const preview = texto.slice(0, 200);
  if (mesa && partnerId) {
    createNotification({ user_id: partnerId, title: "Nova mensagem da Mesa V3", message: preview.slice(0, 80), type: "info", action_url: "/chat" }).catch(() => {});
    void Promise.resolve(db.from("profiles").select("email, full_name").eq("id", partnerId).single()).then(({ data: partner }) => {
      if (partner?.email) {
        void notifyChatMensagemPartner({ partnerEmail: partner.email, partnerName: partner.full_name ?? "Partner", senderName: me.full_name ?? "Mesa V3", preview }).catch(() => {});
      }
    }).catch(() => {});
  } else if (!mesa) {
    // Se a conversa tem responsável, avisa ele; senão, a Mesa toda
    const conversa = (await lerConversas(db, [room_id])).get(room_id);
    const aviso = { title: `Mensagem de ${me.full_name ?? "Partner"}`, message: preview.slice(0, 80), type: "info" as const, action_url: `/chat/admin?room=${room_id}` };
    if (conversa?.responsavel_id) createNotification({ user_id: conversa.responsavel_id, ...aviso }).catch(() => {});
    else notifyByRoles(["ADMIN", "GESTAO", "MESA_OPERACIONAL"], aviso).catch(() => {});
  }

  return NextResponse.json({ message: msg }, { status: 201 });
}
