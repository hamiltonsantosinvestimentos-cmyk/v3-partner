"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  User, Settings, Shield, Bell, CreditCard, Camera, Trash2,
  Save, Mail, Phone, FileText, Calendar, Clock, CheckCircle2,
  AlertCircle, Eye, EyeOff, LogOut, Key, Lock, Smartphone,
  Globe, Moon, Sun, ChevronRight, Upload, X, Info,
  Banknote, Award, Activity, Link2, ExternalLink,
} from "lucide-react";
import { ROLE_LABELS, type UserRole } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

interface ProfileData {
  id: string;
  full_name: string | null;
  email: string;
  role: UserRole;
  avatar_url: string | null;
  phone: string | null;
  document_cpf: string | null;
  nationality: string | null;
  marital_status: string | null;
  profession: string | null;
  created_at: string;
  last_login_at: string | null;
  is_active: boolean;
  cobranding_slug: string | null;
  cobranding_bio: string | null;
  cobranding_whatsapp: string | null;
  cobranding_instagram: string | null;
}

type Tab = "perfil" | "seguranca" | "notificacoes" | "plano" | "preferencias";

const TAB_CONFIG: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "perfil",        label: "Meu Perfil",      icon: <User className="w-4 h-4" /> },
  { key: "seguranca",     label: "Segurança",        icon: <Shield className="w-4 h-4" /> },
  { key: "notificacoes",  label: "Notificações",     icon: <Bell className="w-4 h-4" /> },
  { key: "plano",         label: "Plano & Conta",    icon: <CreditCard className="w-4 h-4" /> },
  { key: "preferencias",  label: "Preferências",     icon: <Settings className="w-4 h-4" /> },
];

