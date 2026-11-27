// Mesa Operacional do master Enterprise: regras de coluna, resumo e formatos (puras, sem servidor).
// BRIEF docs/briefs/2026-11-26_mesa-operacional-master-enterprise.md
// Separado de lib/enterprise/mesa-equipe.ts para o Kanban (cliente) não carregar a visão do partner,
// que depende de código de servidor. lib/enterprise/mesa-equipe.ts reexporta tudo daqui.
import { SLA_STAGES, SLA_STAGE_LABELS } from "@/lib/mesa-operacional-sla";
import { formatCurrencyBRLFromNumber } from "@/lib/utils";

export const COLUNAS = [...SLA_STAGES, "ENCERRADAS"] as const;
export type ColunaMesa = (typeof COLUNAS)[number];

export const ROTULO_COLUNA: Record<ColunaMesa, string> = { ...SLA_STAGE_LABELS, ENCERRADAS: "Encerradas" };

export const LIMITE_MESA = 500;
export const SEM_NOME = "Usuário sem nome";
export const OUTRO_DOCUMENTO = "Outro documento";
export const NAO_INFORMADO = "Não informado";

/** Mesma regra da Mesa Operacional da V3 (mesa-op-client.tsx). */
export function colunaDoCard(etapa: string, status: string): ColunaMesa {
  const e = (etapa ?? "").toUpperCase();
  if (e === "REPROVADO" || e === "DECLINADO") return "ENCERRADAS";
  if (e === "FINALIZADO") {
    const s = (status ?? "").toUpperCase();
    return s === "REJECTED" || s === "CANCELLED" ? "ENCERRADAS" : "LIBERADO";
  }
  if ((SLA_STAGES as readonly string[]).includes(e)) return e as ColunaMesa;
  return "RECEBIDO";
}

export function resumoDaMesa(cards: { coluna: ColunaMesa; valor_solicitado: number | null }[]) {
  const porColuna = Object.fromEntries(COLUNAS.map((c) => [c, 0])) as Record<ColunaMesa, number>;
  let valorSolicitadoAtivas = 0;
  for (const c of cards) {
    porColuna[c.coluna] += 1;
    if (c.coluna !== "ENCERRADAS" && typeof c.valor_solicitado === "number" && Number.isFinite(c.valor_solicitado)) {
      valorSolicitadoAtivas += c.valor_solicitado;
    }
  }
  const encerradas = porColuna.ENCERRADAS;
  return { porColuna, ativas: cards.length - encerradas, encerradas, valorSolicitadoAtivas };
}

/** DD/MM/AAAA (ou DD/MM/AAAA HH:mm) no fuso de São Paulo; nulo ou inválido vira "Não informado". */
export function dataBR(iso: string | null | undefined, comHora = false): string {
  if (!iso) return NAO_INFORMADO;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NAO_INFORMADO;
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric",
      ...(comHora ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const } : {}),
    }).formatToParts(d).map((p) => [p.type, p.value]),
  );
  const data = `${partes.day}/${partes.month}/${partes.year}`;
  return comHora ? `${data} ${partes.hour}:${partes.minute}` : data;
}

/** "R$ " + máscara BRL; nulo vira "Não informado" (nunca "R$ 0,00" nem "NaN"). */
export function valorBR(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? NAO_INFORMADO : `R$ ${formatCurrencyBRLFromNumber(v)}`;
}
