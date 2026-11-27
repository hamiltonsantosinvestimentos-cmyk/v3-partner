// Mesa Operacional do master Enterprise: só acompanhar as operações da equipe.
// BRIEF docs/briefs/2026-11-26_mesa-operacional-master-enterprise.md
// Regras puras e testáveis. O card nasce da visão do partner (lista fechada, lib/api-v1/visao-partner.ts):
// nada interno da V3 (comentários da mesa, instituições, comissões, mandato, cobrança) chega aqui.
import { CAMPOS_PERMITIDOS, documentosDaLinha, visaoDoPartner } from "@/lib/api-v1/visao-partner";
import type { PortfolioLinhaDocs } from "@/lib/credit-checklists";
import {
  colunaDoCard, OUTRO_DOCUMENTO, SEM_NOME,
} from "@/app/(platform)/enterprise/mesa-operacional/exibicao";

// Regras de coluna, resumo e formatos ficam num arquivo sem dependência de servidor (o Kanban usa).
export {
  COLUNAS, colunaDoCard, dataBR, LIMITE_MESA, NAO_INFORMADO, OUTRO_DOCUMENTO, resumoDaMesa, ROTULO_COLUNA,
  SEM_NOME, valorBR, type ColunaMesa,
} from "@/app/(platform)/enterprise/mesa-operacional/exibicao";

/** Chaves exatas de um card (paridade testada). */
export const CAMPOS_CARD = [
  ...CAMPOS_PERMITIDOS.filter((c) => c !== "link_analise_credito"),
  "originador",
  "coluna",
] as const;

type Linha = Record<string, unknown>;

export function cardDaEquipe(linha: Linha, opts: { portfolio: PortfolioLinhaDocs[]; nomes: Map<string, string | null> }) {
  const visao = visaoDoPartner(linha, { portfolio: opts.portfolio, access: false });
  const { link_analise_credito: _omitido, ...v } = visao;
  void _omitido;
  const meta = linha.metadata && typeof linha.metadata === "object" ? linha.metadata : {};
  const nomeDoc = new Map(documentosDaLinha(v.linha, v.cliente.tipo, opts.portfolio, meta).map((d) => [d.id, d.nome]));
  const nome = (id: string) => nomeDoc.get(id) ?? OUTRO_DOCUMENTO;
  const originador = opts.nomes.get(String(linha.partner_id ?? ""));
  return {
    ...v,
    documentos_pendentes: v.documentos_pendentes.map(nome),
    documentos_recebidos: v.documentos_recebidos.map((d) => ({ ...d, tipo_documento: nome(d.tipo_documento) })),
    originador: originador && originador.trim() ? originador.trim() : SEM_NOME,
    coluna: colunaDoCard(v.etapa, v.status),
  };
}

export type CardMesa = ReturnType<typeof cardDaEquipe>;

export function ordenarUsuarios(lista: { id: string; nome: string | null }[], masterId: string): { id: string; rotulo: string }[] {
  const demais = lista.filter((u) => u.id !== masterId);
  const comNome = demais.filter((u) => u.nome && u.nome.trim())
    .sort((a, b) => a.nome!.trim().localeCompare(b.nome!.trim(), "pt-BR", { sensitivity: "base" }));
  const semNome = demais.filter((u) => !u.nome || !u.nome.trim());
  return [
    { id: "todos", rotulo: "Todos" },
    { id: masterId, rotulo: "Você" },
    ...comNome.map((u) => ({ id: u.id, rotulo: u.nome!.trim() })),
    ...semNome.map((u) => ({ id: u.id, rotulo: SEM_NOME })),
  ];
}

export function acessoMesaEquipe(user: { id?: string } | null | undefined, ctx: { ehMaster: boolean } | null | undefined): "login" | "negado" | "master" {
  if (!user?.id) return "login";
  if (!ctx || !ctx.ehMaster) return "negado";
  return "master";
}
