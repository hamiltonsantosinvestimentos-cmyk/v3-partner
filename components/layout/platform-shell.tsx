"use client";

import React, { useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import type { UserRole } from "@/lib/constants";
import { WelcomeWizard } from "@/components/onboarding/welcome-wizard";
import { LocationGate } from "@/components/onboarding/location-gate";
import { SubscriptionGuard } from "./subscription-guard";
import { ChatFloatWidget } from "@/components/chat/chat-float-widget";

interface PlatformShellProps {
  user: {
    id: string;
    full_name: string | null;
    email: string;
    role: UserRole;
    avatar_url: string | null;
    trial_expires_at?: string | null;
    is_active?: boolean | null;
  };
  notificationCount: number;
  children: React.ReactNode;
}

export function PlatformShell({ user, notificationCount, children }: PlatformShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[#09081A]">
      {/* Bloqueio de assinatura expirada */}
      <SubscriptionGuard
        trialExpiresAt={user.trial_expires_at ?? null}
        isActive={user.is_active ?? null}
        role={user.role}
      />
      {/* Wizard de boas-vindas — apenas para partners novos */}
      <WelcomeWizard userName={user.full_name || "Parceiro"} role={user.role} />
      {/* Gate de localização — solicita cidade na primeira sessão */}
      <LocationGate role={user.role} />
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar role={user.role} />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 z-50">
            <Sidebar role={user.role} onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Chat flutuante — visível em todas as páginas da plataforma */}
      <ChatFloatWidget
        profileId={user.id}
        profileName={user.full_name}
        role={user.role}
        isAdmin={["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(user.role)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar
          user={user}
          onMenuClick={() => setSidebarOpen(true)}
          notificationCount={notificationCount}
        />
        <main className="flex-1 overflow-y-auto p-5 lg:p-6 relative"
          style={{
            background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(201,168,76,0.03) 0%, transparent 60%)",
          }}>
          {children}
        </main>
      </div>
    </div>
  );
}
