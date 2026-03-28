import { UsersClient } from "@/components/usuarios/users-client";
import { DEMO_USERS } from "@/lib/demo-data";

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

export default async function UsuariosPage() {
  if (IS_DEMO) {
    return <UsersClient users={DEMO_USERS as Parameters<typeof UsersClient>[0]["users"]} />;
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
  return <UsersClient users={(data ?? []) as Parameters<typeof UsersClient>[0]["users"]} />;
}
