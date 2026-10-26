import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PARTNER_ROLES, calcularEsperas, ehMesa, lerConversas, svc } from "@/lib/chat-partners";

export const dynamic = "force-dynamic";

// GET — lista das conversas para a Mesa: última mensagem, não lidas (desde mesa_lido_ate),
// aguardando resposta (com o início da espera), responsável. Poucas consultas no total
// (antes eram 2 por partner).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!ehMesa(profile?.role as string)) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const [{ data: partners, error: pErr }, { data: msgs }] = await Promise.all([
    db.from("profiles").select("id, full_name, role").in("role", [...PARTNER_ROLES]).order("full_name", { ascending: true }),
    db.from("chat_messages").select("room_id, sender_id, sender_name, sender_role, content, created_at")
      .or("room_id.like.partner_%,room_id.like.instituicao_%")
      .order("created_at", { ascending: false }).limit(8000),
  ]);
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

  type Msg = { room_id: string; sender_id: string | null; sender_name: string; sender_role: string; content: string; created_at: string };
  const lista = (msgs ?? []) as Msg[];
  const ultima = new Map<string, Msg>();
  for (const m of lista) if (!ultima.has(m.room_id)) ultima.set(m.room_id, m);

  const conversas = await lerConversas(db);
  const esperas = calcularEsperas(lista);
  const naoLidas = new Map<string, number>();
  for (const m of lista) {
    if (ehMesa(m.sender_role) || m.sender_role === "SYSTEM") continue;
    const lido = conversas.get(m.room_id)?.mesa_lido_ate;
    // Sem estado salvo, conta só o que está aguardando resposta (não o histórico inteiro).
    const conta = lido ? m.created_at > lido : !!esperas.get(m.room_id) && m.created_at >= esperas.get(m.room_id)!.desde;
    if (conta) naoLidas.set(m.room_id, (naoLidas.get(m.room_id) ?? 0) + 1);
  }

  const montar = (room_id: string, partner_id: string, partner_name: string, partner_role: string) => {
    const u = ultima.get(room_id);
    const c = conversas.get(room_id);
    const e = esperas.get(room_id);
    return {
      room_id, partner_id, partner_name, partner_role,
      last_message: u ? { content: u.content, sender_name: u.sender_name, created_at: u.created_at, da_mesa: ehMesa(u.sender_role) || u.sender_role === "SYSTEM" } : null,
      unread_count: naoLidas.get(room_id) ?? 0,
      aguardando_desde: e?.desde ?? null,
      responsavel_id: c?.responsavel_id ?? null,
      responsavel_nome: c?.responsavel_nome ?? null,
    };
  };

  const rooms = (partners ?? []).map((p) => montar(`partner_${p.id}`, p.id as string, (p.full_name as string) ?? "Partner", p.role as string));

  // Instituições que já conversaram
  const instIds = [...new Set([...ultima.keys()].filter((r) => r.startsWith("instituicao_")).map((r) => r.slice(12)))];
  if (instIds.length) {
    const { data: insts } = await db.from("instituicoes").select("id, nome").in("id", instIds);
    const nomes = new Map((insts ?? []).map((i) => [i.id as string, i.nome as string]));
    for (const id of instIds) rooms.push(montar(`instituicao_${id}`, id, nomes.get(id) ?? "Instituição", "INSTITUICAO"));
  }

  rooms.sort((a, b) => {
    if (!!a.aguardando_desde !== !!b.aguardando_desde) return a.aguardando_desde ? -1 : 1;
    if (a.aguardando_desde && b.aguardando_desde) return a.aguardando_desde.localeCompare(b.aguardando_desde);
    if (!a.last_message && !b.last_message) return a.partner_name.localeCompare(b.partner_name);
    if (!a.last_message) return 1;
    if (!b.last_message) return -1;
    return b.last_message.created_at.localeCompare(a.last_message.created_at);
  });

  return NextResponse.json({ rooms, me: user.id });
}
