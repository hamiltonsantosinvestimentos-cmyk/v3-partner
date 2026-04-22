"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface Notification {
  id: string;
  type: "deal" | "proposal" | "ticket" | "commission" | "split" | "info";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  action_url?: string | null;
}

export function useRealtimeNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (!supabaseRef.current) {
    try { supabaseRef.current = createClient(); } catch { supabaseRef.current = null; }
  }

  // Carrega notificações do banco na montagem
  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then(({ notifications: rows }) => {
        if (!Array.isArray(rows)) return;
        setNotifications(
          rows.map((r: Record<string, unknown>) => ({
            id:         r.id as string,
            type:       (r.type as Notification["type"]) ?? "info",
            title:      r.title as string,
            message:    (r.message as string) ?? "",
            timestamp:  new Date(r.created_at as string),
            read:       r.read as boolean,
            action_url: r.action_url as string | null,
          }))
        );
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  // Marca uma notificação como lida no banco + estado local
  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    fetch(`/api/notifications/${id}`, { method: "PATCH" }).catch(() => {});
  }, []);

  // Marca todas como lidas no banco + estado local
  const dismissAll = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    fetch("/api/notifications", { method: "PATCH" }).catch(() => {});
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Escuta novos INSERTs na tabela notifications do próprio usuário (realtime)
  useEffect(() => {
    if (!loaded) return;
    const supabase = supabaseRef.current;
    if (!supabase) return;

    // Verifica se WebSocket está disponível (iOS Safari pode bloquear)
    if (typeof WebSocket === "undefined") return;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    try {
      channel = supabase
        .channel("realtime-own-notifications")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications" },
          (payload) => {
            const row = payload.new as Record<string, unknown>;
            setNotifications((prev) => {
              // Evita duplicatas
              if (prev.some((n) => n.id === row.id)) return prev;
              return [
                {
                  id:         row.id as string,
                  type:       (row.type as Notification["type"]) ?? "info",
                  title:      row.title as string,
                  message:    (row.message as string) ?? "",
                  timestamp:  new Date(row.created_at as string ?? Date.now()),
                  read:       false,
                  action_url: row.action_url as string | null,
                },
                ...prev.slice(0, 49),
              ];
            });
          }
        )
        .subscribe((status, err) => {
          if (err) {
            // WebSocket indisponível — remove canal silenciosamente
            try { supabase.removeChannel(channel!); } catch { /* noop */ }
            channel = null;
          }
        });
    } catch {
      // WebSocket bloqueado pelo browser (ex: iOS Safari) — sem realtime
      channel = null;
    }

    return () => {
      if (channel) {
        try { supabase.removeChannel(channel); } catch { /* noop */ }
      }
    };
  }, [loaded]);

  return { notifications, unreadCount, dismiss, dismissAll };
}
