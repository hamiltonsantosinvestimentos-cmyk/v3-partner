"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Users, GraduationCap } from "lucide-react";

const UsersClient = dynamic(
  () => import("@/components/usuarios/users-client").then((m) => m.UsersClient),
  { ssr: false }
);

const AdminOnboardingPanel = dynamic(
  () => import("@/components/onboarding/admin-onboarding-panel").then((m) => m.AdminOnboardingPanel),
  { ssr: false }
);

const IS_DEMO = false;

type Tab = "usuarios" | "onboarding";

export default function UsuariosPage() {
  const [users, setUsers] = useState<{ id: string; email: string; full_name: string | null; role: string; phone: string | null; document_cpf: string | null; is_active: boolean; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("usuarios");

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
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#C9A84C] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex items-center gap-1 bg-[#0D1929] border border-[#243A66] rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("usuarios")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
            ${tab === "usuarios"
              ? "bg-[#C9A84C] text-[#09081A]"
              : "text-[#7A8FA8] hover:text-[#F0ECE4]"
            }`}
        >
          <Users className="w-4 h-4" />
          Usuários
        </button>
        <button
          onClick={() => setTab("onboarding")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
            ${tab === "onboarding"
              ? "bg-[#C9A84C] text-[#09081A]"
              : "text-[#7A8FA8] hover:text-[#F0ECE4]"
            }`}
        >
          <GraduationCap className="w-4 h-4" />
          Onboarding
        </button>
      </div>

      {tab === "usuarios" && <UsersClient initialUsers={users} />}
      {tab === "onboarding" && <AdminOnboardingPanel />}
    </div>
  );
}
