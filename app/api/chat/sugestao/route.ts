import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { ehMesa, etapaLabel, svc } from "@/lib/chat-partners";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODELO = "claude-opus-5-5";

const SISTEMA = `Você ajuda a Mesa Operacional da V3 Partners a responder partners (licenciados que trazem operações de crédito) no chat da plataforma.
Escreva UMA resposta curta, em português do Brasil, no tom da Mesa: cordial, direto, profissional, sem jargão desnecessário.
Use só os fatos da conversa e da lista de propostas. Nunca invente prazo, valor, taxa, aprovação ou documento que não esteja nos dados; se faltar informação, diga que vai verificar e retorna.
Se o partner citar uma proposta, use o código e a etapa dela. Se houver pendência registrada, explique o que falta.
Não use travessão. Não assine a mensagem. Responda apenas com o texto da mensagem, sem comentários.`;

// POST { room_id } — rascunho de resposta para a Mesa revisar (nunca envia sozinho).
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const db = svc();
  const { data: me } = await db.from("profiles").select("full_name, role").eq("id", user.id).single();
  if (!ehMesa(me?.role as string)) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "IA não configurada (ANTHROPIC_API_KEY)." }, { status: 503 });

  const { room_id } = (await req.json().catch(() => ({}))) as { room_id?: string };
  if (!room_id?.startsWith("partner_")) return NextResponse.json({ error: "Sugestão disponível só nas conversas com partners" }, { status: 400 });
  const partnerId = room_id.slice(8);

  const [{ data: msgs }, { data: partner }, { data: propostas }, respostas] = await Promise.all([
    db.from("chat_messages").select("sender_name, sender_role, content, created_at").eq("room_id", room_id).order("created_at", { ascending: false }).limit(30),
    db.from("profiles").select("full_name, role").eq("id", partnerId).single(),
    db.from("credit_desk_proposals").select("code, client_name, credit_line, requested_value, stage, status, pending_reason, updated_at")
      .eq("partner_id", partnerId).is("deleted_at", null).order("updated_at", { ascending: false }).limit(15),
    db.from("chat_respostas_prontas").select("atalho, texto").then((r) => r.data ?? [], () => []),
  ]);
  if (!msgs?.length) return NextResponse.json({ error: "Conversa sem mensagens" }, { status: 400 });

  const conversa = [...msgs].reverse().map((m) => {
    const quem = ehMesa(m.sender_role as string) || m.sender_role === "SYSTEM" ? `Mesa (${m.sender_name})` : `Partner (${m.sender_name})`;
    const quando = new Date(m.created_at as string).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
    return `[${quando}] ${quem}: ${m.content}`;
  }).join("\n");
  const listaPropostas = (propostas ?? []).map((p) =>
    `- ${p.code} · ${p.client_name ?? "cliente"} · ${p.credit_line ?? ""} · R$ ${Number(p.requested_value ?? 0).toLocaleString("pt-BR")} · etapa: ${etapaLabel(p.stage as string)}${p.pending_reason ? ` · pendência: ${p.pending_reason}` : ""}`,
  ).join("\n") || "(nenhuma proposta)";
  const modelos = (respostas as { atalho: string; texto: string }[]).map((r) => `/${r.atalho}: ${r.texto}`).join("\n");

  const contexto =
    `Partner: ${partner?.full_name ?? "Partner"}\n\nPropostas do partner:\n${listaPropostas}\n\n` +
    (modelos ? `Respostas padrão da Mesa (use como referência de conteúdo quando couber):\n${modelos}\n\n` : "") +
    `Conversa (mais antiga primeiro):\n${conversa}\n\nEscreva a próxima resposta da Mesa.`;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const resp = await anthropic.messages.create({
      model: MODELO,
      max_tokens: 4000,
      system: SISTEMA,
      output_config: { effort: "low" },
      messages: [{ role: "user", content: contexto }],
    });
    if (resp.stop_reason === "refusal") return NextResponse.json({ error: "A IA não conseguiu sugerir uma resposta para esta conversa." }, { status: 422 });
    const texto = resp.content.filter((b) => b.type === "text").map((b) => (b as Anthropic.TextBlock).text).join("").trim();
    if (!texto) return NextResponse.json({ error: "A IA não devolveu texto." }, { status: 502 });
    return NextResponse.json({ sugestao: texto });
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      const semCredito = e.status === 400 && /credit/i.test(e.message);
      return NextResponse.json({ error: semCredito ? "Sem crédito na conta da IA (Anthropic)." : `IA indisponível (${e.status ?? "erro"}).` }, { status: 502 });
    }
    return NextResponse.json({ error: "IA indisponível no momento." }, { status: 502 });
  }
}
