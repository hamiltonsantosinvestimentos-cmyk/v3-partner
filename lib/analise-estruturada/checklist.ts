// Análise Estruturada V3 — checklist de documentos do cliente (MELHORIA DA CONSULTA,
// Fase 1 / entrega 1, 04/10/2026). Vale só para o pacote fechado do V3 Access
// (R$ 1.500, ver isAccessPackage em lib/credit-analysis-pricing.ts).
//
// Os arquivos ficam no bucket privado "documents" (sem whitelist de MIME, porque
// extrato vem em OFX/CSV e faturamento em planilha), numa pasta por pedido:
//   analise-estruturada/<orderId>/<chave do item>/<timestamp>_<arquivo>
// O marcador analise-estruturada/<orderId>/_completo.json registra quando os
// obrigatórios ficaram completos (início do prazo de 24h) e garante que o alerta
// sai uma vez só. Nada disso exige coluna nova no banco.

export type PerfilAnalise = "PJ" | "PF";

export interface ItemChecklist {
  key: string;
  label: string;
  descricao: string;
  obrigatorio: boolean;
}

export const CHECKLIST: Record<PerfilAnalise, ItemChecklist[]> = {
  PJ: [
    { key: "balanco_dre", label: "Balanço patrimonial e DRE", descricao: "Dos 2 últimos exercícios, assinados pelo contador, e o balancete do ano corrente.", obrigatorio: true },
    { key: "faturamento", label: "Faturamento dos últimos 12 meses", descricao: "Relação mês a mês assinada pelo contador.", obrigatorio: true },
    { key: "extratos_pj", label: "Extratos bancários da empresa", descricao: "De 6 a 12 meses, de todas as contas. De preferência o arquivo OFX ou o PDF original do banco.", obrigatorio: true },
    { key: "fiscal", label: "Declaração fiscal", descricao: "PGDAS-D/DEFIS (Simples Nacional) ou ECF/ECD (Lucro Presumido ou Real) do último exercício.", obrigatorio: true },
    { key: "contrato_social", label: "Contrato social", descricao: "Com a última alteração.", obrigatorio: true },
    { key: "ir_socios", label: "Imposto de Renda dos sócios", descricao: "Declaração completa e recibo de entrega dos 2 últimos anos de cada sócio.", obrigatorio: true },
    { key: "endividamento", label: "Relação de endividamento bancário", descricao: "Credor, saldo devedor, parcela, prazo e garantia de cada dívida.", obrigatorio: false },
    { key: "recebiveis", label: "Carteira de recebíveis e principais clientes", descricao: "Aging dos recebíveis e quem são os maiores clientes.", obrigatorio: false },
    { key: "extratos_socios", label: "Extratos bancários dos sócios", descricao: "Últimos 6 meses.", obrigatorio: false },
    { key: "garantia", label: "Documentos da garantia", descricao: "Matrícula atualizada, IPTU e laudo, se houver imóvel em garantia.", obrigatorio: false },
  ],
  PF: [
    { key: "ir_pf", label: "Imposto de Renda", descricao: "Declaração completa e recibo de entrega dos 2 últimos anos.", obrigatorio: true },
    { key: "extratos_pf", label: "Extratos bancários", descricao: "Últimos 6 meses, de todas as contas. De preferência o arquivo OFX ou o PDF original do banco.", obrigatorio: true },
    { key: "renda", label: "Comprovantes de renda", descricao: "Holerite, pró-labore ou DECORE dos últimos 3 meses.", obrigatorio: true },
    { key: "endividamento", label: "Relação de dívidas", descricao: "Credor, saldo devedor, parcela e prazo de cada dívida.", obrigatorio: false },
    { key: "garantia", label: "Documentos da garantia", descricao: "Matrícula atualizada, IPTU e laudo, se houver imóvel em garantia.", obrigatorio: false },
  ],
};

export const BUCKET_ANALISE = "documents";
export const PREFIXO_ANALISE = "analise-estruturada";
export const MAX_ARQUIVOS_POR_ITEM = 30;
export const PRAZO_ENTREGA_HORAS = 24;
/** Alerta interno quando o cliente completa os obrigatórios (pedido do Hamilton, 04/10/2026). */
export const WHATSAPP_ALERTA_DOCUMENTOS = "51997466001";

export const CONTENT_TYPE_POR_EXTENSAO: Record<string, string> = {
  pdf: "application/pdf",
  ofx: "application/x-ofx",
  csv: "text/csv",
  txt: "text/plain",
  xml: "application/xml",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

export function extensaoDe(nomeArquivo: string): string {
  return nomeArquivo.split(".").pop()?.toLowerCase() ?? "";
}

export function perfilPeloDocumento(doc: string | null | undefined): PerfilAnalise {
  return (doc ?? "").replace(/\D/g, "").length === 14 ? "PJ" : "PF";
}

export function itemDoPerfil(perfil: PerfilAnalise, key: string): ItemChecklist | undefined {
  return CHECKLIST[perfil].find((i) => i.key === key);
}
