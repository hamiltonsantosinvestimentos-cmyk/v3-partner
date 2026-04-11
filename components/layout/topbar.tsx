"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Menu,
  LogOut,
  User,
  Settings,
  ChevronDown,
  Zap,
} from "lucide-react";
const IS_DEMO = false;
import { abbreviateName } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS, type UserRole } from "@/lib/constants";

/* ── Page label map ── */
const PAGE_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/crm": "CRM",
  "/ranking": "Ranking",
  "/mesa-credito": "Mesa de Crédito",
  "/mesa-credito/nivel-1": "Crédito Varejo",
  "/mesa-credito/nivel-2": "Crédito Estruturado",
  "/mesa-credito/nivel-3": "High Ticket",
  "/mesa-ma": "Mesa M&A",
  "/mesa-operacional": "Mesa Operacional",
  "/mesa-consorcio-op": "Mesa Consórcio",
  "/split-fiscal": "Split Fiscal",
  "/ma": "M&A",
  "/consorcio": "Consórcio",
  "/ia-assistant": "V3 IA Partner",
  "/financeiro": "Financeiro",
  "/comissoes": "Comissões",
  "/academy": "V3 Academy",
  "/usuarios": "Usuários",
};

interface TopbarProps {
  user: {
    id: string;
    full_name: string | null;
    email: string;
    role: UserRole;
    avatar_url: string | null;
  };
  onMenuClick: () => void;
  notificationCount?: number;
}

export function Topbar({ user, onMenuClick, notificationCount = 0 }: TopbarProps) {
  const pathname = usePathname();

  const handleSignOut = async () => {
    document.cookie = "v3_demo_session=; path=/; max-age=0";
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // demo mode or supabase not configured — just redirect
    }
    window.location.href = "/login";
  };

  const initials = abbreviateName(user.full_name || user.email);

  /* Resolve current page label */
  const pageLabel =
    PAGE_LABELS[pathname] ??
    Object.entries(PAGE_LABELS)
      .filter(([k]) => pathname.startsWith(k + "/"))
      .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ??
    "Plataforma";

  return (
    <header className="h-14 flex items-center px-4 gap-3 relative"
      style={{
        background: "linear-gradient(180deg, rgba(9,8,26,0.98) 0%, rgba(9,8,26,0.95) 100%)",
        borderBottom: "1px solid rgba(201,168,76,0.08)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 1px 0 rgba(201,168,76,0.04), 0 4px 24px rgba(0,0,0,0.3)",
      }}>

      {/* Bottom gold shimmer line */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#C9A84C]/25 to-transparent pointer-events-none" />

      {/* Left edge accent */}
      <div className="absolute top-3 bottom-3 left-0 w-[1px] bg-gradient-to-b from-transparent via-[#C9A84C]/20 to-transparent pointer-events-none" />

      {/* Mobile menu */}
      <button
        onClick={onMenuClick}
        className="p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors lg:hidden flex-shrink-0">
        <Menu className="w-5 h-5 text-[#7A8FA8]" />
      </button>

      {/* ── Page indicator ── */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {/* Brand mark on desktop */}
        <div className="hidden lg:flex items-center gap-2">
          <div className="w-1 h-4 rounded-full bg-gradient-to-b from-[#C9A84C] to-[#E8C97A]" />
          <span className="text-[11px] font-bold tracking-[0.18em] text-[#C9A84C] uppercase select-none">
            V3 Partners
          </span>
          <span className="text-[#7A8FA8]/30 text-sm select-none">/</span>
        </div>
        <span className="text-sm font-semibold text-[#F0ECE4] truncate">{pageLabel}</span>
      </div>

      {/* ── Right controls ── */}
      <div className="flex items-center gap-1.5 flex-shrink-0">

        {/* Live indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[9px] font-bold tracking-[0.12em] text-[#7A8FA8] uppercase">Live</span>
        </div>

        {/* Notification bell */}
        <Link
          href="/notificacoes"
          className="relative p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors group">
          <Bell className="w-4 h-4 text-[#7A8FA8] group-hover:text-[#F0ECE4] transition-colors" />
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#C9A84C] rounded-full shadow-[0_0_6px_rgba(201,168,76,0.6)]" />
          )}
        </Link>

        {/* Divider */}
        <div className="w-px h-5 bg-white/[0.08] mx-0.5" />

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.05] transition-all border border-transparent hover:border-white/[0.06] group">
              {/* Avatar */}
              <div className="relative w-7 h-7 rounded-lg bg-gradient-to-br from-[#C9A84C]/80 to-[#E8C97A]/60 flex items-center justify-center flex-shrink-0 overflow-hidden"
                style={{ boxShadow: "0 0 0 1px rgba(201,168,76,0.25), 0 2px 8px rgba(0,0,0,0.4)" }}>
                {user.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar_url} alt={user.full_name || ""} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[#09081A] text-[10px] font-black tracking-tight">{initials}</span>
                )}
              </div>
              {/* Name + role */}
              <div className="hidden sm:flex flex-col items-start leading-none">
                <span className="text-[11px] font-semibold text-[#F0ECE4] group-hover:text-white transition-colors">
                  {user.full_name?.split(" ")[0] || "Usuário"}
                </span>
                <span className="text-[9px] text-[#C9A84C] font-bold tracking-[0.08em] mt-0.5">
                  {ROLE_LABELS[user.role]}
                </span>
              </div>
              <ChevronDown className="w-3 h-3 text-[#7A8FA8] hidden sm:block group-hover:text-[#F0ECE4] transition-colors" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56 border-[#1E3050] bg-[#0E1A2D]"
            style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,168,76,0.1)" }}>
            <DropdownMenuLabel>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#C9A84C]/80 to-[#E8C97A]/60 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-4 h-4 text-[#09081A]" />
                </div>
                <div className="flex flex-col min-w-0">
                  <p className="text-[11px] font-bold text-[#F0ECE4] truncate">{user.full_name || "Usuário"}</p>
                  <p className="text-[9px] text-[#7A8FA8] truncate">{user.email}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/[0.06]" />
            <DropdownMenuItem asChild>
              <Link href="/perfil" className="cursor-pointer text-[#7A8FA8] hover:text-[#F0ECE4] focus:text-[#F0ECE4]">
                <User className="mr-2 h-3.5 w-3.5" />
                <span className="text-xs">Meu Perfil</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/configuracoes" className="cursor-pointer text-[#7A8FA8] hover:text-[#F0ECE4] focus:text-[#F0ECE4]">
                <Settings className="mr-2 h-3.5 w-3.5" />
                <span className="text-xs">Configurações</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/[0.06]" />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-red-400 focus:text-red-300 cursor-pointer">
              <LogOut className="mr-2 h-3.5 w-3.5" />
              <span className="text-xs">Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
