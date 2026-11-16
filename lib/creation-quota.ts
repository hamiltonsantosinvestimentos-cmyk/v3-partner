// Cota de criação de operações (BRIEF 15/11/2026). Helper único usado por toda rota em que um partner
// (ou um link público) cria registro com código oficial. A decisão de verdade mora no banco, na função
// reserve_creation_slot (atômica, com advisory lock); este arquivo só traduz o resultado em resposta HTTP,
// escolhe o texto e define o que fazer quando a própria função falha. Sem dependência de rede: a rota passa
// uma "porta" (PortaCota), como em lib/chat-retention.ts, e os testes usam uma porta falsa.
//
// Política de sigilo: nenhuma mensagem devolve limite numérico, nome de outro usuário, IP ou o estado das
// chaves. O IP nunca entra em texto de resposta.
import { isIP } from "node:net";

export type ActorKind = "user" | "token";

export type MotivoCota =
  | "ok" | "isento" | "intervalo" | "hora" | "dia" | "bloqueado" | "bloqueio_automatico" | "invalido" | "erro_interno";

export interface ResultadoCota {
  allowed: boolean | null;
  reason: MotivoCota;
  retry_after_seconds?: number;
  blocked_until?: string;
  log_id?: string | null;
  alerta_cota?: boolean;
}

export interface PortaCota {
  reservar(ator: { kind: ActorKind; id: string }, via: string, ip: string | null): Promise<ResultadoCota>;
  liberar(logId: string): Promise<void>;
}

// Papéis isentos. A função do banco aplica a mesma lista e nega por padrão (papel desconhecido sofre cota);
// esta cópia serve só para decidir o que a rota faz se a função falhar e para não forçar o corpo da equipe.
export const PAPEIS_ISENTOS_COTA = ["ADMIN", "GESTAO", "MESA", "MESA_OPERACIONAL"] as const;

export function papelIsentoDeCota(papel: string | null | undefined): boolean {
  return !!papel && (PAPEIS_ISENTOS_COTA as readonly string[]).includes(papel);
}

// Só os cabeçalhos que a Vercel injeta e que o cliente não consegue forjar. O primeiro valor de
// x-forwarded-for é enviado pelo próprio chamador e mascararia a origem, então NÃO é usado.
export function ipDaRequisicao(headers: { get(nome: string): string | null }): string | null {
  for (const nome of ["x-real-ip", "x-vercel-forwarded-for"]) {
    const bruto = headers.get(nome)?.split(",")[0]?.trim();
    if (bruto && isIP(bruto) !== 0) return bruto;
  }
  return null;
}

const FUSO = "America/Sao_Paulo";

