"use client";

import { useState } from "react";
import { AbaConexao } from "./aba-conexao";
import { AbaFinancas } from "./aba-financas";
import { AbaAgenda } from "./aba-agenda";

const ABAS = [
  { id: "conexao", rotulo: "Conexão" },
  { id: "financas", rotulo: "Finanças" },
  { id: "agenda", rotulo: "Agenda" },
] as const;

export function MeuAssistenteClient() {
  const [aba, setAba] = useState<(typeof ABAS)[number]["id"]>("conexao");
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-[32px] font-semibold text-[#F0ECE4] mb-1">MY ASSISTANT IA</h1>
      <p className="text-[13px] text-[#7A8FA8] mb-5">Seu painel pessoal, alimentado pelo WhatsApp por texto ou áudio.</p>
      <div className="flex gap-1 border-b border-[#243A66] mb-5" role="tablist">
        {ABAS.map((a) => (
          <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} onClick={() => setAba(a.id)}
            className={`px-4 py-2 text-[13px] font-medium border-b-2 -mb-px ${aba === a.id ? "border-[#C9A84C] text-[#C9A84C]" : "border-transparent text-[#7A8FA8] hover:text-[#F0ECE4]"}`}>
            {a.rotulo}
          </button>
        ))}
      </div>
      {aba === "conexao" && <AbaConexao />}
      {aba === "financas" && <AbaFinancas />}
      {aba === "agenda" && <AbaAgenda />}
    </div>
  );
}
