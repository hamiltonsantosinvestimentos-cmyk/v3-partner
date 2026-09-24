"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, Wallet, Palette, Loader2, Plus, FileDown, Check, X, Pencil, Upload } from "lucide-react";
import type { Marca } from "@/lib/enterprise";
import type { RepasseLinha, ResumoUsuario } from "@/lib/enterprise-repasses";

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

type Usuario = {
  id: string; full_name: string | null; email: string; phone: string | null;
  is_active: boolean | null; enterprise_repasse_percent: number | null; created_at: string;
};

type Aba = "usuarios" | "repasses" | "marca";

function mesesOpcoes() {
  const out = [{ chave: "todos", label: "Todo o período" }];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 15);
    out.push({ chave: `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`, label: x.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) });
  }
  return out;
}

const input = "h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50";

// ─── Usuários ────────────────────────────────────────────────────────────────
function AbaUsuarios({ limite }: { limite: number }) {
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [novo, setNovo] = useState({ nome: "", email: "", telefone: "", percentual: "" });
  const [criando, setCriando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editPct, setEditPct] = useState("");

  const carregar = useCallback(async () => {
    const r = await fetch("/api/enterprise/usuarios");
    const j = await r.json();
    if (!r.ok) { setErro(j.error ?? "Falha ao carregar"); return; }
    setUsuarios(j.usuarios);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  async function criar() {
    setCriando(true); setErro(null); setAviso(null);
    const r = await fetch("/api/enterprise/usuarios", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: novo.nome, email: novo.email, telefone: novo.telefone, percentual: Number(novo.percentual.replace(",", ".") || 0) }),
    });
    const j = await r.json();
    setCriando(false);
    if (!r.ok) { setErro(j.error ?? "Falha ao criar"); return; }
    setAviso(`Acesso criado. Convite enviado para ${novo.email} (senha temporária: ${j.senha_temporaria}).`);
    setNovo({ nome: "", email: "", telefone: "", percentual: "" });
    carregar();
  }

  async function atualizar(id: string, patch: Record<string, unknown>) {
    setErro(null);
    const r = await fetch("/api/enterprise/usuarios", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...patch }) });
    const j = await r.json();
    if (!r.ok) { setErro(j.error ?? "Falha ao salvar"); return; }
    setEditId(null);
    carregar();
  }

  const usados = usuarios?.length ?? 0;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
        <p className="text-sm font-semibold text-white flex items-center gap-2"><Plus className="w-4 h-4 text-[#C9A84C]" /> Novo usuário <span className="text-xs font-normal text-muted-foreground">({usados}/{limite})</span></p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input className={input} placeholder="Nome completo" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
          <input className={input} placeholder="E-mail" type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} />
          <input className={input} placeholder="Telefone (opcional)" value={novo.telefone} onChange={(e) => setNovo({ ...novo, telefone: e.target.value })} />
          <div className="flex gap-2">
            <input className={`${input} w-24`} placeholder="% com." inputMode="decimal" value={novo.percentual} onChange={(e) => setNovo({ ...novo, percentual: e.target.value.replace(/[^0-9,.]/g, "") })} />
            <button onClick={criar} disabled={criando || usados >= limite || !novo.nome || !novo.email}
              className="flex-1 h-9 px-3 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-bold disabled:opacity-40 flex items-center justify-center gap-1.5">
              {criando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Criar acesso
            </button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          % de comissão do usuário = parte dos seus 55% em cada venda dele. Ex.: 40% → numa venda que gera R$ 10.000 de comissão para você, você repassa R$ 4.000 a ele.
        </p>
        {aviso && <p className="text-xs text-emerald-400">{aviso}</p>}
        {erro && <p className="text-xs text-red-400">{erro}</p>}
      </div>

      <div className="rounded-xl border border-border/50 bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50">
              {["Usuário", "E-mail", "Telefone", "% comissão", "Situação", ""].map((h) => (
                <th key={h} className="text-left px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {usuarios === null && <tr><td colSpan={6} className="px-3 py-6 text-center"><Loader2 className="w-4 h-4 animate-spin inline text-muted-foreground" /></td></tr>}
            {usuarios?.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">Nenhum usuário ainda.</td></tr>}
            {usuarios?.map((u) => (
              <tr key={u.id} className="border-b border-border/30">
                <td className="px-3 py-2 font-medium text-foreground">{u.full_name ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{u.email}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{u.phone ?? "—"}</td>
                <td className="px-3 py-2">
                  {editId === u.id ? (
                    <div className="flex items-center gap-1">
                      <input className={`${input} w-20 h-7`} value={editPct} inputMode="decimal" autoFocus onChange={(e) => setEditPct(e.target.value.replace(/[^0-9,.]/g, ""))} />
                      <button onClick={() => atualizar(u.id, { percentual: Number(editPct.replace(",", ".") || 0) })} className="p-1 text-emerald-400"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditId(null)} className="p-1 text-muted-foreground"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditId(u.id); setEditPct(String(u.enterprise_repasse_percent ?? 0)); }} className="flex items-center gap-1.5 text-foreground hover:text-[#E8C97A]">
                      {u.enterprise_repasse_percent ?? 0}% <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${u.is_active === false ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                    {u.is_active === false ? "Bloqueado" : "Ativo"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => { if (window.confirm(u.is_active === false ? "Reativar o acesso deste usuário?" : "Bloquear o acesso deste usuário? Ele não conseguirá mais entrar.")) atualizar(u.id, { ativo: u.is_active === false }); }}
                    className="text-xs text-muted-foreground hover:text-white"
                  >
                    {u.is_active === false ? "Reativar" : "Bloquear"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Alterar o % vale para as próximas comissões; repasses já gerados mantêm o % da época. O relatório mensal e o Kanban da Mesa de Crédito mostram as propostas de toda a sua equipe.
      </p>
    </div>
  );
}

// ─── Repasses ────────────────────────────────────────────────────────────────
function AbaRepasses({ ehMaster }: { ehMaster: boolean }) {
  const [mes, setMes] = useState("todos");
  const [dados, setDados] = useState<{ linhas: RepasseLinha[]; porUsuario: ResumoUsuario[]; totais: { total: number; pendente: number; pago: number } } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setDados(null); setErro(null);
    const r = await fetch(`/api/enterprise/repasses?mes=${mes}`);
    const j = await r.json();
    if (!r.ok) { setErro(j.error ?? "Falha ao carregar"); return; }
    setDados(j); setSel(new Set());
  }, [mes]);
  useEffect(() => { carregar(); }, [carregar]);

  async function marcar(status: "PAGO" | "PENDENTE") {
    if (sel.size === 0) return;
    setSalvando(true);
    const r = await fetch("/api/enterprise/repasses", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [...sel], status }) });
    const j = await r.json();
    setSalvando(false);
    if (!r.ok) { setErro(j.error ?? "Falha ao salvar"); return; }
    carregar();
  }

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const statusCor: Record<string, string> = { PENDENTE: "text-amber-400", PAGO: "text-emerald-400", CANCELADO: "text-muted-foreground line-through" };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={mes} onChange={(e) => setMes(e.target.value)} className={`${input} capitalize`}>
          {mesesOpcoes().map((m) => <option key={m.chave} value={m.chave}>{m.label}</option>)}
        </select>
        <a href={`/api/enterprise/repasses/pdf?mes=${mes}`} className="h-9 px-3 rounded-lg border border-border text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-secondary">
          <FileDown className="w-3.5 h-3.5" /> Gerar PDF
        </a>
        {ehMaster && (
          <>
            <button onClick={() => marcar("PAGO")} disabled={sel.size === 0 || salvando} className="h-9 px-3 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-semibold disabled:opacity-40">
              Marcar {sel.size || ""} como pago
            </button>
            <button onClick={() => marcar("PENDENTE")} disabled={sel.size === 0 || salvando} className="h-9 px-3 rounded-lg border border-border text-muted-foreground text-xs font-semibold disabled:opacity-40">
              Voltar para a pagar
            </button>
          </>
        )}
      </div>

      {erro && <p className="text-xs text-red-400">{erro}</p>}
      {!dados && !erro && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}

      {dados && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[["A pagar", dados.totais.pendente, "text-amber-300"], ["Pago", dados.totais.pago, "text-emerald-300"], ["Total", dados.totais.total, "text-white"]].map(([l, v, c]) => (
              <div key={l as string} className="rounded-xl border border-border/50 bg-card p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{ehMaster ? `${l}` : l === "A pagar" ? "A receber" : l === "Pago" ? "Recebido" : "Total"}</p>
                <p className={`text-xl font-bold mt-1 ${c}`}>{brl(v as number)}</p>
              </div>
            ))}
          </div>

          {ehMaster && (
            <div className="rounded-xl border border-border/50 bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border/50">
                  {["Usuário", "% atual", "Vendas", "A pagar", "Pago", "Total"].map((h) => <th key={h} className="text-left px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>)}
                </tr></thead>
                <tbody>
                  {dados.porUsuario.map((u) => (
                    <tr key={u.usuarioId} className="border-b border-border/30">
                      <td className="px-3 py-2 font-medium">{u.usuarioNome}</td>
                      <td className="px-3 py-2 text-xs">{u.percentualAtual ?? 0}%</td>
                      <td className="px-3 py-2">{u.qtd}</td>
                      <td className="px-3 py-2 text-amber-300">{brl(u.pendente)}</td>
                      <td className="px-3 py-2 text-emerald-300">{brl(u.pago)}</td>
                      <td className="px-3 py-2">{brl(u.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="rounded-xl border border-border/50 bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border/50">
                {[ehMaster ? "" : null, "Data", ehMaster ? "Usuário" : null, "Operação", "Comissão Enterprise", "%", "Repasse", "Situação"].filter((h) => h !== null).map((h, i) => <th key={i} className="text-left px-3 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>)}
              </tr></thead>
              <tbody>
                {dados.linhas.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-xs text-muted-foreground">Nenhum repasse no período. Repasses nascem quando uma venda de usuário tem o recurso liberado.</td></tr>}
                {dados.linhas.map((l) => (
                  <tr key={l.id} className="border-b border-border/30">
                    {ehMaster && <td className="pl-3 py-2"><input type="checkbox" disabled={l.status === "CANCELADO"} checked={sel.has(l.id)} onChange={() => toggle(l.id)} /></td>}
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{new Date(l.criadoEm).toLocaleDateString("pt-BR")}</td>
                    {ehMaster && <td className="px-3 py-2">{l.usuarioNome}</td>}
                    <td className="px-3 py-2 text-xs"><span className="font-mono text-[#C9A84C]">{l.operacao ?? "—"}</span> <span className="text-muted-foreground">{l.descricao ?? ""}</span></td>
                    <td className="px-3 py-2 whitespace-nowrap">{brl(l.comissaoMaster)}</td>
                    <td className="px-3 py-2 text-xs">{l.percentual}%</td>
                    <td className="px-3 py-2 font-semibold whitespace-nowrap">{brl(l.valor)}</td>
                    <td className={`px-3 py-2 text-xs ${statusCor[l.status]}`}>
                      {l.status === "PENDENTE" ? (ehMaster ? "A pagar" : "A receber") : l.status === "PAGO" ? `Pago${l.pagoEm ? ` em ${new Date(l.pagoEm).toLocaleDateString("pt-BR")}` : ""}` : "Cancelado"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Repasse = % do usuário × comissão do Enterprise (55%) na venda. O valor acompanha a comissão autorizada pela V3; comissão cancelada zera o repasse. Quem paga o repasse é o Enterprise.
          </p>
        </>
      )}
    </div>
  );
}

// ─── Marca ───────────────────────────────────────────────────────────────────
function AbaMarca({ marcaInicial }: { marcaInicial: Marca | null }) {
  const [marca, setMarca] = useState<Marca | null>(marcaInicial);
  const [nome, setNome] = useState(marcaInicial?.nome ?? "");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function salvar(removerLogo = false) {
    setSalvando(true); setMsg(null);
    const fd = new FormData();
    fd.append("nome", nome);
    if (arquivo) fd.append("logo", arquivo);
    if (removerLogo) fd.append("remover_logo", "1");
    const r = await fetch("/api/enterprise/marca", { method: "POST", body: fd });
    const j = await r.json();
    setSalvando(false);
    if (!r.ok) { setMsg(j.error ?? "Falha ao salvar"); return; }
    setMarca(j.marca); setArquivo(null);
    setMsg("Marca salva. Recarregue a página para ver no menu.");
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4 max-w-xl">
      <div className="flex items-center gap-4">
        <div className="w-24 h-24 rounded-xl border border-border/50 bg-[#09081A] flex items-center justify-center overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {marca?.logoUrl ? <img src={marca.logoUrl} alt={marca.nome} className="max-w-full max-h-full object-contain" /> : <Palette className="w-8 h-8 text-muted-foreground/40" />}
        </div>
        <div className="text-xs text-muted-foreground">
          O logo e o nome aparecem para você e para os seus usuários: menu da plataforma, página pública, relatórios/PDFs e e-mails.
          <br />PNG, JPG, WEBP ou SVG até 2MB. Fundo transparente fica melhor.
        </div>
      </div>
      <div className="space-y-2">
        <input className={`${input} w-full`} placeholder="Nome da marca" value={nome} onChange={(e) => setNome(e.target.value)} />
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <Upload className="w-3.5 h-3.5" />
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} className="text-xs" />
        </label>
      </div>
      <div className="flex gap-2">
        <button onClick={() => salvar()} disabled={salvando} className="h-9 px-4 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-bold disabled:opacity-40 flex items-center gap-1.5">
          {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Salvar marca
        </button>
        {marca?.logoUrl && (
          <button onClick={() => salvar(true)} disabled={salvando} className="h-9 px-3 rounded-lg border border-border text-xs text-muted-foreground">Remover logo</button>
        )}
      </div>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}

export function EnterpriseClient({ ehMaster, marcaInicial, limite }: { ehMaster: boolean; marcaInicial: Marca | null; limite: number }) {
  const [aba, setAba] = useState<Aba>(ehMaster ? "usuarios" : "repasses");
  const abas: { id: Aba; label: string; icon: typeof Users }[] = ehMaster
    ? [{ id: "usuarios", label: "Usuários", icon: Users }, { id: "repasses", label: "Repasses a pagar", icon: Wallet }, { id: "marca", label: "Marca", icon: Palette }]
    : [{ id: "repasses", label: "Meus repasses", icon: Wallet }];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1 border-b border-border/50">
        {abas.map((a) => (
          <button key={a.id} onClick={() => setAba(a.id)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px flex items-center gap-1.5 ${aba === a.id ? "border-[#C9A84C] text-white" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <a.icon className="w-4 h-4" /> {a.label}
          </button>
        ))}
      </div>
      {aba === "usuarios" && <AbaUsuarios limite={limite} />}
      {aba === "repasses" && <AbaRepasses ehMaster={ehMaster} />}
      {aba === "marca" && <AbaMarca marcaInicial={marcaInicial} />}
    </div>
  );
}
