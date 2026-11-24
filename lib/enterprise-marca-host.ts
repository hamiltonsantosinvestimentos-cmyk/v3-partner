// Marca do Enterprise dono do domínio acessado, resolvida no servidor para as telas públicas
// (login, esqueci-senha) já saírem com logo, nome e cores dele, sem piscar a V3.
// BRIEF docs/briefs/2026-11-24_login-enterprise-marca-no-servidor.md
import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { ehHostV3, enterprisePorDominio, type Marca } from "@/lib/enterprise";
import { cssVariaveis } from "@/lib/enterprise-tema";

export interface MarcaDoHost { marca: Marca | null; temaCss: string | null; iconeUrl: string | null }

const VAZIA: MarcaDoHost = { marca: null, temaCss: null, iconeUrl: null };

/** Só dados públicos de marca, os mesmos de /api/public/white-label. null em host da V3 ou em falha. */
export const marcaDoHost = cache(async (): Promise<MarcaDoHost> => {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (ehHostV3(host)) return VAZIA;
  try {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const e = await enterprisePorDominio(db, host);
    if (!e) return VAZIA;
    const css = e.tema ? cssVariaveis(e.tema) : null;
    return { marca: e.marca, temaCss: css && css.startsWith(":root{") ? css : null, iconeUrl: e.tema?.icone_url ?? null };
  } catch {
    return VAZIA;
  }
});
