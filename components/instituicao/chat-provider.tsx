"use client";

import { useEffect, useState } from "react";
import { InstituicaoChatWidget } from "./chat-widget";

export function InstituicaoChatProvider() {
  const [instId, setInstId] = useState("");
  const [instNome, setInstNome] = useState("");

  useEffect(() => {
    setInstId(sessionStorage.getItem("instituicao_id") ?? "");
    setInstNome(sessionStorage.getItem("instituicao_nome") ?? "");
  }, []);

  if (!instId || !instNome) return null;
  return <InstituicaoChatWidget instituicaoId={instId} instituicaoNome={instNome} />;
}