function Toast({ msg, type }: { msg: string; type: "success" | "error" }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium animate-fade-in ${
      type === "success"
        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
        : "bg-red-500/15 border-red-500/40 text-red-400"
    }`}>
      {type === "success" ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
      {msg}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", readOnly = false }:
  { label: string; value: string; onChange?: (v: string) => void; placeholder?: string; type?: string; readOnly?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#7A8FA8] mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`w-full h-9 px-3 text-sm rounded-lg border text-[#F0ECE4] placeholder:text-[#3A5070] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50 transition-colors ${
          readOnly
            ? "bg-[#0A1628]/60 border-[#1E3050]/60 cursor-not-allowed text-[#7A8FA8]"
            : "bg-[#111F35] border-[#1E3050] hover:border-[#243A66] focus:border-[#C9A84C]/50"
        }`}
      />
    </div>
  );
}

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-[#1E3050]/50 last:border-0">
      <div>
        <p className="text-sm font-medium text-[#F0ECE4]">{label}</p>
        {description && <p className="text-xs text-[#7A8FA8] mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${checked ? "bg-[#C9A84C]" : "bg-[#1E3050]"}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

export function PerfilClient({ initialProfile }: { initialProfile: ProfileData }) {
  const [tab, setTab] = useState<Tab>("perfil");
  const [profile, setProfile] = useState<ProfileData>(initialProfile);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Perfil edit state
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [cpf, setCpf] = useState(profile.document_cpf ?? "");
  // 17/08/2026: qualificação jurídica para assinatura de contratos (NCNDA
  // Mestre e futuros instrumentos) — cada Head da mesa preenche o próprio
  // dado, fica gravado pras próximas gerações (lib/ncnda-desk-head.ts).
  const [nationality, setNationality] = useState(profile.nationality ?? "");
  const [maritalStatus, setMaritalStatus] = useState(profile.marital_status ?? "");
  const [profession, setProfession] = useState(profile.profession ?? "");

  // Co-branding / Mini-site
  const [cobSlug, setCobSlug] = useState(profile.cobranding_slug ?? "");
  const [cobBio, setCobBio] = useState(profile.cobranding_bio ?? "");
  const [cobWhatsapp, setCobWhatsapp] = useState(profile.cobranding_whatsapp ?? "");
  const [cobInstagram, setCobInstagram] = useState(profile.cobranding_instagram ?? "");
  const [savingCob, setSavingCob] = useState(false);

  // Segurança
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Notificações
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifProposta, setNotifProposta] = useState(true);
  const [notifComissao, setNotifComissao] = useState(true);
  const [notifSistema, setNotifSistema] = useState(false);
  const [notifMarketing, setNotifMarketing] = useState(false);

  // Preferências
  const [language, setLanguage] = useState("pt-BR");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");

  function showToast(msg: string, type: "success" | "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleSaveProfile() {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, phone, document_cpf: cpf, nationality: nationality || null, marital_status: maritalStatus || null, profession: profession || null }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error ?? "Erro ao salvar.", "error"); return; }
      setProfile(prev => ({ ...prev, full_name: fullName, phone, document_cpf: cpf, nationality: nationality || null, marital_status: maritalStatus || null, profession: profession || null }));
      showToast("Perfil atualizado com sucesso!", "success");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveCobranding() {
    const slugClean = cobSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    setSavingCob(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cobranding_slug: slugClean || null,
          cobranding_bio: cobBio.trim() || null,
          cobranding_whatsapp: cobWhatsapp.trim() || null,
          cobranding_instagram: cobInstagram.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(json.error ?? "Erro ao salvar mini-site.", "error"); return; }
      setCobSlug(slugClean);
      setProfile(prev => ({ ...prev, cobranding_slug: slugClean || null, cobranding_bio: cobBio || null, cobranding_whatsapp: cobWhatsapp || null, cobranding_instagram: cobInstagram || null }));
      showToast("Mini-site atualizado com sucesso!", "success");
    } finally {
      setSavingCob(false);
    }
  }

  const handleAvatarFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) { showToast("Arquivo deve ser uma imagem.", "error"); return; }
    if (file.size > 5 * 1024 * 1024) { showToast("Imagem deve ter no máximo 5MB.", "error"); return; }

    // Preview imediato
    const reader = new FileReader();
    reader.onload = (e) => setAvatarPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) { showToast(json.error ?? "Erro ao enviar foto.", "error"); setAvatarPreview(null); return; }
      setProfile(prev => ({ ...prev, avatar_url: json.avatar_url }));
      setAvatarPreview(null);
      showToast("Foto de perfil atualizada!", "success");
      window.dispatchEvent(new Event("v3:avatar-updated"));
    } finally {
      setUploadingAvatar(false);
    }
  }, []);

  async function handleRemoveAvatar() {
    if (!confirm("Remover foto de perfil?")) return;
    await fetch("/api/profile/avatar", { method: "DELETE" });
    setProfile(prev => ({ ...prev, avatar_url: null }));
    setAvatarPreview(null);
    showToast("Foto removida.", "success");
    window.dispatchEvent(new Event("v3:avatar-updated"));
  }

  async function handleResetPassword() {
    setResetLoading(true);
    try {
      const res = await fetch("/api/profile/reset-password", { method: "POST" });
      const json = await res.json();
      if (!res.ok) { showToast(json.error ?? "Erro ao enviar email.", "error"); return; }
      setResetSent(true);
      showToast(json.message ?? "Email enviado!", "success");
    } finally {
      setResetLoading(false);
    }
  }

  const avatarSrc = avatarPreview ?? profile.avatar_url;
  const initials = (profile.full_name ?? profile.email).split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const PLAN_INFO: Record<UserRole, { label: string; color: string; desc: string; commission: string }> = {
    STARTER:          { label: "V3 Starter",     color: "#22D3EE", desc: "R$ 297/mês", commission: "20% de comissionamento" },
    PARTNER:          { label: "V3 Partner",     color: "#C9A84C", desc: "R$ 908,08/mês", commission: "35% de comissionamento" },
    PARTNER_PRO:      { label: "V3 Partner PRO", color: "#E8C97A", desc: "R$ 1.324,75/mês", commission: "50% + co-branding" },
    ENTERPRISE:       { label: "V3 Enterprise",  color: "#FBBF24", desc: "R$ 4.158,08/mês", commission: "55% de comissionamento" },
    ADMIN:            { label: "Administrador",  color: "#A855F7", desc: "Acesso total", commission: "—" },
    GESTAO:           { label: "Gestão",         color: "#60A5FA", desc: "Acesso total exceto Usuários", commission: "—" },
    MESA_OPERACIONAL: { label: "Mesa Operacional", color: "#34D399", desc: "Operações e suporte", commission: "—" },
    FINANCEIRO:       { label: "Financeiro",     color: "#FB923C", desc: "Módulos financeiros", commission: "—" },
    SDR:              { label: "SDR",            color: "#94A3B8", desc: "Prospecção ativa",    commission: "—" },
    CLOSER:           { label: "Closer",         color: "#94A3B8", desc: "Fechamento",          commission: "—" },
    FORNECEDOR:       { label: "Fornecedor",     color: "#94A3B8", desc: "Acesso fornecedor",   commission: "—" },
    INSTITUICAO:      { label: "Instituição",    color: "#818CF8", desc: "Portal institucional", commission: "—" },
  };
  const plan = PLAN_INFO[profile.role] ?? PLAN_INFO.PARTNER;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C9A84C]/80 to-[#E8C97A]/60 flex items-center justify-center">
          <User className="w-5 h-5 text-[#09081A]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#F0ECE4]">Meu Perfil & Configurações</h1>
          <p className="text-xs text-[#7A8FA8]">Gerencie suas informações e preferências</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[#0A1628]/60 rounded-xl border border-[#1E3050]/50 overflow-x-auto">
        {TAB_CONFIG.map((t) => (
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

      {/* ── TAB: PERFIL ── */}
      {tab === "perfil" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Avatar card */}
          <div className="md:col-span-1">
            <div className="p-6 rounded-2xl border border-[#1E3050] bg-[#0A1628]/60 space-y-5 text-center">
              {/* Avatar */}
              <div
                className={`relative mx-auto w-28 h-28 rounded-2xl flex items-center justify-center cursor-pointer group transition-all ${
                  dragOver ? "ring-2 ring-[#C9A84C] scale-105" : ""
                }`}
                style={{ background: "linear-gradient(135deg, rgba(201,168,76,0.3), rgba(232,201,122,0.15))", border: "2px solid rgba(201,168,76,0.25)" }}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault(); setDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleAvatarFile(file);
                }}
              >
                {uploadingAvatar ? (
                  <div className="w-8 h-8 border-3 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
                ) : avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarSrc} alt="Avatar" className="w-full h-full object-cover rounded-2xl" />
                ) : (
                  <span className="text-3xl font-black text-[#C9A84C]">{initials}</span>
                )}
                {/* Overlay hover */}
                <div className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              </div>

              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarFile(f); e.target.value = ""; }} />

              <div>
                <p className="text-sm font-bold text-[#F0ECE4]">{profile.full_name ?? "Sem nome"}</p>
                <p className="text-xs text-[#7A8FA8] mt-0.5">{profile.email}</p>
                <span className="inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-bold"
                  style={{ background: `${plan.color}20`, color: plan.color, border: `1px solid ${plan.color}40` }}>
                  {ROLE_LABELS[profile.role]}
                </span>
              </div>

              <div className="space-y-1.5">
                <button onClick={() => fileRef.current?.click()} disabled={uploadingAvatar}
                  className="w-full h-8 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold bg-[#C9A84C]/15 text-[#E8C97A] border border-[#C9A84C]/30 hover:bg-[#C9A84C]/25 transition-all disabled:opacity-50">
                  <Upload className="w-3.5 h-3.5" />
                  {uploadingAvatar ? "Enviando..." : "Trocar foto"}
                </button>
                {avatarSrc && !avatarPreview && (
                  <button onClick={handleRemoveAvatar}
                    className="w-full h-8 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all">
                    <Trash2 className="w-3.5 h-3.5" /> Remover foto
                  </button>
                )}
              </div>

              <p className="text-[10px] text-[#3A5070]">JPG, PNG ou WEBP · máx. 5MB<br />Clique ou arraste para alterar</p>

              {/* Estatísticas rápidas */}
              <div className="border-t border-[#1E3050]/50 pt-4 grid grid-cols-2 gap-3 text-center">
                <div>
                  <p className="text-[10px] text-[#7A8FA8]">Membro desde</p>
                  <p className="text-xs font-semibold text-[#F0ECE4] mt-0.5">{formatDate(profile.created_at)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#7A8FA8]">Último acesso</p>
                  <p className="text-xs font-semibold text-[#F0ECE4] mt-0.5">
                    {profile.last_login_at ? formatDate(profile.last_login_at) : "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Form card */}
          <div className="md:col-span-2 space-y-4">
            <div className="p-6 rounded-2xl border border-[#1E3050] bg-[#0A1628]/60 space-y-4">
              <h2 className="text-sm font-bold text-[#F0ECE4] flex items-center gap-2">
                <User className="w-4 h-4 text-[#C9A84C]" /> Informações Pessoais
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Nome completo" value={fullName} onChange={setFullName} placeholder="Seu nome completo" />
                <Field label="E-mail" value={profile.email} readOnly placeholder="seu@email.com" />
                <Field label="Telefone / WhatsApp" value={phone} onChange={setPhone} placeholder="(11) 99999-0000" type="tel" />
                <Field label="CPF / CNPJ" value={cpf} onChange={setCpf} placeholder="000.000.000-00" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Cargo / Função" value={ROLE_LABELS[profile.role]} readOnly />
                <Field label="Status da conta" value={profile.is_active ? "Ativa" : "Inativa"} readOnly />
              </div>

              {/* 17/08/2026: Dados para Assinatura de Contratos — só quem
                  assina como Head de mesa (ADMIN/GESTAO) precisa disso.
                  Preenchido uma vez, fica valendo pras próximas gerações
                  de NCNDA (lib/ncnda-desk-head.ts resolve isso em tempo
                  real, sem precisar de deploy novo). */}
              {(profile.role === "ADMIN" || profile.role === "GESTAO") && (
                <div className="pt-2 mt-2 border-t border-[#1E3050]/60 space-y-3">
                  <div>
                    <h3 className="text-xs font-bold text-[#E8C97A] uppercase tracking-wide">Dados para Assinatura de Contratos</h3>
                    <p className="text-[11px] text-[#7A8FA8] mt-0.5">
                      Usado quando você assina como Head de mesa em contratos gerados pela Central de Contratos (ex: NCNDA Mestre). Preencha uma vez, fica gravado para as próximas gerações.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field label="Nacionalidade" value={nationality} onChange={setNationality} placeholder="brasileiro" />
                    <Field label="Estado civil" value={maritalStatus} onChange={setMaritalStatus} placeholder="casado" />
                    <Field label="Profissão" value={profession} onChange={setProfession} placeholder="empresário" />
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button onClick={handleSaveProfile} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-[#C9A84C] text-[#09081A] hover:bg-[#E8C97A] transition-all disabled:opacity-50">
                  <Save className="w-4 h-4" />
                  {saving ? "Salvando..." : "Salvar alterações"}
                </button>
              </div>
            </div>

            {/* Informações de contato adicionais */}
            <div className="p-6 rounded-2xl border border-[#1E3050] bg-[#0A1628]/60 space-y-3">
              <h2 className="text-sm font-bold text-[#F0ECE4] flex items-center gap-2">
                <Info className="w-4 h-4 text-[#C9A84C]" /> Sobre a conta
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { icon: <Mail className="w-3.5 h-3.5" />, label: "E-mail verificado", value: "Sim" },
                  { icon: <Calendar className="w-3.5 h-3.5" />, label: "Criado em", value: formatDate(profile.created_at) },
                  { icon: <Activity className="w-3.5 h-3.5" />, label: "Status", value: profile.is_active ? "Ativo" : "Inativo" },
                ].map((item) => (
                  <div key={item.label} className="p-3 rounded-xl bg-[#111F35] border border-[#1E3050]/50">
                    <div className="flex items-center gap-1.5 text-[#7A8FA8] mb-1">{item.icon}<span className="text-[10px] font-semibold uppercase tracking-wider">{item.label}</span></div>
                    <p className="text-xs font-semibold text-[#F0ECE4]">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Mini-site / Co-branding */}
            <div className="p-6 rounded-2xl border border-[#C9A84C]/20 bg-[#0A1628]/60 space-y-4"
              style={{ boxShadow: "0 0 0 1px rgba(201,168,76,0.08)" }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-[#F0ECE4] flex items-center gap-2">
                    <Globe className="w-4 h-4 text-[#C9A84C]" /> Meu Mini-Site V3
                  </h2>
                  <p className="text-xs text-[#7A8FA8] mt-1">
                    Configure sua página pública com formulário de captação direto ao seu CRM.
                  </p>
                </div>
                {cobSlug && (
                  <a
                    href={`/p/${cobSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#C9A84C]/10 text-[#E8C97A] border border-[#C9A84C]/25 hover:bg-[#C9A84C]/20 transition-all"
                  >
                    <ExternalLink className="w-3 h-3" /> Ver meu site
                  </a>
                )}
              </div>

              {/* URL preview */}
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[#111F35] border border-[#1E3050]">
                <Link2 className="w-3.5 h-3.5 text-[#C9A84C] flex-shrink-0" />
                <span className="text-xs text-[#7A8FA8]">app.v3partners.com.br/p/</span>
                <span className="text-xs font-bold text-[#E8C97A] break-all">
                  {cobSlug || <span className="text-[#3A5070] font-normal italic">seu-slug-aqui</span>}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#7A8FA8] mb-1.5">
                    Slug da URL <span className="text-[#C9A84C]">*</span>
                  </label>
                  <input
                    value={cobSlug}
                    onChange={e => setCobSlug(e.target.value)}
                    placeholder="ex: joao-silva"
                    className="w-full h-9 px-3 text-sm rounded-lg border border-[#1E3050] bg-[#111F35] text-[#F0ECE4] placeholder:text-[#3A5070] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50 focus:border-[#C9A84C]/50 transition-colors"
                  />
                  <p className="text-[10px] text-[#3A5070] mt-1">Apenas letras minúsculas, números e hífens</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#7A8FA8] mb-1.5">WhatsApp</label>
                  <input
                    value={cobWhatsapp}
                    onChange={e => setCobWhatsapp(e.target.value)}
                    placeholder="(11) 99999-0000"
                    className="w-full h-9 px-3 text-sm rounded-lg border border-[#1E3050] bg-[#111F35] text-[#F0ECE4] placeholder:text-[#3A5070] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50 focus:border-[#C9A84C]/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#7A8FA8] mb-1.5">Instagram</label>
                  <input
                    value={cobInstagram}
                    onChange={e => setCobInstagram(e.target.value)}
                    placeholder="@seuperfil"
                    className="w-full h-9 px-3 text-sm rounded-lg border border-[#1E3050] bg-[#111F35] text-[#F0ECE4] placeholder:text-[#3A5070] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50 focus:border-[#C9A84C]/50 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#7A8FA8] mb-1.5">Bio / Apresentação</label>
                <textarea
                  value={cobBio}
                  onChange={e => setCobBio(e.target.value)}
                  rows={3}
                  placeholder="Ex: Especialista em estruturação financeira e M&A. Atendo empresas com faturamento acima de R$5M que buscam crescimento com capital inteligente."
                  className="w-full px-3 py-2.5 text-sm rounded-lg border border-[#1E3050] bg-[#111F35] text-[#F0ECE4] placeholder:text-[#3A5070] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50 focus:border-[#C9A84C]/50 transition-colors resize-none"
                />
                <p className="text-[10px] text-[#3A5070] mt-1">Aparece no hero do seu mini-site · máx. 200 caracteres recomendado</p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-[10px] text-[#3A5070]">
                  Os leads captados vão direto para o seu CRM
                </p>
                <button
                  onClick={handleSaveCobranding}
                  disabled={savingCob || !cobSlug.trim()}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-[#C9A84C] text-[#09081A] hover:bg-[#E8C97A] transition-all disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {savingCob ? "Salvando..." : "Salvar mini-site"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: SEGURANÇA ── */}
      {tab === "seguranca" && (
        <div className="space-y-4">
          {/* Redefinir senha */}
          <div className="p-6 rounded-2xl border border-[#1E3050] bg-[#0A1628]/60 space-y-4">
            <h2 className="text-sm font-bold text-[#F0ECE4] flex items-center gap-2">
              <Key className="w-4 h-4 text-[#C9A84C]" /> Redefinir Senha
            </h2>
            <p className="text-xs text-[#7A8FA8] leading-relaxed">
              Clique no botão abaixo para receber um e-mail em <strong className="text-[#F0ECE4]">{profile.email}</strong> com o link de redefinição de senha. O link expira em 1 hora.
            </p>
            {resetSent ? (
              <div className="flex items-center gap-2.5 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Email enviado!</p>
                  <p className="text-xs mt-0.5">Verifique sua caixa de entrada (e spam) em {profile.email}</p>
                </div>
              </div>
            ) : (
              <button onClick={handleResetPassword} disabled={resetLoading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#C9A84C]/15 text-[#E8C97A] border border-[#C9A84C]/30 hover:bg-[#C9A84C]/25 transition-all disabled:opacity-50">
                <Mail className="w-4 h-4" />
                {resetLoading ? "Enviando..." : "Enviar link de redefinição"}
              </button>
            )}
          </div>

          {/* Autenticação em dois fatores */}
          <div className="p-6 rounded-2xl border border-[#1E3050] bg-[#0A1628]/60 space-y-4">
            <h2 className="text-sm font-bold text-[#F0ECE4] flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#C9A84C]" /> Autenticação em Dois Fatores (2FA)
            </h2>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#7A8FA8]">
                A autenticação de dois fatores adiciona uma camada extra de segurança à sua conta. Em breve disponível na plataforma.
              </p>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#111F35] border border-[#1E3050]/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#1E3050] flex items-center justify-center">
                  <Lock className="w-4 h-4 text-[#7A8FA8]" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#F0ECE4]">Aplicativo Autenticador</p>
                  <p className="text-[10px] text-[#7A8FA8]">Google Authenticator, Authy, etc.</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#1E3050] text-[#7A8FA8]">Em breve</span>
            </div>
          </div>

          {/* Sessões ativas */}
          <div className="p-6 rounded-2xl border border-[#1E3050] bg-[#0A1628]/60 space-y-4">
            <h2 className="text-sm font-bold text-[#F0ECE4] flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#C9A84C]" /> Sessão Atual
            </h2>
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#111F35] border border-emerald-500/20">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <div>
                  <p className="text-xs font-semibold text-[#F0ECE4]">Sessão ativa</p>
                  <p className="text-[10px] text-[#7A8FA8]">Navegador Web · {typeof window !== "undefined" ? window.navigator.userAgent.split(" ").slice(-1)[0] : "—"}</p>
                </div>
              </div>
              <button
                onClick={async () => {
                  const { createClient } = await import("@/lib/supabase/client");
                  await createClient().auth.signOut();
                  window.location.href = "/login";
                }}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors">
                <LogOut className="w-3.5 h-3.5" /> Encerrar
              </button>
            </div>
          </div>

          {/* Zona de perigo */}
          <div className="p-6 rounded-2xl border border-red-500/20 bg-red-500/5 space-y-4">
            <h2 className="text-sm font-bold text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Zona de Perigo
            </h2>
            <p className="text-xs text-[#7A8FA8]">
              Ações irreversíveis. Somente realize estas ações se tiver certeza do que está fazendo.
            </p>
            <button
              onClick={() => showToast("Entre em contato com o administrador para desativar a conta.", "error")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/25 hover:bg-red-500/20 transition-all">
              <X className="w-3.5 h-3.5" /> Solicitar desativação de conta
            </button>
          </div>
        </div>
      )}

      {/* ── TAB: NOTIFICAÇÕES ── */}
      {tab === "notificacoes" && (
        <div className="space-y-4">
          <div className="p-6 rounded-2xl border border-[#1E3050] bg-[#0A1628]/60 space-y-1">
            <h2 className="text-sm font-bold text-[#F0ECE4] flex items-center gap-2 mb-4">
              <Mail className="w-4 h-4 text-[#C9A84C]" /> Notificações por E-mail
            </h2>
            <Toggle checked={notifEmail} onChange={setNotifEmail} label="E-mails de notificação" description="Receba um resumo das atividades por e-mail" />
            <Toggle checked={notifProposta} onChange={setNotifProposta} label="Atualização de propostas" description="Seja notificado quando uma proposta for atualizada" />
            <Toggle checked={notifComissao} onChange={setNotifComissao} label="Comissões e pagamentos" description="Alertas sobre novas comissões aprovadas" />
            <Toggle checked={notifSistema} onChange={setNotifSistema} label="Atualizações do sistema" description="Novidades e melhorias da plataforma" />
            <Toggle checked={notifMarketing} onChange={setNotifMarketing} label="Comunicações de marketing" description="Materiais promocionais e novos produtos" />
          </div>
          <div className="p-6 rounded-2xl border border-[#1E3050] bg-[#0A1628]/60 space-y-1">
            <h2 className="text-sm font-bold text-[#F0ECE4] flex items-center gap-2 mb-4">
              <Bell className="w-4 h-4 text-[#C9A84C]" /> Notificações na Plataforma
            </h2>
            <Toggle checked={true} onChange={() => {}} label="Notificações em tempo real" description="Alertas instantâneos no sino da barra superior" />
            <Toggle checked={notifProposta} onChange={setNotifProposta} label="Badge de propostas pendentes" description="Exibe contador de propostas aguardando ação" />
          </div>
          <div className="flex justify-end">
            <button onClick={() => showToast("Preferências de notificação salvas!", "success")}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-[#C9A84C] text-[#09081A] hover:bg-[#E8C97A] transition-all">
              <Save className="w-4 h-4" /> Salvar preferências
            </button>
          </div>
        </div>
      )}

      {/* ── TAB: PLANO & CONTA ── */}
      {tab === "plano" && (
        <div className="space-y-4">
          {/* Card do plano */}
          <div className="p-6 rounded-2xl border bg-[#0A1628]/60 space-y-5"
            style={{ borderColor: `${plan.color}40` }}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: `${plan.color}20`, border: `1px solid ${plan.color}40` }}>
                  <Award className="w-6 h-6" style={{ color: plan.color }} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#F0ECE4]">{plan.label}</h2>
                  <p className="text-xs text-[#7A8FA8] mt-0.5">{plan.desc}</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-3 py-1 rounded-full"
                style={{ background: `${plan.color}20`, color: plan.color, border: `1px solid ${plan.color}40` }}>
                ATIVO
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { icon: <Banknote className="w-3.5 h-3.5" />, label: "Comissionamento", value: plan.commission },
                { icon: <Calendar className="w-3.5 h-3.5" />, label: "Membro desde", value: formatDate(profile.created_at) },
                { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: "Status", value: "Ativo" },
              ].map((item) => (
                <div key={item.label} className="p-3 rounded-xl bg-[#111F35] border border-[#1E3050]/50">
                  <div className="flex items-center gap-1.5 text-[#7A8FA8] mb-1">{item.icon}
                    <span className="text-[10px] font-semibold uppercase tracking-wider">{item.label}</span></div>
                  <p className="text-xs font-semibold text-[#F0ECE4]">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Benefícios do plano */}
          <div className="p-6 rounded-2xl border border-[#1E3050] bg-[#0A1628]/60 space-y-3">
            <h2 className="text-sm font-bold text-[#F0ECE4]">Benefícios inclusos</h2>
            {[
              "Acesso ao Dashboard e KPIs em tempo real",
              "CRM completo para gestão de clientes",
              "Mesa de Crédito e envio de propostas",
              "V3 IA Partner — assistente inteligente",
              "Ranking de partners e metas",
              "V3 Academy — treinamentos exclusivos",
              profile.role === "PARTNER_PRO" ? "Crédito High Ticket (Nível 3) — acima de R$5M" : null,
              profile.role === "PARTNER_PRO" ? "Co-branding e materiais personalizados" : null,
            ].filter(Boolean).map((b) => (
              <div key={b} className="flex items-center gap-2.5 text-xs text-[#7A8FA8]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" /> {b}
              </div>
            ))}
            {(profile.role === "PARTNER") && (
              <div className="mt-4 p-4 rounded-xl bg-[#C9A84C]/5 border border-[#C9A84C]/20">
                <p className="text-xs font-semibold text-[#E8C97A]">Faça upgrade para V3 Partner PRO</p>
                <p className="text-[10px] text-[#7A8FA8] mt-1">Aumento de 30% → 50% de comissão + acesso ao High Ticket + co-branding. R$ 397/mês.</p>
                <button onClick={() => showToast("Entre em contato com a V3 Partners para upgrade.", "success")}
                  className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#E8C97A] hover:underline">
                  Solicitar upgrade <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: PREFERÊNCIAS ── */}
      {tab === "preferencias" && (
        <div className="space-y-4">
          <div className="p-6 rounded-2xl border border-[#1E3050] bg-[#0A1628]/60 space-y-4">
            <h2 className="text-sm font-bold text-[#F0ECE4] flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#C9A84C]" /> Idioma e Região
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#7A8FA8] mb-1.5">Idioma</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value)}
                  className="w-full h-9 px-3 text-sm bg-[#111F35] border border-[#1E3050] rounded-lg text-[#F0ECE4] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50">
                  <option value="pt-BR">Português (Brasil)</option>
                  <option value="en-US">English (US)</option>
                  <option value="es-ES">Español</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#7A8FA8] mb-1.5">Fuso horário</label>
                <select value={timezone} onChange={(e) => setTimezone(e.target.value)}
                  className="w-full h-9 px-3 text-sm bg-[#111F35] border border-[#1E3050] rounded-lg text-[#F0ECE4] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50">
                  <option value="America/Sao_Paulo">Brasília (GMT-3)</option>
                  <option value="America/New_York">Nova York (GMT-5)</option>
                  <option value="America/Manaus">Manaus (GMT-4)</option>
                  <option value="America/Fortaleza">Fortaleza (GMT-3)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl border border-[#1E3050] bg-[#0A1628]/60 space-y-3">
            <h2 className="text-sm font-bold text-[#F0ECE4] flex items-center gap-2">
              <Moon className="w-4 h-4 text-[#C9A84C]" /> Aparência
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: "dark", label: "Escuro", icon: <Moon className="w-4 h-4" />, desc: "Tema padrão V3" },
                { id: "light", label: "Claro", icon: <Sun className="w-4 h-4" />, desc: "Em breve" },
              ].map((theme) => (
                <button key={theme.id}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    theme.id === "dark"
                      ? "border-[#C9A84C]/40 bg-[#C9A84C]/10"
                      : "border-[#1E3050] bg-[#111F35] opacity-50 cursor-not-allowed"
                  }`}
                  disabled={theme.id === "light"}>
                  <div className="flex items-center gap-2 mb-1" style={{ color: theme.id === "dark" ? "#E8C97A" : "#7A8FA8" }}>
                    {theme.icon}
                    <span className="text-sm font-semibold">{theme.label}</span>
                    {theme.id === "dark" && <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-emerald-400" />}
                  </div>
                  <p className="text-[10px] text-[#7A8FA8]">{theme.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 rounded-2xl border border-[#1E3050] bg-[#0A1628]/60 space-y-3">
            <h2 className="text-sm font-bold text-[#F0ECE4] flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#C9A84C]" /> Privacidade
            </h2>
            <Toggle checked={true} onChange={() => {}} label="Perfil visível para a equipe" description="Outros usuários da plataforma podem ver seu nome e cargo" />
            <Toggle checked={false} onChange={() => {}} label="Exibir telefone para parceiros" description="Seu número aparece nos detalhes de contato" />
          </div>

          <div className="flex justify-end">
            <button onClick={() => showToast("Preferências salvas!", "success")}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-[#C9A84C] text-[#09081A] hover:bg-[#E8C97A] transition-all">
              <Save className="w-4 h-4" /> Salvar preferências
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}
