import { NextResponse } from "next/server";

// Checagem única de ADMIN para /api/usuarios (GET e POST). BRIEF 2026-11-20_rls-crm-insert-e-profiles-update-own.md:
// o POST criava conta (auth.admin.createUser com a chave de serviço) para qualquer usuário logado.

export type DecisaoAdmin = { ok: true } | { ok: false; status: 401 | 403; error: string };

/** Regra pura: sem usuário = 401; papel diferente de ADMIN = 403. */
export function avaliarAcessoAdmin(userId: string | null | undefined, role: string | null | undefined): DecisaoAdmin {
  if (!userId) return { ok: false, status: 401, error: "Não autorizado" };
  if (role !== "ADMIN") return { ok: false, status: 403, error: "Acesso restrito a administradores" };
  return { ok: true };
}

/** Lê a sessão e o papel (do banco, nunca de metadata). Devolve a resposta de erro pronta quando não é ADMIN. */
export async function exigirAdmin(): Promise<{ ok: true; userId: string } | { ok: false; res: NextResponse }> {
  const { createClient, createServiceClient } = await import("@/lib/supabase/server");
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  let role: string | null = null;
  if (user) {
    const svc = await createServiceClient();
    const { data: caller } = await svc.from("profiles").select("role").eq("id", user.id).single();
    role = (caller?.role as string | null) ?? null;
  }
  const d = avaliarAcessoAdmin(user?.id, role);
  if (!d.ok) return { ok: false, res: NextResponse.json({ error: d.error }, { status: d.status }) };
  return { ok: true, userId: user!.id };
}
