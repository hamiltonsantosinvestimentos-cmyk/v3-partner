import type { SupabaseClient } from "@supabase/supabase-js";
import { enviarTextoSessaoPropria } from "@/lib/whatsapp/openwa-client";
import {
  CATEGORIAS, agoraBrasilia, dataHoraBr, dataIsoParaBr, dataIsoValida, formatarReais, hojeBrasilia, limitesDoMes,
  localBrasiliaParaIso, mesValido, rotuloMes, textoLimpo, valorValido,
} from "./formato";
import { interpretarMensagem, type Interpretacao } from "./interpretar";
import { transcreverAudio } from "./transcrever";

// MY ASSISTANT IA: respostas vêm de modelos fixos aqui, nunca geradas pela IA. Logs sem telefone, texto ou valor.
export const RESPOSTA_FORA_DO_ESCOPO = "Ainda não sei fazer isso.";
export const RESPOSTA_FALHA = "Não consegui processar agora. Nada foi lançado. Tente novamente.";
export const RESPOSTA_AUDIO_LONGO = "Áudio muito longo. Envie em partes menores ou por texto.";
export const RESPOSTA_LIMITE = "Limite diário atingido. Use a tela.";
export const LIMITE_DIARIO = 300;
const JANELA_DESFAZER_MS = 10 * 60 * 1000;
const JANELA_PENDENCIA_MS = 30 * 60 * 1000;
const TETO_TRABALHO_MS = 45_000;
const TETO_TRANSCRICAO_MS = 20_000;
const TETO_IA_MS = 20_000;

const PERGUNTAS: Record<string, string> = {
  valor: "Qual foi o valor?",
  tipo: "Foi uma entrada ou uma saída?",
  horario: "Qual o horário do compromisso?",
  dia: "Qual o dia do compromisso?",
  titulo: "Qual o assunto do compromisso?",
  esclarecer: "Não entendi com segurança. Pode reescrever com mais detalhes?",
  faixa: "O valor precisa ficar entre R$ 0,01 e R$ 10.000.000,00. Qual é o valor correto?",
};

export type Plano =
  | { tipo: "fora_do_escopo" }
  | { tipo: "pergunta"; falta: string }
  | { tipo: "lancamento"; registro: { tipo: "entrada" | "saida"; valor_centavos: number; categoria: string; descricao: string | null; data: string } }
  | { tipo: "compromisso"; registro: { titulo: string; inicio: string; fim: string | null; local: string | null; notas: string | null } }
  | { tipo: "consulta_financas"; mes: string }
  | { tipo: "consulta_agenda" };

const limpoOuNulo = (t: string | null) => (t && textoLimpo(t)) || null;

/** Decide o que fazer, sem gravar nada. Em dúvida nunca grava: pergunta. */
export function planejar(i: Interpretacao, hoje: string): Plano {
  if (i.acao === "fora_do_escopo") return { tipo: "fora_do_escopo" };
  if (i.acao === "perguntar") return { tipo: "pergunta", falta: i.falta ?? "esclarecer" };
  if (i.confianca === "baixa" && (i.acao === "lancamento" || i.acao === "compromisso")) return { tipo: "pergunta", falta: "esclarecer" };

  if (i.acao === "lancamento") {
    if (i.valor_centavos === null) return { tipo: "pergunta", falta: "valor" };
    if (!valorValido(i.valor_centavos)) return { tipo: "pergunta", falta: "faixa" };
    if (!i.tipo) return { tipo: "pergunta", falta: "tipo" };
    if (i.data !== null && !dataIsoValida(i.data)) return { tipo: "pergunta", falta: "esclarecer" };
    return {
      tipo: "lancamento",
      registro: {
        tipo: i.tipo,
        valor_centavos: i.valor_centavos,
        categoria: CATEGORIAS.includes(i.categoria ?? "") ? (i.categoria as string) : "Outros",
        descricao: limpoOuNulo(i.descricao),
        data: i.data ?? hoje,
      },
    };
  }

  if (i.acao === "compromisso") {
    const titulo = limpoOuNulo(i.titulo);
    if (!titulo) return { tipo: "pergunta", falta: "titulo" };
    const inicio = localBrasiliaParaIso(i.inicio);
    if (!inicio) return { tipo: "pergunta", falta: "horario" };
    const fim = i.fim === null ? null : localBrasiliaParaIso(i.fim);
    if (i.fim !== null && (!fim || new Date(fim) < new Date(inicio))) return { tipo: "pergunta", falta: "esclarecer" };
    return { tipo: "compromisso", registro: { titulo, inicio, fim, local: limpoOuNulo(i.local), notas: limpoOuNulo(i.notas) } };
  }

  if (i.acao === "consulta_financas") return { tipo: "consulta_financas", mes: mesValido(i.mes) ? i.mes : hoje.slice(0, 7) };
  return { tipo: "consulta_agenda" };
}

