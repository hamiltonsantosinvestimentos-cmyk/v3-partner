/**
 * CHECKLIST CONDICIONAL AO IMÓVEL EM GARANTIA (28/09/2026)
 *
 * Cada documento do portfólio (documentos_pf / documentos_pj) pode ter `aplica`:
 *   sempre (padrão) · imovel (urbano e rural) · urbano (só imóvel urbano) · rural (só imóvel rural)
 * A proposta guarda metadata.imovel_garantia, respondido no cadastro ("Possui imóvel em garantia?"):
 *   nao · urbano · rural · urbano_rural (vários imóveis de tipos diferentes)
 * Proposta antiga, sem resposta, continua vendo TODOS os documentos (comportamento de antes).
 */

export type AplicaDoc = "sempre" | "imovel" | "urbano" | "rural";
export type ImovelGarantia = "nao" | "urbano" | "rural" | "urbano_rural";

export const APLICA_ORDEM: AplicaDoc[] = ["sempre", "imovel", "urbano", "rural"];
export const APLICA_LABEL: Record<AplicaDoc, string> = {
  sempre: "Sempre",
  imovel: "Imóvel",
  urbano: "Só urbano",
  rural: "Só rural",
};

/** Situação de imóvel da proposta; null = proposta sem essa informação (legado → mostra tudo). */
export function imovelGarantiaDaProposta(meta: unknown): ImovelGarantia | null {
  const m = (meta ?? {}) as { imovel_garantia?: string; imoveis?: { zona?: string }[] };
  if (m.imovel_garantia === "nao" || m.imovel_garantia === "urbano" || m.imovel_garantia === "rural" || m.imovel_garantia === "urbano_rural") {
    return m.imovel_garantia;
  }
  return null;
}

/** Tipo de imóvel a partir das zonas dos imóveis cadastrados (URBANO/RURAL). */
export function garantiaPelasZonas(zonas: (string | null | undefined)[]): ImovelGarantia {
  const temUrbano = zonas.some((z) => z === "URBANO");
  const temRural = zonas.some((z) => z === "RURAL");
  if (temUrbano && temRural) return "urbano_rural";
  if (temRural) return "rural";
  if (temUrbano) return "urbano";
  return "urbano_rural"; // tem imóvel mas o tipo não foi informado: pede tudo de imóvel
}

export function docAplica(aplica: string | null | undefined, garantia: ImovelGarantia | null): boolean {
  if (garantia === null) return true;
  const a = (aplica ?? "sempre") as AplicaDoc;
  if (a === "sempre") return true;
  if (garantia === "nao") return false;
  if (a === "imovel" || garantia === "urbano_rural") return true;
  return a === garantia;
}

/** Filtra um checklist pela situação de imóvel da proposta. */
export function filtrarChecklistPorImovel<T extends { aplica?: string | null }>(itens: T[], garantia: ImovelGarantia | null): T[] {
  return itens.filter((i) => docAplica(i.aplica, garantia));
}
