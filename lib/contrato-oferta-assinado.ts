// Aviso de contrato Gold/Diamante assinado (30/10/2026, pedido do Hamilton):
// quando o envelope fecha, avisa no WhatsApp da V3 para liberar o partner no
// grupo. A nota em contract_notes evita aviso repetido, já que webhook, cron e
// "Atualizar status" podem ver o mesmo fechamento.
import type { SupabaseClient } from "@supabase/supabase-js";
import { familiaDoTemplate } from "@/lib/contrato-parceria-partner";
import { SYSTEM_USER_ID } from "@/lib/contract-signature-timeline";
import { sendWhatsApp } from "@/lib/whatsapp/subscription-messages";

export const CONTRATO_ASSINADO_WHATSAPP = "51997466001";
export const CONTRATO_ASSINADO_NOTA = "Aviso de contrato assinado enviado no WhatsApp da V3";

/** Falha aqui nunca derruba a assinatura: o contrato já está marcado como assinado. */
export async function avisarContratoOfertaAssinado(db: SupabaseClient, contractId: string): Promise<void> {
  try {
    const { data: contrato } = await db
      .from("operation_contracts")
      .select("contract_code, template_id, parties")
      .eq("id", contractId)
      .maybeSingle();
    if (!contrato?.template_id) return;

    const { data: minuta } = await db
      .from("contract_templates")
      .select("template_name")
      .eq("id", contrato.template_id)
      .maybeSingle();
    if (familiaDoTemplate(minuta?.template_name as string | null) !== "oferta") return;

    const { data: jaAvisou } = await db
      .from("contract_notes")
      .select("id")
      .eq("contract_id", contractId)
      .eq("content", CONTRATO_ASSINADO_NOTA)
      .limit(1);
    if (jaAvisou?.length) return;

    const partes = (contrato.parties as Array<{ role?: string; name?: string; email?: string }> | null) ?? [];
    const partner = partes.find((p) => p.role !== "v3_partners" && p.role !== "testemunha");
    const { data: perfil } = partner?.email
      ? await db.from("profiles").select("role, phone").ilike("email", partner.email).maybeSingle()
      : { data: null };
    const plano = perfil?.role === "DIAMANTE" ? "V3 Diamante" : perfil?.role === "GOLD" ? "V3 Gold" : "Gold/Diamante";

    const enviado = await sendWhatsApp(
      CONTRATO_ASSINADO_WHATSAPP,
      `✅ Contrato assinado\n\n${partner?.name ?? "Partner"} (${plano}) assinou o contrato ${contrato.contract_code ?? ""}.\nWhatsApp: ${perfil?.phone ?? "não informado"}\n\nPode liberar o acesso ao grupo da V3.`,
    );
    if (!enviado) {
      console.error(`[contrato-oferta-assinado] WhatsApp não enviado para o contrato ${contractId}`);
      return;
    }

    await db.from("contract_notes").insert({
      contract_id: contractId,
      author_id: SYSTEM_USER_ID,
      author_name: "Sistema",
      note_type: "sistema",
      content: CONTRATO_ASSINADO_NOTA,
    });
  } catch (e) {
    console.error("[contrato-oferta-assinado] falha ao avisar:", e);
  }
}
