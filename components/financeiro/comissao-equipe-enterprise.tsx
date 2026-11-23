"use client";
// Quadro "Comissão da equipe" do master Enterprise na aba Comissões (BRIEF 2026-11-23 menu enxuto e comissões).
// Grava pelo mesmo PATCH /api/enterprise/usuarios de Enterprise › Usuários (validação e auditoria no servidor).
import { useState } from "react";
import { Check, Loader2, Pencil, Users, X } from "lucide-react";

export interface UsuarioEquipe {
  id: string;
  nome: string;
  ativo: boolean;
  percentual: number;
}

const fmtPct = (n: number) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

/** "12,5" ou "12.5" → 12.5; vazio ou inválido → null. */
function lerPercentual(v: string): number | null {
  const s = v.trim();
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  if (!v.trim() || !Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

export function ComissaoEquipeEnterprise({ usuariosIniciais }: { usuariosIniciais: UsuarioEquipe[] }) {
  const [usuarios, setUsuarios] = useState(usuariosIniciais);
  const [editando, setEditando] = useState<string | null>(null);
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function salvar(u: UsuarioEquipe) {
    const novo = lerPercentual(valor);
    if (novo == null || novo < 0 || novo > 100) { setMsg("Informe um % entre 0 e 100."); return; }
    setSalvando(true); setMsg(null);
    const r = await fetch("/api/enterprise/usuarios", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, percentual: novo }),
    });
    const j = await r.json().catch(() => ({}));
    setSalvando(false);
    if (!r.ok) { setMsg(j.error ?? "Não foi possível salvar."); return; }
    setUsuarios((lista) => lista.map((x) => (x.id === u.id ? { ...x, percentual: novo } : x)));
    setEditando(null);
    setMsg(`${u.nome}: de ${fmtPct(u.percentual)} para ${fmtPct(novo)}. Vale para as próximas comissões.`);
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><Users className="w-4 h-4 text-[#C9A84C]" /> Comissão da equipe</h2>
        <p className="text-xs text-muted-foreground">O % vale para as próximas comissões. As já geradas mantêm o % da época.</p>
      </div>
      {usuarios.length === 0 ? (
        <p className="text-xs text-muted-foreground">Você ainda não tem usuários. Cadastre em Enterprise › Usuários.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left py-2 pr-3">Usuário</th>
                <th className="text-left py-2 pr-3">Situação</th>
                <th className="text-left py-2">Comissão do usuário</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="border-t border-border/40">
                  <td className="py-2 pr-3 text-foreground">{u.nome}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{u.ativo ? "Ativo" : "Inativo"}</td>
                  <td className="py-2">
                    {editando === u.id ? (
                      <span className="flex items-center gap-1.5">
                        <input autoFocus inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value.replace(/[^0-9.,]/g, ""))}
                          onKeyDown={(e) => { if (e.key === "Enter") salvar(u); if (e.key === "Escape") setEditando(null); }}
                          className="h-7 w-20 px-2 rounded bg-secondary border border-border text-foreground" aria-label={`% de ${u.nome}`} />
                        <span className="text-muted-foreground">%</span>
                        <button onClick={() => salvar(u)} disabled={salvando} className="p-1 text-[#C9A84C] disabled:opacity-40" aria-label="Salvar">
                          {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => setEditando(null)} className="p-1 text-muted-foreground" aria-label="Cancelar"><X className="w-3.5 h-3.5" /></button>
                      </span>
                    ) : (
                      <button onClick={() => { setEditando(u.id); setValor(u.percentual.toLocaleString("pt-BR", { maximumFractionDigits: 2 })); setMsg(null); }}
                        className="flex items-center gap-1.5 text-foreground hover:text-[#E8C97A]">
                        {fmtPct(u.percentual)} <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}
