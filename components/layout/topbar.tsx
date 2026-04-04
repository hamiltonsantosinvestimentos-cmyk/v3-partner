"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Search,
  Menu,
  LogOut,
  User,
  Settings,
  ChevronDown,
} from "lucide-react";
const IS_DEMO = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");
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
import { ThemeToggle } from "./theme-toggle";

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
  const router = useRouter();

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

  return (
    <header className="h-14 border-b border-[#122036]/80 bg-[#09081A]/90 backdrop-blur-md flex items-center px-4 gap-4 relative">
      {/* Bottom gold accent */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#C9A84C]/20 to-transparent" />
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="p-1.5 rounded-lg hover:bg-secondary transition-colors lg:hidden"
      >
        <Menu className="w-5 h-5 text-muted-foreground" />
      </button>

      {/* Search */}
      <div className="flex-1 max-w-md hidden sm:flex">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar operações, partners..."
            className="w-full h-8 pl-9 pr-4 text-sm bg-secondary rounded-lg border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
          />
        </div>
      </div>

      <div className="flex-1 lg:hidden" />

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <Link
          href="/notificacoes"
          className="relative p-1.5 rounded-lg hover:bg-secondary transition-colors"
        >
          <Bell className="w-5 h-5 text-muted-foreground" />
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-[#C9A84C] rounded-full" />
          )}
        </Link>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-secondary transition-colors">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#C9A84C] to-[#E8C97A] flex items-center justify-center text-[#09081A] text-xs font-bold flex-shrink-0">
                {user.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatar_url}
                    alt={user.full_name || ""}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-xs font-medium text-foreground leading-none">
                  {user.full_name?.split(" ")[0] || "Usuário"}
                </span>
                <span className="text-[10px] text-muted-foreground leading-none mt-0.5">
                  {ROLE_LABELS[user.role]}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-0.5">
                <p className="text-sm font-medium">{user.full_name || "Usuário"}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/perfil" className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                Meu Perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/configuracoes" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
