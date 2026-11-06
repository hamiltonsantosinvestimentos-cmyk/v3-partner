// Respostas padrão da API v1: JSON em português, erro no formato { erro: { codigo, mensagem, campos } }.
import { NextResponse } from "next/server";

export type CodigoErro =
  | "dados_invalidos" | "documento_estrangeiro_nao_suportado" | "chave_invalida" | "chave_vencida"
  | "ip_nao_permitido" | "ip_bloqueado" | "termo_pendente" | "sem_permissao" | "sem_acesso"
  | "nao_encontrada" | "referencia_repetida" | "arquivo_grande" | "tipo_nao_aceito"
  | "regra_de_credito" | "limite_excedido" | "idempotency_key_obrigatoria" | "erro_interno"
  | "em_processamento" | "limite_de_envios";

export class ErroApi extends Error {
  constructor(
    public status: number,
    public codigo: CodigoErro,
    mensagem: string,
    public campos?: Record<string, string>,
    public headers?: Record<string, string>,
    public extra?: Record<string, unknown>,
  ) {
    super(mensagem);
  }
}

export function respostaErro(e: ErroApi): NextResponse {
  return NextResponse.json(
    { erro: { codigo: e.codigo, mensagem: e.message, ...(e.campos ? { campos: e.campos } : {}) }, ...(e.extra ?? {}) },
    { status: e.status, headers: { "Cache-Control": "no-store", ...(e.headers ?? {}) } },
  );
}

export function respostaOk(corpo: unknown, status = 200): NextResponse {
  return NextResponse.json(corpo, { status, headers: { "Cache-Control": "no-store" } });
}

/** Data/hora em ISO 8601 com fuso de Brasília (-03:00), como a documentação promete. */
export function isoBrasilia(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const t = new Date(valor).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t - 3 * 3600_000).toISOString().replace(/\.\d{3}Z$/, "-03:00");
}
