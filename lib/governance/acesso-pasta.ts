// Pasta Pública (bucket v3-docs-publico): regra única de acesso por pasta.
// BRIEF docs/briefs/2026-11-24_pasta-publica-acesso-direto-e-listagem.md. Funções puras; as rotas carregam as
// concessões do banco (com a chave de serviço) e perguntam aqui.

export const PAPEIS_EQUIPE_PASTA = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

/** Subpastas que perfil externo não vê, por vertical (duplo cego). Vertical fora da lista: externo não vê subpasta. */
export const SUBPASTAS_OCULTAS_EXTERNO: Record<string, readonly string[]> = {
  MA: ["05_Propostas", "06_Contrato", "07_Closing"],
  Credito: ["03_Parecer", "04_Contrato", "05_Monitoramento"],
};

export const AVISO_SUBPASTAS = "Algumas pastas são liberadas em etapas posteriores da operação.";
export const MSG_SEM_ACESSO_PASTA = "Sem acesso a esta pasta";
export const MSG_SEM_ACESSO_ARQUIVO = "Sem acesso a este arquivo";

export interface Concessao {
  full_path: string;
  vertical: string | null;
  expires_at: string | null;
  /** O usuário é o dono da operação da pasta (originador do deal ou partner da proposta). Calculado pela rota. */
  dono: boolean;
}

export interface ItemListado {
  name: string;
  is_folder: boolean;
}

export function ehAdmin(papel: string | null | undefined): boolean {
  return papel === "ADMIN";
}

export function ehExterno(papel: string | null | undefined): boolean {
  return !(PAPEIS_EQUIPE_PASTA as readonly string[]).includes(papel ?? "");
}

/** Caminho sem "..", sem barra inicial ou final e sem barra dupla. Vazio é a raiz (válido). */
export function caminhoSeguro(caminho: string): boolean {
  if (caminho === "") return true;
  if (caminho.startsWith("/") || caminho.endsWith("/") || caminho.includes("//") || caminho.includes("\\")) return false;
  return !caminho.split("/").some(p => p === ".." || p === ".");
}

export function concessaoValida(c: Concessao, agoraIso: string): boolean {
  return !c.expires_at || c.expires_at > agoraIso;
}

/** Concessões que valem: dentro da validade e, para externo, só da operação de que ele é dono. */
export function concessoesEfetivas(papel: string | null | undefined, concessoes: Concessao[], agoraIso: string): Concessao[] {
  const externo = ehExterno(papel);
  return concessoes.filter(c => concessaoValida(c, agoraIso) && (!externo || c.dono));
}

function dentroDe(caminho: string, base: string): boolean {
  return caminho === base || caminho.startsWith(base + "/");
}

/** Para externo: o caminho cai numa subpasta oculta da pasta concedida? */
export function emSubpastaOculta(c: Concessao, caminho: string): boolean {
  if (caminho === c.full_path) return false;
  const primeira = caminho.slice(c.full_path.length + 1).split("/")[0];
  const ocultas = SUBPASTAS_OCULTAS_EXTERNO[c.vertical ?? ""];
  if (!ocultas) return true; // vertical sem regra: nenhuma subpasta para externo
  return ocultas.includes(primeira);
}

/** O caminho (pasta ou arquivo) está dentro de uma pasta concedida e, para externo, fora de subpasta oculta? */
export function podeAcessarCaminho(papel: string | null | undefined, efetivas: Concessao[], caminho: string): boolean {
  if (!caminhoSeguro(caminho)) return false;
  if (ehAdmin(papel)) return true;
  const externo = ehExterno(papel);
  return efetivas.some(c => dentroDe(caminho, c.full_path) && (!externo || !emSubpastaOculta(c, caminho)));
}

export function ordenarItens<T extends ItemListado>(itens: T[]): T[] {
  return [...itens].sort((a, b) => {
    if (a.is_folder !== b.is_folder) return a.is_folder ? -1 : 1;
    return a.name.localeCompare(b.name, "pt-BR");
  });
}

export type ResultadoListagem<T> = { ok: true; itens: T[]; aviso: string | null } | { ok: false };

/**
 * Filtra o que o Storage listou em `caminho`:
 * - dentro de pasta concedida: tudo, menos subpastas ocultas para externo (com aviso neutro na pasta do deal);
 * - raiz ou pasta-mãe de pasta concedida: só os itens que levam a uma pasta concedida;
 * - fora disso: sem acesso.
 */
export function filtrarListagem<T extends ItemListado>(
  papel: string | null | undefined, efetivas: Concessao[], caminho: string, itens: T[],
): ResultadoListagem<T> {
  if (!caminhoSeguro(caminho)) return { ok: false };
  if (ehAdmin(papel)) return { ok: true, itens: ordenarItens(itens), aviso: null };
  const externo = ehExterno(papel);
  const filho = (nome: string) => (caminho ? `${caminho}/${nome}` : nome);

  const base = efetivas.find(c => dentroDe(caminho, c.full_path));
  if (base) {
    if (externo && emSubpastaOculta(base, caminho)) return { ok: false };
    if (!externo) return { ok: true, itens: ordenarItens(itens), aviso: null };
    const visiveis = itens.filter(i => !i.is_folder || !emSubpastaOculta(base, filho(i.name)));
    const escondeu = caminho === base.full_path && visiveis.length < itens.length;
    return { ok: true, itens: ordenarItens(visiveis), aviso: escondeu ? AVISO_SUBPASTAS : null };
  }

  // A raiz sempre responde (lista vazia para quem não tem concessão); pasta-mãe só se levar a uma concedida.
  const ancestral = caminho === "" || efetivas.some(c => c.full_path.startsWith(caminho + "/"));
  if (!ancestral) return { ok: false };
  const leva = itens.filter(i => i.is_folder && efetivas.some(c => c.full_path === filho(i.name) || c.full_path.startsWith(filho(i.name) + "/")));
  return { ok: true, itens: ordenarItens(leva), aviso: null };
}
