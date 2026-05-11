"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  CheckCircle2, Loader2, ArrowRight, TrendingUp,
  Building2, ShoppingBag, Zap, CreditCard, BarChart3,
} from "lucide-react";

const GOLD = "#C9A84C";
const NAVY = "#09081A";
const NAVY_CARD = "#162744";
const NAVY_BASE = "#111F35";
const MUTED = "#7A8FA8";

const ORIGENS = [
  { value: "linkedin",  label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube",   label: "YouTube" },
  { value: "google",    label: "Google" },
  { value: "indicacao", label: "Indicação de alguém" },
  { value: "evento",    label: "Evento / Palestra" },
  { value: "outro",     label: "Outro" },
];

const ESTADOS_BR = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS",
  "MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const DIFERENCIAIS = [
  { icon: TrendingUp,  titulo: "Até 60% de comissão",         desc: "A maior comissão do mercado financeiro" },
  { icon: CreditCard,  titulo: "20+ linhas de crédito",        desc: "Home Equity, CGI, CRI, FIDC, Consórcio e mais" },
  { icon: BarChart3,   titulo: "+R$ 3 bi intermediados",       desc: "Histórico comprovado de estruturação" },
  { icon: Building2,   titulo: "M&A e Real Estate",            desc: "Estruturação de negócios cross-border" },
  { icon: ShoppingBag, titulo: "Marketplace V3",               desc: "Acesso a produtos e fornecedores exclusivos" },
  { icon: Zap,         titulo: "Inteligência Tributária",      desc: "Split fiscal e otimização tributária" },
];

