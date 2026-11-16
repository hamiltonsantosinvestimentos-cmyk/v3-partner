// Cola entre as rotas e a cota de criação (BRIEF 15/11/2026): reserva a vaga, devolve a resposta HTTP pronta quando
// a criação é negada, dispara o alerta interno fora do caminho da resposta e entrega uma função para devolver a vaga
// se a criação falhar. A decisão em si mora em lib/creation-quota.ts (testada) e no banco (reserve_creation_slot).
import { createHash } from "node:crypto";
import { NextResponse, after } from "next/server";
import {
  reservarVagaDeCriacao, devolverVagaDeCriacao, portaSupabase, ipDaRequisicao, type ActorKind, type PortaCota,
} from "@/lib/creation-quota";
import { enviarAlertaCota } from "@/lib/creation-alert";

type ClienteRpc = Parameters<typeof portaSupabase>[0];

export interface PedidoDeVaga {
  kind: ActorKind;
  /** Para kind "token", o token do link (vira hash antes de ir ao log: o token é segredo do link). */
  id: string;
  via: string;
  papel?: string | null;
  nomeUsuario?: string | null;
}

export interface VagaDeCriacao {
  /** Resposta pronta quando a criação foi negada; nula quando pode seguir. */
  negado: NextResponse | null;
  /** Devolve a vaga reservada (chamar em toda saída de erro depois da reserva). Nunca lança. */
  devolver: () => Promise<void>;
}

/** Identificador estável do ator no log. O token do link nunca é gravado em claro. */
export function atorParaLog(kind: ActorKind, id: string): string {
  return kind === "token" ? `t:${createHash("sha256").update(id).digest("hex").slice(0, 32)}` : id;
}

export async function reservarVagaOuNegar(
  req: { headers: { get(nome: string): string | null } },
  db: ClienteRpc,
  p: PedidoDeVaga,
  porta?: PortaCota,
): Promise<VagaDeCriacao> {
  const portaCota = porta ?? portaSupabase(db);
  const decisao = await reservarVagaDeCriacao(portaCota, {
    kind: p.kind,
    id: atorParaLog(p.kind, p.id),
    via: p.via,
    papel: p.papel,
    ip: p.kind === "user" ? ipDaRequisicao(req.headers) : null,
  });

  if (decisao.liberado) {
    return { negado: null, devolver: () => devolverVagaDeCriacao(portaCota, decisao.logId) };
  }

  // Alerta A: primeira recusa por hora ou dia, uma vez por usuário por dia (a função do banco decide). Fora do
  // caminho da resposta, nunca altera nem atrasa o 429.
  if (decisao.alertaCota && p.kind === "user" && (decisao.motivo === "hora" || decisao.motivo === "dia" || decisao.motivo === "bloqueio_automatico")) {
    const janela: "hora" | "dia" = decisao.motivo === "dia" ? "dia" : "hora";
    const dados = { nomeUsuario: p.nomeUsuario ?? null, via: p.via, janela };
    try {
      after(() => enviarAlertaCota(dados));
    } catch {
      void enviarAlertaCota(dados);
    }
  }

  return {
    negado: NextResponse.json(decisao.corpo, { status: decisao.status, headers: decisao.cabecalhos }),
    devolver: async () => {},
  };
}
