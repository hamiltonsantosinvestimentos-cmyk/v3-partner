"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, BrainCircuit, PieChart, Building2,
  CreditCard, Headphones, ChevronDown, ChevronRight, X,
  Trophy, GraduationCap, Handshake, Settings2, Medal,
  ContactRound, DollarSign, Wallet, Zap, Target, ShieldCheck, Calculator, UserPlus, ClipboardList, BadgeCheck, Layers, BarChart2, BookMarked, BotMessageSquare,
  ShoppingBag, Radar, BookOpen, FileText, UserPlus2, MessageSquare, BarChart3, Video, UsersRound,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/constants";

const iconMap = {
  LayoutDashboard, Users, BrainCircuit, PieChart, Building2,
  CreditCard, Headphones, Trophy, GraduationCap, Handshake,
  Settings2, Medal, ContactRound, DollarSign, Wallet, Zap,
  Target, ShieldCheck, Calculator, UserPlus, ClipboardList, BadgeCheck, Layers, BarChart2, BookMarked, BotMessageSquare,
  ShoppingBag, Radar, BookOpen, FileText, UserPlus2, MessageSquare, BarChart3, Video, UsersRound,
};

interface NavSubItem { href: string; label: string; roles: string[]; }
interface NavItem {
  href: string; label: string; icon: keyof typeof iconMap;
  roles: string[]; children?: NavSubItem[];
}
interface NavSection { label: string; items: NavItem[]; }