function hhmm(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

function dataHora(d: Date): { data: string; hora: string } {
  const data = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
  return { data, hora: hhmm(d) };
}

export const CONTATO_COMPLIANCE = "compliance@v3partners.com.br";

// Texto na tela, nunca e-mail (BRIEF 1.8). Sem a expressão "uso indevido" e sem números de limite.
export function mensagemDeNegacao(r: ResultadoCota, kind: ActorKind, agora: Date = new Date()): string {
  if (kind === "token") {
    return "Limite de envios atingido para este link. Fale com quem enviou o link.";
  }
  if (r.reason === "intervalo") {
    return "Aguarde alguns instantes antes de criar um novo cadastro.";
  }
  if ((r.reason === "bloqueado" || r.reason === "bloqueio_automatico") && r.blocked_until) {
    const { data, hora } = dataHora(new Date(r.blocked_until));
    return `Limite de cadastros excedido. A criação de novos registros está suspensa até ${data} às ${hora}. Em caso de dúvida ou para pedir revisão, fale com ${CONTATO_COMPLIANCE}.`;
  }
  // Cota da hora ou do dia sem bloqueio (estado de lançamento, chave do bloqueio desligada).
  const volta = new Date(agora.getTime() + Math.max(1, r.retry_after_seconds ?? 60) * 1000);
  return `Limite de cadastros atingido por enquanto. Você poderá cadastrar novamente às ${hhmm(volta)}. Em caso de dúvida, fale com ${CONTATO_COMPLIANCE}.`;
}

export type DecisaoCota =
  | { liberado: true; logId: string | null; alertaCota: boolean }
  | { liberado: false; status: 429 | 503; corpo: { error: string }; cabecalhos: Record<string, string>; alertaCota: boolean };

// Reserva a vaga e traduz o resultado. Quando a função do banco falha (erro_interno) ou a chamada lança:
//  - equipe isenta e a via "parceria" (etapa obrigatória do cadastro do partner) seguem, para um defeito da
//    cota nunca travar a Mesa nem o onboarding;
//  - qualquer outro papel fica barrado (503 genérico), porque o dano de 12/11 era justamente cadastro sem freio.
export async function reservarVagaDeCriacao(
  porta: PortaCota,
  p: { kind: ActorKind; id: string; via: string; papel?: string | null; ip?: string | null; agora?: Date },
): Promise<DecisaoCota> {
  let r: ResultadoCota;
  try {
    r = await porta.reservar({ kind: p.kind, id: p.id }, p.via, p.ip ?? null);
  } catch (e) {
    console.error("[creation-quota] falha ao chamar a função de reserva", { via: p.via, tipo: e instanceof Error ? e.name : "desconhecido" });
    r = { allowed: null, reason: "erro_interno" };
  }

  if (r.allowed === true) return { liberado: true, logId: r.log_id ?? null, alertaCota: false };

  if (r.reason === "erro_interno") {
    console.error("[creation-quota] erro_interno na reserva", { via: p.via, kind: p.kind });
    if (p.via === "parceria" || (p.kind === "user" && papelIsentoDeCota(p.papel))) {
      return { liberado: true, logId: null, alertaCota: false };
    }
    return {
      liberado: false, status: 503, alertaCota: false,
      corpo: { error: "Não foi possível processar o cadastro agora. Tente novamente em instantes." },
      cabecalhos: { "Retry-After": "30" },
    };
  }

  const espera = Math.max(1, Math.ceil(r.retry_after_seconds ?? 60));
  return {
    liberado: false, status: 429, alertaCota: r.alerta_cota === true,
    corpo: { error: mensagemDeNegacao(r, p.kind, p.agora) },
    cabecalhos: { "Retry-After": String(espera) },
  };
}

// Devolve a vaga quando a criação falha depois da reserva. Nunca lança: é chamada dentro de catch.
export async function devolverVagaDeCriacao(porta: PortaCota, logId: string | null): Promise<void> {
  if (!logId) return;
  try {
    await porta.liberar(logId);
  } catch (e) {
    console.error("[creation-quota] falha ao devolver a vaga", { tipo: e instanceof Error ? e.name : "desconhecido" });
  }
}

// Porta real, sobre o cliente de serviço do Supabase (a função só aceita service_role).
export function portaSupabase(db: {
  rpc(nome: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string } | null }>;
}): PortaCota {
  return {
    async reservar(ator, via, ip) {
      const { data, error } = await db.rpc("reserve_creation_slot", {
        p_actor_kind: ator.kind, p_actor_id: ator.id, p_via: via, p_ip: ip,
      });
      if (error || !data || typeof data !== "object") {
        console.error("[creation-quota] rpc reserve_creation_slot falhou", { code: error?.code });
        return { allowed: null, reason: "erro_interno" };
      }
      return data as ResultadoCota;
    },
    async liberar(logId) {
      const { error } = await db.rpc("release_creation_slot", { p_log_id: logId });
      if (error) console.error("[creation-quota] rpc release_creation_slot falhou", { code: error.code });
    },
  };
}

// Para papel não isento, o servidor ignora o que o corpo diz sobre atribuição, originação e código:
// partner nunca escolhe quem é o responsável, quem originou nem o código oficial do deal.
export function camposConfiaveisParaCriacao<T extends { assigned_to?: string; originator_profile_id?: string; code?: string }>(
  corpo: T, papel: string | null | undefined,
): T {
  if (papelIsentoDeCota(papel)) return corpo;
  const { assigned_to: _a, originator_profile_id: _o, code: _c, ...resto } = corpo;
  void _a; void _o; void _c;
  return resto as T;
}
