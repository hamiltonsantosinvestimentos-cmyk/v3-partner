// Marca do Enterprise dono do domínio acessado, resolvida no servidor para as telas públicas
// (login, esqueci-senha) já saírem com logo, nome e cores dele, sem piscar a V3.
// BRIEF docs/briefs/2026-11-24_login-enterprise-marca-no-servidor.md
// App instalado com a marca: docs/briefs/2026-11-26_app-instalado-marca-enterprise.md
import "server-only";
import { cache } from "react";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import type { Marca } from "@/lib/enterprise";
import { cssVariaveis } from "@/lib/enterprise-tema";
import { urlIcone } from "@/lib/manifest-marca";
import { ehMarca, hostDoPedido, marcaDoAppPorHost } from "@/lib/manifest-marca-server";

export interface MarcaDoHost {
  marca: Marca | null;
  temaCss: string | null;
  iconeUrl: string | null;
  /** Versão do ícone do app (URL canônica de /api/public/app-icone). */
  versao: string | null;
  /** Cor da barra do navegador e do app instalado. */
  corPrincipal: string | null;
}

const VAZIA: MarcaDoHost = { marca: null, temaCss: null, iconeUrl: null, versao: null, corPrincipal: null };

/** Só dados públicos de marca, os mesmos de /api/public/white-label. Vazia em host da V3 ou em falha. */
export const marcaDoHost = cache(async (): Promise<MarcaDoHost> => {
  const m = await marcaDoAppPorHost(hostDoPedido(await headers()));
  if (!ehMarca(m)) return VAZIA;
  const css = m.tema ? cssVariaveis(m.tema) : null;
  return {
    marca: { nome: m.nome, logoUrl: m.logoUrl },
    temaCss: css && css.startsWith(":root{") ? css : null,
    iconeUrl: m.iconeUrl,
    versao: m.versao,
    corPrincipal: m.corPrincipal,
  };
});

/** Metadados do app instalado no domínio do Enterprise (manifesto, ícone do iPhone, título). */
export function metadataDoApp(nome: string, versao: string | null): Metadata {
  return {
    manifest: "/api/public/manifest",
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: nome },
    ...(versao ? { icons: { apple: urlIcone("180", versao) } } : {}),
  };
}

/**
 * Metadados das telas públicas no domínio do Enterprise: título, ícones e a prévia do link
 * (og/twitter) com o logo dele. {} em domínio V3. BRIEF docs/briefs/2026-11-24_previa-de-link-marca-enterprise.md
 * `icons` da página substitui o do layout raiz inteiro, por isso os padrões da V3 entram aqui.
 */
export function metadataDaMarca(marca: Marca | null, iconeUrl: string | null, versao: string | null = null): Metadata {
  if (!marca) return {};
  const descricao = `Acesse a plataforma ${marca.nome}.`;
  const imagem = marca.logoUrl ?? iconeUrl;
  const apple = versao ? urlIcone("180", versao) : iconeUrl ?? marca.logoUrl ?? "/icon-192.png";
  return {
    title: marca.nome,
    description: descricao,
    manifest: "/api/public/manifest",
    icons: { icon: iconeUrl ?? "/favicon.ico", apple },
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: marca.nome },
    openGraph: {
      title: marca.nome, siteName: marca.nome, description: descricao, type: "website",
      ...(imagem ? { images: [{ url: imagem, alt: marca.nome }] } : {}),
    },
    twitter: { card: "summary", title: marca.nome, description: descricao, ...(imagem ? { images: [imagem] } : {}) },
  };
}

/** Cor da barra no domínio do Enterprise; {} em host da V3 (vale o padrão do layout raiz). */
export function viewportDaMarca(corPrincipal: string | null): Viewport {
  return corPrincipal ? { themeColor: corPrincipal } : {};
}

/** generateViewport pronto para as páginas com marca pelo host. */
export async function viewportDoHost(): Promise<Viewport> {
  const { corPrincipal } = await marcaDoHost();
  return viewportDaMarca(corPrincipal);
}
