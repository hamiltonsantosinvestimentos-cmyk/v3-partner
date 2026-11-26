// Marca do app instalado pelo host (domínio do Enterprise). BRIEF docs/briefs/2026-11-26_app-instalado-marca-enterprise.md
import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { ehHostV3 } from "@/lib/enterprise";
import { prefixoBucketWhiteLabel, validarTema, type TemaEnterprise } from "@/lib/enterprise-tema";
import { COR_ACENTO_PADRAO, COR_PRINCIPAL_PADRAO, corSegura, nomeSeguro, versaoMarca } from "@/lib/manifest-marca";

export interface MarcaDoApp {
  masterId: string;
  nome: string;
  corPrincipal: string;
  corAcento: string;
  iconeUrl: string | null;
  versao: string;
  tema: TemaEnterprise | null;
  logoUrl: string | null;
}

export type ResultadoMarcaApp = MarcaDoApp | null | { erro: true };

/**
 * marca | null (host da V3 ou sem Enterprise, legítimo) | { erro: true } (falha de consulta).
 * Mesma busca de enterprisePorDominio, numa consulta só e com o erro separado do "não achou".
 */
export const marcaDoAppPorHost = cache(async (host: string | null): Promise<ResultadoMarcaApp> => {
  if (ehHostV3(host)) return null;
  const h = (host ?? "").toLowerCase().split(":")[0];
  try {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data, error } = await db
      .from("profiles")
      .select("id, white_label_nome, white_label_logo_url, white_label_tema")
      .ilike("white_label_dominio", h)
      .eq("role", "ENTERPRISE")
      .is("enterprise_id", null)
      .maybeSingle();
    if (error) return { erro: true };
    if (!data) return null;
    const tema = validarTema((data as { white_label_tema?: unknown }).white_label_tema, prefixoBucketWhiteLabel(process.env.NEXT_PUBLIC_SUPABASE_URL));
    const nome = nomeSeguro(data.white_label_nome);
    const corPrincipal = corSegura(tema?.cor_principal, COR_PRINCIPAL_PADRAO);
    const corAcento = corSegura(tema?.cor_acento, COR_ACENTO_PADRAO);
    const iconeUrl = tema?.icone_url ?? null;
    return {
      masterId: data.id as string, nome, corPrincipal, corAcento, iconeUrl, tema,
      logoUrl: (data.white_label_logo_url as string | null) ?? null,
      versao: versaoMarca({ iconeUrl, corPrincipal, corAcento, nome }),
    };
  } catch {
    return { erro: true };
  }
});

export function ehMarca(m: ResultadoMarcaApp): m is MarcaDoApp {
  return !!m && !("erro" in m);
}

export function hostDoPedido(h: Headers): string | null {
  return h.get("x-forwarded-host") ?? h.get("host");
}
