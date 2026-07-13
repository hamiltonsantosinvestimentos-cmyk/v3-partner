"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  Settings, Link2, Bell, Shield, Zap, Copy, Check, Plus, Power,
  ExternalLink, BarChart3, Users, TrendingUp, Globe, Mail,
  Database, Key, RefreshCw, CheckCircle2, AlertCircle, Clock,
  ChevronRight, Eye, EyeOff, Trash2, Activity, CreditCard, Briefcase,
  BellRing,
} from "lucide-react";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { EditorRegrasLinhas } from "@/components/mesa-credito/editor-regras-linhas";
import { PortfolioEditor } from "@/components/portfolio/portfolio-editor";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  phone: string;
  document_cpf: string;
  cobranding_slug?: string | null;
  cobranding_bio?: string | null;
  cobranding_whatsapp?: string | null;
  cobranding_instagram?: string | null;
}

interface CaptacaoLink {
  id: string;
  token: string;
  partner_name: string;
  active: boolean;
  uses_count: number;
  created_at: string;
}

interface SystemStats {
  totalUsers: number;
  activePartners: number;
  totalLeads: number;
}

interface Props {
  profile: Profile;
  initialLinks: CaptacaoLink[];
  systemStats: SystemStats | null;
}

type Tab = "captacao" | "notificacoes" | "sistema" | "integracoes" | "cobranding" | "regras-credito" | "portfolio";

const IS_PARTNER = (role: string) => ["PARTNER", "PARTNER_PRO", "ADMIN", "GESTAO"].includes(role);
const IS_ADMIN   = (role: string) => ["ADMIN", "GESTAO"].includes(role);
const IS_ADMIN_ONLY = (role: string) => role === "ADMIN";

const BASE_URL = typeof window !== "undefined"
  ? `${window.location.origin}/c/`
  : "https://app.v3partners.com.br/c/";

function Toast({ msg, type }: { msg: string; type: "success" | "error" }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium ${
      type === "success"
        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
        : "bg-red-500/15 border-red-500/40 text-red-400"
    }`}>
      {type === "success" ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
      {msg}
    </div>
  );
}

function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all bg-[#C9A84C]/15 text-[#E8C97A] border border-[#C9A84C]/30 hover:bg-[#C9A84C]/25">
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copiado!" : label}
    </button>
  );
}

function Toggle({ checked, onChange, label, description, disabled = false }: {
  checked: boolean; onChange: (v: boolean) => void;
  label: string; description?: string; disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-[#1E3050]/50 last:border-0">
      <div>
        <p className="text-sm font-medium text-[#F0ECE4]">{label}</p>
        {description && <p className="text-xs text-[#7A8FA8] mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
          disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
        } ${checked ? "bg-[#C9A84C]" : "bg-[#1E3050]"}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`} />
      </button>
    </div>
  );
}