export function ehDesfazer(texto: string): boolean {
  return texto.trim().replace(/[.!]+$/, "").toUpperCase() === "DESFAZER";
}

const nomeTipo = (tipo: string) => (tipo === "entrada" ? "entrada" : "saída");

export function respostaLancamento(r: { tipo: string; valor_centavos: number; categoria: string; data: string }): string {
  return `Lancei: ${nomeTipo(r.tipo)} de ${formatarReais(r.valor_centavos)} em ${r.categoria}, ${dataIsoParaBr(r.data)}. Para desfazer, responda DESFAZER.`;
}

export function respostaCompromisso(r: { titulo: string; inicio: string }): string {
  return `Agendei: ${r.titulo}, ${dataHoraBr(r.inicio)}. Para desfazer, responda DESFAZER.`;
}

async function desfazer(db: SupabaseClient, userId: string): Promise<string> {
  const desde = new Date(Date.now() - JANELA_DESFAZER_MS).toISOString();
  const [l, c] = await Promise.all([
    db.from("assistente_lancamentos").select("id, tipo, valor_centavos, categoria, data, created_at")
      .eq("user_id", userId).eq("origem", "whatsapp").gte("created_at", desde)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("assistente_compromissos").select("id, titulo, inicio, created_at")
      .eq("user_id", userId).eq("origem", "whatsapp").gte("created_at", desde)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (l.error || c.error) throw new Error("Falha ao localizar o último registro");
  if (!l.data && !c.data) return "Nada para desfazer nos últimos 10 minutos.";

  if (l.data && (!c.data || l.data.created_at >= c.data.created_at)) {
    const { error } = await db.from("assistente_lancamentos").delete().eq("id", l.data.id).eq("user_id", userId);
    if (error) throw new Error("Falha ao desfazer");
    return `Removi: ${nomeTipo(l.data.tipo)} de ${formatarReais(l.data.valor_centavos)} em ${l.data.categoria}, ${dataIsoParaBr(l.data.data)}.`;
  }
  const { error } = await db.from("assistente_compromissos").delete().eq("id", c.data!.id).eq("user_id", userId);
  if (error) throw new Error("Falha ao desfazer");
  return `Removi: ${c.data!.titulo}, ${dataHoraBr(c.data!.inicio)}.`;
}

async function consultarFinancas(db: SupabaseClient, userId: string, mes: string): Promise<string> {
  const { inicio, fim } = limitesDoMes(mes);
  const { data, error } = await db.from("assistente_lancamentos").select("tipo, valor_centavos")
    .eq("user_id", userId).gte("data", inicio).lt("data", fim);
  if (error) throw new Error("Falha na consulta");
  let entradas = 0;
  let saidas = 0;
  for (const r of data ?? []) {
    if (r.tipo === "entrada") entradas += Number(r.valor_centavos);
    else saidas += Number(r.valor_centavos);
  }
  return `Em ${rotuloMes(mes)}: entradas de ${formatarReais(entradas)}, saídas de ${formatarReais(saidas)}, saldo de ${formatarReais(entradas - saidas)}.`;
}

async function consultarAgenda(db: SupabaseClient, userId: string): Promise<string> {
  const { data, error } = await db.from("assistente_compromissos").select("titulo, inicio")
    .eq("user_id", userId).gte("inicio", new Date().toISOString()).order("inicio", { ascending: true }).limit(5);
  if (error) throw new Error("Falha na consulta");
  if (!data?.length) return "Nenhum compromisso futuro.";
  return `Próximos compromissos:\n${data.map((c) => `${dataHoraBr(c.inicio)}: ${c.titulo}`).join("\n")}`;
}

export type EntradaMensagem = {
  userId: string;
  sessionId: string;
  chatId: string;
  mensagemId: string;
  tipo: "texto" | "audio" | "outro";
  texto: string | null;
  media?: { data?: string; mimetype?: string; omitted?: boolean } | null;
};

type Resultado = { resposta: string; status: "processada" | "aguardando_resposta" | "ignorada"; pendencia?: unknown };

async function trabalhar(db: SupabaseClient, e: EntradaMensagem, limite: number): Promise<Resultado> {
  const noPrazo = () => { if (Date.now() > limite) throw new Error("Teto de tempo atingido"); };

  const hoje = hojeBrasilia();
  const { count, error: erroContagem } = await db.from("assistente_mensagens")
    .select("id", { count: "exact", head: true }).eq("user_id", e.userId).gte("created_at", `${hoje}T00:00:00-03:00`);
  if (erroContagem) throw new Error("Falha ao contar mensagens");
  if ((count ?? 0) > LIMITE_DIARIO) return { resposta: RESPOSTA_LIMITE, status: "ignorada" };

  if (e.tipo === "outro") return { resposta: RESPOSTA_FORA_DO_ESCOPO, status: "ignorada" };

  let texto = e.texto ?? "";
  if (e.tipo === "audio") {
    if (e.media?.omitted) return { resposta: RESPOSTA_AUDIO_LONGO, status: "ignorada" };
    if (!e.media?.data) throw new Error("Áudio sem conteúdo");
    texto = await transcreverAudio(e.media.data, e.media.mimetype ?? "audio/ogg", TETO_TRANSCRICAO_MS);
    noPrazo();
    const { error } = await db.from("assistente_mensagens").update({ texto }).eq("id", e.mensagemId);
    if (error) throw new Error("Falha ao guardar a transcrição");
  }
  if (!texto.trim()) return { resposta: RESPOSTA_FORA_DO_ESCOPO, status: "ignorada" };

  if (ehDesfazer(texto)) return { resposta: await desfazer(db, e.userId), status: "processada" };

  const desde = new Date(Date.now() - JANELA_PENDENCIA_MS).toISOString();
  const { data: aberta } = await db.from("assistente_mensagens").select("id, pendencia")
    .eq("user_id", e.userId).eq("status", "aguardando_resposta").neq("id", e.mensagemId).gte("created_at", desde)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const pendencia = (aberta?.pendencia as { texto: string; falta: string } | null) ?? null;

  const interpretacao = await interpretarMensagem({ texto, agoraLocal: agoraBrasilia(), pendencia }, TETO_IA_MS);
  noPrazo();
  const plano = planejar(interpretacao, hoje);

  if (aberta) await db.from("assistente_mensagens").update({ status: "processada", pendencia: null }).eq("id", aberta.id);

  switch (plano.tipo) {
    case "fora_do_escopo":
      return { resposta: RESPOSTA_FORA_DO_ESCOPO, status: "ignorada" };
    case "pergunta":
      return {
        resposta: PERGUNTAS[plano.falta] ?? PERGUNTAS.esclarecer,
        status: "aguardando_resposta",
        pendencia: { texto: pendencia ? `${pendencia.texto}\n${texto}` : texto, falta: plano.falta },
      };
    case "lancamento": {
      const { error } = await db.from("assistente_lancamentos").insert({ ...plano.registro, user_id: e.userId, origem: "whatsapp", mensagem_id: e.mensagemId });
      if (error) throw new Error("Falha ao gravar lançamento");
      return { resposta: respostaLancamento(plano.registro), status: "processada" };
    }
    case "compromisso": {
      const { error } = await db.from("assistente_compromissos").insert({ ...plano.registro, user_id: e.userId, origem: "whatsapp", mensagem_id: e.mensagemId });
      if (error) throw new Error("Falha ao gravar compromisso");
      return { resposta: respostaCompromisso(plano.registro), status: "processada" };
    }
    case "consulta_financas":
      return { resposta: await consultarFinancas(db, e.userId, plano.mes), status: "processada" };
    case "consulta_agenda":
      return { resposta: await consultarAgenda(db, e.userId), status: "processada" };
  }
}

/** Roda em after(): até 45s de trabalho e 5s para responder. Depois do teto nada mais é gravado. */
export async function processarMensagem(db: SupabaseClient, e: EntradaMensagem): Promise<void> {
  const limite = Date.now() + TETO_TRABALHO_MS;
  let resultado: Resultado | null = null;
  try {
    resultado = await Promise.race([
      trabalhar(db, e, limite),
      new Promise<never>((_, rejeitar) => setTimeout(() => rejeitar(new Error("Teto de tempo atingido")), TETO_TRABALHO_MS)),
    ]);
  } catch (erro) {
    console.error("[Assistente] falha", { mensagem: e.mensagemId, tipo: e.tipo, erro: erro instanceof Error ? erro.name : "erro" });
  }

  const { error } = await db.from("assistente_mensagens").update({
    status: resultado?.status ?? "falhou",
    pendencia: resultado?.pendencia ?? null,
  }).eq("id", e.mensagemId);
  if (error) console.error("[Assistente] falha ao gravar status", { mensagem: e.mensagemId, codigo: error.code });

  const enviado = await enviarTextoSessaoPropria(e.sessionId, e.chatId, resultado?.resposta ?? RESPOSTA_FALHA).catch(() => false);
  console.log("[Assistente] processada", { mensagem: e.mensagemId, tipo: e.tipo, status: resultado?.status ?? "falhou", enviado });
}
