// lib/esignature/index.ts
//
// Factory do provedor de assinatura digital (Fase 1, 07/09/2026; roteamento
// real por vertical na Fase 3, 10/09/2026).
import { createClient as sc } from "@supabase/supabase-js";
import type { ESignatureProvider, EsignatureContext, EsignatureProviderName } from "./types";
import { clickSignProvider } from "./clicksign-provider";
import { certOneProvider } from "./certone-provider";

function providerByName(name: EsignatureProviderName): ESignatureProvider {
  if (name === "certone") return certOneProvider;
  return clickSignProvider;
}

// Ordem de resolução (Fase 3, decisão de João em 10/09/2026, congelamento
// por contrato): override explícito (context.provider) > o que já está
// gravado no contrato (context.provider também é usado pra isso — o call
// site pós-envio passa contract.esignature_provider aqui) > config atual da
// vertical (esignature_vertical_config) > fallback ClickSign. Nunca reler a
// config da vertical para um contrato já enviado: por isso o valor
// congelado sempre chega via context.provider, nunca recalculado aqui a
// partir de context.vertical quando o contrato já tem um provider salvo —
// essa responsabilidade é do call site (ver comentário em cada rota).
export async function getProvider(context: EsignatureContext = {}): Promise<ESignatureProvider> {
  if (context.provider) {
    if (context.provider !== "clicksign" && context.provider !== "certone") {
      throw new Error(`Provedor de assinatura "${context.provider}" desconhecido.`);
    }
    return providerByName(context.provider);
  }

  if (context.vertical) {
    const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data } = await svc
      .from("esignature_vertical_config")
      .select("provider")
      .eq("vertical", context.vertical)
      .maybeSingle();
    if (data?.provider === "certone") return certOneProvider;
  }

  return clickSignProvider;
}

export { htmlToPdfBase64 } from "./clicksign-provider";
export { clickSignProvider } from "./clicksign-provider";
export { certOneProvider } from "./certone-provider";
export type {
  ESignatureProvider,
  EsignatureContext,
  EsignatureProviderName,
  EsignatureSignatory,
  SendEnvelopeInput,
  SendEnvelopeResult,
  EnvelopeStatusResult,
  CancelResult,
  NotifyResult,
  WebhookParseResult,
} from "./types";