export function IndicacaoForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("ref") ?? "";

  const [form, setForm] = useState({
    nome: "", documento: "", email: "", telefone: "",
    cidade: "", estado: "", origem: "", indicado_por_nome: "",
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.nome.trim() || !form.email.trim()) {
      setErr("Nome e e-mail são obrigatórios"); return;
    }
    setSaving(true); setErr(null);
    try {
      const r = await fetch("/api/prospeccao/publico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, token }),
      }).then(r => r.json());
      if (r.error) { setErr(r.error); return; }
      setDone(true);
    } catch {
      setErr("Erro ao enviar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full rounded-xl px-4 py-3 text-sm text-white border border-white/10 focus:border-yellow-500/40 focus:outline-none transition-colors";

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: NAVY }}>
        <div className="text-center space-y-5 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Recebemos seus dados!</h2>
            <p className="text-sm mt-2" style={{ color: MUTED }}>
              Nossa equipe comercial entrará em contato em breve para apresentar a plataforma e esclarecer todas as suas dúvidas.
            </p>
          </div>
          <div className="rounded-2xl p-4 border text-left space-y-1" style={{ background: NAVY_CARD, borderColor: `${GOLD}30` }}>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>V3 Partners</p>
            <p className="text-xs" style={{ color: MUTED }}>Boutique institucional multiproduto de securitização e estruturação financeira.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: NAVY }}>

      {/* Header */}
      <div className="border-b border-white/5 px-6 py-4 flex items-center gap-3" style={{ background: NAVY_BASE }}>
        <div className="relative w-8 h-8">
          <Image src="/logo.jpg" alt="V3 Partners" fill className="object-contain rounded" />
        </div>
        <span className="text-sm font-bold text-white">V3 Partners</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">

        {/* Hero */}
        <div className="text-center space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>
            Rede de Partners
          </p>
          <h1 className="text-3xl font-bold text-white leading-tight">
            Transforme seu network<br />em receita recorrente
          </h1>
          <p className="text-sm max-w-md mx-auto" style={{ color: MUTED }}>
            Acesse a plataforma completa V3 Partners e comece a estruturar operações com as melhores condições do mercado financeiro.
          </p>
        </div>

        {/* Diferenciais */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {DIFERENCIAIS.map(d => (
            <div
              key={d.titulo}
              className="rounded-xl p-3 border border-white/5 flex gap-2 items-start"
              style={{ background: NAVY_CARD }}
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${GOLD}20` }}>
                <d.icon className="w-3.5 h-3.5" style={{ color: GOLD }} />
              </div>
              <div>
                <p className="text-xs font-bold text-white leading-tight">{d.titulo}</p>
                <p className="text-[10px] mt-0.5 leading-tight" style={{ color: MUTED }}>{d.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Plataforma completa — chips */}
        <div className="rounded-2xl border border-white/5 p-4" style={{ background: NAVY_BASE }}>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: GOLD }}>
            Plataforma completa inclui
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              "Crédito Estruturado", "M&A", "Marketplace", "Inteligência Tributária",
              "Consórcio", "Home Equity", "KYC & Compliance", "CRM",
              "Mesa de Crédito", "Academy", "IA Partner", "Split Fiscal",
            ].map(m => (
              <span
                key={m}
                className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-white/10"
                style={{ color: "#F0ECE4", background: NAVY_CARD }}
              >
                {m}
              </span>
            ))}
          </div>
        </div>

        {/* Formulário */}
        <div className="rounded-2xl border border-white/10 p-5 space-y-4" style={{ background: NAVY_BASE }}>
          <div>
            <p className="text-base font-bold text-white">Quero ser Partner V3</p>
            <p className="text-xs mt-0.5" style={{ color: MUTED }}>Nossa equipe entrará em contato para apresentar a plataforma</p>
          </div>

          {/* Nome */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest mb-1 block" style={{ color: GOLD }}>
              Nome completo / Razão social *
            </label>
            <input
              value={form.nome}
              onChange={e => set("nome", e.target.value)}
              placeholder="Seu nome ou empresa"
              className={inputCls}
              style={{ background: NAVY_CARD }}
            />
          </div>

          {/* Documento + Telefone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest mb-1 block" style={{ color: MUTED }}>
                CPF / CNPJ
              </label>
              <input
                value={form.documento}
                onChange={e => set("documento", e.target.value)}
                placeholder="000.000.000-00"
                className={inputCls}
                style={{ background: NAVY_CARD }}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest mb-1 block" style={{ color: MUTED }}>
                Telefone / WhatsApp
              </label>
              <input
                value={form.telefone}
                onChange={e => set("telefone", e.target.value)}
                placeholder="(11) 99999-9999"
                className={inputCls}
                style={{ background: NAVY_CARD }}
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest mb-1 block" style={{ color: GOLD }}>
              E-mail *
            </label>
            <input
              type="email"
              value={form.email}
              onChange={e => set("email", e.target.value)}
              placeholder="seu@email.com"
              className={inputCls}
              style={{ background: NAVY_CARD }}
            />
          </div>

          {/* Cidade + Estado */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest mb-1 block" style={{ color: MUTED }}>
                Cidade
              </label>
              <input
                value={form.cidade}
                onChange={e => set("cidade", e.target.value)}
                placeholder="São Paulo"
                className={inputCls}
                style={{ background: NAVY_CARD }}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest mb-1 block" style={{ color: MUTED }}>
                Estado
              </label>
              <select
                value={form.estado}
                onChange={e => set("estado", e.target.value)}
                className={inputCls}
                style={{ background: NAVY_CARD }}
              >
                <option value="">UF</option>
                {ESTADOS_BR.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Origem */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest mb-1 block" style={{ color: MUTED }}>
              Como conheceu a V3 Partners?
            </label>
            <select
              value={form.origem}
              onChange={e => set("origem", e.target.value)}
              className={inputCls}
              style={{ background: NAVY_CARD }}
            >
              <option value="">Selecione</option>
              {ORIGENS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {form.origem === "indicacao" && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest mb-1 block" style={{ color: MUTED }}>
                Quem te indicou?
              </label>
              <input
                value={form.indicado_por_nome}
                onChange={e => set("indicado_por_nome", e.target.value)}
                placeholder="Nome de quem te indicou"
                className={inputCls}
                style={{ background: NAVY_CARD }}
              />
            </div>
          )}

          {err && <p className="text-xs text-red-400">{err}</p>}

          <button
            onClick={submit}
            disabled={saving}
            className="w-full py-3.5 rounded-xl font-bold text-sm text-black flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60"
            style={{ background: GOLD }}
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</>
              : <><ArrowRight className="w-4 h-4" /> Quero ser Partner V3</>
            }
          </button>

          <p className="text-[10px] text-center" style={{ color: MUTED }}>
            Seus dados são usados apenas para contato comercial pela equipe V3 Partners.
          </p>
        </div>

      </div>
    </div>
  );
}
