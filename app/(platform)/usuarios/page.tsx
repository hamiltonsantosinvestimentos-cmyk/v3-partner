"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const UsersClient = dynamic(
  () => import("@/components/usuarios/users-client").then((m) => m.UsersClient),
  { ssr: false }
);

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

export default function UsuariosPage() {
  const [users, setUsers] = useState<{ id: string; email: string; full_name: string | null; role: string; phone: string | null; is_active: boolean; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (IS_DEMO) {
      import("@/lib/demo-data").then(({ DEMO_USERS }) => {
        setUsers(DEMO_USERS as typeof users);
        setLoading(false);
      });
      return;
    }

    fetch("/api/usuarios")
      .then((r) => r.json())
      .then((data) => {
        setUsers(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#C4922E] border-t-transparent" />
      </div>
    );
  }

  return <UsersClient initialUsers={users} />;
}
