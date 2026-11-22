"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Building2, Search, ChevronDown, ChevronRight, ExternalLink, Loader2, ShieldOff, ShieldCheck } from "lucide-react";
import { aviso, confirmar } from "@/lib/aviso";
import { formatDateBr } from "@/lib/cm-indicators";

// Aba "Enterprises" do ADMIN (BRIEF docs/briefs/2026-11-20_aba-enterprises-admin-e-equipe-fora-das-listas.md).

export type EnterpriseLinha = {
  id: string;
  masterNome: string;
  masterEmail: string;
  marca: string | null;
  marcaExibida: string;
  logoUrl: string | null;
  dominio: string | null;
  dominioStatus: string | null;
  ativo: boolean;
  acessoAte: string | null;
  /** Calculado no servidor (data passada). */
  acessoVencido: boolean;
  criadoEm: string;
  equipe: { id: string; nome: string; email: string; ativo: boolean }[];
};

function SeloDominio({ dominio, status }: { dominio: string | null; status: string | null }) {
  if (!dominio) return <span className="text-xs text-muted-foreground">Sem domínio</span>;
  const cor = status === "ativo" ? "bg-emerald-500/10 text-emerald-400" : status === "erro" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400";
  const rotulo = status === "ativo" ? "Ativo" : status === "erro" ? "Erro" : "Aguardando DNS";
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-foreground break-all">{dominio}</span>
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded w-fit ${cor}`}>{rotulo}</span>
    </div>
  );
}

function AcessoAte({ iso, vencido }: { iso: string | null; vencido: boolean }) {
  if (!iso) return <span className="text-xs text-muted-foreground">Sem data</span>;
  const d = new Date(iso);
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-foreground tabular-nums">{formatDateBr(d)}</span>
      {vencido && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">Vencido</span>}
    </div>
  );
}

export function AdminEnterprisesClient({ iniciais, maxUsuarios }: { iniciais: EnterpriseLinha[]; maxUsuarios: number }) {
  const [linhas, setLinhas] = useState(iniciais);
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return linhas;
    return linhas.filter((l) => l.marcaExibida.toLowerCase().includes(q) || l.masterNome.toLowerCase().includes(q));
  }, [linhas, busca]);

  async function alternarAcesso(masterId: string, u: EnterpriseLinha["equipe"][number]) {
    const bloquear = u.ativo;
    const ok = await confirmar(
      bloquear
        ? `Bloquear o acesso de ${u.nome || u.email} à plataforma? Ele deixa de entrar até ser liberado.`
        : `Liberar o acesso de ${u.nome || u.email}?`,
      bloquear
        ? { perigo: true, titulo: "Bloquear acesso", botao: "Bloquear acesso" }
        : { titulo: "Liberar acesso", botao: "Liberar acesso" },
    );
    if (!ok) return;
    setSalvando(u.id);
    try {
      const res = await fetch(`/api/usuarios/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !bloquear }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        aviso((j as { error?: string }).error ?? "Não foi possível alterar o acesso. Tente de novo.");
        return;
      }
      setLinhas((prev) => prev.map((l) => l.id !== masterId ? l : { ...l, equipe: l.equipe.map((x) => x.id === u.id ? { ...x, ativo: !bloquear } : x) }));
      aviso(bloquear ? "Acesso bloqueado." : "Acesso liberado.");
    } finally {
      setSalvando(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Enterprises</h1>
        <p className="text-sm text-muted-foreground mt-1">Clientes Enterprise da V3, a equipe de cada um e o white label.</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          id="busca-enterprises"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por empresa ou master"
          className="w-full h-9 pl-9 pr-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50"
        />
      </div>

      {linhas.length === 0 ? (
        <div className="rounded-xl border border-border p-10 text-center text-sm text-muted-foreground">Nenhum cliente Enterprise ainda.</div>
      ) : (
        <div className="rounded-xl border border-border overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                {["Enterprise", "Usuários", "Domínio", "Acesso até", "Situação", "Ação"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((l) => {
                const ativos = l.equipe.filter((u) => u.ativo).length;
                const expandido = aberto === l.id;
                return (
                  <FragmentoLinha key={l.id}>
                    <tr className="data-table-row align-top">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[#09081A] border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                            {l.logoUrl
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={l.logoUrl} alt={l.marcaExibida} className="w-full h-full object-contain" />
                              : <Building2 className="w-4 h-4 text-muted-foreground" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">{l.marca ?? "Sem marca"}</p>
                            <p className="text-xs text-muted-foreground">{l.masterNome || l.masterEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-foreground tabular-nums" title={`${ativos} ativos`}>{l.equipe.length} de {maxUsuarios}</span>
                      </td>
                      <td className="px-4 py-3"><SeloDominio dominio={l.dominio} status={l.dominioStatus} /></td>
                      <td className="px-4 py-3"><AcessoAte iso={l.acessoAte} vencido={l.acessoVencido} /></td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${l.ativo ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                          {l.ativo ? "Ativo" : "Bloqueado"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <a
                            href={`/enterprise?master=${l.id}`}
                            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-[#C9A84C]/40 text-[#E8C97A] hover:bg-[#C9A84C]/10"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Abrir painel
                          </a>
                          <button
                            type="button"
                            onClick={() => setAberto(expandido ? null : l.id)}
                            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border text-foreground hover:bg-secondary"
                            aria-expanded={expandido}
                          >
                            {expandido ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />} Ver equipe
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandido && (
                      <tr className="border-b border-border/50 bg-secondary/30">
                        <td colSpan={6} className="px-4 py-3">
                          {l.equipe.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Este Enterprise ainda não cadastrou usuários.</p>
                          ) : (
                            <ul className="divide-y divide-border/50">
                              {l.equipe.map((u) => (
                                <li key={u.id} className="flex items-center justify-between gap-3 py-2">
                                  <div className="min-w-0">
                                    <p className="text-sm text-foreground">{u.nome || "Sem nome"}</p>
                                    <p className="text-xs text-muted-foreground break-all">{u.email}</p>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${u.ativo ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                                      {u.ativo ? "Ativo" : "Bloqueado"}
                                    </span>
                                    <button
                                      type="button"
                                      disabled={salvando === u.id}
                                      onClick={() => alternarAcesso(l.id, u)}
                                      className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border disabled:opacity-50 ${u.ativo ? "border-red-500/40 text-red-400 hover:bg-red-500/10" : "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"}`}
                                    >
                                      {salvando === u.id
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        : u.ativo ? <ShieldOff className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                                      {u.ativo ? "Bloquear acesso" : "Liberar acesso"}
                                    </button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </FragmentoLinha>
                );
              })}
              {filtradas.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum Enterprise encontrado para essa busca.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FragmentoLinha({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
