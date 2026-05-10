"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingBag, Building2, User, Mail, Phone, MapPin, Globe, FileText, Tag, Lock, Loader2, CheckCircle, AlertCircle, ChevronRight } from "lucide-react";
import { MARKETPLACE_CATEGORIES } from "@/lib/constants";

const STATES = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export default function FornecedorCadastroPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    company_name: "",
    cnpj: "",
    contact_name: "",
    email: "",
    phone: "",
    city: "",
    state: "SP",
    website: "",
    description: "",
    categories: [] as string[],
    password: "",
    password_confirm: "",
  });

  function set(k: string, v: string) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  function toggleCategory(c: string) {
    setForm(prev => ({
      ...prev,
      categories: prev.categories.includes(c)
        ? prev.categories.filter(x => x !== c)
        : [...prev.categories, c],
    }));
  }

  function formatCNPJ(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 14);
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
      .replace(/^(\d{2})(\d{3})(\d{3})(\d{4})$/, "$1.$2.$3/$4")
      .replace(/^(\d{2})(\d{3})(\d{3})$/, "$1.$2.$3")
      .replace(/^(\d{2})(\d{3})$/, "$1.$2")
      .replace(/^(\d{2})$/, "$1");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.password_confirm) {
      setError("Senhas não conferem");
      return;
    }
    if (form.categories.length === 0) {
      setError("Selecione ao menos uma categoria");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/marketplace/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: form.company_name,
          cnpj: form.cnpj,
          contact_name: form.contact_name,
          email: form.email,
          phone: form.phone,
          city: form.city,
          state: form.state,
          website: form.website || null,
          description: form.description,
          categories: form.categories,
          password: form.password,
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        const msg = typeof j.error === "string" ? j.error : JSON.stringify(j.error) ?? "Erro ao cadastrar";
        throw new Error(msg);
      }
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao cadastrar");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#F0ECE4] mb-2">Cadastro realizado!</h2>
            <p className="text-[#7A8FA8]">
              Seu cadastro foi enviado para análise. Nossa equipe irá revisar e aprovar em até 2 dias úteis.
              Você receberá um e-mail com a confirmação.
            </p>
          </div>
          <div className="bg-[#C9A84C]/10 border border-[#C9A84C]/30 rounded-xl p-4">
            <p className="text-[#C9A84C] text-sm font-medium">Próximos passos:</p>
            <ul className="text-[#7A8FA8] text-sm mt-2 space-y-1 text-left">
              <li>1. Aguardar aprovação da V3 Partners</li>
              <li>2. Acessar o portal do fornecedor</li>
              <li>3. Cadastrar seus produtos/serviços</li>
              <li>4. Partners começam a vender!</li>
            </ul>
          </div>
          <Link
            href="/fornecedor/login"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-bold rounded-xl transition-colors"
          >
            Acessar Portal <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[420px] flex-col bg-[#0D1929] border-r border-[#1B3050] p-10 justify-between">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl bg-[#C9A84C]/20 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-[#C9A84C]" />
            </div>
            <div>
              <p className="text-[#C9A84C] font-bold text-sm tracking-wider">V3 PARTNERS</p>
              <p className="text-[#7A8FA8] text-xs">Marketplace B2B</p>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-[#F0ECE4] mb-4 leading-tight">
            Venda seus produtos para a rede V3
          </h1>
          <p className="text-[#7A8FA8] leading-relaxed mb-8">
            Cadastre sua empresa e tenha acesso a centenas de Partners qualificados prontos para oferecer seus produtos e serviços aos clientes deles.
          </p>

          <div className="space-y-4">
            {[
              { icon: "🏆", title: "Rede de Partners", desc: "Acesse parceiros já qualificados e prontos para vender" },
              { icon: "💰", title: "Comissão Flexível", desc: "Defina sua própria estrutura de comissionamento" },
              { icon: "📊", title: "Painel de Leads", desc: "Acompanhe em tempo real os interesses dos Partners" },
              { icon: "✅", title: "Curadoria V3", desc: "Sua marca validada pela V3 Partners gera credibilidade" },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <span className="text-xl">{icon}</span>
                <div>
                  <p className="text-[#F0ECE4] font-semibold text-sm">{title}</p>
                  <p className="text-[#7A8FA8] text-xs">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[#7A8FA8] text-xs">
          Já é fornecedor?{" "}
          <Link href="/fornecedor/login" className="text-[#C9A84C] hover:underline">
            Acessar portal
          </Link>
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-start justify-center p-6 lg:p-10 overflow-y-auto">
        <div className="w-full max-w-xl">
          {/* Mobile header */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <ShoppingBag className="w-5 h-5 text-[#C9A84C]" />
            <span className="text-[#C9A84C] font-bold text-sm tracking-wider">V3 PARTNERS MARKETPLACE</span>
          </div>

          <h2 className="text-2xl font-bold text-[#F0ECE4] mb-1">Cadastro de Fornecedor</h2>
          <p className="text-[#7A8FA8] text-sm mb-8">Preencha os dados da sua empresa para começar</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Company */}
            <div className="bg-[#0D1929] border border-[#1B3050] rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-4 h-4 text-[#C9A84C]" />
                <h3 className="text-[#F0ECE4] font-semibold text-sm">Dados da Empresa</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-1.5">Razão Social *</label>
                  <input required value={form.company_name} onChange={e => set("company_name", e.target.value)}
                    className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2.5 text-sm text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]/50 placeholder:text-[#7A8FA8]/40"
                    placeholder="Nome da empresa" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-1.5">CNPJ *</label>
                  <input required value={form.cnpj}
                    onChange={e => set("cnpj", formatCNPJ(e.target.value))}
                    className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2.5 text-sm text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]/50 placeholder:text-[#7A8FA8]/40"
                    placeholder="00.000.000/0000-00" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-1.5">Site</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7A8FA8]" />
                    <input value={form.website} onChange={e => set("website", e.target.value)}
                      className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg pl-9 pr-3 py-2.5 text-sm text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]/50 placeholder:text-[#7A8FA8]/40"
                      placeholder="https://suaempresa.com.br" />
                  </div>
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="bg-[#0D1929] border border-[#1B3050] rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4 text-[#C9A84C]" />
                <h3 className="text-[#F0ECE4] font-semibold text-sm">Contato Responsável</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-1.5">Nome Completo *</label>
                  <input required value={form.contact_name} onChange={e => set("contact_name", e.target.value)}
                    className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2.5 text-sm text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]/50 placeholder:text-[#7A8FA8]/40"
                    placeholder="Seu nome" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-1.5">E-mail *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7A8FA8]" />
                    <input required type="email" value={form.email} onChange={e => set("email", e.target.value)}
                      className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg pl-9 pr-3 py-2.5 text-sm text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]/50 placeholder:text-[#7A8FA8]/40"
                      placeholder="email@empresa.com" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-1.5">Telefone *</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7A8FA8]" />
                    <input required value={form.phone} onChange={e => set("phone", e.target.value)}
                      className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg pl-9 pr-3 py-2.5 text-sm text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]/50 placeholder:text-[#7A8FA8]/40"
                      placeholder="(11) 99999-9999" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-1.5">Cidade *</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7A8FA8]" />
                    <input required value={form.city} onChange={e => set("city", e.target.value)}
                      className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg pl-9 pr-3 py-2.5 text-sm text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]/50 placeholder:text-[#7A8FA8]/40"
                      placeholder="Sua cidade" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-1.5">Estado *</label>
                  <select required value={form.state} onChange={e => set("state", e.target.value)}
                    className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2.5 text-sm text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]/50">
                    {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="bg-[#0D1929] border border-[#1B3050] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-[#C9A84C]" />
                <h3 className="text-[#F0ECE4] font-semibold text-sm">Sobre a Empresa</h3>
              </div>
              <textarea
                required
                value={form.description}
                onChange={e => set("description", e.target.value)}
                rows={4}
                placeholder="Descreva sua empresa, produtos/serviços oferecidos, diferenciais..."
                className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2.5 text-sm text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]/50 placeholder:text-[#7A8FA8]/40 resize-none"
              />
            </div>

            {/* Categories */}
            <div className="bg-[#0D1929] border border-[#1B3050] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Tag className="w-4 h-4 text-[#C9A84C]" />
                <h3 className="text-[#F0ECE4] font-semibold text-sm">Categorias de Atuação *</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {MARKETPLACE_CATEGORIES.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCategory(c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                      form.categories.includes(c)
                        ? "bg-[#C9A84C]/20 text-[#C9A84C] border-[#C9A84C]/40"
                        : "bg-[#111F35] text-[#7A8FA8] border-[#1B3050] hover:text-[#F0ECE4]"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              {form.categories.length > 0 && (
                <p className="text-[10px] text-[#7A8FA8] mt-2">{form.categories.length} categoria(s) selecionada(s)</p>
              )}
            </div>

            {/* Password */}
            <div className="bg-[#0D1929] border border-[#1B3050] rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Lock className="w-4 h-4 text-[#C9A84C]" />
                <h3 className="text-[#F0ECE4] font-semibold text-sm">Acesso ao Portal</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-1.5">Senha *</label>
                  <input required type="password" value={form.password} onChange={e => set("password", e.target.value)}
                    minLength={8}
                    className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2.5 text-sm text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]/50 placeholder:text-[#7A8FA8]/40"
                    placeholder="Mínimo 8 caracteres" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-1.5">Confirmar Senha *</label>
                  <input required type="password" value={form.password_confirm} onChange={e => set("password_confirm", e.target.value)}
                    className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2.5 text-sm text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]/50 placeholder:text-[#7A8FA8]/40"
                    placeholder="Repita a senha" />
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-bold rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              {loading ? "Enviando cadastro..." : "Cadastrar como Fornecedor"}
            </button>

            <p className="text-center text-[#7A8FA8] text-xs">
              Já é fornecedor?{" "}
              <Link href="/fornecedor/login" className="text-[#C9A84C] hover:underline">
                Fazer login
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
