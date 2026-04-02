import { UsersClient } from "@/components/usuarios/users-client";
import { DEMO_USERS } from "@/lib/demo-data";

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

export default async function UsuariosPage() {
  if (IS_DEMO) {
    return <UsersClient initialUsers={DEMO_USERS} />;
  }

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Usuarios] Supabase error:", error.message);
    }

    return <UsersClient initialUsers={(data ?? []) as Parameters<typeof UsersClient>[0]["initialUsers"]} />;
  } catch (err) {
    console.error("[Usuarios] Unexpected error:", err);
    return <UsersClient initialUsers={[]} />;
  }
}
