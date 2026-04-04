// Utilitários compartilhados entre /api/pipefy/route.ts e /api/pipefy/webhook/route.ts

/** Mapeia nome da fase do Pipefy → deal_stage ENUM do Supabase */
export function mapPhaseToStage(phaseName: string): string {
  const n = phaseName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (n.includes("prospec")) return "PROSPECTING";
  if (n.includes("qualif")) return "QUALIFICATION";
  if (n.includes("viabil") || n.includes("ioi") || n.includes("intenc")) return "QUALIFICATION";
  if (n.includes("estrutur") || n.includes("oferta") || n.includes("proposta")) return "NEGOTIATION";
  if (n.includes("negoc")) return "NEGOTIATION";
  if (n.includes("due") || n.includes("dilig") || n.includes("auditoria")) return "DUE_DILIGENCE";
  if (n.includes("aprova") || n.includes("fech") || n.includes("closing") || n.includes("contrato")) return "CLOSING";
  if (n.includes("conclu") || n.includes("ganho") || n.includes("won") || n.includes("fechado")) return "CLOSED_WON";
  if (n.includes("perdido") || n.includes("lost") || n.includes("cancel")) return "CLOSED_LOST";
  return "PROSPECTING";
}

/** Extrai campo do array de fields do Pipefy pelo label (case-insensitive, múltiplos labels) */
export function getCardField(
  fields: Array<{ field: { label: string }; value: string }>,
  ...labels: string[]
): string | null {
  for (const label of labels) {
    const found = fields.find(f =>
      f.field?.label?.toLowerCase().includes(label.toLowerCase())
    );
    if (found?.value) return found.value;
  }
  return null;
}

/** Converte valor monetário brasileiro (ex: "R$ 1.500.000,00") para number */
export function parseBRCurrency(raw: string): number | null {
  if (!raw) return null;
  const num = parseFloat(
    raw.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".")
  );
  return isNaN(num) ? null : num;
}