function IntegrationCard({ name, desc, icon, status, detail }: {
  name: string; desc: string; icon: React.ReactNode;
  status: "ok" | "warn" | "off"; detail?: string;
}) {
  const colors = {
    ok:   { dot: "bg-emerald-400", badge: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20", label: "Ativo" },
    warn: { dot: "bg-amber-400", badge: "bg-amber-400/10 text-amber-400 border-amber-400/20", label: "Atenção" },
    off:  { dot: "bg-[#3A5070]", badge: "bg-[#1E3050] text-[#7A8FA8] border-[#1E3050]", label: "Inativo" },
  };
  const c = colors[status];
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-[#111F35] border border-[#1E3050]/50">
      <div className="w-9 h-9 rounded-lg bg-[#162744] border border-[#1E3050]/50 flex items-center justify-center flex-shrink-0 text-[#C9A84C]">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-[#F0ECE4]">{name}</p>
          <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${c.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
            {c.label}
          </span>
        </div>
        <p className="text-xs text-[#7A8FA8] mt-0.5">{desc}</p>
        {detail && <p className="text-[10px] text-[#3A5070] mt-1 font-mono">{detail}</p>}
      </div>
    </div>
  );
}

function CobrandingTab({ profile }: { profile: Profile }) {
  const [form, setForm] = useState({
    cobranding_slug:      profile.cobranding_slug ?? "",
    cobranding_bio:       profile.cobranding_bio ?? "",
    cobranding_whatsapp:  profile.cobranding_whatsapp ?? "",
    cobranding_instagram: profile.cobranding_instagram ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [err, setErr]       = useState("");

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://app.v3partners.com.br";
  const previewUrl = form.cobranding_slug ? `${baseUrl}/p/${form.cobranding_slug}` : null;

  const inputCls = "w-full h-10 px-3 text-sm rounded-lg border bg-[#0A1628] border-[#243A66] text-[#F0ECE4] placeholder:text-[#3A5070] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50";
  const labelCls = "block text-xs font-semibold text-[#7A8FA8] mb-1.5";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setSaving(true);
    const slug = form.cobranding_slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!slug) { setErr("Informe um link personalizado."); setSaving(false); return; }
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cobranding_slug: slug, cobranding_bio: form.cobranding_bio || null, cobranding_whatsapp: form.cobranding_whatsapp || null, cobranding_instagram: form.cobranding_instagram || null }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error ?? "Erro ao salvar."); setSaving(false); return; }
    setSaved(true); setSaving(false);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-[#C9A84C]/5 border border-[#C9A84C]/20 flex gap-3">
        <Globe className="w-4 h-4 text-[#C9A84C] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-[#C9A84C]">Co-branding exclusivo Partner PRO</p>
          <p className="text-xs text-[#7A8FA8] mt-0.5">Crie sua landing page personalizada com logo V3 + seu perfil. Compartilhe com clientes e indique oportunidades.</p>
        </div>
      </div>
      <form onSubmit={handleSave} className="p-6 rounded-2xl border border-[#1E3050] bg-[#0A1628]/60 space-y-4">
        <div>
          <label className={labelCls}>Seu link personalizado</label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#7A8FA8] whitespace-nowrap">{baseUrl}/p/</span>
            <input
              value={form.cobranding_slug}
              onChange={e => setForm(f => ({ ...f, cobranding_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
              placeholder="seu-nome"
              className={inputCls}
            />
          </div>
          {previewUrl && (
            <a href={previewUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-[#C9A84C] hover:underline">
              <ExternalLink className="w-3 h-3" /> Ver página
            </a>
          )}
        </div>
        <div>
          <label className={labelCls}>Sua bio (exibida na página)</label>
          <textarea
            value={form.cobranding_bio}
            onChange={e => setForm(f => ({ ...f, cobranding_bio: e.target.value }))}
            placeholder="Especialista em soluções financeiras estruturadas..."
            rows={3}
            className="w-full px-3 py-2.5 text-sm rounded-lg border bg-[#0A1628] border-[#243A66] text-[#F0ECE4] placeholder:text-[#3A5070] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50 resize-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>WhatsApp (com DDD)</label>
            <input value={form.cobranding_whatsapp} onChange={e => setForm(f => ({ ...f, cobranding_whatsapp: e.target.value }))} placeholder="11999999999" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Instagram (sem @)</label>
            <input value={form.cobranding_instagram} onChange={e => setForm(f => ({ ...f, cobranding_instagram: e.target.value }))} placeholder="seuperfil" className={inputCls} />
          </div>
        </div>
        {err && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] text-sm font-bold transition-colors disabled:opacity-60">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
          {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar Co-branding"}
        </button>
      </form>
    </div>
  );
}

function PushNotificationsSection() {
  const { isSupported, isSubscribed, permission, loading, subscribe, unsubscribe } =
    usePushNotifications();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleToggle = async () => {
    setError(""); setSuccess("");
    try {
      if (isSubscribed) {
        await unsubscribe();
        setSuccess("Notificações push desativadas.");
      } else {
        await subscribe();
        setSuccess("Notificações push ativadas com sucesso!");
      }
    } catch (e: unknown) {
      setError((e as Error).message ?? "Erro ao configurar notificações.");
    }
    setTimeout(() => { setSuccess(""); setError(""); }, 4000);
  };

  if (!isSupported) {
    return (
      <div className="p-6 rounded-2xl border border-[#1E3050] bg-[#0A1628]/60">
        <h2 className="text-sm font-bold text-[#F0ECE4] flex items-center gap-2 mb-3">
          <BellRing className="w-4 h-4 text-[#C9A84C]" /> Notificações Push
        </h2>
        <p className="text-xs text-[#7A8FA8]">
          Seu navegador não suporta notificações push. Tente no Chrome, Firefox ou Edge.
        </p>
      </div>
    );
  }

  const statusLabel = permission === "denied"
    ? "Bloqueado pelo navegador"
    : isSubscribed
    ? "Ativo"
    : "Inativo";

  const statusColor = permission === "denied"
    ? "text-red-400 border-red-400/20 bg-red-400/10"
    : isSubscribed
    ? "text-emerald-400 border-emerald-400/20 bg-emerald-400/10"
    : "text-[#7A8FA8] border-[#1E3050] bg-[#111F35]";

  return (
    <div className="p-6 rounded-2xl border border-[#1E3050] bg-[#0A1628]/60 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-[#F0ECE4] flex items-center gap-2">
          <BellRing className="w-4 h-4 text-[#C9A84C]" /> Notificações Push
        </h2>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      <p className="text-xs text-[#7A8FA8]">
        Receba alertas mesmo com o navegador fechado — novas mensagens no chat, comissões aprovadas/pagas e alertas importantes da plataforma.
      </p>

      {permission === "denied" ? (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">
            Permissão bloqueada no navegador. Para ativar, vá em Configurações do navegador → Notificações e permita este site.
          </p>
        </div>
      ) : (
        <button
          onClick={handleToggle}
          disabled={loading}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-60 ${
            isSubscribed
              ? "bg-[#1E3050] text-[#7A8FA8] border border-[#243A66] hover:border-red-500/40 hover:text-red-400"
              : "bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A]"
          }`}
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <BellRing className="w-4 h-4" />
          )}
          {loading
            ? "Aguarde..."
            : isSubscribed
            ? "Desativar notificações push"
            : "Ativar notificações push"}
        </button>
      )}

      {success && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <p className="text-xs text-emerald-400">{success}</p>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}

function VideoBoasVindasEditor() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/settings/platform")
      .then(r => r.json())
      .then(d => {
        // Extrai ID do embed ou URL comum do YouTube
        setUrl(d.founder_video_url ?? "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function toEmbed(raw: string): string {
    const clean = raw.trim();
    // Já é URL de embed
    if (clean.includes("youtube.com/embed/")) return clean;
    // youtu.be/ID
    const short = clean.match(/youtu\.be\/([^?&]+)/);
    if (short) return `https://www.youtube.com/embed/${short[1]}`;
    // youtube.com/watch?v=ID
    const watch = clean.match(/[?&]v=([^&]+)/);
    if (watch) return `https://www.youtube.com/embed/${watch[1]}`;
    return clean;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setSaving(true);
    const embedUrl = toEmbed(url);
    if (!embedUrl.includes("youtube.com/embed/")) {
      setErr("Cole um link válido do YouTube (ex: https://www.youtube.com/watch?v=...)");
      setSaving(false); return;
    }
    const res = await fetch("/api/settings/platform", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ founder_video_url: embedUrl }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error ?? "Erro ao salvar."); setSaving(false); return; }
    setUrl(embedUrl);
    setSaved(true); setSaving(false);
    setTimeout(() => setSaved(false), 3000);
  }

  const inputCls = "w-full h-10 px-3 text-sm rounded-lg border bg-[#0A1628] border-[#243A66] text-[#F0ECE4] placeholder:text-[#3A5070] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50";

  return (
    <div className="p-6 rounded-2xl border border-[#1E3050] bg-[#0A1628]/60 space-y-4">
      <h2 className="text-sm font-bold text-[#F0ECE4] flex items-center gap-2">
        <Activity className="w-4 h-4 text-[#C9A84C]" /> Vídeo de Boas-Vindas
      </h2>
      <p className="text-xs text-[#7A8FA8]">
        Exibido automaticamente para novos parceiros ao entrar na plataforma. Cole o link do YouTube abaixo.
      </p>
      <form onSubmit={handleSave} className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-[#7A8FA8] mb-1.5">
            Link do vídeo (YouTube)
          </label>
          <input
            value={loading ? "Carregando..." : url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            disabled={loading || saving}
            className={inputCls}
          />
          <p className="text-[10px] text-[#3A5070] mt-1">
            Aceita links normais (watch?v=) ou links de incorporação (embed/)
          </p>
        </div>
        {err && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}
        <button type="submit" disabled={saving || loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] text-sm font-bold transition-colors disabled:opacity-60">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
          {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar vídeo"}
        </button>
      </form>
    </div>
  );
}

export function ConfiguracoesClient({ profile, initialLinks, systemStats }: Props) {
  const tabs = ([
    { key: "captacao"    as Tab, label: "Links de Captação", icon: <Link2 className="w-4 h-4" />,   show: IS_PARTNER(profile.role) },
    { key: "cobranding"  as Tab, label: "Co-branding PRO",   icon: <Globe className="w-4 h-4" />,   show: profile.role === "PARTNER_PRO" },
    { key: "notificacoes" as Tab, label: "Notificações",      icon: <Bell className="w-4 h-4" />,    show: true },
    { key: "regras-credito" as Tab, label: "Regras de Crédito", icon: <CreditCard className="w-4 h-4" />, show: IS_ADMIN(profile.role) },
    { key: "portfolio"   as Tab, label: "Portfólio",          icon: <Briefcase className="w-4 h-4" />, show: IS_ADMIN(profile.role) },
    { key: "sistema"     as Tab, label: "Sistema",            icon: <Shield className="w-4 h-4" />, show: IS_ADMIN(profile.role) },
    { key: "integracoes" as Tab, label: "Integrações",        icon: <Zap className="w-4 h-4" />,    show: IS_ADMIN_ONLY(profile.role) },
  ] as { key: Tab; label: string; icon: React.ReactNode; show: boolean }[]).filter(t => t.show);

  const [tab, setTab] = useState<Tab>(tabs[0]?.key ?? "notificacoes");
  const [links, setLinks] = useState<CaptacaoLink[]>(initialLinks);
  const [creatingLink, setCreatingLink] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});
  const [rulesEditorOpen, setRulesEditorOpen] = useState(false);
  const [rulesKey, setRulesKey] = useState(0);

  // Notificações (localStorage)
  const [notifEmail, setNotifEmail]   = useState(() => typeof window !== "undefined" ? localStorage.getItem("v3_notif_email") !== "false" : true);
  const [notifDeals, setNotifDeals]   = useState(() => typeof window !== "undefined" ? localStorage.getItem("v3_notif_deals") !== "false" : true);
  const [notifComis, setNotifComis]   = useState(() => typeof window !== "undefined" ? localStorage.getItem("v3_notif_comis") !== "false" : true);
  const [notifSist,  setNotifSist]    = useState(() => typeof window !== "undefined" ? localStorage.getItem("v3_notif_sist") === "true" : false);

  function showToast(msg: string, type: "success" | "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  function saveNotif(key: string, value: boolean) {
    if (typeof window !== "undefined") localStorage.setItem(key, String(value));
  }

  async function handleCreateLink() {
    setCreatingLink(true);
    try {
      const res = await fetch("/api/captacao", { method: "POST" });
      const json = await res.json();
      if (!res.ok) { showToast(json.error ?? "Erro ao criar link.", "error"); return; }
      const newLink: CaptacaoLink = {
        id: json.id, token: json.token,
        partner_name: profile.full_name || "Partner",
        active: true, uses_count: 0,
        created_at: new Date().toISOString(),
      };
      setLinks(prev => [newLink, ...prev]);
      showToast("Link criado com sucesso!", "success");
    } finally {
      setCreatingLink(false);
    }
  }

  const handleToggleLink = useCallback(async (id: string, active: boolean) => {
    setTogglingId(id);
    try {
      const res = await fetch("/api/captacao", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, active: !active }),
      });
      if (!res.ok) { showToast("Erro ao atualizar link.", "error"); return; }
      setLinks(prev => prev.map(l => l.id === id ? { ...l, active: !active } : l));
      showToast(!active ? "Link ativado." : "Link desativado.", "success");
    } finally {
      setTogglingId(null);
    }
  }, []);

  function formatDate(s: string) {
    return new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  }

  function maskToken(token: string) {
    return token.slice(0, 6) + "••••••••" + token.slice(-4);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C9A84C]/80 to-[#E8C97A]/60 flex items-center justify-center">
          <Settings className="w-5 h-5 text-[#09081A]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#F0ECE4]">Configurações</h1>
          <p className="text-xs text-[#7A8FA8]">Links de captação, notificações e parâmetros da plataforma</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[#0A1628]/60 rounded-xl border border-[#1E3050]/50 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              tab === t.key
                ? "bg-[#C9A84C]/15 text-[#E8C97A] border border-[#C9A84C]/30"
                : "text-[#7A8FA8] hover:text-[#F0ECE4] hover:bg-[#111F35]"
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: LINKS DE CAPTAÇÃO ── */}
      {tab === "captacao" && (
        <div className="space-y-4">
          {/* Info card */}
          <div className="p-4 rounded-xl bg-[#C9A84C]/5 border border-[#C9A84C]/20 flex gap-3">
            <Globe className="w-4 h-4 text-[#C9A84C] flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#E8C97A]">Como funciona</p>
              <p className="text-xs text-[#7A8FA8] leading-relaxed">
                Cada link leva o cliente a um formulário de interesse personalizado com seu nome. Quando preenchido, o lead é registrado automaticamente no seu CRM. Compartilhe no WhatsApp, e-mail ou redes sociais.
              </p>
            </div>
          </div>

          {/* Header com botão criar */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-[#F0ECE4]">Seus links</p>
              <p className="text-xs text-[#7A8FA8]">{links.length} link{links.length !== 1 ? "s" : ""} criado{links.length !== 1 ? "s" : ""}</p>
            </div>
            <button onClick={handleCreateLink} disabled={creatingLink}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#C9A84C] text-[#09081A] hover:bg-[#E8C97A] transition-all disabled:opacity-50">
              {creatingLink ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {creatingLink ? "Criando..." : "Novo link"}
            </button>
          </div>

          {/* Lista de links */}
          {links.length === 0 ? (
            <div className="p-10 rounded-2xl border border-dashed border-[#1E3050] text-center space-y-3">
              <Link2 className="w-8 h-8 text-[#3A5070] mx-auto" />
              <p className="text-sm font-semibold text-[#7A8FA8]">Nenhum link criado ainda</p>
              <p className="text-xs text-[#3A5070]">Crie seu primeiro link de captação para começar a capturar leads.</p>
              <button onClick={handleCreateLink} disabled={creatingLink}
                className="mx-auto flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-[#C9A84C] text-[#09081A] hover:bg-[#E8C97A] transition-all">
                <Plus className="w-4 h-4" /> Criar meu primeiro link
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {links.map((link) => {
                const fullUrl = `${BASE_URL}${link.token}`;
                const visible = showTokens[link.id];
                return (
                  <div key={link.id}
                    className={`p-4 rounded-xl border transition-all ${
                      link.active
                        ? "border-[#1E3050] bg-[#0A1628]/60"
                        : "border-[#1E3050]/40 bg-[#09081A]/40 opacity-60"
                    }`}>
                    <div className="flex items-start gap-3">
                      {/* Status dot */}
                      <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${link.active ? "bg-emerald-400" : "bg-[#3A5070]"}`} />

                      <div className="flex-1 min-w-0 space-y-2">
                        {/* URL row */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111F35] border border-[#1E3050]/50">
                            <Link2 className="w-3 h-3 text-[#7A8FA8] flex-shrink-0" />
                            <span className="text-xs text-[#F0ECE4] font-mono truncate">
                              {visible ? fullUrl : `${BASE_URL.replace("https://", "")}${maskToken(link.token)}`}
                            </span>
                            <button onClick={() => setShowTokens(p => ({ ...p, [link.id]: !visible }))}
                              className="text-[#7A8FA8] hover:text-[#F0ECE4] flex-shrink-0 transition-colors">
                              {visible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>

                        {/* Actions row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <CopyButton text={fullUrl} label="Copiar link" />
                          <a href={fullUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#111F35] border border-[#1E3050]/50 text-[#7A8FA8] hover:text-[#F0ECE4] transition-all">
                            <ExternalLink className="w-3.5 h-3.5" /> Abrir
                          </a>
                          <button onClick={() => handleToggleLink(link.id, link.active)} disabled={togglingId === link.id}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                              link.active
                                ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
                                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                            } disabled:opacity-50`}>
                            {togglingId === link.id
                              ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              : <Power className="w-3.5 h-3.5" />}
                            {link.active ? "Desativar" : "Ativar"}
                          </button>
                        </div>

                        {/* Meta */}
                        <div className="flex items-center gap-4 text-[10px] text-[#3A5070]">
                          <span className="flex items-center gap-1">
                            <BarChart3 className="w-3 h-3" /> {link.uses_count} uso{link.uses_count !== 1 ? "s" : ""}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Criado em {formatDate(link.created_at)}
                          </span>
                          <span className={`flex items-center gap-1 font-semibold ${link.active ? "text-emerald-500" : "text-[#3A5070]"}`}>
                            {link.active ? "● Ativo" : "● Inativo"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* WhatsApp quick share tip */}
          {links.some(l => l.active) && (
            <div className="p-4 rounded-xl bg-[#111F35] border border-[#1E3050]/50">
              <p className="text-xs font-semibold text-[#F0ECE4] mb-2">Dica de compartilhamento</p>
              <p className="text-xs text-[#7A8FA8] mb-3">Mensagem sugerida para WhatsApp:</p>
              <div className="p-3 rounded-lg bg-[#0A1628] border border-[#1E3050]/50 text-xs text-[#7A8FA8] leading-relaxed font-mono">
                {`Olá! Aqui é ${profile.full_name || "Partner"} da V3 Partners 🏦\n\nEstamos especializados em soluções financeiras estruturadas: crédito, M&A, consórcio e muito mais.\n\nSe tiver interesse, preencha seus dados aqui e nossa equipe entrará em contato:\n${links.find(l => l.active) ? `${BASE_URL}${links.find(l => l.active)!.token}` : "..."}`}
              </div>
              <div className="mt-2 flex justify-end">
                <CopyButton
                  text={`Olá! Aqui é ${profile.full_name || "Partner"} da V3 Partners 🏦\n\nEstamos especializados em soluções financeiras estruturadas: crédito, M&A, consórcio e muito mais.\n\nSe tiver interesse, preencha seus dados aqui e nossa equipe entrará em contato:\n${links.find(l => l.active) ? `${BASE_URL}${links.find(l => l.active)!.token}` : "..."}`}
                  label="Copiar mensagem"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: CO-BRANDING PRO ── */}
      {tab === "cobranding" && profile.role === "PARTNER_PRO" && (
        <CobrandingTab profile={profile} />
      )}

      {/* ── TAB: NOTIFICAÇÕES ── */}
      {tab === "notificacoes" && (
        <div className="space-y-4">
          <div className="p-6 rounded-2xl border border-[#1E3050] bg-[#0A1628]/60 space-y-1">
            <h2 className="text-sm font-bold text-[#F0ECE4] flex items-center gap-2 mb-4">
              <Mail className="w-4 h-4 text-[#C9A84C]" /> Notificações por E-mail
            </h2>
            <Toggle
              checked={notifEmail} label="E-mails de atividade"
              description="Resumo diário das principais atividades da plataforma"
              onChange={(v) => { setNotifEmail(v); saveNotif("v3_notif_email", v); }}
            />
            <Toggle
              checked={notifDeals} label="Propostas e deals"
              description="Alertas quando uma proposta for atualizada ou um deal avançar"
              onChange={(v) => { setNotifDeals(v); saveNotif("v3_notif_deals", v); }}
            />
            <Toggle
              checked={notifComis} label="Comissões e pagamentos"
              description="Avise-me quando uma comissão for aprovada ou paga"
              onChange={(v) => { setNotifComis(v); saveNotif("v3_notif_comis", v); }}
            />
            <Toggle
              checked={notifSist} label="Atualizações da plataforma"
              description="Novidades, melhorias e manutenções programadas"
              onChange={(v) => { setNotifSist(v); saveNotif("v3_notif_sist", v); }}
            />
          </div>

          <div className="p-6 rounded-2xl border border-[#1E3050] bg-[#0A1628]/60 space-y-1">
            <h2 className="text-sm font-bold text-[#F0ECE4] flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-[#C9A84C]" /> Notificações na Plataforma
            </h2>
            <Toggle
              checked={true} label="Notificações em tempo real"
              description="Alertas instantâneos no sino da barra superior"
              onChange={() => {}} disabled
            />
            <Toggle
              checked={true} label="Novos leads de captação"
              description="Notificado quando um lead preencher seu formulário"
              onChange={() => {}} disabled
            />
          </div>

          <PushNotificationsSection />

          <div className="flex items-center gap-2 p-3 rounded-xl bg-[#111F35] border border-[#1E3050]/50">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <p className="text-xs text-[#7A8FA8]">Preferências salvas automaticamente neste dispositivo.</p>
          </div>
        </div>
      )}

      {/* ── TAB: SISTEMA ── */}
      {tab === "sistema" && IS_ADMIN(profile.role) && (
        <div className="space-y-4">
          {/* Stats */}
          {systemStats && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: "Usuários",  value: systemStats.totalUsers,     icon: <Users className="w-4 h-4" />,     color: "#60A5FA" },
                { label: "Partners",  value: systemStats.activePartners, icon: <TrendingUp className="w-4 h-4" />, color: "#C9A84C" },
                { label: "Leads",     value: systemStats.totalLeads,     icon: <BarChart3 className="w-4 h-4" />,  color: "#34D399" },
              ].map((s) => (
                <div key={s.label} className="p-4 rounded-xl bg-[#0A1628]/60 border border-[#1E3050] flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${s.color}15`, border: `1px solid ${s.color}30`, color: s.color }}>
                    {s.icon}
                  </div>
                  <div>
                    <p className="text-xl font-black text-[#F0ECE4]">{s.value.toLocaleString("pt-BR")}</p>
                    <p className="text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Parâmetros */}
          <div className="p-6 rounded-2xl border border-[#1E3050] bg-[#0A1628]/60 space-y-3">
            <h2 className="text-sm font-bold text-[#F0ECE4] flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#C9A84C]" /> Parâmetros do Sistema
            </h2>
            {[
              { label: "Comissão Partner",        value: "30%",          note: "Padrão para role PARTNER" },
              { label: "Comissão Partner PRO",    value: "50%",          note: "Padrão para role PARTNER_PRO" },
              { label: "Mínimo High Ticket (N3)", value: "R$ 5.000.000", note: "Crédito Estruturado — mesa N3" },
              { label: "Trial period",            value: "30 dias",      note: "Período padrão após cadastro" },
              { label: "Limite de links / partner", value: "Ilimitado",  note: "Links de captação por partner" },
            ].map((p) => (
              <div key={p.label} className="flex items-center justify-between py-2.5 border-b border-[#1E3050]/50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-[#F0ECE4]">{p.label}</p>
                  <p className="text-[10px] text-[#3A5070]">{p.note}</p>
                </div>
                <span className="text-sm font-bold text-[#C9A84C] bg-[#C9A84C]/10 px-3 py-1 rounded-lg border border-[#C9A84C]/20">
                  {p.value}
                </span>
              </div>
            ))}
            <div className="pt-2 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <p className="text-[10px] text-[#7A8FA8]">Alterações nos parâmetros requerem update no banco de dados. Contate o time técnico.</p>
            </div>
          </div>

          {/* Vídeo de boas-vindas */}
          <VideoBoasVindasEditor />

          {/* Ambiente */}
          <div className="p-6 rounded-2xl border border-[#1E3050] bg-[#0A1628]/60 space-y-3">
            <h2 className="text-sm font-bold text-[#F0ECE4] flex items-center gap-2">
              <Database className="w-4 h-4 text-[#C9A84C]" /> Ambiente
            </h2>
            {[
              { label: "Plataforma",     value: "V3 PARTNERS" },
              { label: "Framework",      value: "Next.js 16 + Supabase" },
              { label: "Deploy",         value: "Vercel Production" },
              { label: "Banco de dados", value: "PostgreSQL (Supabase)" },
              { label: "Autenticação",   value: "Supabase Auth" },
              { label: "IA",             value: "Anthropic Claude (Sonnet)" },
            ].map((e) => (
              <div key={e.label} className="flex items-center justify-between py-1.5">
                <p className="text-xs text-[#7A8FA8]">{e.label}</p>
                <p className="text-xs font-mono font-semibold text-[#F0ECE4]">{e.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB: INTEGRAÇÕES ── */}
      {tab === "integracoes" && IS_ADMIN_ONLY(profile.role) && (
        <div className="space-y-4">
          <div className="p-6 rounded-2xl border border-[#1E3050] bg-[#0A1628]/60 space-y-3">
            <h2 className="text-sm font-bold text-[#F0ECE4] flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-[#C9A84C]" /> Serviços Conectados
            </h2>
            <IntegrationCard
              name="Supabase"
              desc="Banco de dados, autenticação e armazenamento"
              icon={<Database className="w-4 h-4" />}
              status="ok"
              detail={process.env.NEXT_PUBLIC_SUPABASE_URL?.replace("https://", "").split(".")[0] + ".supabase.co"}
            />
            <IntegrationCard
              name="Anthropic Claude"
              desc="Motor de IA para o V3 IA Partner"
              icon={<Zap className="w-4 h-4" />}
              status="ok"
              detail="claude-sonnet-4-6 · API v1"
            />
            <IntegrationCard
              name="Resend"
              desc="Envio de e-mails transacionais e notificações"
              icon={<Mail className="w-4 h-4" />}
              status="ok"
              detail="SMTP via resend.com"
            />
            <IntegrationCard
              name="Escavador"
              desc="Validação de CPF e dados jurídicos"
              icon={<Globe className="w-4 h-4" />}
              status="ok"
              detail="escavador.com · REST API"
            />
            <IntegrationCard
              name="Vercel"
              desc="Hosting, CDN e serverless functions"
              icon={<Activity className="w-4 h-4" />}
              status="ok"
              detail="app.v3partners.com.br · Edge Network"
            />
          </div>

          <div className="p-6 rounded-2xl border border-[#1E3050] bg-[#0A1628]/60 space-y-3">
            <h2 className="text-sm font-bold text-[#F0ECE4] flex items-center gap-2 mb-4">
              <Key className="w-4 h-4 text-[#C9A84C]" /> Chaves de API
            </h2>
            <p className="text-xs text-[#7A8FA8]">
              As chaves de API são gerenciadas via variáveis de ambiente no Vercel. Acesse o painel do Vercel para visualizar ou rotacionar as chaves.
            </p>
            {[
              { label: "NEXT_PUBLIC_SUPABASE_URL",    masked: "https://******.supabase.co" },
              { label: "NEXT_PUBLIC_SUPABASE_ANON_KEY", masked: "eyJ••••••••••••••••••••••••" },
              { label: "SUPABASE_SERVICE_ROLE_KEY",   masked: "eyJ••••••••••••••••••••••••" },
              { label: "ANTHROPIC_API_KEY",           masked: "sk-ant-••••••••••••••••••••" },
              { label: "RESEND_API_KEY",              masked: "re_••••••••••••••••••••••••" },
              { label: "ESCAVADOR_API_TOKEN",         masked: "••••••••••••••••••••••••••••" },
            ].map((k) => (
              <div key={k.label} className="flex items-center justify-between py-2 border-b border-[#1E3050]/50 last:border-0">
                <p className="text-xs font-mono text-[#7A8FA8]">{k.label}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-[#3A5070]">{k.masked}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">✓</span>
                </div>
              </div>
            ))}
            <a
              href="https://vercel.com/hamiltonsantosinvestimentos-2666s-projects/v3-partner/settings/environment-variables"
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-[#C9A84C] hover:underline mt-2">
              <ExternalLink className="w-3.5 h-3.5" /> Gerenciar no Vercel
              <ChevronRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* ── TAB: REGRAS DE CRÉDITO ── */}
      {tab === "regras-credito" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-[#1E3050]/50 bg-[#0D1B2E]/60 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#F0ECE4]">Regras das Linhas de Crédito</p>
                <p className="text-xs text-[#7A8FA8] mt-0.5">Edite score mínimo, valores, LTV, faturamento e parâmetros de cada linha de crédito.</p>
              </div>
              <button
                key={rulesKey}
                onClick={() => setRulesEditorOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#C9A84C]/30 bg-[#C9A84C]/10 text-xs font-semibold text-[#C9A84C] hover:bg-[#C9A84C]/20 transition-colors"
              >
                <CreditCard className="w-3.5 h-3.5" /> Editar Regras
              </button>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {["CGI", "CRI", "FIDC", "SLB", "BTS", "BTR", "PRECATÓRIO", "MINERAÇÃO", "M&A", "CROSS-BORDER", "HIGH TICKET"].map(line => (
                <span key={line} className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20">{line}</span>
              ))}
            </div>
            <p className="text-[11px] text-[#7A8FA8]">11 linhas de crédito configuráveis. Alterações refletem imediatamente na recomendação de linhas para todas as propostas.</p>
          </div>

          <EditorRegrasLinhas
            open={rulesEditorOpen}
            onClose={() => setRulesEditorOpen(false)}
            onSaved={() => { setRulesKey(k => k + 1); showToast("Regras salvas com sucesso!", "success"); }}
          />
        </div>
      )}

      {/* ── TAB: PORTFÓLIO ── */}
      {tab === "portfolio" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-[#C9A84C]/5 border border-[#C9A84C]/20 flex gap-3">
            <Briefcase className="w-4 h-4 text-[#C9A84C] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-[#E8C97A]">Portfólio V3 Partners 2026</p>
              <p className="text-xs text-[#7A8FA8] mt-0.5">
                Gerencie todos os produtos e linhas de crédito do portfólio. Cada produto ficará visível na aba "Portfólio" de todos os partners.
              </p>
            </div>
          </div>
          <PortfolioEditor />
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}