const NAV_SECTIONS: NavSection[] = [
  {
    label: "GERAL",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard", roles: ["ADMIN", "PARTNER", "PARTNER_PRO", "MESA_OPERACIONAL", "GESTAO", "SDR", "CLOSER"] },
      { href: "/crm", label: "CRM", icon: "ContactRound", roles: ["ADMIN", "PARTNER", "PARTNER_PRO"] },
      { href: "/chat", label: "Chat Mesa V3", icon: "MessageSquare", roles: ["PARTNER", "PARTNER_PRO"] },
      { href: "/chat/admin", label: "Chat Partners", icon: "MessageSquare", roles: ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] },
      { href: "/chat/equipe", label: "Chat Equipe", icon: "UsersRound", roles: ["ADMIN", "GESTAO", "MESA_OPERACIONAL", "MESA", "FINANCEIRO"] },
      {
        href: "/prospeccao", label: "Prospecção Partners", icon: "Radar",
        roles: ["ADMIN", "SDR", "CLOSER", "GESTAO"],
        children: [
          { href: "/prospeccao", label: "Pipeline Kanban", roles: ["ADMIN", "SDR", "CLOSER", "GESTAO"] },
          { href: "/prospeccao/dashboard", label: "Dashboard SDR", roles: ["ADMIN", "SDR", "CLOSER", "GESTAO"] },
        ],
      },
      { href: "/minhas-operacoes", label: "Minhas Operações", icon: "ClipboardList", roles: ["PARTNER", "PARTNER_PRO"] },
      { href: "/ranking", label: "Ranking", icon: "Medal", roles: ["ADMIN", "PARTNER", "PARTNER_PRO"] },
      { href: "/indicacoes", label: "Indicações", icon: "UserPlus2", roles: ["ADMIN", "PARTNER", "PARTNER_PRO", "GESTAO"] },
    ],
  },
  {
    label: "OPERAÇÕES",
    items: [
      {
        href: "/mesa-credito", label: "Mesa de Crédito", icon: "CreditCard",
        roles: ["ADMIN", "GESTAO", "PARTNER", "PARTNER_PRO", "MESA_OPERACIONAL"],
        children: [
          { href: "/mesa-credito/nivel-1", label: "N1 — Crédito Varejo", roles: ["ADMIN", "GESTAO", "PARTNER", "PARTNER_PRO", "MESA_OPERACIONAL"] },
          { href: "/mesa-credito/nivel-2", label: "N2 — Crédito Estruturado", roles: ["ADMIN", "GESTAO", "PARTNER", "PARTNER_PRO", "MESA_OPERACIONAL"] },
          { href: "/mesa-credito/nivel-3", label: "N3 — High Ticket", roles: ["ADMIN", "GESTAO", "PARTNER_PRO"] },
        ],
      },
      { href: "/relatorios", label: "Relatórios V3", icon: "BarChart2", roles: ["ADMIN", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO"] },
      { href: "/hub", label: "Hub de Deals", icon: "Layers", roles: ["ADMIN", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO"] },
      { href: "/prompts", label: "Banco de Prompts", icon: "BookMarked", roles: ["ADMIN", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO"] },
      { href: "/mesa-ma", label: "Mesa M&A", icon: "Handshake", roles: ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] },
      { href: "/ma/oportunidades", label: "Deal Discovery", icon: "Radar", roles: ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] },
      { href: "/mesa-operacional", label: "Mesa Operacional", icon: "Headphones", roles: ["ADMIN", "MESA_OPERACIONAL", "GESTAO"] },
      { href: "/mesa-consorcio-op", label: "Mesa Consórcio", icon: "Settings2", roles: ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] },
    ],
  },
  {
    label: "PRODUTOS",
    items: [
      {
        href: "/simulador-home-equity", label: "Simuladores", icon: "Calculator",
        roles: ["ADMIN", "GESTAO", "PARTNER", "PARTNER_PRO", "MESA_OPERACIONAL"],
        children: [
          { href: "/simulador-home-equity", label: "Home Equity / CGI", roles: ["ADMIN", "GESTAO", "PARTNER", "PARTNER_PRO", "MESA_OPERACIONAL"] },
          { href: "/simulador-homecash", label: "HomeCash", roles: ["ADMIN", "GESTAO", "PARTNER", "PARTNER_PRO", "MESA_OPERACIONAL"] },
        ],
      },
      { href: "/split-fiscal", label: "Split Fiscal", icon: "PieChart", roles: ["ADMIN", "PARTNER", "PARTNER_PRO", "GESTAO"] },
      { href: "/ma", label: "M&A", icon: "Building2", roles: ["ADMIN", "GESTAO", "PARTNER", "PARTNER_PRO", "MESA_OPERACIONAL"] },
      {
        href: "/consorcio", label: "Consórcio", icon: "Trophy",
        roles: ["ADMIN", "PARTNER", "PARTNER_PRO", "MESA_OPERACIONAL", "GESTAO"],
        children: [
          { href: "/consorcio/simulacao", label: "Simulação", roles: ["ADMIN", "PARTNER", "PARTNER_PRO", "MESA_OPERACIONAL", "GESTAO"] },
          { href: "/consorcio/cartas-contempladas", label: "Cartas Contempladas", roles: ["ADMIN", "PARTNER", "PARTNER_PRO", "MESA_OPERACIONAL", "GESTAO"] },
          { href: "/consorcio/projetos", label: "Projetos", roles: ["ADMIN", "PARTNER", "PARTNER_PRO", "MESA_OPERACIONAL", "GESTAO"] },
        ],
      },
      { href: "/marketplace", label: "Marketplace", icon: "ShoppingBag",
        roles: ["ADMIN", "PARTNER", "PARTNER_PRO", "GESTAO", "MESA_OPERACIONAL"],
      },
    ],
  },
  {
    label: "PLATAFORMA",
    items: [
      { href: "/agentes", label: "Squads de IA", icon: "BotMessageSquare", roles: ["ADMIN", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO"] },
      { href: "/deal-rooms", label: "Deal Rooms", icon: "Layers", roles: ["ADMIN", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO"] },
      { href: "/ia-assistant", label: "V3 IA Partner", icon: "BrainCircuit", roles: ["ADMIN", "PARTNER", "PARTNER_PRO", "MESA_OPERACIONAL", "GESTAO", "FINANCEIRO"] },
      { href: "/metas", label: "Metas & Performance", icon: "Target", roles: ["ADMIN", "GESTAO", "PARTNER", "PARTNER_PRO"] },
      { href: "/compliance", label: "Compliance", icon: "ShieldCheck", roles: ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] },
      { href: "/financeiro", label: "Financeiro", icon: "DollarSign", roles: ["ADMIN", "FINANCEIRO"] },
      { href: "/comissoes", label: "Comissões", icon: "Wallet", roles: ["ADMIN", "PARTNER", "PARTNER_PRO", "FINANCEIRO"] },
      { href: "/minha-assinatura", label: "Minha Assinatura", icon: "BadgeCheck", roles: ["PARTNER", "PARTNER_PRO"] },
      {
        href: "/academy", label: "V3 Academy", icon: "GraduationCap",
        roles: ["ADMIN", "PARTNER", "PARTNER_PRO", "MESA_OPERACIONAL", "GESTAO"],
        children: [
          { href: "/academy?cat=home-equity", label: "Home Equity", roles: ["ADMIN", "PARTNER", "PARTNER_PRO", "MESA_OPERACIONAL", "GESTAO"] },
          { href: "/academy?cat=estruturado", label: "Crédito Estruturado", roles: ["ADMIN", "PARTNER", "PARTNER_PRO", "MESA_OPERACIONAL", "GESTAO"] },
          { href: "/academy?cat=high-ticket", label: "High Ticket", roles: ["ADMIN", "PARTNER", "PARTNER_PRO", "MESA_OPERACIONAL", "GESTAO"] },
          { href: "/academy?cat=ma", label: "M&A", roles: ["ADMIN", "GESTAO", "PARTNER_PRO"] },
          { href: "/academy?cat=split-fiscal", label: "Split Fiscal", roles: ["ADMIN", "PARTNER", "PARTNER_PRO", "GESTAO"] },
          { href: "/academy?cat=consorcio", label: "Consórcio", roles: ["ADMIN", "PARTNER", "PARTNER_PRO", "MESA_OPERACIONAL", "GESTAO"] },
          { href: "/academy?cat=compliance", label: "Compliance", roles: ["ADMIN", "PARTNER", "PARTNER_PRO", "MESA_OPERACIONAL", "GESTAO"] },
        ],
      },
    ],
  },
  {
    label: "DOCUMENTAÇÃO",
    items: [
      {
        href: "/docs", label: "Manuais", icon: "BookOpen",
        roles: ["ADMIN", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO", "PARTNER", "PARTNER_PRO"],
        children: [
          { href: "/docs/usuario",  label: "Manual do Usuário",  roles: ["ADMIN", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO"] },
          { href: "/docs/tecnico",  label: "Manual Técnico",     roles: ["ADMIN", "GESTAO"] },
        ],
      },
    ],
  },
  {
    label: "SISTEMA",
    items: [
      { href: "/admin-dashboard",  label: "Painel Admin",    icon: "LayoutDashboard", roles: ["ADMIN"] },
      { href: "/admin-cadastros", label: "Cadastros",      icon: "UserPlus", roles: ["ADMIN"] },
      { href: "/admin-marketplace", label: "Marketplace Admin", icon: "ShoppingBag", roles: ["ADMIN", "GESTAO"] },
      { href: "/usuarios",       label: "Usuários",       icon: "Users",    roles: ["ADMIN"] },
      { href: "/configuracoes",  label: "Configurações",  icon: "Settings2", roles: ["ADMIN", "PARTNER", "PARTNER_PRO", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO"] },
    ],
  },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  PARTNER: "Partner",
  PARTNER_PRO: "Partner PRO",
  MESA_OPERACIONAL: "Mesa Operacional",
  FINANCEIRO: "Financeiro",
  GESTAO: "Gestão",
  SDR: "SDR",
  CLOSER: "Closer",
};

interface SidebarProps { role: UserRole; onClose?: () => void; }

export function Sidebar({ role, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>(["/mesa-credito"]);
  const [academyProgress, setAcademyProgress] = useState<{ completed: number; total: number } | null>(null);

  React.useEffect(() => {
    fetch("/api/academy/progress")
      .then(r => r.json())
      .then(d => {
        if (d.progress) {
          const vals = Object.values(d.progress as Record<string, number>);
          const completed = vals.filter((v: number) => v >= 90).length;
          setAcademyProgress({ completed, total: 27 });
        }
      }).catch(() => {});
  }, []);

  const toggleExpanded = (href: string) =>
    setExpandedItems(prev => prev.includes(href) ? prev.filter(h => h !== href) : [...prev, href]);

  return (
    <aside className="sidebar-premium flex flex-col h-full w-[232px] relative overflow-hidden">
      {/* Vertical gold accent left edge */}
      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-[#C9A84C]/50 to-transparent" />

      {/* Subtle grid texture */}
      <div className="absolute inset-0 bg-grid-sidebar opacity-100 pointer-events-none" />

      {/* Mobile close */}
      {onClose && (
        <button onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-lg hover:bg-white/5 transition-colors lg:hidden">
          <X className="w-4 h-4 text-[#7A8FA8]" />
        </button>
      )}

      {/* ── LOGO AREA ── */}
      <div className="relative flex flex-col items-center px-4 py-5 border-b border-white/[0.05]">
        {/* Gold top shimmer */}
        <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-[#C9A84C]/60 to-transparent" />

        <div className="relative group">
          {/* Outer glow ring */}
          <div className="absolute -inset-1.5 rounded-2xl bg-gradient-to-br from-[#C9A84C]/20 via-transparent to-[#E8C97A]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          {/* Logo container */}
          <div className="relative w-[100px] h-[100px] rounded-2xl overflow-hidden"
            style={{ boxShadow: "0 0 0 1px rgba(201,168,76,0.2), 0 8px 24px rgba(0,0,0,0.5), 0 0 40px rgba(201,168,76,0.08)" }}>
            <Image src="/logo.jpg" alt="V3 PARTNERS" width={100} height={100}
              className="w-full h-full object-contain" priority />
          </div>
          {/* Status dot */}
          <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-[#09081A] flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>

        <div className="mt-3 text-center">
          <p className="text-[11px] font-bold tracking-[0.2em] text-[#C9A84C] uppercase">V3 Partners</p>
          <p className="text-[9px] text-[#7A8FA8]/70 tracking-[0.15em] uppercase mt-0.5">Plataforma Institucional</p>
        </div>
      </div>

      {/* ── NAVIGATION ── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5 scrollbar-thin">
        {NAV_SECTIONS.map(section => {
          const visibleItems = section.items.filter(item => item.roles.includes(role));
          if (!visibleItems.length) return null;

          return (
            <div key={section.label} className="mb-1">
              <p className="px-3 mb-1 mt-2 text-[9px] font-bold tracking-[0.18em] text-[#7A8FA8]/50 uppercase select-none">
                {section.label}
              </p>
              {visibleItems.map(item => {
                const Icon = iconMap[item.icon];
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                const isExpanded = expandedItems.includes(item.href);
                const hasChildren = item.children && item.children.length > 0;
                const filteredChildren = item.children?.filter(c => c.roles.includes(role));

                return (
                  <div key={item.href}>
                    {hasChildren ? (
                      <button onClick={() => toggleExpanded(item.href)}
                        className={cn("nav-item-v3 w-full", isActive ? "nav-item-v3-active" : "nav-item-v3-inactive")}>
                        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all",
                          isActive ? "bg-[#C9A84C]/15 text-[#C9A84C]" : "text-[#7A8FA8] group-hover:text-[#F0ECE4]")}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.href === "/academy" && academyProgress && academyProgress.completed > 0 && (
                          <span className="text-[9px] font-bold text-[#C9A84C] bg-[#C9A84C]/10 px-1.5 py-0.5 rounded-full mr-1">
                            {academyProgress.completed}/{academyProgress.total}
                          </span>
                        )}
                        {isExpanded
                          ? <ChevronDown className="w-3 h-3 flex-shrink-0 opacity-50" />
                          : <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-50" />}
                      </button>
                    ) : (
                      <Link href={item.href} onClick={onClose}
                        className={cn("nav-item-v3 group", isActive ? "nav-item-v3-active" : "nav-item-v3-inactive")}>
                        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all",
                          isActive ? "bg-[#C9A84C]/15 text-[#C9A84C]" : "text-[#7A8FA8] group-hover:text-[#F0ECE4]")}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span>{item.label}</span>
                        {isActive && <div className="ml-auto w-1 h-1 rounded-full bg-[#C9A84C]" />}
                      </Link>
                    )}

                    {hasChildren && isExpanded && filteredChildren && (
                      <div className="ml-4 mt-0.5 mb-1 space-y-0.5 pl-5 border-l border-[#C9A84C]/15">
                        {filteredChildren.map(child => {
                          const childActive = pathname === child.href || pathname.startsWith(child.href + "?");
                          return (
                            <Link key={child.href} href={child.href} onClick={onClose}
                              className={cn(
                                "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium transition-all duration-150",
                                childActive
                                  ? "text-[#E8C97A] bg-[#C9A84C]/08"
                                  : "text-[#7A8FA8] hover:text-[#F0ECE4] hover:bg-white/[0.04]"
                              )}>
                              <span className={cn("w-1 h-1 rounded-full flex-shrink-0",
                                childActive ? "bg-[#C9A84C]" : "bg-[#7A8FA8]/40")} />
                              {child.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* ── BOTTOM USER BADGE ── */}
      <div className="px-3 py-3 border-t border-white/[0.05]">
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          {/* Avatar placeholder */}
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#C9A84C]/80 to-[#E8C97A]/60 flex items-center justify-center flex-shrink-0">
            <Zap className="w-3.5 h-3.5 text-[#09081A]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-[#7A8FA8] leading-none">Perfil ativo</p>
            <p className="text-[11px] font-bold text-[#C9A84C] leading-none mt-0.5 truncate">
              {ROLE_LABELS[role] ?? role}
            </p>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
        </div>
      </div>
    </aside>
  );
}
