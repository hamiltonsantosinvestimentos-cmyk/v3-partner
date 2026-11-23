"use client";
// Identidade do Enterprise para as telas (BRIEF 2026-11-23 identidade fase 1).
// null = partner da V3 ou equipe interna: a tela mantém os textos de hoje.
// Uma chamada por carregamento de página, compartilhada entre os componentes.
import { useEffect, useState } from "react";
import type { IdentidadeEnterprise } from "@/lib/enterprise-identidade";

let pedido: Promise<IdentidadeEnterprise | null> | null = null;

export function buscarIdentidade(): Promise<IdentidadeEnterprise | null> {
  if (!pedido) {
    pedido = fetch("/api/enterprise/identidade")
      .then((r) => (r.ok ? r.json() : { identidade: null }))
      .then((j: { identidade?: IdentidadeEnterprise | null }) => j.identidade ?? null)
      .catch(() => null);
  }
  return pedido;
}

export function useIdentidadeEnterprise(): IdentidadeEnterprise | null {
  const [id, setId] = useState<IdentidadeEnterprise | null>(null);
  useEffect(() => {
    let vivo = true;
    buscarIdentidade().then((v) => { if (vivo) setId(v); });
    return () => { vivo = false; };
  }, []);
  return id;
}
