"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface Notification {
  id: string;
  type: "ticket" | "proposal" | "deal";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

export function useRealtimeNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (!supabaseRef.current) {
    try { supabaseRef.current = createClient(); } catch { supabaseRef.current = null; }
  }

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const dismissAll = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const supabase = supabaseRef.current;
    if (!supabase) return;

    const ticketChannel = supabase
      .channel("realtime-tickets")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "operational_tickets" },
        (payload) => {
          const row = payload.new as { id: string; title: string; priority: string; code: string };
          setNotifications((prev) => [
            {
              id: `ticket-${row.id}`,
              type: "ticket",
              title: "Novo Ticket",
              message: `${row.code}: ${row.title}`,
              timestamp: new Date(),
              read: false,
            },
            ...prev.slice(0, 19),
          ]);
        }
      )
      .subscribe();

    const proposalChannel = supabase
      .channel("realtime-proposals")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "credit_desk_proposals" },
        (payload) => {
          const row = payload.new as { id: string; title: string; code: string; client_name: string };
          setNotifications((prev) => [
            {
              id: `proposal-${row.id}`,
              type: "proposal",
              title: "Nova Proposta de Crédito",
              message: `${row.code}: ${row.client_name}`,
              timestamp: new Date(),
              read: false,
            },
            ...prev.slice(0, 19),
          ]);
        }
      )
      .subscribe();

    const dealChannel = supabase
      .channel("realtime-deals")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ma_deals" },
        (payload) => {
          const row = payload.new as { id: string; target_company: string; code: string };
          setNotifications((prev) => [
            {
              id: `deal-${row.id}`,
              type: "deal",
              title: "Novo Deal M&A",
              message: `${row.code}: ${row.target_company}`,
              timestamp: new Date(),
              read: false,
            },
            ...prev.slice(0, 19),
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ticketChannel);
      supabase.removeChannel(proposalChannel);
      supabase.removeChannel(dealChannel);
    };
  }, []);

  return { notifications, unreadCount, dismiss, dismissAll };
}
