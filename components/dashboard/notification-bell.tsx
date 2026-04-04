"use client";

import { useState } from "react";
import { Bell, X, Check, Headphones, Building2, CreditCard } from "lucide-react";
import { useRealtimeNotifications, type Notification } from "@/hooks/use-realtime-notifications";

function NotificationIcon({ type }: { type: Notification["type"] }) {
  if (type === "ticket")   return <Headphones className="w-4 h-4 text-amber-400" />;
  if (type === "proposal") return <CreditCard  className="w-4 h-4 text-emerald-400" />;
  return                          <Building2   className="w-4 h-4 text-purple-400" />;
}

function timeAgo(date: Date) {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60)   return "agora";
  if (s < 3600) return `${Math.floor(s / 60)}min atrás`;
  return `${Math.floor(s / 3600)}h atrás`;
}

export function NotificationBell() {
  const { notifications, unreadCount, dismiss, dismissAll } = useRealtimeNotifications();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-white/5 transition-colors text-muted-foreground hover:text-foreground"
        aria-label="Notificações"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-[#C4922E] text-[#070E1A] text-[9px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Panel */}
          <div className="absolute right-0 top-10 w-80 bg-[#091221] border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold text-foreground">
                Notificações
                {unreadCount > 0 && (
                  <span className="ml-2 bg-[#C4922E]/20 text-[#C4922E] text-xs px-1.5 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </span>
              {notifications.some((n) => !n.read) && (
                <button
                  onClick={dismissAll}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  <Check className="w-3 h-3" /> Marcar todas
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Nenhuma notificação
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-0 transition-colors ${
                      n.read ? "opacity-50" : "bg-white/[0.02]"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      <NotificationIcon type={n.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">{n.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        {timeAgo(n.timestamp)}
                      </p>
                    </div>
                    {!n.read && (
                      <button
                        onClick={() => dismiss(n.id)}
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
