"use client";

import { useEffect, useState } from "react";
import { UsersClient } from "@/components/usuarios/users-client";

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

export default function UsuariosPage() {
  const [users, setUsers] = useState<Parameters<typeof UsersClient>[0]["initialUsers"]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (IS_DEMO) {
      import("@/lib/demo-data").then(({ DEMO_USERS }) => {
        setUsers(DEMO_USERS as Parameters<typeof UsersClient>[0]["initialUsers"]);
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
