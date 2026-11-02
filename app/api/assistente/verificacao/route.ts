import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { exigirUsuarioAutorizado } from "@/lib/assistente/acesso";
import { garantirConfig, svcAssistente } from "@/lib/assistente/conexao";
import { telefoneOculto } from "@/lib/assistente/formato";
import { normalizePhone } from "@/lib/phone";
import { enviarTextoSessaoPropria, statusSessaoPropria, whatsappIdSessaoPropria } from "@/lib/whatsapp/openwa-client";

const VALIDADE_MS = 10 * 60 * 1000;
const HORA_MS = 60 * 60 * 1000;
const MAX_TENTATIVAS = 5;
const MAX_ENVIOS_HORA = 3;

function hashCodigo(userId: string, telefone: string, codigo: string): string {
  const segredo = process.env.ASSISTENTE_WEBHOOK_SECRET;
  if (!segredo) throw new Error("ASSISTENTE_WEBHOOK_SECRET ausente");
  return createHmac("sha256", segredo).update(`${userId}:${telefone}:${codigo}`).digest("hex");
}

// POST: envia o código pelo número exclusivo. Sem sessão própria a verificação é recusada.
export async function POST(req: NextRequest) {
  const auth = await exigirUsuarioAutorizado();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const corpo = z.object({ telefone: z.string().max(30) }).safeParse(await req.json().catch(() => null));
  const telefone = normalizePhone(corpo.success ? corpo.data.telefone : "");
  if (!telefone.ok || !telefone.e164 || !telefone.digits) {
    return NextResponse.json({ error: telefone.error ?? "Informe o celular com DDI e DDD." }, { status: 400 });
  }

  const db = svcAssistente();
  try {
    const config = await garantirConfig(db, auth.user.id);
    const sessionId = config.openwa_session_id;
    if (!sessionId) return NextResponse.json({ error: "Conecte o número exclusivo antes de verificar o celular." }, { status: 409 });
    const sessao = await statusSessaoPropria(sessionId);
    if (sessao?.status !== "ready") return NextResponse.json({ error: "O número exclusivo ainda não está conectado." }, { status: 409 });

    const { data: anterior, error: erroLeitura } = await db.from("assistente_verificacao")
      .select("envios_na_hora, janela_envios_inicio").eq("user_id", auth.user.id).maybeSingle();
    if (erroLeitura) throw new Error(`Falha ao ler verificação: ${erroLeitura.code}`);
    const agora = Date.now();
    const janelaVale = anterior && agora - new Date(anterior.janela_envios_inicio).getTime() < HORA_MS;
    if (janelaVale && anterior.envios_na_hora >= MAX_ENVIOS_HORA) {
      return NextResponse.json({ error: "Limite de 3 envios por hora atingido. Tente mais tarde." }, { status: 429 });
    }

    const chatId = await whatsappIdSessaoPropria(sessionId, telefone.digits);
    if (!chatId) return NextResponse.json({ error: "Este número não tem WhatsApp." }, { status: 400 });

    const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const { error } = await db.from("assistente_verificacao").upsert({
      user_id: auth.user.id,
      phone_e164: telefone.e164,
      codigo_hash: hashCodigo(auth.user.id, telefone.e164, codigo),
      expira_em: new Date(agora + VALIDADE_MS).toISOString(),
      tentativas: 0,
      envios_na_hora: janelaVale ? anterior.envios_na_hora + 1 : 1,
      janela_envios_inicio: janelaVale ? anterior.janela_envios_inicio : new Date(agora).toISOString(),
    }, { onConflict: "user_id" });
    if (error) throw new Error(`Falha ao gravar verificação: ${error.code}`);

    const enviado = await enviarTextoSessaoPropria(sessionId, chatId, `Seu código do MY ASSISTANT IA é ${codigo}. Vale por 10 minutos.`, 15000);
    if (!enviado) return NextResponse.json({ error: "Não foi possível enviar o código. Tente novamente." }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[Assistente verificacao] falha ao enviar", { erro: e instanceof Error ? e.name : "erro" });
    return NextResponse.json({ error: "Não foi possível enviar o código. Tente novamente." }, { status: 500 });
  }
}

// PUT: confere o código. O telefone só passa a valer em assistente_config depois do acerto.
export async function PUT(req: NextRequest) {
  const auth = await exigirUsuarioAutorizado();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const corpo = z.object({ codigo: z.string().regex(/^\d{6}$/) }).safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ error: "Informe o código de 6 dígitos." }, { status: 400 });

  const db = svcAssistente();
  try {
    const config = await garantirConfig(db, auth.user.id);
    if (!config.openwa_session_id) return NextResponse.json({ error: "Conecte o número exclusivo antes de verificar o celular." }, { status: 409 });

    const { data: v, error: erroLeitura } = await db.from("assistente_verificacao").select("*").eq("user_id", auth.user.id).maybeSingle();
    if (erroLeitura) throw new Error(`Falha ao ler verificação: ${erroLeitura.code}`);
    if (!v || new Date(v.expira_em).getTime() < Date.now()) return NextResponse.json({ error: "Código expirado. Peça um novo." }, { status: 400 });
    if (v.tentativas >= MAX_TENTATIVAS) return NextResponse.json({ error: "Limite de tentativas atingido. Peça um novo código." }, { status: 429 });

    // Conta a tentativa antes de comparar, para um erro de gravação nunca dar tentativa grátis.
    const { error: erroTentativa } = await db.from("assistente_verificacao").update({ tentativas: v.tentativas + 1 }).eq("user_id", auth.user.id);
    if (erroTentativa) throw new Error(`Falha ao contar tentativa: ${erroTentativa.code}`);

    const esperado = Buffer.from(v.codigo_hash);
    const recebido = Buffer.from(hashCodigo(auth.user.id, v.phone_e164, corpo.data.codigo));
    if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) {
      return NextResponse.json({ error: "Código incorreto." }, { status: 400 });
    }

    const whatsappId = await whatsappIdSessaoPropria(config.openwa_session_id, v.phone_e164.replace(/\D/g, ""));
    if (!whatsappId) return NextResponse.json({ error: "Este número não tem WhatsApp." }, { status: 400 });

    const agora = new Date().toISOString();
    const { error } = await db.from("assistente_config").update({
      phone_e164: v.phone_e164, whatsapp_id: whatsappId, phone_verificado_em: agora, updated_at: agora,
    }).eq("user_id", auth.user.id);
    if (error) throw new Error(`Falha ao gravar celular: ${error.code}`);
    await db.from("assistente_verificacao").delete().eq("user_id", auth.user.id);
    return NextResponse.json({ ok: true, telefone: telefoneOculto(v.phone_e164) });
  } catch (e) {
    console.error("[Assistente verificacao] falha ao conferir", { erro: e instanceof Error ? e.name : "erro" });
    return NextResponse.json({ error: "Não foi possível conferir o código. Tente novamente." }, { status: 500 });
  }
}
